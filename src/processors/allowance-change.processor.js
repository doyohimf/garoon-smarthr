import { SmartHRExtendedService } from '../services/smarthr-extended.service.js';
import { RetryUtil } from '../utils/retry.util.js';
import { logger } from '../utils/logger.util.js';
import { ALLOWANCE_CUSTOM_KEY_MAP, ALLOWANCE_KEY_MAP } from '../config/allowance.config.js';
import { SmartHRService } from '../services/smarthr.service.js';
import { SmartHRRepository } from '../repositories/smarthr.repository.js';
import { FormatterUtil } from '../utils/formatter.util.js';
import { garoonFields } from '../config/garoon.config.js';

export class EmployeeAllowanceChangeProcessor {
  constructor() {
    this.smartHRRepository = new SmartHRRepository();
    this.smartHRExtendedService = new SmartHRExtendedService();
    this.retryUtil = new RetryUtil();
  }

  async process(garoonRequest) {
    logger.info(`Processing allowance change for request: ${garoonRequest.request.request_id}`);

    try {
      const allowanceData = await this.extractAllowanceData(garoonRequest);

      if (!allowanceData.employeeCode) {
        logger.warn('Missing required fields for allowance change: Employee Code is required.');
      }

      logger.info('🟢 ALLOWANCE_CHANGE.process - Extracted Data:', JSON.stringify({ allowanceData }, null, 2));

      const result = await this.retryUtil.executeWithRetry(
        async () => await this.smartHRExtendedService.updateEmployeeAllowances(allowanceData),
        3,
        1000
      );


      logger.info(`✓ Allowance change completed: ${allowanceData.employeeCode} - ${allowanceData.employeeName}`);
      
      return { success: true, result};

    } catch (error) {
      logger.error('Allowance change processing failed', error);
      throw error;
    }
  }

  async extractAllowanceData(request) {
    const items = request.formFields || {};
    const employeeCode = items.find(field => field.field_name === garoonFields.target_employee_code)?.field_value;
    const allowanceName = items.find(field => field.field_name === ALLOWANCE_KEY_MAP.allowanceName)?.field_value;
    const changeDate = items.find(field => field.field_name === ALLOWANCE_KEY_MAP.changeDate)?.field_value;
    const changeAmount = this.parseAmount(items.find(field => field.field_name === ALLOWANCE_KEY_MAP.changeAmount)?.field_value);
    const details = items.find(field => field.field_name === ALLOWANCE_KEY_MAP['details'])?.field_value || null;
    
    var position_allowance = '';
    var managers_allowance = '';
    var special_allowace = '';
    var relocation_allowance = '';
    var vehicle_allowance = '';
    
    switch (allowanceName) {
      case '職位手当':
        position_allowance = changeAmount;
        break;
      case '責任者手当':
        managers_allowance = changeAmount;
        break;
      case '特別手当':
        special_allowace = changeAmount;
        break;
      case '赴任手当':
        relocation_allowance = changeAmount;
        break;
      case '車両手当':
        vehicle_allowance = changeAmount;
        break;
    }

    const cfields = {};
    cfields[ALLOWANCE_CUSTOM_KEY_MAP.allowanceName] = allowanceName;
    cfields[ALLOWANCE_CUSTOM_KEY_MAP.changeDate] = changeDate;
    cfields[ALLOWANCE_CUSTOM_KEY_MAP.changeAmount] = changeAmount;
    cfields[ALLOWANCE_CUSTOM_KEY_MAP.changeDetails] = details;

    const customFieldTemplates = await this.smartHRRepository.getCustomFieldTemplates();
    const customFieldsArray = FormatterUtil.buildCustomFieldsArray(cfields, customFieldTemplates);

    if (!details) {
      logger.warn('No details field found in request');
      return [];
    }
    
    return {
      employeeCode: employeeCode,
      customFieldsArray
    };
  }

  parseAmount(value) {
    if (!value) return 0;
    return parseFloat(value.toString().replace(/[,円¥]/g, '')) || 0;
  }

  findValue(items, fieldName) {
    const item = Object.values(items).find(i => i.name === fieldName);
    return item?.value || null;
  }

}
