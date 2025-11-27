import fs from 'fs/promises';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import { logger } from './logger.util.js';
import { EmailService } from '../services/email.service.js';
import { env } from '../config/environment.js';

export class ErrorLogger {
  constructor() {
    this.errorDir = path.join(process.cwd(), 'data', 'errors');
    this.emailService = new EmailService();
    this.storageClient = null;
    this.bucket = null;
    this.bucketName = env.GCS_BUCKET_NAME || 'jc-etl-tracking';
    this.errorLogsPrefix = 'error-logs';
    this.useGCP = env.NODE_ENV === 'production';
    this.initializeGCPClient();
  }

  /**
   * Initialize Google Cloud Storage client
   */
  initializeGCPClient() {
    try {
      if (!this.useGCP) {
        logger.debug('Using local file storage for errors');
        return;
      }

      this.storageClient = new Storage({
        projectId: env.GCP_PROJECT_ID,
        keyFilename: env.GCP_CREDENTIALS_PATH
      });

      this.bucket = this.storageClient.bucket(this.bucketName);
      logger.info('GCP Storage client initialized for error logging', {
        bucket: this.bucketName,
        prefix: this.errorLogsPrefix
      });
    } catch (error) {
      logger.warn('Failed to initialize GCP Storage client, falling back to local storage', error);
      this.useGCP = false;
    }
  }

  /**
   * Ensure error directory exists
   */
  async ensureErrorDir() {
    try {
      await fs.access(this.errorDir);
    } catch {
      await fs.mkdir(this.errorDir, { recursive: true });
    }
  }

  /**
   * Save error to log file (GCP or local)
   * @param {Object} errorData - Error details
   * @param {string} context - Context (e.g., 'ETL', 'UNIFIED_PROCESSOR')
   * @param {Object} failedData - The data that was being processed when error occurred
   */
  async logError(errorData, context = 'ETL', failedData = null) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `error-${context}-${timestamp}.json`;

      const logEntry = {
        timestamp: new Date().toISOString(),
        context,
        failedData,
        ...errorData
      };

      if (this.useGCP && this.bucket) {
        await this.saveToGCP(filename, logEntry);
      } else {
        await this.saveToLocal(filename, logEntry);
      }

      logger.info(`Error logged to: ${filename}`);
    } catch (error) {
      logger.error('Failed to write error log', error);
    }
  }

  /**
   * Save error to GCP Storage bucket
   * @private
   */
  async saveToGCP(filename, logEntry) {
    try {
      const filepath = `${this.errorLogsPrefix}/${filename}`;
      const file = this.bucket.file(filepath);

      await file.save(JSON.stringify(logEntry, null, 2), {
        metadata: {
          contentType: 'application/json'
        }
      });

      logger.debug(`Error logged to GCP: gs://${this.bucketName}/${filepath}`);
    } catch (error) {
      logger.warn('Failed to save error to GCP, falling back to local storage', error);
      await this.saveToLocal(filename, logEntry);
    }
  }

  /**
   * Save error to local filesystem
   * @private
   */
  async saveToLocal(filename, logEntry) {
    try {
      await this.ensureErrorDir();
      const filepath = path.join(this.errorDir, filename);

      await fs.appendFile(
        filepath,
        JSON.stringify(logEntry, null, 2) + '\n\n',
        'utf-8'
      );

      logger.debug(`Error logged to local: ${filepath}`);
    } catch (error) {
      logger.error('Failed to save error to local storage', error);
    }
  }

  /**
   * Save error with request details
   */
  async logRequestError(requestId, requestName, error, additionalData = {}, failedData = null) {
    const errorData = {
      requestId,
      requestName,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      ...additionalData
    };

    await this.logError(errorData, 'REQUEST_PROCESSING', failedData);

    // Send email notification
    await this.emailService.sendErrorNotification({
      requestId,
      requestName,
      errorMessage: error.message,
      errorStack: error.stack,
      additionalData
    });
  }

  /**
   * Save processor error with detail info
   */
  async logProcessorError(processorType, requestId, error, detailData = {}, failedData = null) {
    const errorData = {
      processorType,
      requestId,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      detailData
    };

    await this.logError(errorData, `PROCESSOR_${processorType}`, failedData);
  }

  /**
   * Get list of error log files from GCP or local storage
   */
  async getErrorLogs() {
    try {
      if (this.useGCP && this.bucket) {
        return await this.getGCPErrorLogs();
      } else {
        return await this.getLocalErrorLogs();
      }
    } catch (error) {
      logger.error('Failed to read error logs', error);
      return [];
    }
  }

  /**
   * Get error logs from GCP bucket
   * @private
   */
  async getGCPErrorLogs() {
    try {
      const [files] = await this.bucket.getFiles({
        prefix: this.errorLogsPrefix
      });

      return files
        .filter(f => f.name.endsWith('.json'))
        .map(f => ({
          name: path.basename(f.name),
          path: f.name,
          size: f.metadata.size,
          created: f.metadata.timeCreated
        }))
        .sort((a, b) => new Date(b.created) - new Date(a.created));
    } catch (error) {
      logger.error('Failed to fetch error logs from GCP', error);
      return [];
    }
  }

  /**
   * Get error logs from local storage
   * @private
   */
  async getLocalErrorLogs() {
    try {
      await this.ensureErrorDir();
      const files = await fs.readdir(this.errorDir);
      return files.filter(f => f.endsWith('.json'));
    } catch (error) {
      logger.error('Failed to read local error logs', error);
      return [];
    }
  }

  /**
   * Read specific error log from GCP or local storage
   */
  async readErrorLog(filename) {
    try {
      if (this.useGCP && this.bucket) {
        return await this.readGCPErrorLog(filename);
      } else {
        return await this.readLocalErrorLog(filename);
      }
    } catch (error) {
      logger.error(`Failed to read error log: ${filename}`, error);
      return null;
    }
  }

  /**
   * Read error log from GCP bucket
   * @private
   */
  async readGCPErrorLog(filename) {
    try {
      const filepath = `${this.errorLogsPrefix}/${filename}`;
      const file = this.bucket.file(filepath);
      const [content] = await file.download();
      return content.toString('utf-8');
    } catch (error) {
      logger.error(`Failed to read error log from GCP: ${filename}`, error);
      return null;
    }
  }

  /**
   * Read error log from local storage
   * @private
   */
  async readLocalErrorLog(filename) {
    try {
      const filepath = path.join(this.errorDir, filename);
      return await fs.readFile(filepath, 'utf-8');
    } catch (error) {
      logger.error(`Failed to read local error log: ${filename}`, error);
      return null;
    }
  }
}