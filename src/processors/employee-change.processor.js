import { SmartHRExtendedService } from '../services/smarthr-extended.service.js';
import { SmartHRService } from '../services/smarthr.service.js';
import { RetryUtil } from '../utils/retry.util.js';
import { logger } from '../utils/logger.util.js';
import { FormatterUtil } from '../utils/formatter.util.js';
import { CHANGE_CUSTOM_FIELDS, CHANGE_KEY_MAP } from '../config/unified_change.config.js';
import { garoonFields } from '../config/garoon.config.js';
import { SmartHRRepository } from '../repositories/smarthr.repository.js';
import { smarthr_custom_fields } from '../config/smarthr.config.js';
import { EmailService } from '../services/email.service.js';
import { BigQueryService } from '../services/bigquery.service.js';
import { DateUtil } from '../utils/date.util.js';

export class UnifiedEmployeeChangeProcessor {
  constructor() {
    this.smartHRRepository = new SmartHRRepository();
    this.smartHRService = new SmartHRExtendedService();
    this.smartHRBaseService = new SmartHRService();
    this.retryUtil = new RetryUtil();
    this.emailService = new EmailService();
    this.bigQueryService = new BigQueryService();
  }

  async process(garoonRequest) {
    logger.info(`Processing employee changes for request: ${garoonRequest.request.request_id}`);

    try {
      const changeData = await this.extractChangeData(garoonRequest);
      logger.info('🟢 CHANGE.process - Extracted Data:', JSON.stringify({ changeData }, null, 2));

      if (!changeData.emp_code) {
        throw new Error('Missing employee code for change update.');
      }

      // Extract effective date for date-based logic
      const effectiveDate = this.extractEffectiveDate(garoonRequest);
      
      if (!effectiveDate) {
        logger.warn('Missing effective date - processing immediately');
      }

      // Check if request already exists in empchanges_workflow
      try {
        const requestExists = await this.checkIfRequestExists(
          garoonRequest.request.request_id,
          garoonRequest.request.request_number
        );
        
        if (requestExists) {
          logger.warn(`⏭️  Skipping duplicate entry - request_id: ${garoonRequest.request.request_id}`);
          return { success: true, transmitted: false, message: 'Duplicate request - skipped' };
        }
      } catch (dupCheckError) {
        logger.error(`Error checking for duplicate request`, dupCheckError);
        return { success: false, error: 'Failed to check for duplicates' };
      }

      // Check if effective date is today or recent
      let isEffectiveDateRecent = true; // Default to immediate processing if no date
      if (effectiveDate) {
        try {
          isEffectiveDateRecent = DateUtil.isWithinPastDays(effectiveDate, 0); // Only today
          logger.info(`Effective date "${effectiveDate}" is today? ${isEffectiveDateRecent}`);
        } catch (dateError) {
          logger.error(`Error checking if date is today: ${effectiveDate}`, dateError);
          isEffectiveDateRecent = true; // Default to immediate processing on error
        }
      }

      // Store in empchanges_workflow table
      if (effectiveDate) {
        try {
          await this.storeEmployeeChangeWorkflow(changeData, effectiveDate, garoonRequest);
        } catch (dbError) {
          logger.error(`Error storing to empchanges_workflow: ${changeData.emp_code}`, dbError);
          return { success: false, error: 'Failed to store workflow data' };
        }
      }

      // If effective date is today or missing (immediate), transmit to SmartHR
      if (isEffectiveDateRecent) {
        logger.info(`✅ Effective date is today/immediate - transmitting to SmartHR for ${changeData.emp_code}`);
        
        const result = await this.retryUtil.executeWithRetry(
          async () => await this.smartHRService.updateEmployeeChanges(changeData),
          3,
          1000
        );
        
        logger.info(`Employee change updated: ${changeData.emp_code}`);
        return { success: true, result, transmitted: true };
      } else {
        logger.info(`⏸️  Effective date is future - data stored, awaiting processing date. Employee: ${changeData.emp_code}`);
        return { success: true, transmitted: false, message: 'Data stored, awaiting processing date' };
      }

    } catch (error) {
      logger.error('Employee change processing failed', error);
      throw error;
    }
  }

  async processDirectChange(changeData) {
    logger.info(`Processing direct employee change for: ${changeData.emp_code}`);

    try {
      if (!changeData.emp_code) {
        throw new Error('Missing employee code for change update.');
      }

      // Handle positions if specified
      if (changeData.position) {
        const positionId = await this.smartHRBaseService.findOrCreatePosition(changeData.position);
        if (!positionId) {
          logger.warn(`Position not found in SmartHR: ${changeData.position} for employee: ${changeData.emp_code}`);
          await this.emailService.sendErrorNotification({
            requestId: 'DIRECT_CHANGE',
            requestName: 'Direct Employee Change Processing',
            processorType: 'UnifiedEmployeeChangeProcessor',
            errorMessage: `Position "${changeData.position}" does not exist in SmartHR. Please create the position before processing this change request.`,
            additionalData: {
              employee_code: changeData.emp_code,
              position_requested: changeData.position,
              action: 'SKIPPED - Position not found'
            }
          });
          throw new Error(`Position "${changeData.position}" does not exist in SmartHR. Processing skipped.`);
        }
      }

      // Update employee changes in SmartHR
      const result = await this.retryUtil.executeWithRetry(
        async () => await this.smartHRService.updateEmployeeChanges(changeData),
        3,
        1000
      );
      
      logger.info(`Direct employee change updated: ${changeData.emp_code}`);
      return { success: true, result };

    } catch (error) {
      logger.error('Direct employee change processing failed', error);
      return { success: false, error: error.message };
    }
  }

