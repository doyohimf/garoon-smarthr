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
        const fieldNameEng = field.field_name_eng || '';
        const fieldName = field.field_name || '';
        
        // Check if field name starts with 'Details' or '詳細' followed by optional space(s) and number
        const matchesEng = /^Details\s*\d+$/i.test(fieldNameEng.trim());
        const matchesJp = /^詳細\s*\d+$/.test(fieldName.trim());
        
        return matchesEng || matchesJp;
      });

      if (detailsFields.length === 0) {
        logger.warn('No details fields found');
        return [];
      }

      logger.info(`Found ${detailsFields.length} details fields`);

      // Sort by detail number
      const sortedFields = this.sortDetailFields(detailsFields);

      const parsedDetails = sortedFields.map((field, index) => {
        logger.debug(`Parsing detail field ${index + 1}: ${field.field_name_eng || field.field_name}`);
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

    try {
      // Store original text for smart extraction fallback
      const detail = { originalText: value };

      // Split by newlines or common delimiters
      const lines = value.split(/\n|、|；/).map(line => line.trim()).filter(Boolean);
      
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

      // If minimal data extracted, try smart extraction
      if (Object.keys(detail).length <= 2) {
        const smartExtracted = this.smartExtractFromLines(lines, value);
        Object.assign(detail, smartExtracted);
      }

      return Object.keys(detail).length > 1 ? detail : null;

    } catch (error) {
      logger.error('Error parsing detail value', error);
      return null;
    }
  }

  /**
   * Smart extraction from unstructured lines
   * @param {Array<string>} lines - Text lines
   * @param {string} fullText - Full text
   * @returns {Object} Extracted data
   */
  smartExtractFromLines(lines, fullText) {
    const extracted = {};

    // Extract employee name with position
    const namePatterns = [
      /([一-龯ぁ-んァ-ヶー\s]+)\s*([課長|部長|係長|主任|社員]+)/,
      /(?:Manager|Chief|Staff)\s+([A-Za-z\s]+?)(?:,|\s+who|\s+of)/i,
    ];

    for (const pattern of namePatterns) {
      const match = fullText.match(pattern);
      if (match) {
        extracted['Staff Name'] = match[1].trim();
        extracted['Position'] = match[2];
        break;
      }
    }

    // Extract employee code
    const codeMatch = fullText.match(/(?:コード|Code|社員番号)[：:\s]*([A-Z0-9]+)/i);
    if (codeMatch) {
      extracted['Employee Code'] = codeMatch[1].trim();
    }

    // Extract departments
    const prevDeptMatch = fullText.match(/(?:異動前所属|異動前部署|Previous Department)[：:]\s*(.+?)(?:\r?\n|$)/i);
    if (prevDeptMatch) {
      extracted['Previous Department'] = prevDeptMatch[1].trim();
    }

    const newDeptMatch = fullText.match(/(?:異動後所属|異動後部署|New Department)[：:]\s*(.+?)(?:\r?\n|$)/i);
    if (newDeptMatch) {
      extracted['New Department'] = newDeptMatch[1].trim();
    }

    // Extract effective date
    const datePatterns = [
      /(?:異動適用日|発令日|Effective Date)[：:]\s*(.+?)(?:\r?\n|$)/i,
      /(\d{4})年(\d{1,2})月(\d{1,2})日/,
    ];

    for (const pattern of datePatterns) {
      const match = fullText.match(pattern);
      if (match) {
        if (match[0].includes('年')) {
          extracted['Effective Date'] = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        } else {
          extracted['Effective Date'] = match[1].trim();
        }
        break;
      }
    }

    return extracted;
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