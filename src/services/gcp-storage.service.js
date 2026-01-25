import { Storage } from '@google-cloud/storage';
import { env } from '../config/environment.js';
import { logger } from '../utils/logger.util.js';

export class GCPStorageService {
  constructor() {
    this.storageClient = null;
    this.bucket = null;
    this.bucketName = env.GCS_BUCKET_NAME || 'jc-etl-tracking';
    this.workflowPrefix = 'workflow-starting-points';
    this.useGCP = env.NODE_ENV === 'production';
    this.initializeGCPClient();
  }

  /**
   * Initialize Google Cloud Storage client
   */
  initializeGCPClient() {
    try {
      if (!this.useGCP) {
        logger.debug('Using local file storage for workflow starting points');
        return;
      }

      this.storageClient = new Storage({
        projectId: env.GCP_PROJECT_ID,
        keyFilename: env.GCP_CREDENTIALS_PATH
      });

      this.bucket = this.storageClient.bucket(this.bucketName);
      logger.info('GCP Storage client initialized for workflow starting points', {
        bucket: this.bucketName,
        prefix: this.workflowPrefix
      });
    } catch (error) {
      logger.warn('Failed to initialize GCP Storage client for workflow starting points', error);
      this.useGCP = false;
    }
  }

  /**
   * Check if a workflow starting point file exists
   * @param {number|string} workflowId - The workflow ID
   * @returns {Promise<boolean>}
   */
  async workflowStartingPointExists(workflowId) {
    try {
      if (!this.useGCP) {
        return await this.localStartingPointExists(workflowId);
      }

      const filename = this.getStartingPointFilename(workflowId);
      const filepath = `${this.workflowPrefix}/${filename}`;
      const file = this.bucket.file(filepath);
      
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      logger.error(`Error checking if workflow ${workflowId} starting point exists`, error);
      return false;
    }
  }

  /**
   * Create a new workflow starting point file
   * @param {number|string} workflowId - The workflow ID
   * @param {Date} launchDate - The launch date (defaults to current date)
   * @returns {Promise<Object>} The created starting point data
   */
  async createWorkflowStartingPoint(workflowId, launchDate = new Date()) {
    try {
      const startingPointData = {
        date_launched: launchDate.toISOString()
      };

      if (!this.useGCP) {
        return await this.createLocalStartingPoint(workflowId, startingPointData);
      }

      const filename = this.getStartingPointFilename(workflowId);
      const filepath = `${this.workflowPrefix}/${filename}`;
      const file = this.bucket.file(filepath);

      await file.save(JSON.stringify(startingPointData, null, 2), {
        metadata: {
          contentType: 'application/json'
        }
      });

      logger.info(`Workflow ${workflowId} starting point created`, {
        filepath: `gs://${this.bucketName}/${filepath}`,
        dateLaunched: startingPointData.date_launched
      });

      return startingPointData;
    } catch (error) {
      logger.error(`Error creating workflow ${workflowId} starting point`, error);
      throw error;
    }
  }

  /**
   * Read workflow starting point data
   * @param {number|string} workflowId - The workflow ID
   * @returns {Promise<Object|null>} The starting point data or null if not found
   */
  async readWorkflowStartingPoint(workflowId) {
    try {
      if (!this.useGCP) {
        return await this.readLocalStartingPoint(workflowId);
      }

      const filename = this.getStartingPointFilename(workflowId);
      const filepath = `${this.workflowPrefix}/${filename}`;
      const file = this.bucket.file(filepath);

      const [content] = await file.download();
      const startingPointData = JSON.parse(content.toString('utf-8'));

      logger.debug(`Read workflow ${workflowId} starting point`, {
        dateLaunched: startingPointData.date_launched
      });

      return startingPointData;
    } catch (error) {
      if (error.code === 404) {
        logger.debug(`Workflow ${workflowId} starting point not found`);
        return null;
      }
      logger.error(`Error reading workflow ${workflowId} starting point`, error);
      throw error;
    }
  }

  /**
   * Get or create workflow starting point
   * @param {number|string} workflowId - The workflow ID
   * @returns {Promise<Object>} The starting point data
   */
  async getOrCreateWorkflowStartingPoint(workflowId) {
    try {
      // Check if starting point exists
      const exists = await this.workflowStartingPointExists(workflowId);
      
      if (exists) {
        return await this.readWorkflowStartingPoint(workflowId);
      }

      // Create new starting point
      return await this.createWorkflowStartingPoint(workflowId);
    } catch (error) {
      logger.error(`Error getting or creating workflow ${workflowId} starting point`, error);
      throw error;
    }
  }

  /**
   * Generate filename for workflow starting point
   * @param {number|string} workflowId - The workflow ID
   * @returns {string}
   */
  getStartingPointFilename(workflowId) {
    return `workflow_${workflowId}_startoff_point.json`;
  }

  // Local storage fallback methods for development

  /**
   * Check if local starting point file exists
   * @param {number|string} workflowId - The workflow ID
   * @returns {Promise<boolean>}
   */
  async localStartingPointExists(workflowId) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const localDir = path.join(process.cwd(), 'data', 'workflow-starting-points');
      const filename = this.getStartingPointFilename(workflowId);
      const filepath = path.join(localDir, filename);
      
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create local starting point file
   * @param {number|string} workflowId - The workflow ID
   * @param {Object} startingPointData - The starting point data
   * @returns {Promise<Object>}
   */
  async createLocalStartingPoint(workflowId, startingPointData) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const localDir = path.join(process.cwd(), 'data', 'workflow-starting-points');
      await fs.mkdir(localDir, { recursive: true });
      
      const filename = this.getStartingPointFilename(workflowId);
      const filepath = path.join(localDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(startingPointData, null, 2));
      
      logger.info(`Local workflow ${workflowId} starting point created`, {
        filepath,
        dateLaunched: startingPointData.date_launched
      });
      
      return startingPointData;
    } catch (error) {
      logger.error(`Error creating local workflow ${workflowId} starting point`, error);
      throw error;
    }
  }

  /**
   * Read local starting point file
   * @param {number|string} workflowId - The workflow ID
   * @returns {Promise<Object|null>}
   */
  async readLocalStartingPoint(workflowId) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const localDir = path.join(process.cwd(), 'data', 'workflow-starting-points');
      const filename = this.getStartingPointFilename(workflowId);
      const filepath = path.join(localDir, filename);
      
      const content = await fs.readFile(filepath, 'utf-8');
      const startingPointData = JSON.parse(content);
      
      logger.debug(`Read local workflow ${workflowId} starting point`, {
        dateLaunched: startingPointData.date_launched
      });
      
      return startingPointData;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.debug(`Local workflow ${workflowId} starting point not found`);
        return null;
      }
      logger.error(`Error reading local workflow ${workflowId} starting point`, error);
      throw error;
    }
  }
}
