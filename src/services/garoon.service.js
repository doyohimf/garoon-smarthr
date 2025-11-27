import { GaroonRepository } from '../repositories/garoon.repository.js';
import { logger } from '../utils/logger.util.js';

export class GaroonService {
  constructor() {
    this.repository = new GaroonRepository();
  }

  async fetchRequests(limit = 500, formId = null) {
    try {
      const now = new Date();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const params = {
        orderBy: 'createdAt desc',
        limit,
        offset: 0,
        start: sixMonthsAgo.toISOString(),
        end: now.toISOString()
      };

      if (formId) {
        params.form_id = formId;
      }

      const data = await this.repository.getRequests(params);

      if (!data || !data.requests || data.requests.length === 0) {
        logger.warn('No requests found');
        return [];
      }

      return data.requests;
    } catch (error) {
      logger.error('Error fetching Garoon requests', error);
      throw error;
    }
  }
}
