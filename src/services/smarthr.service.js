import { SmartHRRepository } from '../repositories/smarthr.repository.js';
import { logger } from '../utils/logger.util.js';

export class SmartHRService {
  constructor() {
    this.repository = new SmartHRRepository();
    this.customFieldsCache = null;
    this.departmentCache = new Map(); // Cache for created departments
  }

  async getCustomFields() {
    if (this.customFieldsCache) {
      return this.customFieldsCache;
    }

    try {
      this.customFieldsCache = await this.repository.getCustomFieldTemplates();
      return this.customFieldsCache;
    } catch (error) {
      logger.error('Error fetching SmartHR custom fields', error);
      throw error;
    }
  }

  async createCrew(crewData) {
    try {
      logger.info('🔵 SMARTHR.createCrew - Input Data:', JSON.stringify({ crewData }, null, 2));
      
      const result = await this.repository.createCrew(crewData);
      
      if (!result || !result.id) {
        throw new Error('SmartHR crew creation failed');
      }

      logger.info(`Crew created successfully in SmartHR: ${result.id}`);
      return result;
    } catch (error) {
      logger.error('Error creating crew in SmartHR', error);
      throw error;
    }
  }

  async verifyCrew(crewId) {
    try {
      const crew = await this.repository.getCrew(crewId);
      return !!crew;
    } catch (error) {
      logger.error(`Error verifying crew ${crewId}`, error);
      return false;
    }
  }

  async getDepartments(perPage = 50) {
    try {
      return await this.repository.getDepartments(perPage);
    } catch (error) {
      logger.error('Error fetching departments', error);
      throw error;
    }
  }

  async getDepartment(departmentId) {
    try {
      return await this.repository.getDepartment(departmentId);
    } catch (error) {
      logger.error(`Error fetching department ${departmentId}`, error);
      throw error;
    }
  }

  async createDepartment(departmentData) {
    try {
      logger.info('Creating department in SmartHR', departmentData);
      const result = await this.repository.createDepartment(departmentData);
      logger.info(`Department created successfully: ${result.id}`);
      return result;
    } catch (error) {
      logger.error('Error creating department in SmartHR', error);
      throw error;
    }
  }

  async findOrCreateDepartment(departmentName) {
    try {
      // Validate department name
      if (!departmentName || typeof departmentName !== 'string') {
        logger.warn(`Invalid department name: ${departmentName}`);
        return null;
      }

      let trimmedName = departmentName.trim();
      if (!trimmedName || trimmedName.length === 0) {
        logger.warn(`Empty department name after trimming: ${departmentName}`);
        return null;
      }

      // Get all departments and search for exact match
      const departments = await this.getDepartments(500);
      const existingDept = departments.find(dept => dept.name && dept.name.trim() === trimmedName);

      if (existingDept) {
        logger.info(`Department already exists: ${existingDept.name} (ID: ${existingDept.id})`);
        return existingDept.id;
      }

      // Create new department if it doesn't exist
      const newDept = await this.createDepartment({ name: trimmedName });
      logger.info(`Created new department: ${newDept.name} (ID: ${newDept.id})`);
      return newDept.id;
    } catch (error) {
      logger.error(`Error finding or creating department: ${departmentName}`, error);
      throw error;
    }
  }

  async getPositions(perPage = 500) {
    try {
      return await this.repository.getPositions(perPage);
    } catch (error) {
      logger.error('Error fetching positions', error);
      throw error;
    }
  }

  async findOrCreatePosition(positionName) {
    try {
      // Validate position name
      if (!positionName || typeof positionName !== 'string') {
        logger.warn(`Invalid position name: ${positionName}`);
        return null;
      }

      let trimmedName = positionName.trim();
      if (!trimmedName || trimmedName.length === 0) {
        logger.warn(`Empty position name after trimming: ${positionName}`);
        return null;
      }

      // Get all positions and search for exact match
      const positions = await this.getPositions(500);
      const existingPos = positions.find(pos => pos.name && pos.name.trim() === trimmedName);

      if (existingPos) {
        logger.info(`Position already exists: ${existingPos.name} (ID: ${existingPos.id})`);
        return existingPos.id;
      }

      // If position doesn't exist, return the name to be used as is
      logger.info(`Position does not exist, will use name as-is: ${trimmedName}`);
      return null;
    } catch (error) {
      logger.error(`Error finding position: ${positionName}`, error);
      throw error;
    }
  }

  async getEmploymentTypes(perPage = 50) {
    try {
      return await this.repository.getEmploymentTypes(perPage);
    } catch (error) {
      logger.error('Error fetching employment types', error);
      throw error;
    }
  }

  async getPaymentPeriods(perPage = 50) {
    try {
      return await this.repository.getPaymentPeriods(perPage);
    } catch (error) {
      logger.error('Error fetching payment periods', error);
      throw error;
    }
  }

  async findPaymentPeriodId(salaryClassification) {
    try {
      if (!salaryClassification) {
        return null;
      }

      const paymentPeriods = await this.getPaymentPeriods(500);
      const matchedPeriod = paymentPeriods.find(period => 
        period.name && period.name.trim() === salaryClassification.trim()
      );

      if (matchedPeriod) {
        logger.info(`Found payment period: ${salaryClassification} (ID: ${matchedPeriod.id})`);
        return matchedPeriod.id;
      }

      logger.warn(`Payment period not found: ${salaryClassification}`);
      return null;
    } catch (error) {
      logger.error(`Error finding payment period: ${salaryClassification}`, error);
      throw error;
    }
  }

  sanitizeDepartmentName(name) {
    // Replace special characters (except dash and parenthesis) with dash
    // Keep: - (dash), ( (left paren), ) (right paren)
    // Replace: / ／ \ | > < : and other special symbols
    const sanitized = name.replace(/[\/／\\|><:]+/g, '-');
    return sanitized.trim();
  }

  isValidDepartmentName(name) {
    // Check length (reasonable limit)
    if (name.length > 100) {
      return false;
    }

    // Avoid emojis or unusual symbols (basic check)
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    if (emojiRegex.test(name)) {
      return false;
    }

    // Check for remaining invalid characters
    const invalidChars = /[\/／\\|><:]/;
    if (invalidChars.test(name)) {
      return false;
    }

    return true;
  }
}