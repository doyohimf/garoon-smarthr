import { ETLOrchestrator } from './orchestrator/etl.orchestrator.js';
import { ETL1Orchestrator } from './orchestrator/etl-1.orchestrator.js';
import { ETL2Orchestrator } from './orchestrator/etl-2.orchestrator.js';
import { ETL3Orchestrator } from './orchestrator/etl-3.orchestrator.js';
import { ETL4Orchestrator } from './orchestrator/etl-4.orchestrator.js';
import { ETL5Orchestrator } from './orchestrator/etl-5.orchestrator.js';
import { ETL6Orchestrator } from './orchestrator/etl-6.orchestrator.js';
import { ETL7Orchestrator } from './orchestrator/etl-7.orchestrator.js';
import { logger } from './utils/logger.util.js';

export const garoonToSmartHRETL = async (req, res) => {
  try {
    const { workflow, trigger } = req.body || {};
    
    logger.info(`Starting Garoon to SmartHR ETL process - Workflow: ${workflow}, Trigger: ${trigger}`);
    
    let orchestrator;
    let workflowName;
    
    // Route to specific workflow orchestrator
    switch (workflow) {
      case 'etl-1':
        orchestrator = new ETL1Orchestrator();
        workflowName = 'ETL Workflow 1 (New Hire)';
        break;
      case 'etl-2':
        orchestrator = new ETL2Orchestrator();
        workflowName = 'ETL Workflow 2 (Employee Changes)';
        break;
      case 'etl-3':
        orchestrator = new ETL3Orchestrator();
        workflowName = 'ETL Workflow 3 (Secondment)';
        break;
      case 'etl-4':
        orchestrator = new ETL4Orchestrator();
        workflowName = 'ETL Workflow 4 (Leave Management)';
        break;
      case 'etl-5':
        orchestrator = new ETL5Orchestrator();
        workflowName = 'ETL Workflow 5 (Allowance Management)';
        break;
      case 'etl-6':
        orchestrator = new ETL6Orchestrator();
        workflowName = 'ETL Workflow 6 (Resignation)';
        break;
      default:
        // Fallback to general orchestrator if no workflow specified
        orchestrator = new ETLOrchestrator();
        workflowName = 'General ETL Process';
        break;
    }
    
    logger.info(`Executing ${workflowName}`);
    const result = await orchestrator.execute();
    
    logger.info(`${workflowName} completed`, result);
    
    res.status(200).json({
      success: true,
      message: `${workflowName} completed successfully`,
      workflow: workflow || 'general',
      trigger: trigger || 'manual',
      data: result
    });
  } catch (error) {
    logger.error('ETL process failed', error);
    
    res.status(500).json({
      success: false,
      message: 'ETL process failed',
      workflow: req.body?.workflow || 'unknown',
      trigger: req.body?.trigger || 'unknown',
      error: error.message
    });
  }
};