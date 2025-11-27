import { SmartHRExtendedService } from '../services/smarthr-extended.service.js';
import { SmartHRRepository } from '../repositories/smarthr.repository.js';
import { RetryUtil } from '../utils/retry.util.js';
import { FormatterUtil } from '../utils/formatter.util.js';
import { logger } from '../utils/logger.util.js';
import { SECONDMENT_KEY_MAP, SECONDMENT_CUSTOM_KEY_MAP } from '../config/secondment.config.js';
import { SmartHRService } from '../services/smarthr.service.js';

export class EmployeeSecondmentProcessor {
  constructor() {
    this.smartHRService = new SmartHRService();
    this.smartHRExtendedService = new SmartHRExtendedService();
    this.smartHRRepository = new SmartHRRepository();
    this.retryUtil = new RetryUtil();
  }

  async process(garoonRequest) {
    logger.info(`Processing employee secondment for request: ${garoonRequest.request.request_id}`);

    try {
      const secondmentData = await this.extractSecondmentData(garoonRequest);
      
      logger.info('🟢 SECONDMENT.process - Extracted Data:', JSON.stringify({ secondmentData }, null, 2));
      
      if (!secondmentData.employeeCode) {
        throw new Error('Missing required fields for secondment: Employee Code');
      }

      const secondmentType = this.determineSecondmentType(secondmentData);

      // Update employee secondment status in SmartHR
      const result = await this.retryUtil.executeWithRetry(
        async () => await this.smartHRExtendedService.updateEmployeeSecondment(secondmentData),
        3,
        1000
      );

      logger.info(`Employee secondment completed: ${secondmentData.employeeCode}`);
      return { success: true, result, secondmentType };

    } catch (error) {
      logger.error('Employee secondment failed', error);
      throw error;
    }
  }

  async extractSecondmentData(request) {
    const items = request.formFields || {};
    const typeField = items.find(field => field.field_name === SECONDMENT_KEY_MAP.secondment_type)?.field_value;
    const employeeCode = items.find(field => field.field_name === SECONDMENT_KEY_MAP.employee_code)?.field_value;
    const transferTo = items.find(field => field.field_name === SECONDMENT_KEY_MAP.transferTo)?.field_value;

    // Check department if already exist in SmartHR
    let department = transferTo;
    let department_ids = [];
    
    if (transferTo) {
      const departments = await this.smartHRService.getDepartments(500);
      logger.debug('Available departments:', departments.map(d => d.name));
      
      const normalizedDeptName = transferTo.trim().replace(/[/／]/g, '／');
      
      const existingDept = departments.find(dept => {
        if (!dept.name) return false;
        const normalizedSmartHRName = dept.name.trim().replace(/[/／]/g, '／');
        return normalizedSmartHRName === normalizedDeptName;
      });
      
      logger.debug('Looking for department:', transferTo);
      logger.debug('Normalized to:', normalizedDeptName);
      logger.debug('Found matching department:', existingDept);
      
      if (existingDept) {
        department_ids = [existingDept.id];
        department = undefined;
      }
    }

    const detailField = items.find(field => field.field_name === SECONDMENT_KEY_MAP.details);
    const detailValue = detailField.field_value;
    //const lines = this.convertLinesToObject(detailValue.split(/\r?\n/).map(line => line.trim()).filter(Boolean));

    const cfields = {};
    cfields[SECONDMENT_CUSTOM_KEY_MAP.secondmentDetails] = detailValue;

    const customFieldTemplates = await this.smartHRRepository.getCustomFieldTemplates();
    const custom_fields = FormatterUtil.buildCustomFieldsArray(cfields, customFieldTemplates);
    
    if(typeField === SECONDMENT_KEY_MAP.transfertType){
      return {
        employeeCode: employeeCode ? employeeCode : null,
        ...(department_ids.length > 0 ? { department_ids } : { department }),
        custom_fields
      };
    } else {
      return {
        employeeCode: employeeCode ? employeeCode : null,
        custom_fields
      };
    }
  }

  determineSecondmentType(data) {
    if (data.secondmentType === '転籍') return 'TRANSFER';
    if (data.secondmentType === '出向') return 'SECONDMENT';
    return 'INDEFINITE_SECONDMENT';
  }

  findValue(items, fieldName) {
    const item = Object.values(items).find(i => i.name === fieldName);
    return item?.value || null;
  }

  convertLinesToObject(lines) {
    const dataObject = {};
    const keyValueRegex = /^(.+?)[:：]\s*(.+)$/;
    const bracketRegex = /^【(.+?)】(.+)$/;
    const nameKeys = new Set(
      [SECONDMENT_KEY_MAP?.name, '氏名', '氏　名'].filter(Boolean)
    );
    const names = [];

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

        if (nameKeys.has(japaneseKey)) {
          const codeMatch = rawValue.match(/[（(]([^（）()]+)[)）]/);
          const code = codeMatch ? (codeMatch[1]?.trim() || null) : null;
          const cleanedName = rawValue
            .replace(/[（(][^（）()]+[)）]/g, '')
            .trim();

          names.push({
            name: cleanedName || rawValue,
            code: code || null
          });
        }
        
        const englishKey = SECONDMENT_KEY_MAP[japaneseKey];
        if (englishKey) {
          dataObject[englishKey] = rawValue;
        }
      }
    });

    dataObject.names = names;
    return dataObject;
  }
}
