import { SmartHRRepository } from '../repositories/smarthr.repository.js';
import { LEAVES_CUSTOM_FIELDS } from '../config/leaves.config.js';
import { logger } from '../utils/logger.util.js';

/**
 * Extended SmartHR service with employee update methods
 */
export class SmartHRExtendedService {
  constructor() {
    this.repository = new SmartHRRepository();
  }

  /**
   * Update employee department (transfer)
   */
  async updateEmployeeDepartment(data) {
    try {
      const employee = await this.repository.getCrewByCode(data.employeeCode);
      if (!employee) {
        throw new Error(`Employee not found with code: ${data.employeeCode}`);
      }

      const employeeId = employee.id;

      const updateData = {
        department_id: data.toDepartment,
        position: data.toPosition,
        work_location: data.workLocation,
        effective_date: data.effectiveDate
      };

      logger.info('🔵 SMARTHR.updateEmployeeDepartment - Input Data:', JSON.stringify({ input: data }, null, 2));
      logger.info('🔵 SMARTHR.updateEmployeeDepartment - Payload to API:', JSON.stringify({ updateData }, null, 2));

      const result = await this.repository.updateCrew(employeeId, updateData);
      logger.info(`Employee department updated: ${data.employeeCode} (crew id: ${employeeId})`);
      return result;
    } catch (error) {
      logger.error('Error updating employee department', error);
      throw error;
    }
  }

  /**
   * Update employee position (promotion/demotion)
   */
  async updateEmployeePosition(data) {
    try {
      const employee = await this.repository.getCrewByCode(data.employeeCode);
      if (!employee) {
        throw new Error(`Employee not found with code: ${data.employeeCode}`);
      }

      const employeeId = employee.id;

      const updateData = {
        position: data.newPosition,
        job_title: data.newJobTitle,
        grade: data.newGrade,
        effective_date: data.effectiveDate
      };

      logger.info('🔵 SMARTHR.updateEmployeePosition - Input Data:', JSON.stringify({ input: data }, null, 2));
      logger.info('🔵 SMARTHR.updateEmployeePosition - Payload to API:', JSON.stringify({ updateData }, null, 2));

      const result = await this.repository.updateCrew(employeeId, updateData);
      logger.info(`Employee position updated: ${data.employeeCode} (crew id: ${employeeId})`);
      return result;
    } catch (error) {
      logger.error('Error updating employee position', error);
      throw error;
    }
  }

  /**
   * Update employee salary
   */
  async updateEmployeeSalary(data) {
    try {
      const employee = await this.repository.getCrewByCode(data.employeeCode);
      if (!employee) {
        throw new Error(`Employee not found with code: ${data.employeeCode}`);
      }

      const employeeId = employee.id;

      const updateData = {
        monthly_base_salary: data.newBaseSalary,
        annual_salary: data.newAnnualSalary,
        effective_date: data.effectiveDate
      };

      logger.info('🔵 SMARTHR.updateEmployeeSalary - Input Data:', JSON.stringify({ input: data }, null, 2));
      logger.info('🔵 SMARTHR.updateEmployeeSalary - Payload to API:', JSON.stringify({ updateData }, null, 2));

      const result = await this.repository.updateCrew(employeeId, updateData);
      logger.info(`Employee salary updated: ${data.employeeCode} (crew id: ${employeeId})`);
      return result;
    } catch (error) {
      logger.error('Error updating employee salary', error);
      throw error;
    }
  }

  /**
   * Update employee secondment status
   */
  async updateEmployeeSecondment(data) {
    try {
      const employee = await this.repository.getCrewByCode(data.employeeCode);
      if (!employee) {
        throw new Error(`Employee not found with code: ${data.employeeCode}`);
      }

      const employeeId = employee.id;

      // const updateData = {
      //   custom_fields: data.customFieldsArray
      // };

      logger.info('🔵 SMARTHR.updateEmployeeSecondment - Input Data:', JSON.stringify({ input: data }, null, 2));
      logger.info('🔵 SMARTHR.updateEmployeeSecondment - Payload to API:', JSON.stringify({ data }, null, 2));

      const result = await this.repository.updateCrew(employeeId, data);
      logger.info(`Employee secondment updated: ${data.employeeCode} (crew id: ${employeeId})`);
      return result;
    } catch (error) {
      logger.error('Error updating employee secondment', error);
      throw error;
    }
  }

