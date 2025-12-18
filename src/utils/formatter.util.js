export class FormatterUtil {
  static formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';

    let cleaned = phoneNumber.toString().trim();

    cleaned = cleaned.replace(/^\+81/, '0').replace(/^81/, '0');

    cleaned = cleaned.replace(/[\s\-\(\)]/g, '');

    const validLandlineCodes = ['01', '02', '03', '04', '05', '06', '07', '08', '09'];

    if (cleaned.match(/^0\d{9}$/)) {
      const areaCode = cleaned.slice(0, 2);
      if (validLandlineCodes.includes(areaCode)) {
        return cleaned.slice(0, 2) + '-' + cleaned.slice(2, 6) + '-' + cleaned.slice(6);
      }
    }

    if (cleaned.match(/^0\d{10}$/)) {
      const prefix = cleaned.slice(0, 3);
      if (['090', '080', '070'].includes(prefix)) {
        return cleaned.slice(0, 3) + '-' + cleaned.slice(3, 7) + '-' + cleaned.slice(7);
      }
    }

    return cleaned;
  }

  /**
   * Dissect full name into first name, last name, and readings
   * @param {string} fullName - Full name string potentially with readings in parentheses
   * @returns {Object} Object with firstName, lastName, readingFirstName, readingLastName
   */
  static dissectName(fullName) {
    if (!fullName) {
      return { firstName: '', lastName: '', readingFirstName: '', readingLastName: '' };
    }

    const parts = fullName.trim().split(/\s+/);
    let firstName = '';
    let lastName = '';
    let readingFirstName = '';
    let readingLastName = '';

    if (parts.length >= 2) {
      lastName = parts[0];
      firstName = parts.slice(1).join(' ');
    } else if (parts.length === 1) {
      firstName = parts[0];
    }

    const readingMatch = fullName.match(/\(([^)]+)\)/);
    if (readingMatch) {
      const reading = readingMatch[1].split(/\s+/);
      if (reading.length >= 2) {
        readingLastName = reading[0];
        readingFirstName = reading.slice(1).join(' ');
      } else if (reading.length === 1) {
        readingFirstName = reading[0];
      }
    }

    return { firstName, lastName, readingFirstName, readingLastName };
  }

  /**
   * Build custom fields array from data and SmartHR templates
   * @param {Object} data - Data object with field names and values
   * @param {Array} customFieldTemplates - Array of custom field templates from SmartHR
   * @returns {Array} Array of custom field objects with template_id and value
   */
  static buildCustomFieldsArray(data, customFieldTemplates) {
    const customFieldsArray = [];
    
    for (const cFieldKey in data) {
      const cf = customFieldTemplates.find(cf => cf.name === cFieldKey);
      if (cf && data[cFieldKey]) {
        customFieldsArray.push({
          template_id: cf.id,
          name: cFieldKey,
          value: data[cFieldKey]
        });
      }
    }
    
    return customFieldsArray;
  }
}
