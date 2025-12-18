import { SmartHRExtendedService } from '../services/smarthr-extended.service.js';
import { SmartHRService } from '../services/smarthr.service.js';
import { RetryUtil } from '../utils/retry.util.js';
import { logger } from '../utils/logger.util.js';
import { FormatterUtil } from '../utils/formatter.util.js';
import { LEAVES_CUSTOM_FIELDS, LEAVES_KEY_MAP } from '../config/leaves.config.js';
import { garoonFields } from '../config/garoon.config.js';
import { SmartHRRepository } from '../repositories/smarthr.repository.js';

export class EmployeeLeaveProcessor {
  constructor() {
    this.smartHRRepository = new SmartHRRepository();
    this.smartHRService = new SmartHRExtendedService();
    this.smartHRBaseService = new SmartHRService();
    this.retryUtil = new RetryUtil();
  }

  async processLeave(garoonRequest) {
    logger.info(`Processing employee leave for request: ${garoonRequest.request.request_id}`);

    try {
      const leaveData = await this.extractLeaveData(garoonRequest);
      if (!leaveData.employeeCode) {
        throw new Error('Missing required fields for leave: Employee code is missing');
      }

      const result = await this.retryUtil.executeWithRetry(
        async () => await this.smartHRService.updateEmployeeLeaveStatus(leaveData),
        3,
        1000
      );
      
      logger.info(`Employee leave processed: ${leaveData.employeeCode}`);
      return { success: true, result };
    } catch (error) {
      logger.error('Employee leave processing failed', error);
      throw error;
    }
  }

  async processReturnLeave(garoonRequest) {
    logger.info(`Processing employee return for request: ${garoonRequest.request.request_id}`);

    try {
      const returnData = this.extractReturnLeaveData(garoonRequest);
      
      if (!returnData.employeeCode) {
        throw new Error('Missing required fields for return: employee code is missing');
      }

      // Update employee return status in SmartHR
      const result = await this.retryUtil.executeWithRetry(
        async () => await this.smartHRService.updateEmployeeReturnStatus(returnData),
        3,
        1000
      );

      logger.info(`Employee return processed: ${returnData.employeeCode}`);
      return { success: true, result };

    } catch (error) {
      logger.error('Employee return processing failed', error);
      throw error;
    }
  }

  async extractLeaveData(request) {
    const items = request.formFields || {};

    const detailValue = items.find(field => field.field_name === garoonFields.details)?.field_value;
    const employeeCode = items.find(field => field.field_name === garoonFields.target_employee_code)?.field_value;
    console.log(employeeCode);
    const cfields = {};
    cfields[LEAVES_CUSTOM_FIELDS.details] = detailValue;
    cfields[LEAVES_CUSTOM_FIELDS.empStatus] = 'on_leave';

    const customFieldTemplates = await this.smartHRRepository.getCustomFieldTemplates();
    const custom_fields = FormatterUtil.buildCustomFieldsArray(cfields, customFieldTemplates);

    return {
      emp_status: 'absent',
      employeeCode: employeeCode,
      widow_memo: detailValue,
      memo: detailValue,
      custom_fields
    };
  }

  async extractReturnLeaveData(request) {
    const items = request.formFields || {};

    const detailValue = items.find(field => field.field_name === garoonFields.details)?.field_value;
    const employeeCode = items.find(field => field.field_name === garoonFields.target_employee_code)?.field_value;
   
    const cfields = {};
    cfields[LEAVES_CUSTOM_FIELDS.details] = detailValue;
    cfields[LEAVES_CUSTOM_FIELDS.empStatus] = 'return_work';

    const customFieldTemplates = await this.smartHRRepository.getCustomFieldTemplates();
    const customFieldsArray = FormatterUtil.buildCustomFieldsArray(cfields, customFieldTemplates);

    return {
      employeeCode: employeeCode,
      emp_status: 'employed',
      // returnDate: this.findValue(lines, '復職日'),
      // dueDate: this.findValue(lines, '出産予定日'),
      // maternityleavePeriod: this.findValue(lines, LEAVES_KEY_MAP['maternityLeavePeriod']),
      // postpartumleavePeriod: this.findValue(lines, LEAVES_KEY_MAP['postpartumLeavePeriod']),
      // childcareleavePeriod: this.findValue(lines, LEAVES_KEY_MAP['childcareLeavePeriod']),
      // paternityleavePeriod: this.findValue(lines, LEAVES_KEY_MAP['paternityLeavePeriod']),
      customFieldsArray
    };
  }

