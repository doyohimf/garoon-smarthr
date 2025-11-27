import { SmartHRExtendedService } from '../services/smarthr-extended.service.js';
import { RetryUtil } from '../utils/retry.util.js';
import { logger } from '../utils/logger.util.js';

export class EmployeeSalaryChangeProcessor {
  constructor() {
    this.smartHRService = new SmartHRExtendedService();
    this.retryUtil = new RetryUtil();
  }

  async process(garoonRequest) {
    logger.info(`Processing salary change for request: ${garoonRequest.id}`);

    try {
      const salaryData = this.extractSalaryData(garoonRequest);
      
      logger.info('🟢 SALARY_CHANGE.process - Extracted Data:', JSON.stringify({ salaryData }, null, 2));
      
      if (!salaryData.employeeCode || !salaryData.effectiveDate) {
        throw new Error('Missing required fields for salary change');
      }

      // Calculate change percentage
      const changeInfo = this.calculateSalaryChange(salaryData);

      // Update employee salary in SmartHR
      const result = await this.retryUtil.executeWithRetry(
        async () => await this.smartHRService.updateEmployeeSalary(salaryData),
        3,
        1000
      );

      logger.info(`Salary change completed: ${salaryData.employeeCode}`);
      return { success: true, result, changeInfo };

    } catch (error) {
      logger.error('Salary change failed', error);
      throw error;
    }
  }

  extractSalaryData(request) {
    const items = request.items || {};
    
    return {
      employeeCode: this.findValue(items, '社員番号'),
      employeeName: this.findValue(items, '氏名'),
      currentBaseSalary: this.parseAmount(this.findValue(items, '現基本給')),
      newBaseSalary: this.parseAmount(this.findValue(items, '新基本給')),
      currentMonthlyTotal: this.parseAmount(this.findValue(items, '現月額合計')),
      newMonthlyTotal: this.parseAmount(this.findValue(items, '新月額合計')),
      currentAnnualSalary: this.parseAmount(this.findValue(items, '現年俸')),
      newAnnualSalary: this.parseAmount(this.findValue(items, '新年俸')),
      changeReason: this.findValue(items, '改定理由'), // 定期昇給/昇格/業績/その他
      effectiveDate: this.findValue(items, '発令日'),
      remarks: this.findValue(items, '備考'),
      
      // Allowances
      currentHousingAllowance: this.parseAmount(this.findValue(items, '現住宅手当')),
      newHousingAllowance: this.parseAmount(this.findValue(items, '新住宅手当')),
      currentFamilyAllowance: this.parseAmount(this.findValue(items, '現家族手当')),
      newFamilyAllowance: this.parseAmount(this.findValue(items, '新家族手当')),
      currentPositionAllowance: this.parseAmount(this.findValue(items, '現役職手当')),
      newPositionAllowance: this.parseAmount(this.findValue(items, '新役職手当'))
    };
  }

  calculateSalaryChange(data) {
    const baseChange = data.newBaseSalary - data.currentBaseSalary;
    const baseChangePercent = data.currentBaseSalary > 0 
      ? (baseChange / data.currentBaseSalary * 100).toFixed(2)
      : 0;

    const totalChange = data.newMonthlyTotal - data.currentMonthlyTotal;
    const totalChangePercent = data.currentMonthlyTotal > 0
      ? (totalChange / data.currentMonthlyTotal * 100).toFixed(2)
      : 0;

    return {
      baseChange,
      baseChangePercent,
      totalChange,
      totalChangePercent,
      changeType: baseChange > 0 ? 'INCREASE' : baseChange < 0 ? 'DECREASE' : 'NO_CHANGE'
    };
  }

  parseAmount(value) {
    if (!value) return 0;
    // Remove commas and yen symbol, parse as float
    return parseFloat(value.toString().replace(/[,円¥]/g, '')) || 0;
  }

  findValue(items, fieldName) {
    const item = Object.values(items).find(i => i.name === fieldName);
    return item?.value || null;
  }
}
