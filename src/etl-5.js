import { ETL5Orchestrator } from './orchestrator/etl-5.orchestrator.js';
import { logger } from './utils/logger.util.js';

const orchestrator = new ETL5Orchestrator();

orchestrator.execute()
  .then(() => {
    logger.info('ETL Workflow 5 completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('ETL Workflow 5 failed', error);
    process.exit(1);
  });
