import { GaroonService } from '../services/garoon.service.js';
import { BigQueryService } from '../services/bigquery.service.js';
import { logger } from '../utils/logger.util.js';
import { ErrorLogger } from '../utils/error-logger.util.js';
import { RequestRouter } from '../routers/request.router.js';
import { ProcessorFactory } from '../processors/processor.factory.js';
import { GaroonToBigQueryTransformer } from '../transformers/garoon-bq.transformer.js';
import { PauseUtil } from '../utils/pause.util.js';
import { BaseOrchestrator } from './base.orchestrator.js';

const WORKFLOW_ID = 2;

export class ETL2Orchestrator extends BaseOrchestrator {
  constructor() {
    super();
    this.garoonService = new GaroonService();
    this.bigQueryService = new BigQueryService();
    this.errorLogger = new ErrorLogger();
    this.requestRouter = new RequestRouter();
    this.processorFactory = new ProcessorFactory();
    this.garoonToBQTransformer = new GaroonToBigQueryTransformer();
  }

  async processPendingEmployeeChanges() {
    try {
      logger.info('[Pre-processing] Checking for pending employee changes...');
      
      const pendingChanges = await this.bigQueryService.getPendingEmpChanges();
      
      if (pendingChanges.length === 0) {
        logger.info('[Pre-processing] No pending employee changes found for today');
        return;
      }

      logger.info(`[Pre-processing] Found ${pendingChanges.length} pending employee changes for today`);

      for (const change of pendingChanges) {
        try {
          logger.info(`[Pre-processing] Processing change for employee: ${change.employee_code}`);
          
          // Transform to format expected by processor
          const changeData = {
            emp_code: change.employee_code,
            position: change.position,
            custom_fields: this.buildCustomFieldsForChange(change)
          };

          // Process through SmartHR
          const processor = this.processorFactory.getProcessor('UNIFIED_CHANGE');
          const result = await processor.processDirectChange(changeData);

          if (result.success) {
            await this.bigQueryService.markEmpChangeProcessed(change.employee_code, change.change_date);
            logger.info(`[Pre-processing] Successfully processed change for ${change.employee_code}`);
          } else {
            logger.error(`[Pre-processing] Failed to process change for ${change.employee_code}:`, result.error);
          }

        } catch (error) {
          logger.error(`[Pre-processing] Error processing change for ${change.employee_code}:`, error);
          await this.errorLogger.logError({
            employee_code: change.employee_code,
            change_date: change.change_date,
            error: { message: error.message, stack: error.stack }
          }, 'PRE_PROCESSING_ERROR');
        }
      }

      logger.info('[Pre-processing] Completed processing pending employee changes');
    } catch (error) {
      logger.error('[Pre-processing] Failed to process pending employee changes:', error);
      throw error;
    }
  }

  buildCustomFieldsForChange(change) {
    const customFields = [];
    
    if (change.type) customFields.push({ key: 'classification', value: change.type });
    if (change.classification) customFields.push({ key: 'classification', value: change.classification });
    if (change.new_salary) customFields.push({ key: 'new_salary', value: change.new_salary.toString() });
    if (change.position_allowance) customFields.push({ key: 'position_allowance', value: change.position_allowance.toString() });
    if (change.change_date) customFields.push({ key: 'effectivity_date', value: change.change_date });
    
    if (change.custom_fields) {
      try {
        const parsedCustomFields = JSON.parse(change.custom_fields);
        if (Array.isArray(parsedCustomFields)) {
          customFields.push(...parsedCustomFields);
        }
      } catch (error) {
        logger.warn(`Failed to parse custom_fields for ${change.employee_code}:`, error);
      }
    }
    
    return customFields;
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

      // Pre-processing step: Handle pending employee changes for today
      await this.processPendingEmployeeChanges();

      while (true) {
        const requests = await this.garoonService.fetchRequestsWithDateRange(500, 1041);
        
        if (!requests || requests.length === 0) {
          logger.info('No requests found, waiting 30 seconds...');
          await new Promise(resolve => setTimeout(resolve, 30000));
          continue;
        }

        logger.info(`Fetched ${requests.length} requests from Garoon`);
        
        // TESTING: Filter to only process ID 840384 - REMOVE IN DEPLOYMENT
        // const filteredRequests = requests.filter(req => req.id === "840761"); // 840384, 840761, 840762
        // if (filteredRequests.length > 0) {
        //   logger.info(`🧪 TESTING MODE: Processing only ID 840761`);
        // } else {
        //   logger.info(`🧪 TESTING MODE: ID 840761 not found in current batch, skipping all requests`);
        //   stats.skippedRequests += requests.length;
        //   await new Promise(resolve => setTimeout(resolve, 5000));
        //   continue;
        // }
        // stats.totalRequests += filteredRequests.length;
        stats.totalRequests += requests.length;
        let batchProcessedCount = 0;
        let batchSkippedCount = 0;
        let batchErrorCount = 0;

        for (const request of requests) {
        // for (const request of filteredRequests) {
        try {
          const requestId = request.id;
          const requestName = request.name;
          const requestNumber = request.number || '';
          const createdAt = request.createdAt || new Date().toISOString();

          const exists = await this.bigQueryService.checkGaroonRequestExists(requestId, requestNumber);
          
          if (exists) {
            logger.debug(`⏭️  Skipping existing request: ${requestId}`);
            stats.skippedRequests++;
            batchSkippedCount++;
            continue;
          }

          const processorType = 'UNIFIED_CHANGE';

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
