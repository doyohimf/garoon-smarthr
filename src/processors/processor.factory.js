import { EmployeeTransferProcessor } from './transfer.processor.js';
import { EmployeePromotionProcessor } from './promotion.processor.js';
import { EmployeeSalaryChangeProcessor } from './salary-change.processor.js';
import { EmployeeSecondmentProcessor } from './secondment.processor.js';
import { EmployeeLeaveProcessor } from './leave.processor.js';
import { EmployeeAllowanceChangeProcessor } from './allowance-change.processor.js';
import { EmployeeResignationProcessor } from './resignation.processor.js';
import { UnifiedEmployeeChangeProcessor } from './employee-change.processor.js';
import { logger } from '../utils/logger.util.js';

export class ProcessorFactory {
  constructor() {
    this.processors = {
      TRANSFER: new EmployeeTransferProcessor(),
      PROMOTION: new EmployeePromotionProcessor(),
      DEMOTION: new EmployeePromotionProcessor(),
      SALARY_CHANGE: new EmployeeSalaryChangeProcessor(),
      SECONDMENT: new EmployeeSecondmentProcessor(),
      LEAVE: new EmployeeLeaveProcessor(),
      RETURN: new EmployeeLeaveProcessor(),
      ALLOWANCE_CHANGE: new EmployeeAllowanceChangeProcessor(),
      RESIGNATION: new EmployeeResignationProcessor(),
      UNIFIED_CHANGE: new UnifiedEmployeeChangeProcessor()
    };
  }

/**
   * Determine request type from Garoon request data
   * @param {Object} garoonRequest - Garoon request object
   * @returns {string|null} Request type
   */
  determineRequestType(garoonRequest) {
    const requestName = garoonRequest.name?.toLowerCase() || '';
    const items = garoonRequest.items || {};
    
    // Check if request has Details fields - use unified processor
    // Match patterns: 'Details 1', 'Details 2', 'Details1', '詳細 1', '詳細1', etc.
    const hasDetailsFields = Object.values(items).some(item => {
      const name = item.name || '';
      
      // Match '詳細' followed by optional space(s) and number
      const matchesJp = /^詳細\s*\d+$/.test(name.trim());
      
      return matchesJp;
    });

    const hasRequestCategory = Object.values(items).some(item => {
      const name = item.name || '';
      // Match exact '種別' with no spaces or numbers
      const matchesJp = /^種別$/.test(name.trim());
      return matchesJp ? item.values : null;
    });
    
    if (hasDetailsFields) {
      logger.info('Request contains Details fields, using unified processor');
      return 'UNIFIED_CHANGE';
    }
    
    // Check request name patterns
    if (requestName.includes('異動') || requestName.includes('転勤')) {
      return 'TRANSFER';
    }
    
    if (requestName.includes('昇格') || requestName.includes('昇進')) {
      return 'PROMOTION';
    }
    
    if (requestName.includes('降格')) {
      return 'DEMOTION';
    }
    
    if (requestName.includes('給与改定') || requestName.includes('昇給')) {
      return 'SALARY_CHANGE';
    }
    
    if (requestName.includes('出向') || requestName.includes('転籍')) {
      return 'SECONDMENT';
    }
    
    if (requestName.includes('休職')) {
      return 'LEAVE';
    }
    
    if (requestName.includes('復職') || hasRequestCategory === '復職') {
      return 'RETURN';
    }
    
    if (requestName.includes('手当変更') || requestName.includes('手当改定')) {
      return 'ALLOWANCE_CHANGE';
    }
    
    if (requestName.includes('退職') || requestName.includes('退社')) {
      return 'RESIGNATION';
    }
    
    // Check by form fields as fallback
    const fieldNames = Object.values(items).map(item => item.name || '').join(' ');
    
    if (fieldNames.includes('異動先部署') || fieldNames.includes('異動後部署')) {
      return 'TRANSFER';
    }
    
    if (fieldNames.includes('新職位') || fieldNames.includes('新等級')) {
      return 'PROMOTION';
    }
    
    if (fieldNames.includes('新基本給') || fieldNames.includes('給与改定')) {
      return 'SALARY_CHANGE';
    }
    
    if (fieldNames.includes('出向先') || fieldNames.includes('出向元')) {
      return 'SECONDMENT';
    }
    
    if (fieldNames.includes('休職開始日')) {
      return 'LEAVE';
    }
    
    if (fieldNames.includes('復職日')) {
      return 'RETURN';
    }
    
    if (fieldNames.includes('新通勤手当') || fieldNames.includes('新住宅手当')) {
      return 'ALLOWANCE_CHANGE';
    }
    
    if (fieldNames.includes('退職日') || fieldNames.includes('最終出勤日')) {
      return 'RESIGNATION';
    }
    
    logger.warn(`Could not determine request type for: ${requestName}`);
    return null;
  }

