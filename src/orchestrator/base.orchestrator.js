import { logger } from '../utils/logger.util.js';

export class BaseOrchestrator {
  constructor() {
    this.pauseCount = 0;
    this.maxPauses = 3;
    this.pauseDuration = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
  }

  /**
   * Handle pause logic for ETL workflows
   * @param {number} totalBatchProcessed - Total rows processed (processed + skipped)
   * @param {number} totalRequests - Total fetched requests
   * @param {number} workflowId - Workflow ID for logging
   * @returns {boolean} - Returns true if should exit, false if should continue
   */
  async handlePauseLogic(totalBatchProcessed, totalRequests, workflowId) {
    // Check if all fetched rows were accounted for (processed + skipped)
    if (totalBatchProcessed === totalRequests) {
      if (this.pauseCount >= this.maxPauses) {
        logger.info(`🛑 Maximum pause count (${this.maxPauses}) reached. Exiting ETL run.`);
        return true; // Exit
      }
      
      this.pauseCount++;
      const pauseHours = this.pauseDuration / (60 * 60 * 1000);
      logger.info(`⏸️  All ${totalRequests} rows accounted for. Pausing for ${pauseHours} hours (pause ${this.pauseCount}/${this.maxPauses})`);
      
      await new Promise(resolve => setTimeout(resolve, this.pauseDuration));
      
      logger.info(`▶️  Resuming ETL after ${pauseHours}-hour pause`);
    } else {
      // Reset pause count if we had unprocessed rows
      if (this.pauseCount > 0) {
        logger.info(`🔄 Unprocessed rows detected, resetting pause count`);
        this.pauseCount = 0;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    return false; // Continue
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
    logger.info(`[Workflow ${workflowId}] ETL run completed after ${this.pauseCount} pauses`, stats);
  }
}