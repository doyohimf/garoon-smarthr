import { DateUtil } from '../utils/date.util.js';
import { AllowanceWorkflowRepository } from '../repositories/allowance-workflow.repository.js';
import { logger } from '../utils/logger.util.js';

export class WF5ValidationUtil {
  static async testDateUtil() {
    logger.info('🧪 Testing DateUtil...');

    const testCases = [
      { date: '2025-11-27', expected: 'Today check depends on system date' },
      { date: '2025/11/27', expected: 'Today check depends on system date' },
      { date: '11/27', expected: 'Today check depends on system date' }
    ];

    for (const testCase of testCases) {
      const isToday = DateUtil.isToday(testCase.date);
      logger.info(`DateUtil.isToday("${testCase.date}") = ${isToday}`);
    }

    const formatted = DateUtil.formatDateToBigQuery('2025/11/27');
    logger.info(`DateUtil.formatDateToBigQuery("2025/11/27") = "${formatted}"`);

    const todayBQ = DateUtil.getTodayBigQueryFormat();
    logger.info(`DateUtil.getTodayBigQueryFormat() = "${todayBQ}"`);
  }

  static async testAllowanceWorkflowRepository() {
    logger.info('🧪 Testing AllowanceWorkflowRepository...');

    const repo = new AllowanceWorkflowRepository();

    // Test data structure
    const testData = {
      employee_code: 'TEST001',
      change_date: DateUtil.formatDateToBigQuery('2025-11-27'),
      type: '職位手当',
      amount: 50000,
      custom_fields: { notes: 'test' },
      request_id: 'req_test_12345'
    };

    logger.info('Test data structure:', JSON.stringify(testData, null, 2));

    try {
      // This will log in dev mode but not actually insert
      await repo.insertAllowanceWorkflow(testData);
      logger.info('✓ insertAllowanceWorkflow() executed successfully');
    } catch (error) {
      logger.error('❌ insertAllowanceWorkflow() failed:', error.message);
    }

    logger.info('✓ AllowanceWorkflowRepository tests completed');
  }

  static async runAllTests() {
    logger.info('🚀 Starting WF#5 Validation Tests');
    logger.info('═══════════════════════════════════════');

    try {
      await this.testDateUtil();
      logger.info('─────────────────────────────────────');
      await this.testAllowanceWorkflowRepository();
      logger.info('═══════════════════════════════════════');
      logger.info('✅ All validation tests completed');
    } catch (error) {
      logger.error('❌ Validation tests failed:', error);
    }
  }
}
