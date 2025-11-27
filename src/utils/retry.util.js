import { logger } from './logger.util.js';

export class RetryUtil {
  async executeWithRetry(fn, maxRetries = 3, delayMs = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Attempt ${attempt} of ${maxRetries}`);
        const result = await fn();
        return result;
      } catch (error) {
        lastError = error;
        logger.warn(`Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < maxRetries) {
          const delay = delayMs * attempt;
          logger.info(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }
    
    logger.error(`All ${maxRetries} attempts failed`);
    throw lastError;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}