import { SmartHRExtendedService } from '../services/smarthr-extended.service.js';
import { RetryUtil } from '../utils/retry.util.js';
import { logger } from '../utils/logger.util.js';

export class EmployeePromotionProcessor {
  constructor() {
    this.smartHRService = new SmartHRExtendedService();
    this.retryUtil = new RetryUtil();
  }

  async process(garoonRequest) {
    logger.info(`Processing employee promotion/demotion for request: ${garoonRequest.id}`);

    try {
      const promotionData = this.extractPromotionData(garoonRequest);
      
      logger.info('🟢 PROMOTION.process - Extracted Data:', JSON.stringify({ promotionData }, null, 2));
      
      if (!promotionData.employeeCode || !promotionData.effectiveDate) {
        throw new Error('Missing required fields for promotion');
      }

      // Determine if promotion or demotion
      const changeType = this.determineChangeType(promotionData);

      // Update employee position in SmartHR
      const result = await this.retryUtil.executeWithRetry(
        async () => await this.smartHRService.updateEmployeePosition(promotionData),
        3,
        1000
      );

      logger.info(`Employee ${changeType} completed: ${promotionData.employeeCode}`);
      return { success: true, result, changeType };

    } catch (error) {
      logger.error('Employee promotion/demotion failed', error);
      throw error;
    }
  }

  extractPromotionData(request) {
    const items = request.formFields || {};
    
    
    return {
      employeeCode: this.findValue(items, '社員番号'),
      employeeName: this.findValue(items, '氏名'),
      currentPosition: this.findValue(items, '現職位'),
      newPosition: this.findValue(items, '新職位'),
      effectiveDate: this.findValue(items, '発令日'),
      reason: this.findValue(items, '昇格理由'),
      department: this.findValue(items, '所属部署'),
      remarks: this.findValue(items, '備考')
    };
  }

  determineChangeType(data) {
    const gradeMap = {
      '役員': 10,
      '部長': 9,
      '次長': 8,
      '課長': 7,
      '係長': 6,
      '主任': 5,
      '一般': 1
    };

    const currentLevel = gradeMap[data.currentGrade] || 0;
    const newLevel = gradeMap[data.newGrade] || 0;

    if (newLevel > currentLevel) return 'PROMOTION';
    if (newLevel < currentLevel) return 'DEMOTION';
    return 'LATERAL_MOVE';
  }

  findValue(items, fieldName) {
    const item = Object.values(items).find(i => i.name === fieldName);
    return item?.value || null;
  }
}