  /**
   * Process request with appropriate processor
   * @param {Object} requestData - Request data (can be Garoon or BigQuery format)
   * @returns {Object} Processing result
   */
  async processRequest(requestData) {
    // Check if data is from BigQuery (has formFields array)
    const isBigQueryData = requestData.formFields && Array.isArray(requestData.formFields);
    
    let requestType;
    
    if (isBigQueryData) {
      // For BigQuery data, check formFields for Details pattern
      // Match patterns: 'Details 1', 'Details 2', 'Details1', '詳細 1', '詳細1', etc.
      const hasDetailsFields = requestData.formFields.some(field => {
        const fieldName = field.field_name || '';
        
        // Match '詳細' followed by optional space(s) and number
        const matchesJp = /^詳細\s*\d+$/.test(fieldName.trim());
        
        return matchesJp;
      });
      
      if (hasDetailsFields) {
        requestType = 'UNIFIED_CHANGE';
      } else {
        // Try to determine from request name
        requestType = this.determineRequestType(requestData.request || {});
      }
    } else {
      // For Garoon data
      requestType = this.determineRequestType(requestData);
    }
    
    if (!requestType) {
      return {
        success: false,
        error: 'Could not determine request type',
        requestId: requestData.id || requestData.request?.request_id
      };
    }
    
    const processor = this.getProcessor(requestType);
    
    if (!processor) {
      return {
        success: false,
        error: `No processor available for type: ${requestType}`,
        requestId: requestData.id || requestData.request?.request_id,
        requestType
      };
    }
    
    try {
      logger.info(`Processing request as type: ${requestType}`);
      
      // Handle special case for leave/return
      if (requestType === 'LEAVE') {
        return await processor.processLeave(requestData);
      } else if (requestType === 'RETURN') {
        return await processor.processReturnLeave(requestData);
      } else if (requestType === 'UNIFIED_CHANGE') {
        // Unified processor expects BigQuery format
        return await processor.process(requestData);
      } else {
        return await processor.process(requestData);
      }
      
    } catch (error) {
      logger.error(`Failed to process ${requestType} request`, error);
      return {
        success: false,
        error: error.message,
        requestId: requestData.id || requestData.request?.request_id,
        requestType
      };
    }
  }

  /**
   * Get processor based on request type
   * @param {string} requestType - Type of Garoon request
   * @returns {Object} Processor instance
   */
  getProcessor(requestType) {
    const processor = this.processors[requestType];
    
    if (!processor) {
      logger.warn(`No processor found for request type: ${requestType}`);
      return null;
    }
    
    return processor;
  }

  /**
   * Determine request type from Garoon request data
   * @param {Object} garoonRequest - Garoon request object
   * @returns {string|null} Request type
   */
  determineRequestType(garoonRequest) {
    const requestName = garoonRequest.name?.toLowerCase() || '';
    const items = garoonRequest.items || {};
    
    // Check request name patterns
    if (requestName.includes('異動') || requestName.includes('転勤')) {
      return 'TRANSFER';
    }
    
    if (requestName.includes('昇格') || requestName.includes('昇進')) {
      return 'PROMOTION';
    }
    
    if (requestName.includes('降格')) {
      return 'DEMOTION';
    }
    
    if (requestName.includes('給与改定') || requestName.includes('昇給')) {
      return 'SALARY_CHANGE';
    }
    
    if (requestName.includes('出向') || requestName.includes('転籍')) {
      return 'SECONDMENT';
    }
    
    if (requestName.includes('休職')) {
      return 'LEAVE';
    }
    
    if (requestName.includes('復職')) {
      return 'RETURN';
    }
    
    if (requestName.includes('手当変更') || requestName.includes('手当改定')) {
      return 'ALLOWANCE_CHANGE';
    }
    
    if (requestName.includes('退職') || requestName.includes('退社')) {
      return 'RESIGNATION';
    }
    
    // Check by form fields as fallback
    const fieldNames = Object.values(items).map(item => item.name || '').join(' ');
    
    if (fieldNames.includes('異動先部署') || fieldNames.includes('異動後部署')) {
      return 'TRANSFER';
    }
    
    if (fieldNames.includes('新職位') || fieldNames.includes('新等級')) {
      return 'PROMOTION';
    }
    
    if (fieldNames.includes('新基本給') || fieldNames.includes('給与改定')) {
      return 'SALARY_CHANGE';
    }
    
    if (fieldNames.includes('出向先') || fieldNames.includes('出向元')) {
      return 'SECONDMENT';
    }
    
    if (fieldNames.includes('休職開始日')) {
      return 'LEAVE';
    }
    
    if (fieldNames.includes('復職日')) {
      return 'RETURN';
    }
    
    if (fieldNames.includes('新通勤手当') || fieldNames.includes('新住宅手当')) {
      return 'ALLOWANCE_CHANGE';
    }
    
    if (fieldNames.includes('退職日') || fieldNames.includes('最終出勤日')) {
      return 'RESIGNATION';
    }
    
    logger.warn(`Could not determine request type for: ${requestName}`);
    return null;
  }

  /**
   * Process request with appropriate processor
   * @param {Object} garoonRequest - Garoon request object
   * @returns {Object} Processing result
   */
  async processRequest(garoonRequest) {
    const requestType = this.determineRequestType(garoonRequest);
    
    if (!requestType) {
      return {
        success: false,
        error: 'Could not determine request type',
        requestId: garoonRequest.id
      };
    }
    
    const processor = this.getProcessor(requestType);
    
    if (!processor) {
      return {
        success: false,
        error: `No processor available for type: ${requestType}`,
        requestId: garoonRequest.id,
        requestType
      };
    }
    
    try {
      logger.info(`Processing request ${garoonRequest.id} as type: ${requestType}`);
      
      // Handle special case for leave/return
      if (requestType === 'LEAVE') {
        return await processor.processLeave(garoonRequest);
      } else if (requestType === 'RETURN') {
        return await processor.processReturnLeave(garoonRequest);
      } else {
        return await processor.process(garoonRequest);
      }
      
    } catch (error) {
      logger.error(`Failed to process ${requestType} request`, error);
      return {
        success: false,
        error: error.message,
        requestId: garoonRequest.id,
        requestType
      };
    }
  }

  /**
   * Get all available request types
   * @returns {Array<string>} List of request types
   */
  getAvailableTypes() {
    return Object.keys(this.processors);
  }
}