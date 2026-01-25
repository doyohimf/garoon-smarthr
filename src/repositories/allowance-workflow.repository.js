import { BigQueryRepository } from './bigquery.repository.js';
import { logger } from '../utils/logger.util.js';
import { DateUtil } from '../utils/date.util.js';

export class AllowanceWorkflowRepository {
  constructor() {
    this.bigQueryRepo = new BigQueryRepository();
    this.tableName = 'allowances_workflow';
  }

  async checkIfExists(request_id, request_number) {
    try {
      if (!request_id && !request_number) {
        logger.warn('No request_id or request_number provided for duplicate check');
        return false;
      }

      let query = `
        SELECT COUNT(*) as count
        FROM \`${this.bigQueryRepo.projectId}.${this.bigQueryRepo.datasetId}.${this.tableName}\`
        WHERE (request_id = @request_id OR request_number = @request_number)
      `;

      const results = await this.bigQueryRepo.query(query, {
        request_id: request_id || null,
        request_number: request_number || null
      });

      const exists = results.length > 0 && results[0].count > 0;
      logger.info(`Duplicate check - request_id: ${request_id}, request_number: ${request_number}, exists: ${exists}`);
      return exists;
    } catch (error) {
      logger.error(`Error checking if allowance workflow already exists`, error);
      throw error;
    }
  }

  async insertAllowanceWorkflow(allowanceData) {
    try {
      logger.info(`Inserting allowance workflow data for employee: ${allowanceData.employee_code}`);

      const workflowData = {
        employee_code: allowanceData.employee_code,
        change_date: allowanceData.change_date,
        type: allowanceData.type,
        amount: parseFloat(allowanceData.amount) || 0,
        date_registered: new Date().toISOString(),
        for_process: 0,
        custom_fields: allowanceData.custom_fields ? JSON.stringify(allowanceData.custom_fields) : null,
        inserted_at: new Date().toISOString(),
        request_id: allowanceData.request_id || null,
        request_number: allowanceData.request_number || null
      };

      await this.bigQueryRepo.insert(this.tableName, [workflowData]);
      logger.info(`✓ Allowance workflow data inserted for: ${allowanceData.employee_code}`);

      return workflowData;
    } catch (error) {
      logger.error(`Error inserting allowance workflow data`, error);
      throw error;
    }
  }

  async markForProcess(employee_code, change_date) {
    try {
      const query = `
        UPDATE \`${this.bigQueryRepo.projectId}.${this.bigQueryRepo.datasetId}.${this.tableName}\`
        SET for_process = 0
        WHERE employee_code = @employee_code AND change_date = @change_date
      `;

      const results = await this.bigQueryRepo.query(query, {
        employee_code,
        change_date
      });

      logger.info(`✓ Marked as pending for process: ${employee_code} on ${change_date}`);
      return results;
    } catch (error) {
      logger.error(`Error marking allowance as pending for processing`, error);
      throw error;
    }
  }

  async getReadyForTransfer() {
    try {
      const query = `
        SELECT *
        FROM \`${this.bigQueryRepo.projectId}.${this.bigQueryRepo.datasetId}.${this.tableName}\`
        WHERE for_process = 0
        AND change_date = CURRENT_DATE()
        ORDER BY inserted_at ASC
      `;

      const results = await this.bigQueryRepo.query(query);
      logger.debug(`Found ${results.length} allowances ready for transfer`);

      return results;
    } catch (error) {
      logger.error(`Error retrieving allowances ready for transfer`, error);
      throw error;
    }
  }

  async isChangeDateToday(changeDateString) {
    return DateUtil.isToday(changeDateString);
  }

  async markAsTransmitted(employee_code, change_date) {
    try {
      const query = `
        UPDATE \`${this.bigQueryRepo.projectId}.${this.bigQueryRepo.datasetId}.${this.tableName}\`
        SET for_process = 1, transmitted_at = CURRENT_TIMESTAMP()
        WHERE employee_code = @employee_code AND change_date = @change_date
      `;

      const results = await this.bigQueryRepo.query(query, {
        employee_code,
        change_date
      });

      logger.info(`✓ Marked as transmitted: ${employee_code} on ${change_date}`);
      return results;
    } catch (error) {
      logger.error(`Error marking allowance as transmitted`, error);
      throw error;
    }
  }
}