  /**
   * Update employee changes
   */
  async updateEmployeeChanges(data) {
    try {
      const employee = await this.repository.getCrewByCode(data.emp_code);
      if (!employee) {
        throw new Error(`Employee not found with code: ${data.emp_code}`);
      }

      const employeeId = employee.id;

      // const updateData = {
      //   custom_fields: data.customFieldsArray
      // };

      logger.info('🔵 SMARTHR.updateEmployeeChanges - Input Data:', JSON.stringify({ input: data }, null, 2));
      logger.info('🔵 SMARTHR.updateEmployeeChanges - Payload to API:', JSON.stringify({ data }, null, 2));

      const result = await this.repository.updateCrew(employeeId, data);
      logger.info(`Employee changes updated: ${data.emp_code} (crew id: ${employeeId})`);
      return result;
    } catch (error) {
      logger.error('Error updating employee changes', error);
      throw error;
    }
  }

  /**
   * Build custom fields array from templates and data
   */
  /*async buildCustomFieldsArray(data, customFieldConfig) {
    const customFieldTemplates = await this.repository.getCustomFieldTemplates();
    
    const customFieldsArray = [];
    for (const [fieldKey, fieldValue] of Object.entries(customFieldConfig)) {
      const template = customFieldTemplates.find(t => t.name === fieldKey);
      if (template) {
        let value = data[fieldValue];
        
        if (value !== undefined) {
          customFieldsArray.push({
            template_id: template.id,
            value: value
          });
        }
      }
    }
    
    return customFieldsArray;
  }*/

  /**
   * Update employee leave status
   */
  async updateEmployeeLeaveStatus(data) {
    try {
      const employee = await this.repository.getCrewByCode(data.employeeCode);
      if (!employee) {
        throw new Error(`Employee not found with code: ${data.employeeCode}`);
      }

      const employeeId = employee.id;

      // const updateData = {
      //   custom_fields: data.customFieldsArray
      // };

      logger.info('🔵 SMARTHR.updateEmployeeLeaveStatus - Input Data:', JSON.stringify({ input: data }, null, 2));
      logger.info('🔵 SMARTHR.updateEmployeeLeaveStatus - Payload to API:', JSON.stringify({ data }, null, 2));
      const result = await this.repository.updateCrew(employeeId, data);
      logger.info(`Employee leave status updated: ${employeeId}`);
      return result;
    } catch (error) {
      logger.error('Error updating employee leave status', error);
      throw error;
    }
  }

  /**
   * Update employee return status
   */
  async updateEmployeeReturnStatus(data) {
    try {
      const employee = await this.repository.getCrewByCode(data.employeeCode);
      if (!employee) {
        throw new Error(`Employee not found with code: ${data.employeeCode}`);
      }

      const employeeId = employee.id;

      const updateData = {
        custom_fields: data.customFieldsArray
      };

      logger.info('🔵 SMARTHR.updateEmployeeReturnStatus - Input Data:', JSON.stringify({ input: data }, null, 2));
      logger.info('🔵 SMARTHR.updateEmployeeReturnStatus - Payload to API:', JSON.stringify({ updateData }, null, 2));

      const result = await this.repository.updateCrew(employeeId, updateData);
      logger.info(`Employee return status updated: ${data.employeeCode} (crew id: ${employeeId})`);
      return result;
    } catch (error) {
      logger.error('Error updating employee return status', error);
      throw error;
    }
  }

  /**
   * Update employee allowances
   */
  async updateEmployeeAllowances(data) {
    try {
      const employee = await this.repository.getCrewByCode(data.employeeCode);
      if (!employee) {
        throw new Error(`Employee not found with code: ${data.employeeCode}`);
      }

      const employeeId = employee.id;

      const updateData = {
        custom_fields: data.customFieldsArray
      };

      logger.info('🔵 SMARTHR.updateEmployeeAllowances - Input Data:', JSON.stringify({ input: data }, null, 2));
      logger.info('🔵 SMARTHR.updateEmployeeAllowances - Payload to API:', JSON.stringify({ updateData }, null, 2));

      const result = await this.repository.updateCrew(employeeId, updateData);
      logger.info(`Employee allowances updated: ${data.employeeCode} (crew id: ${employeeId})`);
      return result;
    } catch (error) {
      logger.error('Error updating employee allowances', error);
      throw error;
    }
  }

