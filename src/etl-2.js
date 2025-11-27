import { ETL2Orchestrator } from './orchestrator/etl-2.orchestrator.js';
import { logger } from './utils/logger.util.js';

const orchestrator = new ETL2Orchestrator();

orchestrator.execute()
  .then(() => {
    logger.info('ETL Workflow 2 completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('ETL Workflow 2 failed', error);
    process.exit(1);
  });
