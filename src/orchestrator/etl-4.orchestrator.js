import { GaroonService } from '../services/garoon.service.js';
import { BigQueryService } from '../services/bigquery.service.js';
import { logger } from '../utils/logger.util.js';
import { ErrorLogger } from '../utils/error-logger.util.js';
import { RequestRouter } from '../routers/request.router.js';
import { ProcessorFactory } from '../processors/processor.factory.js';
import { GaroonToBigQueryTransformer } from '../transformers/garoon-bq.transformer.js';
import { PauseUtil } from '../utils/pause.util.js';
import { LEAVE_PROCESSOR_TYPE, LEAVES_KEY_MAP } from '../config/leaves.config.js';
import { BaseOrchestrator } from './base.orchestrator.js';

const WORKFLOW_ID = 4;

export class ETL4Orchestrator extends BaseOrchestrator {
  constructor() {
    super();
    this.garoonService = new GaroonService();
    this.bigQueryService = new BigQueryService();
    this.errorLogger = new ErrorLogger();
    this.requestRouter = new RequestRouter();
    this.processorFactory = new ProcessorFactory();
    this.garoonToBQTransformer = new GaroonToBigQueryTransformer();
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
      logger.info(`[Workflow ${WORKFLOW_ID}] Starting ETL - Running with pause mechanism (max ${this.maxPauses} pauses)`);

      while (true) {
        const requests = await this.garoonService.fetchRequests(500, 1042, 'workflow_4');
        
        if (!requests || requests.length === 0) {
          logger.info('No requests found, waiting 30 seconds...');
          await new Promise(resolve => setTimeout(resolve, 30000));
          continue;
        }

        logger.info(`Fetched ${requests.length} requests from Garoon`);
        
        // TESTING: Filter to only process ID 840070 - REMOVE IN DEPLOYMENT
        const filteredRequests = requests.filter(req => req.id === "840070");
        if (filteredRequests.length > 0) {
          logger.info(`🧪 TESTING MODE: Processing only ID 840070`);
        } else {
          logger.info(`🧪 TESTING MODE: ID 840070 not found in current batch, skipping all requests`);
          stats.skippedRequests += requests.length;
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
        //stats.totalRequests += requests.length;
        stats.totalRequests += filteredRequests.length;
        let batchProcessedCount = 0;
        let batchSkippedCount = 0;
        let batchErrorCount = 0;

        //for (const request of requests) {
        for (const request of filteredRequests) {
        try {
          const requestId = request.id;
          const requestName = request.name;
          const requestNumber = request.number || '';
          const createdAt = request.createdAt || new Date().toISOString();
          const items = Array.isArray(request.items)
            ? request.items
            : Object.values(request.items || {});
          const requestType = items.find(field =>
            field.name === LEAVES_KEY_MAP['leaveType']
          )?.value;

          const exists = await this.bigQueryService.checkGaroonRequestExists(requestId, requestNumber);
          
          if (exists) {
            logger.debug(`⏭️  Skipping existing request: ${requestId}`);
            stats.skippedRequests++;
            batchSkippedCount++;
            continue;
          }
          
          const processorType = LEAVE_PROCESSOR_TYPE[requestType];

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
            batchProcessedCount++;
          } else {
            logger.error(`❌ Failed to process request ${requestId}: ${processResult.error}`);
            stats.erroredRequests++;
            batchErrorCount++;
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
          batchErrorCount++;
        }
      }

        const totalBatchProcessed = this.logBatchCompletion(
          WORKFLOW_ID, 
          batchProcessedCount, 
          batchSkippedCount, 
          batchErrorCount, 
          requests.length
        );

        // Handle pause logic using base class method
        const shouldExit = await this.handlePauseLogic(totalBatchProcessed, requests.length, WORKFLOW_ID);
        if (shouldExit) {
          break;
        }
      }

      this.logFinalCompletion(WORKFLOW_ID, stats);

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

      if (transferStatus === 'ERROR') {
        return {
          success: false,
          error: 'Processing failed with ERROR status',
          requestId,
          requestName,
          processorType
        };
      }

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
      const resolvedType = processorType === 'LEAVE_RETURN'
        ? (this.determineLeaveReturnSubtype(bqData) || 'LEAVE')
        : processorType;

      if (processorType === 'LEAVE_RETURN') {
        logger.info(`Resolved LEAVE_RETURN subtype as ${resolvedType} for request ${requestId}`);
      }

      const processor = this.processorFactory.getProcessor(resolvedType);
      
      if (!processor) {
        throw new Error(`No processor found for type: ${resolvedType}`);
      }

      let result;
      if (resolvedType === 'LEAVE') {
        result = await processor.processLeave(bqData);
      } else if (resolvedType === 'RETURN') {
        result = await processor.processReturnLeave(bqData);
      } else {
        result = await processor.process(bqData);
      }

      if (result?.success || (result?.successful && result.successful > 0)) {
        logger.info(`Employee change processed successfully for request ${requestId}`);
        return 'COMPLETED';
      }

      logger.error(`Employee change processing failed for request ${requestId}`);
      
      await this.errorLogger.logProcessorError(
        resolvedType,
        requestId,
        new Error(result?.error || 'Processing failed'),
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

    } catch (error) {
      logger.error(`Failed to process employee change for request ${requestId}`, error);
      
      await this.errorLogger.logProcessorError(
        processorType === 'LEAVE_RETURN' ? 'LEAVE_RETURN' : processorType,
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

  determineLeaveReturnSubtype(bqData) {
    const requestName = (bqData.request?.request_name || '').toLowerCase();
    if (requestName.includes('復職')) return 'RETURN';
    if (requestName.includes('復帰')) return 'RETURN';
    if (requestName.includes('休業')) return 'LEAVE';
    if (requestName.includes('休職')) return 'LEAVE';

    for (const field of bqData.formFields || []) {
      const fieldValue = (field.field_value || '').toLowerCase();
      if (fieldValue.includes('復職') || fieldValue.includes('復帰')) return 'RETURN';
      if (fieldValue.includes('休業') || fieldValue.includes('休職')) return 'LEAVE';
    }

    logger.warn('Unable to determine subtype for LEAVE_RETURN request, defaulting to LEAVE');
    return null;
  }
}