  async extractChangeData(request) {
    const items = request.formFields || {};

    const employee_code = items.find(field => field.field_name === garoonFields.target_employee_code)?.field_value;
    const effectiveDate = items.find(field => field.field_name === CHANGE_KEY_MAP.effectivityDate)?.field_value;
    const classification = items.find(field => field.field_name === CHANGE_KEY_MAP.classification)?.field_value;
    const detail = items.find(field => field.field_name === garoonFields.details)?.field_value || '';
    
    // Parse details to extract key-value pairs
    const parsedDetails = this.parseDetailsField(detail.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
    
    // Handle positions (check if exists in SmartHR)
    let positions = [];
    let position = undefined;
    
    if (parsedDetails.newPosition) {
      const positionId = await this.smartHRBaseService.findOrCreatePosition(parsedDetails.newPosition);
      if (positionId) {
        positions = [positionId];
      } else {
        // Position does not exist - send email notification and skip processing
        logger.warn(`Position not found in SmartHR: ${parsedDetails.newPosition} for employee: ${employee_code}`);
        await this.emailService.sendErrorNotification({
          requestId: request.request?.request_id || 'Unknown',
          requestName: 'Employee Change Processing',
          processorType: 'UnifiedEmployeeChangeProcessor',
          errorMessage: `Position "${parsedDetails.newPosition}" does not exist in SmartHR. Please create the position before processing this change request.`,
          additionalData: {
            employee_code,
            position_requested: parsedDetails.newPosition,
            effective_date: effectiveDate,
            action: 'SKIPPED - Position not found'
          }
        });
        throw new Error(`Position "${parsedDetails.newPosition}" does not exist in SmartHR. Processing skipped.`);
      }
    }
    
    const cfields = {};
    cfields[CHANGE_CUSTOM_FIELDS.classification] = classification;
    cfields[CHANGE_CUSTOM_FIELDS.effectivityDate] = effectiveDate;
    //cfields[CHANGE_CUSTOM_FIELDS.newPosition] = parsedDetails.newPosition;
    cfields[CHANGE_CUSTOM_FIELDS.newSalary] = parsedDetails.newSalary;
    cfields[smarthr_custom_fields.position_allowance] = this.cleanNumericValue(parsedDetails.jobAllowance);

    const customFieldTemplates = await this.smartHRRepository.getCustomFieldTemplates();
    const custom_fields = FormatterUtil.buildCustomFieldsArray(cfields, customFieldTemplates);
    
    const result = {
      emp_code: employee_code,
      position: parsedDetails.newPosition,
      custom_fields
    };
    
    return result;
  }

  parseDetailLines(text) {
    const dataObject = {};
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const keyValueRegex = /^(.+?)[:：]\s*(.+)$/;
    const bracketRegex = /^【(.+?)】(.+)$/;

    lines.forEach(line => {
      let match = line.match(keyValueRegex);
      let key, value;

      if (match) {
        key = match[1].trim();
        value = match[2].trim();
      } else {
        match = line.match(bracketRegex);
        if (match) {
          key = match[1].trim();
          value = match[2].trim();
        }
      }

      if (key && value) {
        dataObject[key] = value;
      }
    });

    return dataObject;
  }

  findValue(items, fieldName) {
    if (!items || typeof items !== 'object') {
      return null;
    }
    
    return items[fieldName] || null;
  }

  extractDateFromText(text) {
    const dateMatch = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (dateMatch) {
      return `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    }
    return null;
  }

  parseDetailsField(lines) {
    const dataObject = {};
    const keyValueRegex = /^(.+?)[:：]\s*(.+)$/;
    const bracketRegex = /^【(.+?)】(.+)$/;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match = line.match(keyValueRegex);
      let japaneseKey, rawValue;

      if (match) {
        japaneseKey = match[1].trim();
        rawValue = match[2].trim();
      } else {
        match = line.match(bracketRegex);
        if (match) {
          japaneseKey = match[1].trim();
          rawValue = match[2].trim();
        } else if (line.match(/^【(.+?)】$/)) {
          japaneseKey = line.match(/^【(.+?)】$/)[1].trim();
          const nextLineIndex = i + 1;
          if (nextLineIndex < lines.length) {
            const nextLine = lines[nextLineIndex];
            if (nextLine.startsWith('・')) {
              rawValue = nextLine.replace(/^・/, '').trim();
              i++;
            }
          }
        }
      }

      if (japaneseKey && rawValue) {
        if (japaneseKey === '異動適用日' || japaneseKey === '異動日') {
          const dateMatch = rawValue.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
          if (dateMatch) {
            const [, year, month, day] = dateMatch;
            rawValue = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }
        
        // Parse monthly working hours (format: 175.0時間＋固定残業10.0時間＝185.0時間)
        if (japaneseKey === '月間勤務時間数') {
          const hoursMatch = rawValue.match(/(\d+\.?\d*)時間.*?固定残業(\d+\.?\d*)時間/);
          if (hoursMatch) {
            dataObject['monthlyWorkingHours'] = hoursMatch[1] + '時間';
            dataObject['fixedOvertime'] = hoursMatch[2] + '時間';
            dataObject['月間勤務時間数'] = rawValue;
            
            // Calculate total
            const total = parseFloat(hoursMatch[1]) + parseFloat(hoursMatch[2]);
            dataObject['totalMonthlyHours'] = total + '時間';
          } else {
            // Simple format without overtime
            dataObject[japaneseKey] = rawValue;
          }
        } else {
          dataObject[japaneseKey] = rawValue;
        }

        const englishKey = CHANGE_KEY_MAP[japaneseKey];
        if (englishKey && japaneseKey !== '月間勤務時間数') {
          dataObject[englishKey] = rawValue;
        }
      }
    }

    return dataObject;
  }

  cleanNumericValue(value) {
    if (!value) return null;
    
    // Convert to string if not already
    const strValue = String(value);
    
    // Remove all non-digit characters
    const cleanedValue = strValue.replace(/\D/g, '');
    
    // Return null if empty after cleaning, otherwise return the numeric string
    return cleanedValue ? cleanedValue : null;
  }

  extractEffectiveDate(garoonRequest) {
    try {
      const formFields = garoonRequest.formFields || [];
      
      // Look for effective date field
      const effectiveDateField = formFields.find(field => 
        field.field_name === CHANGE_KEY_MAP.effectivityDate ||
        field.field_name === '発効日' ||
        field.field_name === '異動適用日' ||
        field.field_name === '適用開始日' ||
        field.field_name.includes('発効') ||
        field.field_name.includes('適用')
      );
      
      if (effectiveDateField && effectiveDateField.field_value) {
        return effectiveDateField.field_value;
      }
      
      // Also check in parsed details
      const details = formFields.find(field => field.field_name === garoonFields.details)?.field_value || '';
      const parsedDetails = this.parseDetailsField(details.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
      
      return parsedDetails.effectivityDate || parsedDetails.transferDate || null;
    } catch (error) {
      logger.warn('Failed to extract effective date:', error);
      return null;
    }
  }

  async checkIfRequestExists(requestId, requestNumber) {
    try {
      return await this.bigQueryService.checkGaroonRequestExists(requestId, requestNumber);
    } catch (error) {
      logger.error('Error checking if request exists:', error);
      return false;
    }
  }

  async storeEmployeeChangeWorkflow(changeData, effectiveDate, garoonRequest) {
    try {
      const empChangeRecord = {
        employee_code: changeData.emp_code,
        change_date: DateUtil.formatDateToBigQuery(effectiveDate),
        type: this.getChangeType(changeData),
        position: changeData.position || null,
        classification: this.getClassification(changeData),
        new_salary: this.getNewSalary(changeData),
        position_allowance: this.getPositionAllowance(changeData),
        for_process: 1, // Mark as pending for processing
        custom_fields: JSON.stringify(changeData.custom_fields || []),
        inserted_at: new Date().toISOString(),
        transmitted_at: null,
        request_id: garoonRequest.request.request_id,
        request_number: garoonRequest.request.request_number
      };

      await this.bigQueryService.insertEmpChange(empChangeRecord);
      logger.info(`Stored employee change workflow: ${changeData.emp_code} for ${effectiveDate}`);
    } catch (error) {
      logger.error('Failed to store employee change workflow:', error);
      throw error;
    }
  }

  getChangeType(changeData) {
    // Extract change type from custom fields
    const classificationField = changeData.custom_fields?.find(cf => 
      cf.template_id === CHANGE_CUSTOM_FIELDS.classification
    );
    return classificationField?.value || 'CHANGE';
  }

  getClassification(changeData) {
    // Extract classification from custom fields
    const classificationField = changeData.custom_fields?.find(cf => 
      cf.template_id === CHANGE_CUSTOM_FIELDS.classification
    );
    return classificationField?.value || null;
  }

  getNewSalary(changeData) {
    // Extract new salary from custom fields
    const salaryField = changeData.custom_fields?.find(cf => 
      cf.template_id === CHANGE_CUSTOM_FIELDS.newSalary
    );
    return salaryField?.value ? parseFloat(salaryField.value) : null;
  }

  getPositionAllowance(changeData) {
    // Extract position allowance from custom fields
    const allowanceField = changeData.custom_fields?.find(cf => 
      cf.template_id === smarthr_custom_fields.position_allowance
    );
    return allowanceField?.value ? parseFloat(allowanceField.value) : null;
  }
}
