import { logger } from './logger.util.js';

export class DateRangeCalculator {
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
   * Calculate appropriate date range for data fetching based on workflow starting point
   * @param {string} dateLaunched - The workflow launch date (ISO string)
   * @param {Date} currentDate - The current date (defaults to now)
   * @returns {Object} Object containing start and end dates for fetching
   */
  static calculateDataRange(dateLaunched, currentDate = new Date()) {
    const launchDate = new Date(dateLaunched);
    const daysSinceLaunch = this.calculateDaysDifference(launchDate, currentDate);

    let startDate, endDate;

    if (daysSinceLaunch >= 30) {
      // Use fixed 30-day range from current date
      const rangeStart = new Date(currentDate);
      rangeStart.setDate(currentDate.getDate() - 30);
      
      startDate = this.getStartOfDay(rangeStart);
      endDate = this.getEndOfDay(currentDate);
    } else if (daysSinceLaunch < 1) {
      // For same-day launch, use a 7-day window to ensure we get some data
      const rangeStart = new Date(currentDate);
      rangeStart.setDate(currentDate.getDate() - 7);
      
      startDate = this.getStartOfDay(rangeStart);
      endDate = this.getEndOfDay(currentDate);
    } else {
      // Use actual launch-to-today range
      startDate = this.getStartOfDay(launchDate);
      endDate = this.getEndOfDay(currentDate);
    }

    const result = {
      startDate,
      endDate,
      daysSinceLaunch,
      rangeType: daysSinceLaunch >= 30 ? 'fixed-30-day' : 
                daysSinceLaunch < 1 ? 'initial-7-day' : 'launch-to-today'
    };

    logger.info('Calculated data range for workflow', {
      dateLaunched: launchDate.toISOString(),
      currentDate: currentDate.toISOString(),
      ...result
    });

    return result;
  }

  /**
   * Subtract days from a date
   * @param {Date} date - The base date
   * @param {number} days - Number of days to subtract
   * @returns {Date} New date with days subtracted
   */
  static subtractDays(date, days) {
    const result = new Date(date);
    result.setDate(date.getDate() - days);
    return result;
  }

  /**
   * Add days to a date
   * @param {Date} date - The base date
   * @param {number} days - Number of days to add
   * @returns {Date} New date with days added
   */
  static addDays(date, days) {
    const result = new Date(date);
    result.setDate(date.getDate() + days);
    return result;
  }

  /**
   * Get ISO date string with time set to start of day (00:00:00.000Z)
   * @param {Date|string} date - The date to process
   * @returns {string} ISO string with start of day time
   */
  static getStartOfDay(date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }

  /**
   * Get ISO date string with time set to end of day (23:59:59.999Z)
   * @param {Date|string} date - The date to process
   * @returns {string} ISO string with end of day time
   */
  static getEndOfDay(date) {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d.toISOString();
  }

  /**
   * Validate if a date string is valid
   * @param {string} dateString - The date string to validate
   * @returns {boolean} True if valid, false otherwise
   */
  static isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Format date for logging/display purposes
   * @param {Date|string} date - The date to format
   * @returns {string} Formatted date string
   */
  static formatDate(date) {
    return new Date(date).toISOString().split('T')[0];
  }
}