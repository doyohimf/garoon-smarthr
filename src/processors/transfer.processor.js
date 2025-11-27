import { garoonFields } from '../config/garoon.config.js';
import { SmartHRExtendedService } from '../services/smarthr-extended.service.js';
import { RetryUtil } from '../utils/retry.util.js';
import { logger } from '../utils/logger.util.js';

export class EmployeeTransferProcessor {
  constructor() {
    this.smartHRService = new SmartHRExtendedService();
    this.retryUtil = new RetryUtil();
  }

  async process(garoonRequest) {
    logger.info(`Processing employee transfer for request: ${garoonRequest.id}`);

    try {
      const transferData = this.extractTransferData(garoonRequest);
      
      logger.info('🟢 TRANSFER.process - Extracted Data:', JSON.stringify({ transferData }, null, 2));
      
      // Validate required fields
      if (!transferData.employeeCode || !transferData.effectiveDate) {
        throw new Error('Missing required fields for transfer');
      }

      // Update employee in SmartHR
      const result = await this.retryUtil.executeWithRetry(
        async () => await this.smartHRService.updateEmployeeDepartment(transferData),
        3,
        1000
      );

      logger.info(`Employee transfer completed: ${transferData.employeeCode}`);
      return { success: true, result };

    } catch (error) {
      logger.error('Employee transfer failed', error);
      throw error;
    }
  }

  extractTransferData(request) {
    const items = request.items || {};
    
    return {
      employeeCode: this.findValue(items, '社員番号'),
      employeeName: this.findValue(items, '氏名'),
      fromDepartment: this.findValue(items, '異動前部署'),
      toDepartment: this.findValue(items, '異動後部署'),
      fromPosition: this.findValue(items, '異動前役職'),
      toPosition: this.findValue(items, '異動後役職'),
      effectiveDate: this.findValue(items, '発令日'),
      transferType: this.findValue(items, '異動区分'), // 転勤/転属/転籍
      reason: this.findValue(items, '異動理由'),
      workLocation: this.findValue(items, '勤務地'),
      remarks: this.findValue(items, '備考')
    };
  }

  findValue(items, fieldName) {
    const item = Object.values(items).find(i => i.name === fieldName);
    return item?.value || null;
  }
}
