import { env } from '../config/environment.js';
import { logger } from '../utils/logger.util.js';

export class SmartHRRepository {
  constructor() {
    this.baseUrl = env.SMARTHR_BASE_URL;
    this.accessToken = env.SMARTHR_ACCESS_TOKEN;
    
    if (!this.baseUrl || !this.accessToken) {
      throw new Error('SmartHR configuration missing: SMARTHR_BASE_URL and SMARTHR_ACCESS_TOKEN are required');
    }
  }

  async getCustomFieldTemplates() {
    try {
      const response = await fetch(`${this.baseUrl}/crew_custom_field_templates?per_page=100`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`SmartHR API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Error fetching custom field templates', error);
      throw error;
    }
  }

  async createCrew(crewData) {
    try {
      const response = await fetch(`${this.baseUrl}/crews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify(crewData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`SmartHR API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Error creating crew', error);
      throw error;
    }
  }

  async getCrew(crewId) {
    try {
      const response = await fetch(`${this.baseUrl}/crews/${crewId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`SmartHR API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Error fetching crew', error);
      throw error;
    }
  }

  async updateCrew(crewId, updateData) {
    try {
      const response = await fetch(`${this.baseUrl}/crews/${crewId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`SmartHR API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Error updating crew', error);
      throw error;
    }
  }

  async getCrewByCode(empCode) {
    try {
      const response = await fetch(`${this.baseUrl}/crews?emp_code=${empCode}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`SmartHR API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      // API returns array, get first result
      if (data && data.length > 0) {
        return data[0];
      }

      return null;
    } catch (error) {
      logger.error('Error fetching crew by code', error);
      throw error;
    }
  }

  async getDepartments(perPage = 50) {
    try {
      const response = await fetch(`${this.baseUrl}/departments?per_page=${perPage}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`SmartHR API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Error fetching departments', error);
      throw error;
    }
  }

  async getDepartment(departmentId) {
    try {
      const response = await fetch(`${this.baseUrl}/departments/${departmentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`SmartHR API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Error fetching department', error);
      throw error;
    }
  }

  async getPositions(perPage = 50) {
    try {
      const response = await fetch(`${this.baseUrl}/job_titles?per_page=${perPage}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`SmartHR API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Error fetching positions', error);
      throw error;
    }
  }

  async getEmploymentTypes(perPage = 50) {
    try {
      const response = await fetch(`${this.baseUrl}/employment_types?per_page=${perPage}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`SmartHR API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Error fetching employment types', error);
      throw error;
    }
  }

  async createDepartment(departmentData) {
    try {
      const response = await fetch(`${this.baseUrl}/departments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify(departmentData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`SmartHR API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Error creating department', error);
      throw error;
    }
  }

  async getAllResignedEmployees() {
    try {
      logger.info('Fetching all resigned employees from SmartHR');
      
      const response = await fetch(
        `${this.baseUrl}/crews?resigned_at=*&per_page=100`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`SmartHR API error: ${response.status} ${response.statusText}`);
      }

      const employees = await response.json();
      return Array.isArray(employees) ? employees : [];
    } catch (error) {
      logger.error('Error fetching resigned employees', error);
      throw error;
    }
  }
}