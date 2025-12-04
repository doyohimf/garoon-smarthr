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

  /**
   * Calculate the difference in days between two dates
   * @param {Date|string} startDate - The start date
   * @param {Date|string} endDate - The end date (defaults to current date)
   * @returns {number} Number of days difference
   */
  static calculateDaysDifference(startDate, endDate = new Date()) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate the time difference in milliseconds
    const timeDifference = end.getTime() - start.getTime();
    
    // Convert to days (use floor for more accurate same-day detection)
    const daysDifference = Math.floor(timeDifference / (1000 * 3600 * 24));
    
    logger.debug('Calculated days difference', {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      timeDifferenceMs: timeDifference,
      daysDifference
    });
    
    return daysDifference;
  }

  /**
   * Parse Japanese era date string to Gregorian date
   * @param {string} dateString - Date string in Japanese era format (e.g., "令和5年12月2日")
   * @returns {string} Date in YYYY-MM-DD format
   */
  static parseJapaneseEraDate(dateString) {
    if (!dateString) return null;

    const trimmed = dateString.trim();

    // Match patterns like "令和5年12月2日"
    const match = trimmed.match(/^(.+?)(\d+)年(\d+)月(\d+)日$/);
    if (!match) {
      logger.warn(`DateUtil.parseJapaneseEraDate: Unable to parse "${dateString}"`);
      return null;
    }

    const era = match[1];
    const eraYear = parseInt(match[2]);
    const month = parseInt(match[3]);
    const day = parseInt(match[4]);

    let gregorianYear;

    switch (era) {
      case '令和':
        gregorianYear = 2019 + eraYear - 1;
        break;
      case '平成':
        gregorianYear = 1989 + eraYear - 1;
        break;
      case '昭和':
        gregorianYear = 1926 + eraYear - 1;
        break;
      case '大正':
        gregorianYear = 1912 + eraYear - 1;
        break;
      case '明治':
        gregorianYear = 1868 + eraYear - 1;
        break;
      default:
        logger.warn(`DateUtil.parseJapaneseEraDate: Unknown era "${era}"`);
        return null;
    }

    // Validate the date
    const date = new Date(gregorianYear, month - 1, day);
    if (date.getFullYear() !== gregorianYear || date.getMonth() !== month - 1 || date.getDate() !== day) {
      logger.warn(`DateUtil.parseJapaneseEraDate: Invalid date "${dateString}"`);
      return null;
    }

    return `${gregorianYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /**
   * Check if a date is within the past N days (including today)
   * @param {string} dateString - The date to check
   * @param {number} days - Number of days in the past (including today)
   * @returns {boolean} True if the date is within the past N days
   */
  static isWithinPastDays(dateString, days) {
    if (!dateString || days < 0) {
      logger.warn('DateUtil.isWithinPastDays: Invalid input');
      return false;
    }

    try {
      const inputDate = DateUtil.parseDate(dateString);
      const today = DateUtil.getTodayDate();
      const daysDifference = DateUtil.calculateDaysDifference(inputDate, today);

      const result = daysDifference >= 0 && daysDifference <= days;
      logger.debug(`DateUtil.isWithinPastDays: "${dateString}" within past ${days} days? ${result} (diff: ${daysDifference})`);
      return result;
    } catch (error) {
      logger.error(`DateUtil.isWithinPastDays: Error checking date "${dateString}"`, error);
      return false;
    }
  }
}
