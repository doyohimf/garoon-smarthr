import { env } from '../config/environment.js';
import { logger } from '../utils/logger.util.js';

export class GaroonRepository {
  constructor() {
    this.baseUrl = env.GAROON_BASE_URL;
    this.apiEndpoint = env.GAROON_API_ENDPOINT;
    this.authorization = env.CYBOZU_AUTHORIZATION;
  }

  async getRequests(params) {
    const urlParams = new URLSearchParams({
      orderBy: params.orderBy || 'createdAt desc',
      limit: params.limit || 1,
      offset: params.offset || 0,
      status: 'COMPLETED',
      rangeStartApprovedAt: params.start || '',
      rangeEndApprovedAt: params.end || '',
      form: params.form_id
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