  /**
   * Update employee resignation status
   */
  async updateEmployeeResignation(data) {
    try {
      logger.info('🔵 SMARTHR.updateEmployeeResignation - Input Data:', JSON.stringify({ input: data }, null, 2));
      logger.info('🔵 SMARTHR.updateEmployeeResignation - Payload to API:', JSON.stringify({ data }, null, 2));

      // First, try to resolve the employee by employeeCode to get the crew id
      const employee = await this.repository.getCrewByCode(data.employeeCode);
      if (!employee) {
        // Throw a not_found-style error so callers (and existing retry/fallback logic) can detect it
        const notFoundErr = `SmartHR API error: 404 - {"code":4,"type":"not_found","message":"存在しない ID です","errors":null}`;
        logger.warn(`Employee not found for code ${data.employeeCode}`);
        throw new Error(notFoundErr);
      }

      const crewId = employee.id;
      const result = await this.repository.updateCrew(crewId, data);
      logger.info(`Employee resignation updated: ${data.employeeCode} (crew id: ${crewId})`);
      return result;
    } catch (error) {
      logger.error('Error updating employee resignation', error);
      throw error;
    }
  }

  /**
   * Create new employee with resignation status
   */
  async createEmployeeResignation(data) {
    try {
      const createData = {
        emp_status: 'employed',
        last_name: data.last_name,
        first_name: data.first_name,
        resigned_at: data.resigned_at,
        resigned_reason: data.resigned_reason,
        emp_code: data.emp_code,
        gender: data.gender
      };

      logger.info('🔵 SMARTHR.createEmployeeResignation - Input Data:', JSON.stringify({ input: data }, null, 2));
      logger.info('🔵 SMARTHR.createEmployeeResignation - Payload to API:', JSON.stringify({ createData }, null, 2));

      const result = await this.repository.createCrew(createData);
      
      logger.info(`Employee resignation created: ${data.last_name} ${data.first_name}`);
      return result;
    } catch (error) {
      logger.error('Error creating employee resignation', error);
      throw error;
    }
  }

  /**
   * Get employee by employee code
   */
  async getEmployeeByCode(empCode) {
    try {
      const employee = await this.repository.getCrewByCode(empCode);
      
      if (!employee) {
        logger.warn(`Employee not found with code: ${empCode}`);
        return null;
      }

      logger.info(`Found employee: ${employee.id} (${empCode})`);
      return employee;
    } catch (error) {
      logger.error('Error fetching employee by code', error);
      throw error;
    }
  }

  /**
   * Unified update for multiple changes at once
   * Handles salary, allowances, department, and position changes together
   */
  async updateEmployeeUnified(data) {
    try {
      const employee = await this.repository.getCrewByCode(data.employee_code);
      if (!employee) {
        throw new Error(`Employee not found with code: ${data.employee_code}`);
      }

      const employeeId = employee.id;

      const updateData = {
        effective_date: data.effective_date
      };

      // Add salary changes
      if (data.salary) {
        updateData.monthly_base_salary = data.salary.amount;
      }

      // Add allowance changes
      if (data.allowance) {
        if (data.allowance.housing) {
          updateData.housing_allowance = data.allowance.housing;
        }
        if (data.allowance.transport) {
          updateData.commuting_allowance = data.allowance.transport;
        }
        if (data.allowance.family) {
          updateData.family_allowance = data.allowance.family;
        }
      }

      // Add department change
      if (data.department_id) {
        updateData.department_id = data.department_id;
      }

      // Add position change
      if (data.position) {
        updateData.position = data.position;
      }

      logger.info('🔵 SMARTHR.updateEmployeeUnified - Input Data:', JSON.stringify({ input: data }, null, 2));
      logger.info('🔵 SMARTHR.updateEmployeeUnified - Payload to API:', JSON.stringify({ updateData }, null, 2));

      const result = await this.repository.updateCrew(employeeId, updateData);
      logger.info(`Employee unified update completed: ${data.employee_code} (crew id: ${employeeId})`);
      return result;
    } catch (error) {
      logger.error('Error updating employee (unified)', error);
      throw error;
    }
  }
}