import { BigQuery } from '@google-cloud/bigquery';
import { env } from '../config/environment.js';
import { initializeGCPAuth } from '../utils/gcp-auth.util.js';
import { logger } from '../utils/logger.util.js';

export class BigQueryRepository {
  constructor() {
    const gcpAuth = initializeGCPAuth();
    
    if (!gcpAuth) {
      logger.info('BigQuery repository disabled in development mode');
      this.bigquery = null;
      this.projectId = env.GCP_PROJECT_ID || 'dev-project';
      this.datasetId = env.BIGQUERY_DATASET_ID;
      return;
    }

    const config = gcpAuth.getBigQueryConfig();
    if (!config) {
      logger.info('BigQuery repository disabled in development mode');
      this.bigquery = null;
      this.projectId = env.GCP_PROJECT_ID || 'dev-project';
      this.datasetId = env.BIGQUERY_DATASET_ID;
      return;
    }
    
    this.bigquery = new BigQuery(config);
    this.projectId = gcpAuth.getProjectId();
    this.datasetId = env.BIGQUERY_DATASET_ID;
    
    logger.info(`BigQuery repository initialized for project: ${this.projectId}, dataset: ${this.datasetId}`);
  }

  async insert(tableId, rows) {
    try {
      if (!this.bigquery) {
        logger.info(`BigQuery insert skipped in development mode: ${tableId} (${rows.length} rows)`);
        logger.debug('Development mode data:', { tableId, rows });
        return;
      }
      
      await this.bigquery
        .dataset(this.datasetId)
        .table(tableId)
        .insert(rows, { skipInvalidRows: false });

      logger.debug(`Inserted ${rows.length} rows into ${tableId}`);
    } catch (error) {
      // Handle PartialFailureError
      if (error.name === 'PartialFailureError' && error.errors) {
        const failedRows = error.errors;
        logger.error(`PartialFailureError: ${failedRows.length} rows failed out of ${rows.length}`, {
          failedRows: failedRows.map(e => ({
            index: e.row?.index,
            message: e.errors?.[0]?.message,
            reason: e.errors?.[0]?.reason
          }))
        });
        
        // Log detailed error info for debugging
        failedRows.forEach((failure, idx) => {
          const rowIndex = failure.row?.index || idx;
          const rowData = rows[rowIndex];
          logger.error(`Failed row ${rowIndex}:`, {
            data: rowData,
            errors: failure.errors
          });
        });
      }
      
      logger.error(`Error inserting into ${tableId}`, error);
      throw error;
    }
  }

  async updateStatus(requestId, status) {
    if (!this.bigquery) {
      logger.info(`BigQuery updateStatus skipped in development mode: ${requestId} -> ${status}`);
      return;
    }
    
    const query = `
      UPDATE \`${this.projectId}.${this.datasetId}.requests\`
      SET status = @status
      WHERE request_id = @requestId
    `;

    const options = {
      query,
      params: { status, requestId }
    };

    try {
      const [job] = await this.bigquery.createQueryJob(options);
      await job.getQueryResults();
      logger.debug(`Updated status for request ${requestId} to ${status}`);
    } catch (error) {
      logger.error(`Error updating status for ${requestId}`, error);
      throw error;
    }
  }

  async query(sqlQuery, params = {}) {
    if (!this.bigquery) {
      logger.info(`BigQuery query skipped in development mode`);
      return [];
    }
    
    const options = {
      query: sqlQuery,
      params
    };

    try {
      const [rows] = await this.bigquery.query(options);
      return rows;
    } catch (error) {
      logger.error('Error executing query', error);
      throw error;
    }
  }

  async resignRecordExists(emp_code) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM \`${this.projectId}.${this.datasetId}.resign_tagging\`
        WHERE emp_code = @emp_code
      `;

      const results = await this.query(query, { emp_code });
      return results.length > 0 && results[0].count > 0;
    } catch (error) {
      logger.error(`Error checking if resign record exists for ${emp_code}`, error);
      throw error;
    }
  }
}