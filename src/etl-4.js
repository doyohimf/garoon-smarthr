import { ETL4Orchestrator } from './orchestrator/etl-4.orchestrator.js';
import { logger } from './utils/logger.util.js';

const orchestrator = new ETL4Orchestrator();

orchestrator.execute()
  .then(() => {
    logger.info('ETL Workflow 4 completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('ETL Workflow 4 failed', error);
    process.exit(1);
  });
