import { ETL7Orchestrator } from './orchestrator/etl-7.orchestrator.js';
import { logger } from './utils/logger.util.js';

const orchestrator = new ETL7Orchestrator();

async function runETL7() {
  try {
    logger.info('Starting ETL-7: Resign Tagging Workflow');
    const result = await orchestrator.execute();
    logger.info('ETL-7 completed successfully', result);
    process.exit(0);
  } catch (error) {
    logger.error('ETL-7 failed', error);
    process.exit(1);
  }
}

runETL7();
