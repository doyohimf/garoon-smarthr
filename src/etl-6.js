import { ETL6Orchestrator } from './orchestrator/etl-6.orchestrator.js';
import { logger } from './utils/logger.util.js';

const orchestrator = new ETL6Orchestrator();

orchestrator.execute()
  .then(() => {
    logger.info('ETL Workflow 6 completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('ETL Workflow 6 failed', error);
    process.exit(1);
  });
