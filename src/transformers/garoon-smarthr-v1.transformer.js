import { garoonFields, garoonGender } from '../config/garoon.config.js';
import { smarthr_custom_fields } from '../config/smarthr.config.js';
import { SmartHRService } from '../services/smarthr.service.js';
import { KuroshiroUtil } from '../utils/kuroshiro.util.js';
import { logger } from '../utils/logger.util.js';

export class GaroonToSmartHRTransformer {
  constructor() {
    this.smartHRService = new SmartHRService();
    this.kuroshiroUtil = new KuroshiroUtil();
  }

  async transform(garoonRequest) {
    const customFields = await this.smartHRService.getCustomFields();
    
    // Extract name fields
    const fullNameKanji = this.findGaroonData(garoonRequest, garoonFields.fullNameKanji) || '';
    const fullName = this.findGaroonData(garoonRequest, garoonFields.fullName) || '';
    
    let firstNameKanji = '', lastNameKanji = '', firstName = '', lastName = '';
    
    if (fullNameKanji) {
      const [first, last] = fullNameKanji.split('ã€€');
      firstNameKanji = await this.kuroshiroUtil.kanjiToKatakana(first || '') || '';
      lastNameKanji = await this.kuroshiroUtil.kanjiToKatakana(last || '') || '';
    }
    
    if (fullName) {
      const [first, last] = fullName.split('ã€€');
      firstName = first || '';
      lastName = last || '';
    }

    // Extract trial period
    const trial_period = this.findGaroonData(garoonRequest, garoonFields.trial_period, true);
    const start_trial_period = trial_period?.[0];
    const end_trial_period = trial_period?.[1];

    // Extract other fields
    const division = this.findGaroonData(garoonRequest, garoonFields.division);
    const joining_date = this.findGaroonData(garoonRequest, garoonFields.joining_date);
    const birthDate = this.findGaroonData(garoonRequest, garoonFields.birthDate);
    const gender = garoonGender[this.findGaroonData(garoonRequest, garoonFields.gender)] || 'male';
    const email = this.findGaroonData(garoonRequest, garoonFields.email);
    const spouse = this.findGaroonData(garoonRequest, garoonFields.spouse);

    // Wage fields
    const work_hours = this.findGaroonData(garoonRequest, garoonFields.work_hours);
    const work_hours_break_time = this.findGaroonData(garoonRequest, garoonFields.work_hours_break_time);
    const work_type = this.findGaroonData(garoonRequest, garoonFields.work_type);
    const holiday = this.findGaroonData(garoonRequest, garoonFields.holiday);
    const fixed_monthly_overtime_hours = this.findGaroonData(garoonRequest, garoonFields.fixed_monthly_overtime_hours);
    const annual_salary = this.findGaroonData(garoonRequest, garoonFields.annual_salary);
    const fixed_monthly_salary = this.findGaroonData(garoonRequest, garoonFields.fixed_monthly_salary);
    const fixed_premium_wage = this.findGaroonData(garoonRequest, garoonFields.fixed_premium_wage);

    // Allowance and insurance
    const commuting_allowance = this.findGaroonData(garoonRequest, garoonFields.commuting_allowance);
    const commuting_expenses = this.findGaroonData(garoonRequest, garoonFields.commuting_expenses);
    const employment_insurance_enrollment = this.findGaroonData(garoonRequest, garoonFields.employment_insurance_enrollment);
    const social_insurance_coverage = this.findGaroonData(garoonRequest, garoonFields.social_insurance_coverage);

    // Build custom fields
    const cfields = {};
    cfields[smarthr_custom_fields.probation_period_start] = start_trial_period;
    cfields[smarthr_custom_fields.probation_period_end] = end_trial_period;
    cfields[smarthr_custom_fields.work_hours] = work_hours;
    cfields[smarthr_custom_fields.work_hours_break_time] = work_hours_break_time;
    cfields[smarthr_custom_fields.work_hours_work_type] = work_type;
    cfields[smarthr_custom_fields.work_hours_holiday] = holiday;
    cfields[smarthr_custom_fields.wages_display_of_fixed_premiums] = fixed_monthly_overtime_hours;
    cfields[smarthr_custom_fields.wages_annual_salary] = annual_salary;
    cfields[smarthr_custom_fields.wages_monthly] = fixed_monthly_salary;
    cfields[smarthr_custom_fields.wages_fixed_premium] = fixed_premium_wage;

    if (commuting_allowance === "1ヶ月") {
      cfields[smarthr_custom_fields.commuting_allowance_monthly] = commuting_expenses;
    } else {
      cfields[smarthr_custom_fields.commuting_allowance_daily] = commuting_expenses;
    }

    cfields[smarthr_custom_fields.employment_insurance] = employment_insurance_enrollment;
    cfields[smarthr_custom_fields.social_insurance] = social_insurance_coverage;

    // Map custom fields to SmartHR format
    const custom_fields = [];
    for (const cFieldKey in cfields) {
      const cf = customFields.find(cf => cf.name === cFieldKey);
      if (cf && cfields[cFieldKey]) {
        custom_fields.push({
          template_id: cf.id,
          value: cfields[cFieldKey]
        });
      }
    }

    // Build crew data
    const crewData = {
      emp_type: 'full_timer',
      position: division,
      entered_at: joining_date,
      last_name: lastName,
      first_name: firstName,
      last_name_yomi: lastNameKanji,
      first_name_yomi: firstNameKanji,
      birth_at: birthDate,
      gender: gender,
      email,
      monthly_base_salary: fixed_monthly_salary,
      having_spouse: spouse === '無' || spouse === '' ? false : true,
      custom_fields
    };

    logger.debug('Transformed Garoon data to SmartHR format', {
      name: `${firstName} ${lastName}`,
      customFieldsCount: custom_fields.length
    });

    return crewData;
  }

  findGaroonData(request, name, hasMultipleValues = false) {
    if (!request.items) return hasMultipleValues ? [] : null;

    if (hasMultipleValues) {
      const items = Object.values(request.items).filter(item => item.name === name);
      return items.map(i => i.value);
    } else {
      const item = Object.values(request.items).find(item => item.name === name);
      return item?.value || null;
    }
  }
}
    