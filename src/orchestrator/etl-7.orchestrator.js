import { ResignTaggingProcessor } from '../processors/resign-tagging.processor.js';
import { logger } from '../utils/logger.util.js';
import { ErrorLogger } from '../utils/error-logger.util.js';

const WORKFLOW_ID = 7;

export class ETL7Orchestrator {
  constructor() {
    this.resignTaggingProcessor = new ResignTaggingProcessor();
    this.errorLogger = new ErrorLogger();
  }

  /**
   * Execute the resign tagging workflow
   * Runs once per execution (not a continuous loop like other workflows)
   */
  async execute() {
    const executionStart = new Date().toISOString();

    try {
      logger.info(`[Workflow ${WORKFLOW_ID}] Starting Resign Tagging ETL`);

      const stats = await this.resignTaggingProcessor.execute();

      logger.info(`[Workflow ${WORKFLOW_ID}] Resign Tagging completed successfully`, {
        ...stats,
        executionStart,
        executionEnd: new Date().toISOString()
      });

      return {
        success: true,
        workflow: WORKFLOW_ID,
        stats,
        executionStart,
        executionEnd: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`[Workflow ${WORKFLOW_ID}] Resign Tagging ETL failed`, error);

      await this.errorLogger.logError(
        {
          workflow: WORKFLOW_ID,
          error: {
            message: error.message,
            stack: error.stack
          },
          executionStart
        },
        'RESIGN_TAGGING_FAILURE'
      );

      throw error;
    }
  }
}