  calculateDuration(startDate, endDate) {
    if (!startDate || !endDate) return null;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  parseAmount(value) {
    if (!value) return 0;
    return parseFloat(value.toString().replace(/[,円¥]/g, '')) || 0;
  }

  findValue(items, fieldName) {
    // const item = Object.values(items).find(i => i.name === fieldName);
    // console.log(fieldName, item, item?.value || null);
    // return item?.value || null;
    if (!items || typeof items !== 'object') {
        return null;
    }
    
    const value = items[fieldName];
    const logValue = value !== undefined ? value : null;
    return logValue;
  }

  /**
   * Extracts the start and end dates from a date range string.
   *
   * @param {string} dateRangeString The string containing the date range (e.g., "2025.12.16～2026.6.16").
   * @returns {{startDate: string|null, endDate: string|null}} An object containing the extracted dates in YYYY-MM-DD format, or null if parsing fails.
   */
  extractDateRange(dateRangeString) {
    if (dateRangeString === null || dateRangeString === undefined) {
      // Return the default failure object immediately if the input is null or undefined
      return {
        startDate: null,
        endDate: null,
      };
    }
    // 1. Normalize the separator and date delimiters
    // Replace full-width tilde (～) with standard tilde (~)
    let normalizedString = dateRangeString.replace(/～/g, '~');
    
    // Replace dots (.) and slashes (/) with hyphens (-) for consistent parsing
    normalizedString = normalizedString.replace(/[\./]/g, '-');

    // 2. Regular Expression for Date Extraction
    // This regex looks for two date-like strings separated by a tilde (~).
    // A date-like string is assumed to be YYYY-MM-DD (or YYYY-M-D) format.
    const regex = /(\d{4}-\d{1,2}-\d{1,2})~(\d{4}-\d{1,2}-\d{1,2})/;
    const match = normalizedString.match(regex);

    if (match) {
      // 3. Format the captured dates to ensure YYYY-MM-DD standard (e.g., 2026-6-16 -> 2026-06-16)
      const startDate = this.formatDateString(match[1]);
      const endDate = this.formatDateString(match[2]);

      return {
        startDate: startDate,
        endDate: endDate,
      };
    } else {
      // Return nulls if no match is found
      return {
        startDate: null,
        endDate: null,
      };
    }
  }

  /**
   * Helper function to ensure dates are padded to YYYY-MM-DD format.
   * E.g., '2026-6-16' becomes '2026-06-16'.
   * @param {string} dateString The date string (e.g., '2025-1-1').
   * @returns {string} The formatted date string.
   */
  formatDateString(dateString) {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      // Pad month and day with a leading zero if they are single digits
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return dateString; // Return as is if formatting fails
  }

  /**
   * Parses the array of strings extracted from the detail field into a structured object.
   * Extracts key-value pairs in format "Key：Value" or 【Key】Value and maps to standardized keys.
   */
  convertLinesToObject(lines) {
    const dataObject = {};
    const keyValueRegex = /^(.+?)[:：]\s*(.+)$/;
    const bracketRegex = /^【(.+?)】(.+)$/;

    lines.forEach(line => {
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
        }
      }

      if (japaneseKey && rawValue) {
        dataObject[japaneseKey] = rawValue;
        
        const englishKey = LEAVES_KEY_MAP[japaneseKey];
        if (englishKey) {
          dataObject[englishKey] = rawValue;
        }
      }
    });

    return dataObject;
  }
  
}
