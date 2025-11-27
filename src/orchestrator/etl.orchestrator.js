import { GaroonService } from '../services/garoon.service.js';
import { BigQueryService } from '../services/bigquery.service.js';
import { BigQueryMockService } from '../services/bigquery-mock.service.js';
import { SmartHRService } from '../services/smarthr.service.js';
import { GaroonToBigQueryTransformer } from '../transformers/garoon-bq.transformer.js';
import { GaroonToSmartHRTransformer } from '../transformers/garoon-smarthr.transformer.js';
import { OffsetTracker } from '../utils/offset-tracker.util.js';
import { OffsetTrackerLocal } from '../utils/offset-tracker-local.util.js';
import { RetryUtil } from '../utils/retry.util.js';
import { logger } from '../utils/logger.util.js';
import { ErrorLogger } from '../utils/error-logger.util.js';
import { RequestRouter } from '../routers/request.router.js';
import { ProcessorFactory } from '../processors/processor.factory.js';

const isLocal = process.env.NODE_ENV === 'local' || !process.env.GCP_PROJECT_ID;

export class ETLOrchestrator {
  constructor() {
    this.garoonService = new GaroonService();
    this.bigQueryService = isLocal ? new BigQueryMockService() : new BigQueryService();
    this.smartHRService = new SmartHRService();
    this.garoonToBQTransformer = new GaroonToBigQueryTransformer();
    this.garoonToSHRTransformer = new GaroonToSmartHRTransformer();
    this.offsetTracker = isLocal ? new OffsetTrackerLocal() : new OffsetTracker();
    this.retryUtil = new RetryUtil();
    this.errorLogger = new ErrorLogger();
    this.requestRouter = new RequestRouter();
    this.processorFactory = new ProcessorFactory();
    
    if (isLocal) {
      logger.info('🧪 Running in LOCAL mode with mock BigQuery');
    }
  }

  async execute() {
    const startTime = new Date().toISOString();
    const stats = {
      totalRequests: 0,
      totalFormFields: 0,
      totalSteps: 0,
      totalProcessors: 0,
      batches: 0,
      skippedRequests: 0,
      erroredRequests: 0,
      startTime
    };

    try {
      const initialOffset = await this.offsetTracker.getOffset();
      logger.info(`Starting ETL at offset: ${initialOffset}`);

      let currentOffset = initialOffset;
      let request = null;
      let processorType = null;

      // Keep fetching until we find a successfully processed request
      while (true) {
        try {
          request = await this.fetchValidRequest(currentOffset);
          
          if (!request) {
            logger.warn(`No valid request found at offset ${currentOffset}`);
            currentOffset++;
            continue;
          }

          const requestId = request.id;
          const requestName = request.name;
          logger.info(`Checking request at offset ${currentOffset}: ${requestName}`);

          // Check if request can be routed to a processor
          processorType = this.requestRouter.route(request);
          
          if (!processorType) {
            logger.info(`⏭️  Skipping unrecognized request: ${requestName}`);
            stats.skippedRequests++;
            currentOffset++;
            await this.offsetTracker.updateOffset(currentOffset, stats);
            continue;
          }

          logger.info(`✅ Found processable request: ${requestName} → ${processorType}`);

          // Try to process this request
          const processResult = await this.processRequest(request, processorType, currentOffset, stats);
          
          if (processResult.success) {
            // Successfully processed, continue to next request
            logger.info(`🎉 Successfully processed request ${requestId}`);
            currentOffset++;
            await this.offsetTracker.updateOffset(currentOffset, stats);
            continue;
          } else {
            // Processing failed, continue to next request
            logger.error(`❌ Failed to process request ${requestId}: ${processResult.error}`);
            
            stats.erroredRequests++;
            currentOffset++;
            await this.offsetTracker.updateOffset(currentOffset, stats);
            continue;
          }

        } catch (error) {
          logger.error(`Error processing request at offset ${currentOffset}`, error);
          
          await this.errorLogger.logError(
            {
              offset: currentOffset,
              error: {
                message: error.message,
                stack: error.stack
              }
            },
            'ETL_EXECUTION'
          );
          
          stats.erroredRequests++;
          currentOffset++;
          await this.offsetTracker.updateOffset(currentOffset, stats);
          continue;
        }
      }



    } catch (error) {
      logger.error('ETL execution failed', error);
      await this.errorLogger.logError(
        {
          error: {
            message: error.message,
            stack: error.stack
          },
          stats
        },
        'ETL_CRITICAL'
      );
      throw error;
    }
  }

