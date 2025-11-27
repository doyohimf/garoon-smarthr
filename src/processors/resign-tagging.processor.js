import { SmartHRRepository } from '../repositories/smarthr.repository.js';
import { SmartHRExtendedService } from '../services/smarthr-extended.service.js';
import { BigQueryRepository } from '../repositories/bigquery.repository.js';
import { EmailService } from '../services/email.service.js';
import { RetryUtil } from '../utils/retry.util.js';
import { logger } from '../utils/logger.util.js';

export class ResignTaggingProcessor {
  constructor() {
    this.smartHRRepository = new SmartHRRepository();
    this.smartHRService = new SmartHRExtendedService();
    this.bigQueryRepository = new BigQueryRepository();
    this.emailService = new EmailService();
    this.retryUtil = new RetryUtil();
  }



  /**
   * Filter employees whose resignation date is more than 2 months old
   */
  filterEmployeesToTag(employees) {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    return employees.filter(emp => {
      if (!emp.resigned_at) return false;

      const resignedDate = new Date(emp.resigned_at);
      return resignedDate < twoMonthsAgo;
    });
  }



  /**
   * Process a single resigned employee
   */
  async processResignedEmployee(employee) {
    try {
      const { id: crewId, emp_code, resigned_at } = employee;

      if (!emp_code) {
        throw new Error(`Employee has no emp_code: ${crewId}`);
      }

      if (!crewId) {
        throw new Error(`Employee has no crew id: ${emp_code}`);
      }

      logger.info(`Processing resigned employee: ${emp_code}, resigned_at: ${resigned_at}`);

      // Check if record already exists in BigQuery
      const exists = await this.bigQueryRepository.resignRecordExists(emp_code);
      if (exists) {
        logger.info(`Record already exists for ${emp_code}, skipping processing`);
        return {
          success: true,
          emp_code,
          resigned_at,
          skipped: true,
          reason: 'Record already exists in resign_tagging table'
        };
      }

      // Update emp_status to "retired" in SmartHR
      const updateResult = await this.retryUtil.executeWithRetry(
        async () => {
          return await this.smartHRRepository.updateCrew(crewId, {
            emp_status: 'retired'
          });
        },
        3,
        1000
      );

      logger.info(`Employee status updated to retired: ${emp_code}`);

      // Save to BigQuery resign_tagging table
      // Convert resigned_at to proper timestamp format if needed
      let resignedAtTimestamp = resigned_at;
      if (resigned_at && !resigned_at.includes('T')) {
        // If it's just a date (YYYY-MM-DD), convert to ISO timestamp
        resignedAtTimestamp = new Date(`${resigned_at}T00:00:00Z`).toISOString();
      }

      const taggingRecord = {
        id: `${emp_code}_${Date.now()}`,
        emp_code,
        resigned_at: resignedAtTimestamp,
        tagging_date: new Date().toISOString(),
        status: 'COMPLETE'
      };

      await this.bigQueryRepository.insert('resign_tagging', [taggingRecord]);
      logger.info(`Resign tagging record saved for: ${emp_code}`);

      // Send email notification
      await this.emailService.sendResignationTaggingNotification({
        emp_code,
        resigned_at,
        tagging_date: taggingRecord.tagging_date
      });

      logger.info(`Resignation notification email sent for: ${emp_code}`);

      return {
        success: true,
        emp_code,
        resigned_at,
        tagging_date: taggingRecord.tagging_date
      };
    } catch (error) {
      logger.error(`Failed to process resigned employee: ${employee.emp_code}`, error);
      throw error;
    }
  }

  /**
   * Execute the resign tagging workflow
   */
  async execute() {
    const stats = {
      totalFetched: 0,
      eligibleForTagging: 0,
      successfullyTagged: 0,
      skippedDuplicate: 0,
      failedTagging: 0,
      startTime: new Date().toISOString()
    };

    try {
      logger.info('Starting resign tagging workflow (WF#7)');

      // Fetch all resigned employees
      const allResignedEmployees = await this.smartHRRepository.getAllResignedEmployees();
      stats.totalFetched = allResignedEmployees.length;
      logger.info(`Fetched ${stats.totalFetched} resigned employees from SmartHR`);

      // Filter to those > 2 months old
      const employeesToTag = this.filterEmployeesToTag(allResignedEmployees);
      stats.eligibleForTagging = employeesToTag.length;
      logger.info(`${stats.eligibleForTagging} employees eligible for tagging (resigned > 2 months ago)`);

      if (employeesToTag.length === 0) {
        logger.info('No employees to tag at this time');
        stats.endTime = new Date().toISOString();
        return stats;
      }

      // Process each eligible employee
      for (const employee of employeesToTag) {
        try {
          const result = await this.processResignedEmployee(employee);
          if (result.skipped) {
            stats.skippedDuplicate++;
          } else {
            stats.successfullyTagged++;
          }
        } catch (error) {
          logger.error(`Error tagging employee ${employee.emp_code}`, error);
          stats.failedTagging++;
          // Continue processing other employees
        }
      }

      stats.endTime = new Date().toISOString();
      logger.info('Resign tagging workflow completed', stats);
      return stats;

    } catch (error) {
      logger.error('Resign tagging workflow failed', error);
      stats.endTime = new Date().toISOString();
      stats.error = error.message;
      throw error;
    }
  }
}
