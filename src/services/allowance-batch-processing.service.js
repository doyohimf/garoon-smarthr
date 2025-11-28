import { AllowanceWorkflowRepository } from '../repositories/allowance-workflow.repository.js';
import { SmartHRExtendedService } from './smarthr-extended.service.js';
import { RetryUtil } from '../utils/retry.util.js';
import { logger } from '../utils/logger.util.js';

export class AllowanceBatchProcessingService {
  constructor() {
    this.allowanceWorkflowRepository = new AllowanceWorkflowRepository();
    this.smartHRExtendedService = new SmartHRExtendedService();
    this.retryUtil = new RetryUtil();
  }

  async processDeferredAllowances() {
    logger.info('🔄 [AllowanceBatchProcessing] Starting preprocessing step');

    try {
      const readyRecords = await this.allowanceWorkflowRepository.getReadyForTransfer();

      if (!readyRecords || readyRecords.length === 0) {
        logger.debug('📭 No deferred allowances ready for transfer (change_date=today, for_process=1)');
        return {
          success: true,
          processed: 0,
          skipped: 0,
          failed: 0,
          message: 'No records found'
        };
      }

      logger.info(`📋 Found ${readyRecords.length} deferred allowances ready for processing`);

      let processed = 0;
      let failed = 0;

      for (const record of readyRecords) {
        try {
          logger.info(`⚙️  Processing deferred allowance for employee: ${record.employee_code}, change_date: ${record.change_date}`);

          const customFields = record.custom_fields ? JSON.parse(record.custom_fields) : [];

          const allowanceData = {
            employeeCode: record.employee_code,
            customFieldsArray: customFields
          };

          const result = await this.retryUtil.executeWithRetry(
            async () => await this.smartHRExtendedService.updateEmployeeAllowances(allowanceData),
            3,
            1000
          );

          logger.info(`✅ Successfully transmitted deferred allowance for: ${record.employee_code}`);

          await this.allowanceWorkflowRepository.markAsTransmitted(
            record.employee_code,
            record.change_date
          );

          processed++;
        } catch (error) {
          logger.error(`❌ Failed to process deferred allowance for ${record.employee_code}`, error);
          failed++;
        }
      }

      const result = {
        success: failed === 0,
        processed,
        skipped: 0,
        failed,
        totalRecords: readyRecords.length,
        message: `Processed ${processed} allowances, ${failed} failed`
      };

      logger.info(`✨ [AllowanceBatchProcessing] Preprocessing completed:`, JSON.stringify(result, null, 2));

      return result;
    } catch (error) {
      logger.error('[AllowanceBatchProcessing] Preprocessing failed', error);
      return {
        success: false,
        processed: 0,
        skipped: 0,
        failed: 0,
        error: error.message
      };
    }
  }
}
