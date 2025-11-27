import { SmartHRExtendedService } from '../services/smarthr-extended.service.js';
import { SmartHRService } from '../services/smarthr.service.js';
import { RetryUtil } from '../utils/retry.util.js';
import { logger } from '../utils/logger.util.js';
import { FormatterUtil } from '../utils/formatter.util.js';
import { CHANGE_CUSTOM_FIELDS, CHANGE_KEY_MAP } from '../config/unified_change.config.js';
import { garoonFields } from '../config/garoon.config.js';
import { SmartHRRepository } from '../repositories/smarthr.repository.js';
import { smarthr_custom_fields } from '../config/smarthr.config.js';

export class UnifiedEmployeeChangeProcessor {
  constructor() {
    this.smartHRRepository = new SmartHRRepository();
    this.smartHRService = new SmartHRExtendedService();
    this.smartHRBaseService = new SmartHRService();
    this.retryUtil = new RetryUtil();
  }

  async process(garoonRequest) {
    logger.info(`Processing employee changes for request: ${garoonRequest.request.request_id}`);

    try {
      const changeData = await this.extractChangeData(garoonRequest);
      logger.info('🟢 CHANGE.process - Extracted Data:', JSON.stringify({ changeData }, null, 2));

      if (!changeData.emp_code) {
        throw new Error('Missing employee code for change update.');
      }

      // Update employee changes in SmartHR
      const result = await this.retryUtil.executeWithRetry(
        async () => await this.smartHRService.updateEmployeeChanges(changeData),
        3,
        1000
      );
      
      logger.info(`Employee change updated: ${changeData.emp_code}`);
      return { success: true, result };

    } catch (error) {
      logger.error('Employee change processing failed', error);
      throw error;
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
        position = parsedDetails.newPosition;
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
}
