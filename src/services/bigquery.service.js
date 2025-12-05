import { BigQueryRepository } from '../repositories/bigquery.repository.js';
import { logger } from '../utils/logger.util.js';

export class BigQueryService {
  constructor() {
    this.repository = new BigQueryRepository();
  }

  async insertRequest(request) {
    try {
      await this.repository.insert('requests', [request]);
      logger.info(`Request inserted to BigQuery: ${request.request_id}`);
    } catch (error) {
      logger.error('Error inserting request to BigQuery', error);
      throw error;
    }
  }

  async insertFormFields(formFields) {
    try {
      await this.repository.insert('request_form_fields', formFields);
      logger.info(`${formFields.length} form fields inserted to BigQuery`);
    } catch (error) {
      logger.error('Error inserting form fields to BigQuery', error);
      throw error;
    }
  }

  async insertSteps(steps) {
    try {
      await this.repository.insert('request_steps', steps);
      logger.info(`${steps.length} steps inserted to BigQuery`);
    } catch (error) {
      logger.error('Error inserting steps to BigQuery', error);
      throw error;
    }
  }

  async insertProcessors(processors) {
    try {
      await this.repository.insert('request_step_processors', processors);
      logger.info(`${processors.length} processors inserted to BigQuery`);
    } catch (error) {
      logger.error('Error inserting processors to BigQuery', error);
      throw error;
    }
  }

  async updateRequestStatus(requestId, status) {
    try {
      await this.repository.updateStatus(requestId, status);
      logger.info(`Request ${requestId} status updated to: ${status}`);
    } catch (error) {
      logger.error(`Error updating request status for ${requestId}`, error);
      throw error;
    }
  }

  async insertGaroonRequest(garoonRequest) {
    try {
      await this.repository.insert('garoon_requests', [garoonRequest]);
      logger.info(`Garoon request inserted: ${garoonRequest.request_id}`);
    } catch (error) {
      logger.error('Error inserting garoon request to BigQuery', error);
      throw error;
    }
  }

  async updateGaroonRequestStatus(requestId, status) {
    try {
      logger.info(`Garoon request ${requestId} status updated to: ${status} (skipped - streaming buffer)`);
    } catch (error) {
      logger.error(`Error updating garoon request status for ${requestId}`, error);
      throw error;
    }
  }

  async checkGaroonRequestExists(requestId, requestNumber = null) {
    try {
      if (!this.repository.bigquery) {
        logger.debug(`BigQuery checkGaroonRequestExists skipped in development mode: ${requestId}`);
        return false;
      }
      
      const query = `
        SELECT request_id
        FROM \`${this.repository.bigquery.projectId}.${this.repository.datasetId}.garoon_requests\`
        WHERE request_id = @requestId
        ${requestNumber ? 'OR request_number = @requestNumber' : ''}
        LIMIT 1
      `;
      const params = requestNumber
        ? { requestId, requestNumber }
        : { requestId };
      const rows = await this.repository.query(query, params);
      return rows.length > 0;
    } catch (error) {
      logger.error(`Error checking garoon request exists for ${requestId}`, error);
      return false;
    }
  }

  async getPendingEmpChanges() {
    try {
      if (!this.repository.bigquery) {
        logger.debug('BigQuery getPendingEmpChanges skipped in development mode');
        return [];
      }

      const today = new Date().toISOString().split('T')[0];
      const query = `
        SELECT employee_code, change_date, type, position, classification, 
               new_salary, position_allowance, custom_fields, request_id, request_number
        FROM \`${this.repository.bigquery.projectId}.${this.repository.datasetId}.empchanges_workflow\`
        WHERE change_date = @today AND for_process = 1
        ORDER BY inserted_at ASC
      `;
      
      const rows = await this.repository.query(query, { today });
      logger.info(`Found ${rows.length} pending employee changes for today`);
      return rows;
    } catch (error) {
      logger.error('Error fetching pending employee changes', error);
      return [];
    }
  }

  async insertEmpChange(empChange) {
    try {
      await this.repository.insert('empchanges_workflow', [empChange]);
      logger.info(`Employee change inserted: ${empChange.employee_code} - ${empChange.change_date}`);
    } catch (error) {
      logger.error('Error inserting employee change to BigQuery', error);
      throw error;
    }
  }

  async markEmpChangeProcessed(employeeCode, changeDate) {
    try {
      if (!this.repository.bigquery) {
        logger.debug(`BigQuery markEmpChangeProcessed skipped in development mode: ${employeeCode}`);
        return;
      }

      const query = `
        UPDATE \`${this.repository.bigquery.projectId}.${this.repository.datasetId}.empchanges_workflow\`
        SET for_process = 0, transmitted_at = CURRENT_TIMESTAMP()
        WHERE employee_code = @employeeCode AND change_date = @changeDate
      `;
      
      await this.repository.query(query, { employeeCode, changeDate });
      logger.info(`Employee change marked as processed: ${employeeCode} - ${changeDate}`);
    } catch (error) {
      logger.error(`Error marking employee change as processed for ${employeeCode}`, error);
      throw error;
    }
  }
}