  /**
   * Process a single request
   */
  async processRequest(request, processorType, currentOffset, stats) {
    const requestId = request.id;
    const requestName = request.name;

    try {
      logger.info(`Processing request ID: ${requestId}, Name: ${requestName}, Type: ${processorType}`);

      const bqData = await this.garoonToBQTransformer.transform(request);
      
      let transferStatus = 'COMPLETED';
      
      if (processorType === 'NEW_HIRE') {
        transferStatus = await this.processNewHire(request, requestId);
      } else {
        transferStatus = await this.processEmployeeChange(bqData, processorType, requestId);
      }

      // Check if processing returned error object instead of string
      if (transferStatus && typeof transferStatus === 'object' && transferStatus.error) {
        await this.errorLogger.logRequestError(
          requestId,
          requestName,
          transferStatus.errorObj || new Error(transferStatus.error),
          {
            processorType,
            offset: currentOffset,
            stats
          },
          request
        );
        return {
          success: false,
          error: transferStatus.error,
          requestId,
          requestName,
          processorType
        };
      }

      // Check if processing was successful (string 'ERROR')
      if (transferStatus === 'ERROR') {
        return {
          success: false,
          error: 'Processing failed with ERROR status',
          requestId,
          requestName,
          processorType
        };
      }

      // Step 3: Update offset tracker (move to next request)
      await this.offsetTracker.updateOffset(currentOffset + 1, stats);

      stats.batches = 1;
      
      return {
        success: true,
        requestId,
        requestName,
        processorType,
        transferStatus,
        stats,
        initialOffset: currentOffset,
        finalOffset: currentOffset + 1,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Failed to process request ${requestId}`, error);
      
      await this.errorLogger.logRequestError(
        requestId,
        requestName,
        error,
        {
          processorType,
          offset: currentOffset
        },
        request
      );
      
      return {
        success: false,
        error: error.message,
        requestId,
        requestName,
        processorType
      };
    }
  }

  async fetchValidRequest(offset) {
    let currentOffset = offset;
    let attempts = 0;

    while (true) {
      try {
        logger.info(`Fetching request at offset: ${currentOffset}`);
        const request = await this.garoonService.fetchRequest(currentOffset);

        if (!request || !request.items) {
          logger.warn(`No request found at offset ${currentOffset}`);
          currentOffset++;
          attempts++;
          continue;
        }

        // Check if fullName (よみがな) is not null (only for NEW_HIRE requests)
        const fullNameField = Object.values(request.items).find(
          item => item.name === 'よみがな'
        );

        // For NEW_HIRE requests, fullName must exist
        // For other requests, we don't need to check fullName
        const processorType = this.requestRouter.route(request);
        
        if (processorType === 'NEW_HIRE') {
          if (fullNameField && fullNameField.value) {
            logger.info(`Valid NEW_HIRE request found at offset: ${currentOffset}`);
            await this.offsetTracker.setCurrentOffset(currentOffset);
            return request;
          } else {
            logger.info(`Skipping NEW_HIRE request at offset ${currentOffset} - fullName is null`);
            currentOffset++;
            attempts++;
            continue;
          }
        } else {
          // For non-NEW_HIRE requests, no need to check fullName
          logger.info(`Valid ${processorType} request found at offset: ${currentOffset}`);
          await this.offsetTracker.setCurrentOffset(currentOffset);
          return request;
        }

      } catch (error) {
        logger.error(`Error fetching request at offset ${currentOffset}`, error);
        currentOffset++;
        attempts++;
      }
    }
  }

  async transferToSmartHR(smartHRData, requestId) {
    try {
      const result = await this.retryUtil.executeWithRetry(
        async () => {
          const response = await this.smartHRService.createCrew(smartHRData);
          
          // Verify creation
          if (!response || !response.id) {
            throw new Error('SmartHR crew creation failed - no ID returned');
          }

          logger.info(`SmartHR crew created successfully: ${response.id}`);
          return response;
        },
        3,
        1000
      );

      return 'COMPLETED';
    } catch (error) {
      logger.error(`Failed to transfer to SmartHR for request ${requestId}`, error);
      return {
        error: error.message,
        errorObj: error
      };
    }
  }

  /**
   * Process new hire request (existing flow)
   */
  async processNewHire(request, requestId) {
    try {
      const smartHRData = await this.garoonToSHRTransformer.transform(request);
      return await this.transferToSmartHR(smartHRData, requestId);
    } catch (error) {
      logger.error(`Failed to process new hire for request ${requestId}`, error);
      return {
        error: error.message,
        errorObj: error
      };
    }
  }

  /**
   * Process employee change request (using processors)
   */
  async processEmployeeChange(bqData, processorType, requestId) {
    try {
      // Get appropriate processor
      const processor = this.processorFactory.getProcessor(processorType);
      
      if (!processor) {
        throw new Error(`No processor found for type: ${processorType}`);
      }

      // Process based on type
      let result;
      if (processorType === 'LEAVE') {
        result = await processor.processLeave(bqData);
      } else if (processorType === 'RETURN') {
        result = await processor.processReturnLeave(bqData);
      } else if (processorType === 'UNIFIED_CHANGE') {
        result = await processor.process(bqData);
      } else {
        result = await processor.process(bqData);
      }

      // Check if processing was successful
      if (result.success || (result.successful && result.successful > 0)) {
        logger.info(`Employee change processed successfully for request ${requestId}`);
        return 'COMPLETED';
      } else {
        logger.error(`Employee change processing failed for request ${requestId}`);
        
        // Log detailed error
        await this.errorLogger.logProcessorError(
          processorType,
          requestId,
          new Error(result.error || 'Processing failed'),
          {
            result,
            bqData: {
              requestId: bqData.request?.request_id,
              formFieldsCount: bqData.formFields?.length
            }
          },
          bqData
        );
        
        return 'ERROR';
      }

    } catch (error) {
      logger.error(`Failed to process employee change for request ${requestId}`, error);
      
      await this.errorLogger.logProcessorError(
        processorType,
        requestId,
        error,
        {
          bqData: {
            requestId: bqData.request?.request_id,
            formFieldsCount: bqData.formFields?.length
          }
        },
        bqData
      );
      
      return {
        error: error.message,
        errorObj: error
      };
    }
  }
}
