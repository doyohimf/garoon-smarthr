import { logger } from '../utils/logger.util.js';
import { REQUEST_TYPE_MAP, getProcessorType, getProcessorDescription } from '../config/routing.config.js';

/**
 * Routes Garoon requests to appropriate processors based on request name
 */
export class RequestRouter {
  constructor() {
    this.routingMap = REQUEST_TYPE_MAP;
  }

  /**
   * Determine which processor to use based on request name
   * @param {Object} garoonRequest - Garoon request object
   * @returns {string|null} Processor type
   */
  route(garoonRequest) {
    const requestName = garoonRequest.name || '';
    
    if (!requestName) {
      logger.warn('Request has no name, cannot route');
      return null;
    }

    logger.info(`Routing request:  ${garoonRequest.number}`); //|| ${requestName}`);

    const processorType = getProcessorType(requestName);

    if (processorType) {
      logger.info(`🧩 Matched processor: ${processorType} - ${getProcessorDescription(processorType)}`);
    } else {
      logger.debug(`Could not determine processor type for: ${requestName}`);
    }

    return processorType;
  }

  /**
   * Get routing information for all request types
   */
  getRoutingMap() {
    return { ...this.routingMap };
  }

  /**
   * Get English translation for request type
   */
  getRequestTypeDescription(processorType) {
    return getProcessorDescription(processorType);
  }

  /**
   * Check if request should be processed
   */
  shouldProcess(garoonRequest) {
    const processorType = this.route(garoonRequest);
    return processorType !== null;
  }

  /**
   * Get all supported request name patterns
   */
  getSupportedPatterns() {
    const patterns = [];
    
    for (const [type, config] of Object.entries(this.routingMap)) {
      patterns.push({
        type,
        processor: config.processor,
        description: config.description,
        keywords: config.keywords,
        excludeKeywords: config.excludeKeywords || []
      });
    }

    return patterns;
  }
}