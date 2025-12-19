import { SmartHRExtendedService } from '../services/smarthr-extended.service.js';
import { RetryUtil } from '../utils/retry.util.js';
import { logger } from '../utils/logger.util.js';
import { ALLOWANCE_CUSTOM_KEY_MAP, ALLOWANCE_KEY_MAP } from '../config/allowance.config.js';
import { SmartHRService } from '../services/smarthr.service.js';
import { SmartHRRepository } from '../repositories/smarthr.repository.js';
import { FormatterUtil } from '../utils/formatter.util.js';
import { garoonFields } from '../config/garoon.config.js';
import { AllowanceWorkflowRepository } from '../repositories/allowance-workflow.repository.js';
import { DateUtil } from '../utils/date.util.js';
import { smarthr_custom_fields } from '../config/smarthr.config.js';

export class EmployeeAllowanceChangeProcessor {
  constructor() {
    this.smartHRRepository = new SmartHRRepository();
    this.smartHRExtendedService = new SmartHRExtendedService();
    this.retryUtil = new RetryUtil();
    this.allowanceWorkflowRepository = new AllowanceWorkflowRepository();
  }

  async process(garoonRequest) {
    logger.info(`Processing allowance change for request: ${garoonRequest.request.request_id}`);

    try {
      const allowanceData = await this.extractAllowanceData(garoonRequest);
      
      if (!allowanceData.employeeCode) {
        logger.warn('Missing required fields for allowance change: Employee Code is required.');
        return { success: false, error: 'Missing employee code' };
      }

      if (!allowanceData.changeDate) {
        logger.warn('Missing required fields for allowance change: Change Date is required.');
        return { success: false, error: 'Missing change date' };
      }

      logger.info('🟢 ALLOWANCE_CHANGE.process - Extracted Data:', JSON.stringify({ allowanceData }, null, 2));

      // Check if request already exists in allowances_workflow
      try {
        const requestExists = await this.allowanceWorkflowRepository.checkIfExists(
          garoonRequest.request.request_id,
          garoonRequest.request.request_number
        );
        
        if (requestExists) {
          logger.warn(`⏭️  Skipping duplicate entry - request_id: ${garoonRequest.request.request_id}, request_number: ${garoonRequest.request.request_number}`);
          return { success: true, transmitted: false, message: 'Duplicate request - skipped' };
        }
      } catch (dupCheckError) {
        logger.error(`Error checking for duplicate request`, dupCheckError);
        return { success: false, error: 'Failed to check for duplicates' };
      }

      // Check if change_date is exactly today
      let isChangeDateToday = false;
      try {
        const today = new Date();
        const changeDate = new Date(allowanceData.changeDate);
        isChangeDateToday = (
          today.getFullYear() === changeDate.getFullYear() &&
          today.getMonth() === changeDate.getMonth() &&
          today.getDate() === changeDate.getDate()
        );
        logger.info(`Change date "${allowanceData.changeDate}" is today? ${isChangeDateToday}`);
      } catch (dateError) {
        logger.error(`Error checking if date is today: ${allowanceData.changeDate}`, dateError);
        isChangeDateToday = false;
      }

      // Store in allowances_workflow table
      try {
        await this.allowanceWorkflowRepository.insertAllowanceWorkflow({
          employee_code: allowanceData.employeeCode,
          change_date: DateUtil.formatDateToBigQuery(allowanceData.changeDate),
          type: allowanceData.allowanceName,
          amount: allowanceData.changeAmount,
          custom_fields: allowanceData.customFieldsArray,
          request_id: garoonRequest.request.request_id,
          request_number: garoonRequest.request.request_number
        });
      } catch (dbError) {
        logger.error(`Error storing to allowances_workflow: ${allowanceData.employeeCode}`, dbError);
        return { success: false, error: 'Failed to store workflow data' };
      }
      
      // If change_date is today, transmit to SmartHR
      if (isChangeDateToday) {
        logger.info(`✅ Change date is today - transmitting to SmartHR for ${allowanceData.employeeCode}`);
        const result = await this.retryUtil.executeWithRetry(
          async () => await this.smartHRExtendedService.updateEmployeeAllowances(allowanceData),
          3,
          1000
        );
        logger.info(`✓ Allowance change completed: ${allowanceData.employeeCode}`);
        return { success: true, result, transmitted: true };
      } else {
        logger.info(`⏸️  Change date is not today - data stored, awaiting processing date. Employee: ${allowanceData.employeeCode}`);
        return { success: true, transmitted: false, message: 'Data stored, awaiting processing date' };
      }

    } catch (error) {
      logger.error('Allowance change processing failed', error);
      throw error;
    }
  }

  async extractAllowanceData(request) {
    const items = request.formFields || {};
    const employeeCode = items.find(field => field.field_name === garoonFields.target_employee_code)?.field_value;
    const allowanceName = items.find(field => field.field_name === ALLOWANCE_KEY_MAP.allowanceName)?.field_value.trim();
    const changeDate = items.find(field => field.field_name === ALLOWANCE_KEY_MAP.effectiveDate)?.field_value;
    const changeAmount = this.parseAmount(items.find(field => field.field_name === ALLOWANCE_KEY_MAP.changeAmount)?.field_value);
    const details = items.find(field => field.field_name === ALLOWANCE_KEY_MAP['details'])?.field_value || null;
    
    logger.debug(`Extracted fields - employeeCode: ${employeeCode}, allowanceName: ${allowanceName}, changeDate: ${changeDate}, changeAmount: ${changeAmount}`);

    var position_allowance = '';
    var managers_allowance = '';
    var special_allowance = '';
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
        special_allowance = changeAmount;
        break;
      case '赴任手当':
        relocation_allowance = changeAmount;
        break;
      case '車両手当':
        vehicle_allowance = changeAmount;
        break;
    }

    const cfields = {};
    //cfields[ALLOWANCE_CUSTOM_KEY_MAP.allowanceName] = allowanceName;
    cfields[smarthr_custom_fields.position_allowance] = position_allowance;
    cfields[smarthr_custom_fields.managers_allowance] = managers_allowance;
    cfields[smarthr_custom_fields.special_allowance] = special_allowance;
    cfields[smarthr_custom_fields.relocation_allowance] = relocation_allowance;
    cfields[smarthr_custom_fields.vehicle_allowance] = vehicle_allowance;
    //cfields[ALLOWANCE_CUSTOM_KEY_MAP.changeDate] = changeDate;
    //cfields[ALLOWANCE_CUSTOM_KEY_MAP.changeAmount] = changeAmount;
    //cfields[ALLOWANCE_CUSTOM_KEY_MAP.changeDetails] = details;

    const customFieldTemplates = await this.smartHRRepository.getCustomFieldTemplates();
    const customFieldsArray = FormatterUtil.buildCustomFieldsArray(cfields, customFieldTemplates);

    if (!details) {
      logger.warn('No details field found in request');
    }
    
    return {
      employeeCode: employeeCode,
      allowanceName: allowanceName,
      changeDate: changeDate,
      changeAmount: changeAmount,
      //details: details,
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
