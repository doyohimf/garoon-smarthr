import { logger } from '../utils/logger.util.js';

export class BaseOrchestrator {
  constructor() {
    // Base orchestrator for ETL workflows
  }



  /**
   * Log batch completion with detailed stats
   */
  logBatchCompletion(workflowId, batchProcessedCount, batchSkippedCount, batchErrorCount, totalRequests) {
    const totalBatchProcessed = batchProcessedCount + batchSkippedCount;
    logger.info(`[Workflow ${workflowId}] Batch completed: ${totalBatchProcessed}/${totalRequests} rows accounted for`, {
      processed: batchProcessedCount,
      skipped: batchSkippedCount,
      errors: batchErrorCount,
      total: totalRequests
    });
    return totalBatchProcessed;
  }

  /**
   * Log final completion stats
   */
  logFinalCompletion(workflowId, stats) {
    logger.info(`[Workflow ${workflowId}] ETL run completed`, stats);
  }
}