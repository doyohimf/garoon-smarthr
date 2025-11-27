import { SmartHRExtendedService } from '../services/smarthr-extended.service.js';
import { RetryUtil } from '../utils/retry.util.js';
import { logger } from '../utils/logger.util.js';
import { FormatterUtil } from '../utils/formatter.util.js';
import { RESIGNATION_KEY_MAP } from '../config/resignation.config.js';

export class EmployeeResignationProcessor {
  constructor() {
    this.smartHRService = new SmartHRExtendedService();
    this.retryUtil = new RetryUtil();
  }

  async process(garoonRequest) {
    logger.info(`Processing employee resignation for request: ${garoonRequest.request.request_id}`);

    try {
      const resignationData = this.extractResignationData(garoonRequest);
      logger.info('🟢 RESIGNATION.process - Extracted Data:', JSON.stringify({ resignationData }, null, 2));
      
      if (!resignationData.resigned_at) {
        throw new Error('Missing resignation date');
      }

      if (!resignationData.emp_code) {
        throw new Error('Missing employee code for resignation update');
      }

      const resignationType = this.determineResignationType(resignationData);

      // // Map emp_code to employeeCode for the service
      // const updateData = {
      //   ...resignationData,
      //   employeeCode: resignationData.emp_code
      // };

      // Update employee resignation in SmartHR
      const result = await this.retryUtil.executeWithRetry(
        async () => await this.smartHRService.updateEmployeeResignation(resignationData),
        3,
        1000
      );
      
      logger.info(`Employee resignation updated: ${resignationData.emp_code}`);
      return { success: true, result, resignationType };

    } catch (error) {
      logger.error('Employee resignation processing failed', error);
      throw error;
    }
  }

  extractResignationData(request) {
    const items = request.formFields || {};
    
    const employeeCode = items.find(field => field.field_name === RESIGNATION_KEY_MAP["targetEmployeeCode"])?.field_value;
    const detailField = items.find(field => field.field_name === RESIGNATION_KEY_MAP["details"]);
    const detailValue = detailField.field_value;
    //const lastDay = items.find(field => field.field_name === RESIGNATION_KEY_MAP["lastDay"])?.field_value;
    const resignationDate = items.find(field => field.field_name === RESIGNATION_KEY_MAP["resignation_date"])?.field_value;
    //const resignationType = items.find(field => field.field_name === RESIGNATION_KEY_MAP["resignation_type"])?.field_value;
    
    const lines = this.parseDetailsField(detailValue.split(/\r?\n/).map(line => line.trim()).filter(Boolean));

    const nameParts = FormatterUtil.dissectName(lines.name);
    return {
      emp_code: employeeCode,
      emp_status: 'retired',
      resigned_reason: lines.resignation_reason || lines['退職理由'],
      resigned_at: resignationDate.replace(/-/g, '/'),
    };
  }

  determineResignationType(data) {
    const typeMap = {
      '自己都合': 'VOLUNTARY',
      '会社都合': 'COMPANY_INITIATED',
      '定年': 'RETIREMENT_AGE',
      '契約満了': 'CONTRACT_EXPIRATION',
      '懲戒解雇': 'DISCIPLINARY_DISMISSAL',
      '死亡': 'DEATH'
    };

    return typeMap[data.resignationType] || 'OTHER';
  }

  calculateYearsOfService(startDate, endDate) {
    if (!startDate || !endDate) return null;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    
    return parseFloat(diffYears.toFixed(2));
  }

  parseAmount(value) {
    if (!value) return 0;
    return parseFloat(value.toString().replace(/[,円¥]/g, '')) || 0;
  }

  findValue(items, fieldName) {
    const item = Object.values(items).find(i => i && i.name === fieldName);
    return item?.value || null;
  }

  parseDetailsField(lines) {
    const dataObject = {};
    const keyValueRegex = /^(.+?)[:：]\s*(.+)$/;
    const bracketRegex = /^【(.+?)】(.+)$/;

    // helper to strip leading decorative chars and surrounding fullwidth/normal parentheses
    const sanitizeKey = (s) => {
      if (!s) return s;
      // remove common leading bullets/markers (■, ・, •, -, ※) and fullwidth spaces
      s = s.replace(/^[\s\u3000\uFEFF■・•\-※]+/, '');
      // remove enclosing parentheses (both fullwidth and normal)
      s = s.replace(/^[（(]+|[)）]+$/g, '');
      return s.trim();
    };

    const sanitizeValue = (s) => {
      if (!s) return s;
      // trim whitespace and remove leading bullets
      s = s.trim().replace(/^[\u3000\s■・•\-※]+/, '');
      // remove enclosing parentheses (e.g. "（入社日）" or trailing ")" with spaces)
      s = s.replace(/^[（(]+|[)）]+$/g, '');
      return s.trim();
    };

    for (let i = 0; i < lines.length; i++) {
      // normalize line first to remove decorative leading markers
      let rawLine = (lines[i] || '').replace(/^[\s\u3000\uFEFF■]+/, '').trim();
      let match = rawLine.match(keyValueRegex);
      let japaneseKey, rawValue;

      if (match) {
        japaneseKey = sanitizeKey(match[1]);
        rawValue = sanitizeValue(match[2]);
      } else {
        match = rawLine.match(bracketRegex);
        if (match) {
          japaneseKey = sanitizeKey(match[1]);
          rawValue = sanitizeValue(match[2]);
        } else if (rawLine.match(/^【(.+?)】$/)) {
          // Handle bracket-only lines, look for value in next line(s)
          japaneseKey = sanitizeKey(rawLine.match(/^【(.+?)】$/)[1]);
          const nextLineIndex = i + 1;
          if (nextLineIndex < lines.length) {
            const nextLine = lines[nextLineIndex];
            if (nextLine && nextLine.startsWith('・')) {
              rawValue = sanitizeValue(nextLine.replace(/^・/, ''));
              i++; // Skip the next line since we processed it
            }
          }
        } else {
          // If the line starts with a marker like ■ and then a parenthesized key e.g. "（入社日" without colon,
          // try to capture lines like "（入社日" followed by a separate value line
          const parentheticalMatch = rawLine.match(/^[（(](.+)/);
          if (parentheticalMatch) {
            japaneseKey = sanitizeKey(parentheticalMatch[1]);
            const nextLineIndex = i + 1;
            if (nextLineIndex < lines.length) {
              rawValue = sanitizeValue(lines[nextLineIndex]);
              i++;
            }
          }
        }
      }

      if (japaneseKey && rawValue) {
        // Special parsing for dates
        if (japaneseKey === '退職日' || japaneseKey === '入社日') {
          const dateMatch = rawValue.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
          if (dateMatch) {
            const [, year, month, day] = dateMatch;
            rawValue = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }

        dataObject[japaneseKey] = rawValue;

        const englishKey = RESIGNATION_KEY_MAP[japaneseKey];
        if (englishKey) {
          dataObject[englishKey] = rawValue;
        }
      }
    }

    return dataObject;
  }
}
