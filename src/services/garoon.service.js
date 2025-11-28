import { GaroonRepository } from '../repositories/garoon.repository.js';
import { GCPStorageService } from './gcp-storage.service.js';
import { DateRangeCalculator } from '../utils/date-range.util.js';
import { logger } from '../utils/logger.util.js';

export class GaroonService {
  constructor() {
    this.repository = new GaroonRepository();
    this.storageService = new GCPStorageService();
  }

  async fetchRequests(limit = 500, formId = null, workflowId = null) {
    try {
      let startDate, endDate;

      if (workflowId) {
        // Get or create workflow starting point
        const startingPoint = await this.storageService.getOrCreateWorkflowStartingPoint(workflowId);
        
        // Calculate dynamic date range based on workflow starting point
        const dateRange = DateRangeCalculator.calculateDataRange(startingPoint.date_launched);
        
        startDate = dateRange.startDate;
        endDate = dateRange.endDate;

        logger.info('Using workflow-based date range', {
          workflowId,
          dateLaunched: startingPoint.date_launched,
          rangeType: dateRange.rangeType,
          daysSinceLaunch: dateRange.daysSinceLaunch,
          startDate,
          endDate
        });
      } else {
        // Fallback to original logic if no workflowId provided
        const now = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 1);

        startDate = sixMonthsAgo.toISOString();
        endDate = now.toISOString();

        logger.info('Using fallback date range (no workflowId provided)', {
          startDate,
          endDate
        });
      }

      const params = {
        orderBy: 'createdAt desc',
        limit,
        offset: 0,
        start: startDate,
        end: endDate
      };

      if (formId) {
        params.form_id = formId;
      }

      const data = await this.repository.getRequests(params);

      if (!data || !data.requests || data.requests.length === 0) {
        logger.warn('No requests found', {
          workflowId,
          formId,
          startDate,
          endDate
        });
        return [];
      }

      logger.info('Fetched Garoon requests', {
        count: data.requests.length,
        workflowId,
        formId,
        startDate,
        endDate
      });

      return data.requests;
    } catch (error) {
      logger.error('Error fetching Garoon requests', {
        error,
        workflowId,
        formId,
        limit
      });
      throw error;
    }
  }

  /**
   * Get workflow starting point information
   * @param {number|string} workflowId - The workflow ID
   * @returns {Promise<Object|null>} Starting point data or null if not found
   */
  async getWorkflowStartingPoint(workflowId) {
    try {
      return await this.storageService.readWorkflowStartingPoint(workflowId);
    } catch (error) {
      logger.error('Error getting workflow starting point', { error, workflowId });
      throw error;
    }
  }

  /**
   * Create or update workflow starting point
   * @param {number|string} workflowId - The workflow ID
   * @param {Date} launchDate - The launch date (defaults to current date)
   * @returns {Promise<Object>} The created starting point data
   */
  async createWorkflowStartingPoint(workflowId, launchDate = new Date()) {
    try {
      return await this.storageService.createWorkflowStartingPoint(workflowId, launchDate);
    } catch (error) {
      logger.error('Error creating workflow starting point', { error, workflowId, launchDate });
      throw error;
    }
  }

  /**
   * Check if a workflow has been initialized with a starting point
   * @param {number|string} workflowId - The workflow ID
   * @returns {Promise<boolean>}
   */
  async hasWorkflowStartingPoint(workflowId) {
    try {
      return await this.storageService.workflowStartingPointExists(workflowId);
    } catch (error) {
      logger.error('Error checking workflow starting point existence', { error, workflowId });
      return false;
    }
  }
}
