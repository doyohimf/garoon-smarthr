import { logger } from './logger.util.js';

export class DetailsParserUtil {
  /**
   * Parse details from form fields that match 'Details%' pattern
   * Handles: 'Details 1', 'Details 2', 'Details 3', etc.
   * Japanese: '詳細 1', '詳細 2', '詳細 3', etc.
   * @param {Object} formFields - Request form fields from BigQuery
   * @returns {Array<Object>} Parsed details objects
   */
  parseDetailsFields(formFields) {
    try {
      // Match patterns: 'Details 1', 'Details1', 'Details  1', '詳細 1', '詳細1', etc.
      const detailsFields = formFields.filter(field => {
        const fieldName = field.field_name || '';

        // Check if field name starts with 'Details' followed by optional number
        // Accept '詳細' with optional number (allow unnumbered '詳細')
        const matchesJp = /^詳細(?:\s*\d+)?$/.test(fieldName.trim());
        
        return matchesJp;
      });

      if (detailsFields.length === 0) {
        logger.warn('No details fields found');
        return [];
      }

      logger.info(`Found ${detailsFields.length} details fields`);

      // Sort by detail number
      const sortedFields = this.sortDetailFields(detailsFields);

      const parsedDetails = sortedFields.map((field, index) => {
        logger.debug(`Parsing detail field ${index + 1}: ${field.field_name}`);
        return this.parseDetailValue(field.field_value);
      }).filter(detail => detail !== null);
      logger.info(`Parsed ${parsedDetails.length} detail records`);
      return parsedDetails;

    } catch (error) {
      logger.error('Error parsing details fields', error);
      return [];
    }
  }

  /**
   * Sort detail fields by number (Details 1, Details 2, etc.)
   */
  sortDetailFields(fields) {
    return fields.sort((a, b) => {
      const aNum = this.extractDetailNumber(a.field_name_eng || a.field_name);
      const bNum = this.extractDetailNumber(b.field_name_eng || b.field_name);
      return aNum - bNum;
    });
  }

  /**
   * Extract number from detail field name
   */
  extractDetailNumber(fieldName) {
    if (!fieldName) return 0;
    
    // Extract number from 'Details 1', 'Details  2', 'Details1', etc.
    const engMatch = fieldName.match(/Details\s*(\d+)/i);
    if (engMatch) {
      return parseInt(engMatch[1], 10);
    }
    
    // Extract from Japanese '詳細 1', '詳細1', '詳細  2', etc.
    const jpMatch = fieldName.match(/詳細\s*(\d+)/);
    if (jpMatch) {
      return parseInt(jpMatch[1], 10);
    }
    
    return 0;
  }

  /**
   * Parse individual detail field value into structured object
   * @param {string} value - Detail field value
   * @returns {Object|null} Parsed detail object
   */
  parseDetailValue(value) {
    if (!value) return null;

    // Treat whitespace-only values as empty
    if (String(value).trim().length === 0) return null;

    try {
      // Check if value contains tab-separated data (table format)
      const tabSeparatedMatch = value.match(/^\d+\t/);
      if (tabSeparatedMatch) {
        return this.parseTabSeparatedDetail(value);
      }

      // Split by newlines or common delimiters
      const lines = value.split(/\n|、|；/).map(line => line.trim()).filter(Boolean);
      
      const detail = {};

      lines.forEach(line => {
        // Parse key-value patterns
        // Format: "Key: Value" or "Key：Value"
        const match = line.match(/^([^:：]+)[：:](.+)$/);
        
        if (match) {
          const key = this.normalizeKey(match[1].trim());
          const val = match[2].trim();
          
          // Handle special cases
          if (key === 'Unit Price' || key === 'Salary' || key === 'unitPrice') {
            detail[key] = this.parseUnitPrice(val);
          } else {
            detail[key] = val;
          }
        }
      });

      return Object.keys(detail).length > 0 ? detail : null;

    } catch (error) {
      logger.error('Error parsing detail value', error);
      return null;
    }
  }

