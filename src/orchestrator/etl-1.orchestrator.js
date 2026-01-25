import { GaroonService } from '../services/garoon.service.js';
import { BigQueryService } from '../services/bigquery.service.js';
import { SmartHRService } from '../services/smarthr.service.js';
import { GaroonToSmartHRTransformer } from '../transformers/garoon-smarthr.transformer.js';
import { RetryUtil } from '../utils/retry.util.js';
import { logger } from '../utils/logger.util.js';
import { ErrorLogger } from '../utils/error-logger.util.js';
import { RequestRouter } from '../routers/request.router.js';
import { PauseUtil } from '../utils/pause.util.js';
import { BaseOrchestrator } from './base.orchestrator.js';

const WORKFLOW_ID = 1;

export class ETL1Orchestrator extends BaseOrchestrator {
  constructor() {
    super();
    this.garoonService = new GaroonService();
    this.bigQueryService = new BigQueryService();
    this.smartHRService = new SmartHRService();
    this.garoonToSHRTransformer = new GaroonToSmartHRTransformer();
    this.retryUtil = new RetryUtil();
    this.errorLogger = new ErrorLogger();
    this.requestRouter = new RequestRouter();
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
        const requests = await this.garoonService.fetchRequests(500, 1032, 'workflow_1');
        
        if (!requests || requests.length === 0) {
          logger.info('No requests found, waiting 30 seconds...');
          await new Promise(resolve => setTimeout(resolve, 30000));
          continue;
        }

        logger.info(`Fetched ${requests.length} requests from Garoon`);
        
        // TESTING: Filter to only process ID 840383 - REMOVE IN DEPLOYMENT
        const filteredRequests = requests.filter(req => req.id === '840383'); //840383 is example ID-- 840895
        if (filteredRequests.length > 0) {
          logger.info(`🧪 TESTING MODE: Processing only ID 840383`);
        } else {
          logger.info(`🧪 TESTING MODE: ID 840383 not found in current batch, skipping all requests`);
          stats.skippedRequests += requests.length;
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        // stats.totalRequests += requests.length;
        stats.totalRequests += filteredRequests.length;
        let batchProcessedCount = 0;
        let batchSkippedCount = 0;
        let batchErrorCount = 0;
        
        // for (const request of requests) {
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
            batchSkippedCount++;
            continue;
          }

          //console.log(JSON.stringify(request.steps, null, 2));
          const processorType = 'NEW_HIRE';

          const fullNameField = Object.values(request.items).find(
            item => item.name === 'よみがな'
          );

          if (!fullNameField || !fullNameField.value) {
            logger.debug(`⏭️  Skipping NEW_HIRE request ${requestId} - fullName is null`);
            stats.skippedRequests++;
            batchSkippedCount++;
            continue;
          }

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
          } else if (processResult.skipCreation) {
            // Employee already exists in SmartHR - log as completed but with warning
            logger.warn(`🔄 Request ${requestId} processed with warning: ${processResult.error}`);
            
            await this.bigQueryService.insertGaroonRequest({
              id: `${requestId}_${Date.now()}`,
              request_id: requestId,
              request_number: requestNumber,
              status: 'COMPLETED_EXISTING',
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

      const transferStatus = await this.processNewHire(request, requestId);

      if (transferStatus === 'ERROR') {
        return {
          success: false,
          error: 'Processing failed with ERROR status',
          requestId,
          requestName,
          processorType
        };
      }

      if (transferStatus && typeof transferStatus === 'object') {
        if (transferStatus.skipCreation) {
          // Employee already exists in SmartHR
          return {
            success: false,
            skipCreation: true,
            error: transferStatus.error,
            requestId,
            requestName,
            processorType
          };
        }
        
        if (transferStatus.error) {
          // Other error occurred
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
      }      return {
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

  async transferToSmartHR(smartHRData, requestId) {
    try {
      // Check if employee already exists in SmartHR
      const empCode = smartHRData.emp_code;
      if (empCode) {
        logger.info(`Checking if employee ${empCode} already exists in SmartHR`);
        const existingEmployee = await this.smartHRService.repository.getCrewByCode(empCode);
        
        if (existingEmployee) {
          logger.warn(`Employee ${empCode} already exists in SmartHR (ID: ${existingEmployee.id}). Skipping creation.`);
          return {
            error: `Employee code ${empCode} already exists in SmartHR`,
            errorObj: new Error(`Employee code ${empCode} already exists in SmartHR`),
            skipCreation: true
          };
        }
      }

      const result = await this.retryUtil.executeWithRetry(
        async () => {
          const response = await this.smartHRService.createCrew(smartHRData);
          
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
}
