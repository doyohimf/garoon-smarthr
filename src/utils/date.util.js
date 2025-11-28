import { logger } from './logger.util.js';

export class DateUtil {
  static isToday(dateString) {
    if (!dateString) {
      logger.warn('DateUtil.isToday: dateString is empty');
      return false;
    }

    try {
      const inputDate = this.parseDate(dateString);
      const today = this.getTodayDate();

      const result = this.isSameDate(inputDate, today);
      logger.debug(`DateUtil.isToday: "${dateString}" is today? ${result}`);
      return result;
    } catch (error) {
      logger.error(`DateUtil.isToday: Error parsing date "${dateString}"`, error);
      return false;
    }
  }

  static parseDate(dateString) {
    if (!dateString) {
      throw new Error('DateUtil.parseDate: dateString is required and cannot be empty');
    }

    const trimmed = dateString.toString().trim();
    
    // Handle YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(trimmed + 'T00:00:00Z');
    }
    
    // Handle YYYY/MM/DD format
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) {
      const parts = trimmed.split('/');
      return new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
    }
    
    // Handle MM/DD or M/D format (assume current year)
    if (/^\d{1,2}\/\d{1,2}$/.test(trimmed)) {
      const parts = trimmed.split('/');
      const month = parseInt(parts[0]) - 1;
      const day = parseInt(parts[1]);
      const today = new Date();
      return new Date(today.getFullYear(), month, day);
    }
    
    // Fallback: Try standard Date parsing
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Unable to parse date: ${dateString}`);
    }
    return parsed;
  }

  static getTodayDate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  static isSameDate(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  static formatDateToBigQuery(dateString) {
    const date = this.parseDate(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static getTodayBigQueryFormat() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
