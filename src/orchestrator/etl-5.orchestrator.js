import { GaroonService } from '../services/garoon.service.js';
import { BigQueryService } from '../services/bigquery.service.js';
import { logger } from '../utils/logger.util.js';
import { ErrorLogger } from '../utils/error-logger.util.js';
import { RequestRouter } from '../routers/request.router.js';
import { ProcessorFactory } from '../processors/processor.factory.js';
import { GaroonToBigQueryTransformer } from '../transformers/garoon-bq.transformer.js';
import { PauseUtil } from '../utils/pause.util.js';
import { AllowanceBatchProcessingService } from '../services/allowance-batch-processing.service.js';

const WORKFLOW_ID = 5;

export class ETL5Orchestrator {
  constructor() {
    this.garoonService = new GaroonService();
    this.bigQueryService = new BigQueryService();
    this.errorLogger = new ErrorLogger();
    this.requestRouter = new RequestRouter();
    this.processorFactory = new ProcessorFactory();
    this.garoonToBQTransformer = new GaroonToBigQueryTransformer();
    this.allowanceBatchProcessingService = new AllowanceBatchProcessingService();
  }

  async execute() {
    const startTime = new Date().toISOString();
    const stats = {
      totalRequests: 0,
      processedRequests: 0,
      skippedRequests: 0,
      erroredRequests: 0,
      startTime
    };

    try {
      logger.info(`[Workflow ${WORKFLOW_ID}] Starting ETL - Running indefinitely`);

      while (true) {
        // PREPROCESSING STEP: Check for deferred allowances to process
        try {
          logger.info('═══════════════════════════════════════════════════════');
          logger.info('🔄 [PREPROCESSING] Checking for deferred allowances...');
          const preprocessingResult = await this.allowanceBatchProcessingService.processDeferredAllowances();
          logger.info(`✨ [PREPROCESSING] Result: ${JSON.stringify(preprocessingResult)}`);
          logger.info('═══════════════════════════════════════════════════════');
        } catch (error) {
          logger.error('[PREPROCESSING] Error during batch processing', error);
          await this.errorLogger.logError(
            {
              error: {
                message: error.message,
                stack: error.stack
              }
            },
            'PREPROCESSING_ERROR'
          );
        }

        // Fetch new requests from Garoon with workflow-based date range
        const requests = await this.garoonService.fetchRequests(500, 1044, 'workflow_5');
        
        if (!requests || requests.length === 0) {
          logger.info('No requests found, waiting 30 seconds...');
          await new Promise(resolve => setTimeout(resolve, 30000));
          continue;
        }

        logger.info(`Fetched ${requests.length} requests from Garoon`);
        
        // TESTING: Filter to only process ID 840067 - REMOVE IN DEPLOYMENT
        const filteredRequests = requests.filter(req => req.id === "840764"); //840764 840067
        if (filteredRequests.length > 0) {
          logger.info(`🧪 TESTING MODE: Processing only ID 840764`);
        } else {
          logger.info(`🧪 TESTING MODE: ID 840764 not found in current batch, skipping all requests`);
          stats.skippedRequests += requests.length;
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
        //stats.totalRequests += requests.length;
        stats.totalRequests += filteredRequests.length;
        //for (const request of requests) {
        for (const request of filteredRequests) {
        try {
          const requestId = request.id;
          const requestName = request.name;
          const requestNumber = request.number || '';
          const createdAt = request.createdAt || new Date().toISOString();

          const exists = await this.bigQueryService.checkGaroonRequestExists(requestId, requestNumber);
          
          if (exists) {
            logger.debug(`⏭️  Skipping existing request: ${requestId}`);
            stats.skippedRequests++;
            continue;
          }

          const processorType = 'ALLOWANCE_CHANGE';

          logger.info(`✅ Found processable request: ${requestName} → ${processorType}`);

          const processResult = await this.processRequest(request, processorType, requestId);
          
          if (processResult.success) {
            logger.info(`🎉 Successfully processed request ${requestId}`);
            await this.bigQueryService.insertGaroonRequest({
              id: `${requestId}_${Date.now()}`,
              request_id: requestId,
              request_number: requestNumber,
              status: 'COMPLETED',
              workflow: WORKFLOW_ID,
              garoon_request_create_date: createdAt,
              etl_updated_date: new Date().toISOString(),
              etl_extracted_date: new Date().toISOString()
            });
            stats.processedRequests++;
          } else {
            logger.error(`❌ Failed to process request ${requestId}: ${processResult.error}`);
            stats.erroredRequests++;
          }

        } catch (error) {
          logger.error(`Error processing request ${request.id}`, error);
          
          await this.errorLogger.logError(
            {
              requestId: request.id,
              error: {
                message: error.message,
                stack: error.stack
              }
            },
            'ETL_EXECUTION'
          );
          
          stats.erroredRequests++;
        }
      }

        logger.info(`[Workflow ${WORKFLOW_ID}] Batch completed`, stats);
        await new Promise(resolve => setTimeout(resolve, 5000));
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

  async processRequest(request, processorType, requestId) {
    const requestName = request.name;

    try {
      logger.info(`Processing request ID: ${requestId}, Name: ${requestName}, Type: ${processorType}`);

      const bqData = await this.garoonToBQTransformer.transform(request);

      const transferStatus = await this.processEmployeeChange(bqData, processorType, requestId);

      if (transferStatus && typeof transferStatus === 'object' && transferStatus.error) {
        await this.errorLogger.logRequestError(
          requestId,
          requestName,
          transferStatus.errorObj || new Error(transferStatus.error),
          {
            processorType,
            workflow: WORKFLOW_ID
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

      if (transferStatus === 'ERROR') {
        return {
          success: false,
          error: 'Processing failed with ERROR status',
          requestId,
          requestName,
          processorType
        };
      }

      return {
        success: true,
        requestId,
        requestName,
        processorType,
        transferStatus,
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
          workflow: WORKFLOW_ID
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

  async processEmployeeChange(bqData, processorType, requestId) {
    try {
      const processor = this.processorFactory.getProcessor(processorType);
      
      if (!processor) {
        throw new Error(`No processor found for type: ${processorType}`);
      }

      const result = await processor.process(bqData);

      if (result.success || (result.successful && result.successful > 0)) {
        logger.info(`Employee change processed successfully for request ${requestId}`);
        return 'COMPLETED';
      } else {
        logger.error(`Employee change processing failed for request ${requestId}`);
        
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
