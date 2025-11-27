import { ETLOrchestrator } from './orchestrator/etl.orchestrator.js';
import { logger } from './utils/logger.util.js';

export const garoonToSmartHRETL = async (req, res) => {
  try {
    logger.info('Starting Garoon to SmartHR ETL process');
    
    const orchestrator = new ETLOrchestrator();
    const result = await orchestrator.execute();
    
    logger.info('ETL process completed', result);
    
    res.status(200).json({
      success: true,
      message: 'ETL process completed successfully',
      data: result
    });
  } catch (error) {
    logger.error('ETL process failed', error);
    
    res.status(500).json({
      success: false,
      message: 'ETL process failed',
      error: error.message
    });
  }
};