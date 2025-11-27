import { ETL3Orchestrator } from './orchestrator/etl-3.orchestrator.js';
import { logger } from './utils/logger.util.js';

const orchestrator = new ETL3Orchestrator();

orchestrator.execute()
  .then(() => {
    logger.info('ETL Workflow 3 completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('ETL Workflow 3 failed', error);
    process.exit(1);
  });
