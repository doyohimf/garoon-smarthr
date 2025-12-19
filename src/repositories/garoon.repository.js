import { env } from '../config/environment.js';
import { logger } from '../utils/logger.util.js';

export class GaroonRepository {
  constructor() {
    this.baseUrl = env.GAROON_BASE_URL;
    this.apiEndpoint = env.GAROON_API_ENDPOINT;
    this.authorization = env.CYBOZU_AUTHORIZATION;
  }

  async getRequests(params) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().split('T')[0] + 'T00:00:00.000Z';
    const endOfDay = new Date().toISOString().split('T')[0] + 'T23:59:59.999Z';
    
    const urlParams = new URLSearchParams({
      orderBy: params.orderBy || 'createdAt desc',
      limit: params.limit || 1,
      offset: params.offset || 0,
      status: 'APPROVED',
      rangeStartApprovedAt: startDate,
      rangeEndApprovedAt: endOfDay,
      form: params.form_id
    });

    logger.debug('Garoon API request parameters', {
      start: startDate,
      end: endOfDay,
      form_id: params.form_id,
      limit: params.limit,
      urlParams: urlParams.toString()
    });

    try {
      const response = await fetch(`${this.apiEndpoint}?${urlParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Cybozu-Authorization': this.authorization
        }
      });

      if (!response.ok) {
        throw new Error(`Garoon API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      logger.debug('Garoon API response received', { 
        requestCount: data.requests?.length 
      });

      return data;
    } catch (error) {
      logger.error('Error calling Garoon API', error);
      throw error;
    }
  }
}