  /**
   * Parse tab-separated detail row
   * Format: "EmployeeCode\tEmployeeName\tCurrentDept\t→\tNewDept"
   * @param {string} value - Tab-separated string
   * @returns {Object|null} Parsed detail object
   */
  parseTabSeparatedDetail(value) {
    try {
      // Split by tabs and filter out whitespace
      const parts = value.split('\t').map(p => p.trim()).filter(Boolean);
      
      if (parts.length < 2) return null;

      const detail = {};

      // First part is usually employee code
      detail['Employee Code'] = parts[0];

      // Second part is employee name
      if (parts[1]) {
        detail['Staff Name'] = parts[1];
      }

      // If there are more parts, look for department/location info
      // Format: "current → new" or "current → new"
      const remaining = parts.slice(2).join(' ');
      const deptMatch = remaining.match(/(.+?)\s*(?:→|⇒|from|to)\s*(.+?)(?:\r\n|$)/i);
      
      if (deptMatch) {
        detail['Current Department'] = deptMatch[1].trim();
        detail['New Department'] = deptMatch[2].trim();
      } else if (remaining) {
        detail['Details'] = remaining;
      }

      return Object.keys(detail).length > 0 ? detail : null;

    } catch (error) {
      logger.error('Error parsing tab-separated detail', error);
      return null;
    }
  }

  /**
   * Parse unit price field that contains Previous/New values
   * @param {string} value - Unit price string
   * @returns {Object} Object with Previous and New keys
   */
  parseUnitPrice(value) {
    const result = { Previous: null, New: null };

    // Pattern: "Previous: XXX New: YYY" or "旧: XXX 新: YYY"
    const previousMatch = value.match(/(?:Previous|旧|前)[：:]?\s*([^\n]+?)(?=(?:New|新|後)|$)/i);
    const newMatch = value.match(/(?:New|新|後)[：:]?\s*(.+?)$/i);

    if (previousMatch) {
      result.Previous = previousMatch[1].trim();
    }
    if (newMatch) {
      result.New = newMatch[1].trim();
    }

    // If no Previous/New markers, try to split by common patterns
    if (!result.Previous && !result.New) {
      const parts = value.split(/→|⇒|から|to/i);
      if (parts.length === 2) {
        result.Previous = parts[0].trim();
        result.New = parts[1].trim();
      }
    }

    return result;
  }

  /**
   * Normalize field keys to standard English names
   * @param {string} key - Original key
   * @returns {string} Normalized key
   */
  normalizeKey(key) {
    const keyMap = {
      '社員コード': 'Employee Code',
      '社員番号': 'Employee Code',
      'スタッフ名': 'Staff Name',
      '氏名': 'Staff Name',
      '勤務地': 'Work location',
      '単価変更日': 'Unit Price Change Date',
      '変更日': 'Change Date',
      '発令日': 'Effective Date',
      '単価区分': 'Unit Classification',
      '給与区分': 'Salary Classification',
      '単価': 'Unit Price',
      '給与': 'Salary',
      '基本給': 'Base Salary',
      '理由': 'Reason',
      '変更理由': 'Reason',
      '部署': 'Department',
      '異動先部署': 'New Department',
      '職位': 'Position',
      '新職位': 'New Position',
      '手当': 'Allowance',
      '住宅手当': 'Housing Allowance',
      '通勤手当': 'Transport Allowance',
      '家族手当': 'Family Allowance'
    };

    return keyMap[key] || key;
  }

  /**
   * Extract all detail records from BigQuery request data
   * @param {Object} bqRequestData - BigQuery request with form_fields
   * @returns {Array<Object>} Array of detail objects
   */
  extractDetailsFromBigQuery(bqRequestData) {
    if (!bqRequestData.formFields || bqRequestData.formFields.length === 0) {
      logger.warn('No form fields found in BigQuery data');
      return [];
    }

    return this.parseDetailsFields(bqRequestData.formFields);
  }

  /**
   * Parse table-formatted details (for structured data)
   * @param {string} value - Table-formatted string
   * @returns {Array<Object>} Array of row objects
   */
  parseTableDetails(value) {
    if (!value) return [];

    try {
      const lines = value.split('\n').filter(line => line.trim());
      if (lines.length < 2) return [];

      // First line is headers
      const headers = lines[0].split(/\t|,|\|/).map(h => h.trim()).filter(Boolean);
      
      // Remaining lines are data rows
      const rows = lines.slice(1).map(line => {
        const values = line.split(/\t|,|\|/).map(v => v.trim());
        const row = {};
        
        headers.forEach((header, index) => {
          row[this.normalizeKey(header)] = values[index] || null;
        });
        
        return row;
      });

      return rows;

    } catch (error) {
      logger.error('Error parsing table details', error);
      return [];
    }
  }
}