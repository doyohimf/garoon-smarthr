import { env } from '../config/environment.js';

class Logger {
  constructor() {
    this.level = env.LOG_LEVEL;
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }

  shouldLog(level) {
    return this.levels[level] >= this.levels[this.level];
  }

  formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message
    };

    if (data) {
      logEntry.data = data;
    }

    return JSON.stringify(logEntry);
  }

  debug(message, data) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  info(message, data) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, data));
    }
  }

  warn(message, data) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message, error) {
    if (this.shouldLog('error')) {
      const errorData = error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error;
      console.error(this.formatMessage('error', message, errorData));
    }
  }
}

export const logger = new Logger();