import { ETL1Orchestrator } from './orchestrator/etl-1.orchestrator.js';
import { logger } from './utils/logger.util.js';

const orchestrator = new ETL1Orchestrator();

orchestrator.execute()
  .then(() => {
    logger.info('ETL Workflow 1 completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('ETL Workflow 1 failed', error);
    process.exit(1);
  });
