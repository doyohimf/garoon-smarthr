import fs from 'fs';
import path from 'path';
import { env } from '../config/environment.js';
import { logger } from './logger.util.js';

/**
 * GCP Authentication Utility
 * 
 * Handles authentication for all GCP services (BigQuery, Cloud Storage, etc.)
 * using the service account key file specified in the environment configuration.
 * 
 * The service account key file should be located at the path specified by
 * GCP_CREDENTIALS_PATH environment variable or default location:
 * data/keys/data-integration-474311-01459c9d6f7b.json
 */
export class GCPAuth {
  constructor() {
    this.credentialsPath = env.GCP_CREDENTIALS_PATH;
    this.credentials = null;
    this.projectId = env.GCP_PROJECT_ID;
  }

  /**
   * Initialize GCP authentication by loading and validating the service account key
   * @throws {Error} If credentials file is not found or invalid
   */
  initialize() {
    try {
      if (env.NODE_ENV === 'development' || env.NODE_ENV === 'local') {
        logger.info('GCP authentication skipped in development mode', {
          projectId: this.projectId
        });
        return null;
      }

      if (!fs.existsSync(this.credentialsPath)) {
        throw new Error(
          `GCP service account key file not found at: ${this.credentialsPath}\n` +
          `Please ensure the file is located at: data/keys/data-integration-474311-01459c9d6f7b.json`
        );
      }

      // Load credentials
      const credentialsContent = fs.readFileSync(this.credentialsPath, 'utf-8');
      this.credentials = JSON.parse(credentialsContent);

      // Validate credentials structure
      this.validateCredentials();

      // Extract project ID from credentials if not provided in environment
      if (!this.projectId && this.credentials.project_id) {
        this.projectId = this.credentials.project_id;
      }

      logger.info('GCP authentication initialized successfully', {
        projectId: this.projectId,
        serviceAccount: this.credentials.client_email,
        credentialsPath: this.credentialsPath
      });

      return this.credentials;
    } catch (error) {
      logger.error('Failed to initialize GCP authentication', error);
      throw error;
    }
  }

  /**
   * Validate that the service account key has required fields
   * @private
   * @throws {Error} If required fields are missing
   */
  validateCredentials() {
    const requiredFields = [
      'type',
      'project_id',
      'private_key_id',
      'private_key',
      'client_email',
      'client_id',
      'auth_uri',
      'token_uri'
    ];

    const missingFields = requiredFields.filter(field => !this.credentials[field]);

    if (missingFields.length > 0) {
      throw new Error(
        `Invalid GCP service account key: missing required fields - ${missingFields.join(', ')}`
      );
    }

    if (this.credentials.type !== 'service_account') {
      throw new Error(
        `Invalid credentials type: expected "service_account", got "${this.credentials.type}"`
      );
    }
  }

  /**
   * Get the authentication configuration for BigQuery client
   * @returns {Object} BigQuery client configuration options
   */
  getBigQueryConfig() {
    if (!this.credentials) {
      return null;
    }
    return {
      projectId: this.projectId || this.credentials.project_id,
      keyFilename: this.credentialsPath
    };
  }

  /**
   * Get the authentication configuration for Cloud Storage client
   * @returns {Object} Cloud Storage client configuration options
   */
  getStorageConfig() {
    if (!this.credentials) {
      return null;
    }
    return {
      projectId: this.projectId || this.credentials.project_id,
      keyFilename: this.credentialsPath
    };
  }

  /**
   * Get raw credentials object
   * @returns {Object} Service account credentials
   */
  getCredentials() {
    return this.credentials;
  }

  /**
   * Get the project ID
   * @returns {string} GCP project ID
   */
  getProjectId() {
    return this.projectId || (this.credentials && this.credentials.project_id);
  }

  /**
   * Get the service account email
   * @returns {string} Service account email
   */
  getServiceAccountEmail() {
    return this.credentials && this.credentials.client_email;
  }
}

// Create singleton instance
let authInstance = null;

/**
 * Get or initialize the GCP authentication singleton
 * @returns {GCPAuth} GCP authentication instance
 */
export function initializeGCPAuth() {
  if (!authInstance) {
    authInstance = new GCPAuth();
    authInstance.initialize();
  }
  return authInstance;
}

/**
 * Get the existing GCP authentication instance
 * @returns {GCPAuth|null} GCP authentication instance or null if not initialized
 */
export function getGCPAuth() {
  return authInstance;
}

export default GCPAuth;
