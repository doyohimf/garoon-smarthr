import { garoonFields, garoonGender } from '../config/garoon.config.js';
import { smarthr_custom_fields } from '../config/smarthr.config.js';
import { NATIONALITY_CODE } from '../config/nationality.config.js';
import { SmartHRService } from '../services/smarthr.service.js';
import { KuroshiroUtil } from '../utils/kuroshiro.util.js';
import { KatakanaUtil } from '../utils/katakana.util.js';
import { FormatterUtil } from '../utils/formatter.util.js';
import { logger } from '../utils/logger.util.js';

export class GaroonToSmartHRTransformer {
  constructor() {
    this.smartHRService = new SmartHRService();
    this.kuroshiroUtil = new KuroshiroUtil();
  }

  async transform(garoonRequest) {
    const customFields = await this.smartHRService.getCustomFields();
    
    let emp_code = this.findGaroonData(garoonRequest, garoonFields.employee_code);
    
    // If emp_code is missing, look for 社員コード in comments
    if (!emp_code || emp_code === '9999' || emp_code === '9' || emp_code === '123456789') {
      emp_code = this.extractEmpCodeFromComments(garoonRequest);
    }
    
    // Generate temporary ID if emp_code is '9999'
    // if (emp_code === '9999') {
    //   const randomDigits = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
    //   emp_code = `TEMP-ID-${randomDigits}`;
    // }
    console.log(emp_code);
    // Extract name fields
    const firstName = this.findGaroonData(garoonRequest, garoonFields.firstname) || '';
    const lastName = this.findGaroonData(garoonRequest, garoonFields.lastname) || '';
    const fullName = this.findGaroonData(garoonRequest, garoonFields.fullName) || '';
    const middleName = this.findGaroonData(garoonRequest, garoonFields.middlename) || '';
    const fullnameRoman = this.findGaroonData(garoonRequest, garoonFields.fullnameRoman) || '';
    const fullNameKanji = this.findGaroonData(garoonRequest, garoonFields.fullNameKanji) || '';

    // Combine middle name with first name and check character length
    let combinedFirstName = firstName;
    if (middleName && middleName.trim()) {
      const combined = `${middleName}${firstName}`;
      if (combined.length <= 30) {
        combinedFirstName = combined;
      }
    }
    
    let firstNameKanji = '', lastNameKanji = '';

    if (fullName) {
      const nameParts = FormatterUtil.dissectName(fullName);
      firstNameKanji = await this.kuroshiroUtil.kanjiToKatakana(nameParts.firstName || '') || '';
      lastNameKanji = await this.kuroshiroUtil.kanjiToKatakana(nameParts.lastName || '') || '';
    }

    // Extract Address - workplace
    const workplace_address = this.findGaroonData(garoonRequest, garoonFields.workplace_address);
    const dissectedWorkplaceAddress = await this.dissectAddress(workplace_address);
    
    // Extract Address - current (split fields)
    const current_postal_code_1 = this.findGaroonData(garoonRequest, garoonFields.current_address_postal_code_1);
    const current_postal_code_2 = this.findGaroonData(garoonRequest, garoonFields.current_address_postal_code_2);
    const current_zip_code = current_postal_code_1 && current_postal_code_2 ? `${current_postal_code_1}-${current_postal_code_2}` : null;
    const current_prefecture = this.findGaroonData(garoonRequest, garoonFields.current_address_prefecture);
    const current_municipality = this.findGaroonData(garoonRequest, garoonFields.current_address_municipality);
    const current_chome_banchi = this.findGaroonData(garoonRequest, garoonFields.current_address_chome_banchi);
    const current_building_room = this.findGaroonData(garoonRequest, garoonFields.current_address_building_room);
    
    // Build current address string for dissection fallback
    const current_address_string = [current_prefecture, current_municipality, current_chome_banchi, current_building_room]
      .filter(Boolean).join('');
    const current_address_literal_yomi = current_address_string ? 
      await this.kuroshiroUtil.kanjiToKatakana(current_address_string) : null;
    
    const dissectedCurrentAddress = {
      country_number: '392',
      zip_code: current_zip_code,
      pref: current_prefecture,
      city: current_municipality,
      street: current_chome_banchi,
      building: current_building_room,
      literal_yomi: current_address_literal_yomi ? KatakanaUtil.ensureFullWidthKatakana(current_address_literal_yomi) : null
    };
    
    // Extract Address - resident (split fields)
    const resident_postal_code_1 = this.findGaroonData(garoonRequest, garoonFields.resident_address_postal_code_1);
    const resident_postal_code_2 = this.findGaroonData(garoonRequest, garoonFields.resident_address_postal_code_2);
    const resident_zip_code = resident_postal_code_1 && resident_postal_code_2 ? `${resident_postal_code_1}-${resident_postal_code_2}` : null;
    const resident_prefecture = this.findGaroonData(garoonRequest, garoonFields.resident_address_prefecture);
    const resident_municipality = this.findGaroonData(garoonRequest, garoonFields.resident_address_municipality);
    const resident_chome_banchi = this.findGaroonData(garoonRequest, garoonFields.resident_address_chome_banchi);
    const resident_building_room = this.findGaroonData(garoonRequest, garoonFields.resident_address_building_room);
    
    // Build resident address string for dissection fallback
    const resident_address_string = [resident_prefecture, resident_municipality, resident_chome_banchi, resident_building_room]
      .filter(Boolean).join('');
    const resident_address_literal_yomi = resident_address_string ? 
      await this.kuroshiroUtil.kanjiToKatakana(resident_address_string) : null;
    
    const dissectedResidentCardAddress = {
      country_number: '392',
      zip_code: resident_zip_code,
      pref: resident_prefecture,
      city: resident_municipality,
      street: resident_chome_banchi,
      building: resident_building_room,
      literal_yomi: resident_address_literal_yomi ? KatakanaUtil.ensureFullWidthKatakana(resident_address_literal_yomi) : null
    };
    
    const occupation1 = this.findGaroonData(garoonRequest, garoonFields.job_description);
    const occupation2 = this.findGaroonData(garoonRequest, garoonFields.job_description_scope_of_change_radio);
    const occupation3 = this.findGaroonData(garoonRequest, garoonFields.job_description_scope_of_change_details);
    let occupation = occupation1 + ' ' + occupation2 + ' ' + occupation3;
    if (occupation.length > 25) {
      occupation = occupation.substring(0, 25);
    }

    // Extract trial period
    const trial_period = this.findGaroonData(garoonRequest, garoonFields.trial_period, true);
    const start_trial_period = trial_period?.[0];
    const end_trial_period = trial_period?.[1];
    // Extract other fields
    const division = this.findGaroonData(garoonRequest, garoonFields.division);
    const departmentName = this.findGaroonData(garoonRequest, garoonFields.affiliation);
    //const department = await this.smartHRService.findOrCreateDepartment(departmentName);
    
    // Check department if already exist in SmartHR
    let department = departmentName;
    let department_ids = [];
    
    if (departmentName) {
      const departments = await this.smartHRService.getDepartments(500);
      logger.debug('Available departments:', departments.map(d => d.name));
      
      const normalizedDeptName = departmentName.trim().replace(/[/／]/g, '／');
      
      const existingDept = departments.find(dept => {
        if (!dept.name) return false;
        const normalizedSmartHRName = dept.name.trim().replace(/[/／]/g, '／');
        return normalizedSmartHRName === normalizedDeptName;
      });
      
      logger.debug('Looking for department:', departmentName);
      logger.debug('Normalized to:', normalizedDeptName);
      logger.debug('Found matching department:', existingDept);
      
      if (existingDept) {
        department_ids = [existingDept.id];
        department = undefined;
      }
    }


    const joining_date = this.findGaroonData(garoonRequest, garoonFields.joining_date);
    const birthDate = this.findGaroonData(garoonRequest, garoonFields.birthDate);
    const gender = garoonGender[this.findGaroonData(garoonRequest, garoonFields.gender)] || 'male';
    const email = this.findGaroonData(garoonRequest, garoonFields.email);
    const spouse = this.findGaroonData(garoonRequest, garoonFields.spouse);
    const phone_number = this.findGaroonData(garoonRequest, garoonFields.phone_number);

    // Wage fields
    const work_hours_starting_time = this.findGaroonData(garoonRequest, garoonFields.work_hours_starting_time);
    const work_hours_closing_time = this.findGaroonData(garoonRequest, garoonFields.work_hours_closing_time);
    const work_hours_break_time = this.findGaroonData(garoonRequest, garoonFields.work_hours_break_time);
    const work_type = this.findGaroonData(garoonRequest, garoonFields.work_type);
    const holiday = this.findGaroonData(garoonRequest, garoonFields.holiday);
    const fixed_monthly_overtime_hours = this.findGaroonData(garoonRequest, garoonFields.fixed_monthly_overtime_hours);
    const annual_salary = this.findGaroonData(garoonRequest, garoonFields.annual_salary);
    const monthly_salary = this.findGaroonData(garoonRequest, garoonFields.monthly_salary_amount);
    const fixed_monthly_salary = this.findGaroonData(garoonRequest, garoonFields.fixed_monthly_salary);
    const fixed_premium_wage = this.findGaroonData(garoonRequest, garoonFields.fixed_premium_wage);
    let salary_classification = this.findGaroonData(garoonRequest, garoonFields.salary_classification).trim();
    
    // Validate salary_classification against SmartHR payment_periods 
    if (salary_classification) {
      const paymentPeriodId = await this.smartHRService.findPaymentPeriodId(salary_classification);
      if (!paymentPeriodId) {
        throw new Error(`Invalid salary classification: "${salary_classification}" does not exist in SmartHR payment_periods`);
      }
      salary_classification = paymentPeriodId;
    }

    // Allowance and insurance
    const commuting_allowance = this.findGaroonData(garoonRequest, garoonFields.commuting_allowance);
    const commuting_expenses = this.findGaroonData(garoonRequest, garoonFields.commuting_expenses);
    const employment_insurance_enrollment = this.findGaroonData(garoonRequest, garoonFields.employment_insurance_enrollment);
    const social_insurance_coverage = this.findGaroonData(garoonRequest, garoonFields.social_insurance_coverage);
    const employment_insurance_enrollment_date = this.findGaroonData(garoonRequest, garoonFields.employment_insurance_enrollment_date);
    const social_insurance_enrollment_date = this.findGaroonData(garoonRequest, garoonFields.social_insurance_enrollment_date);
    const monthly_salary_amount = this.findGaroonData(garoonRequest, garoonFields.monthly_salary_amount);
    const total_allowances_1 = this.findGaroonData(garoonRequest, garoonFields.total_allowances_1);
    const total_allowances_2 = this.findGaroonData(garoonRequest, garoonFields.total_allowances_2);

    // Calculate monthly income
    const hourly_wage = this.findGaroonData(garoonRequest, garoonFields.hourly_wage);
    const monthly_work_hours = this.findGaroonData(garoonRequest, garoonFields.monthly_work_hours);
    let monthly_income_currency;
    if (hourly_wage && monthly_work_hours) {
      // For hourly workers: hourly_wage × monthly_work_hours + commuting_expense × 20
      monthly_income_currency = (parseFloat(hourly_wage) * parseFloat(monthly_work_hours)) + (parseFloat(commuting_expenses || 0) * 20);
    } else {
      // For monthly salaried employees: monthly_salary_amount + fixed_premium_wage + allowances_1 + allowances_2 + commuting_expense
      monthly_income_currency = parseFloat(monthly_salary_amount || 0) + parseFloat(fixed_premium_wage || 0) + parseFloat(total_allowances_1 || 0) + parseFloat(total_allowances_2 || 0) + parseFloat(commuting_expenses || 0);
    }
    monthly_income_currency = this.formatCurrency(monthly_income_currency);

    const monthly_income_goods = (social_insurance_enrollment_date ? '0' : null);

    // Additional fields from updated config
    const employee_classification = this.findGaroonData(garoonRequest, garoonFields.classification);
    const emp_type = this.findGaroonData(garoonRequest, garoonFields.emp_type);
    const affiliated_company = this.findGaroonData(garoonRequest, garoonFields.affiliated_company);
    const affiliated_base = this.findGaroonData(garoonRequest, garoonFields.affiliated_base);
    const application_category = this.findGaroonData(garoonRequest, garoonFields.application_category);
    const hiring_category = this.findGaroonData(garoonRequest, garoonFields.hiring_category);
    const foreigner_category = this.findGaroonData(garoonRequest, garoonFields.foreigner_category);
    const nationality = this.findGaroonData(garoonRequest, garoonFields.nationality);
    const residence_status_category = this.findGaroonData(garoonRequest, garoonFields.residence_status_category);
    const residence_card_expiration_date = this.findGaroonData(garoonRequest, garoonFields.residence_card_expiration_date);
    const workplace_postal_code = this.findGaroonData(garoonRequest, garoonFields.workplace_postal_code);
    const workplace_phone_number = this.findGaroonData(garoonRequest, garoonFields.workplace_phone_number);
    const workplace_name = this.findGaroonData(garoonRequest, garoonFields.workplace_name);
    const fixed_term_contract_start_date = this.findGaroonData(garoonRequest, garoonFields.fixed_term_contract_start_date);
    const fixed_term_contract_end_date = this.findGaroonData(garoonRequest, garoonFields.fixed_term_contract_end_date);
    const contract_renewal = this.findGaroonData(garoonRequest, garoonFields.contract_renewal);
    const home_phone_number = this.findGaroonData(garoonRequest, garoonFields.home_phone_number);
    const age = this.findGaroonData(garoonRequest, garoonFields.age);
    const romanization = this.findGaroonData(garoonRequest, garoonFields.romanization);
    const regular_salary_increase = this.findGaroonData(garoonRequest, garoonFields.regular_salary_increase);
    const bonus = this.findGaroonData(garoonRequest, garoonFields.bonus);
    const spouse_dependent_obligation = this.findGaroonData(garoonRequest, garoonFields.spouse_dependent_obligation);
    const dependents_excluding_spouse = this.findGaroonData(garoonRequest, garoonFields.dependents_excluding_spouse);

    const allowance_1 = this.findGaroonData(garoonRequest, garoonFields.allowances_1);

    var position_allowance = '';
    var managers_allowance = '';
    var special_allowace = '';
    var relocation_allowance = '';
    var vehicle_allowance = '';
    
    switch (allowance_1) {
      case '職位手当':
        position_allowance = total_allowances_1;
        break;
      case '責任者手当':
        managers_allowance = total_allowances_1;
        break;
      case '特別手当':
        special_allowace = total_allowances_1;
        break;
      case '赴任手当':
        relocation_allowance = total_allowances_1;
        break;
      case '車両手当':
        vehicle_allowance = total_allowances_1;
        break;
    }

    const other_allowance = this.findGaroonData(garoonRequest, garoonFields.allowances_2);


    // Build custom fields
    const cfields = {};
    cfields[smarthr_custom_fields.workplace_address_postal_code] = workplace_postal_code;
    cfields[smarthr_custom_fields.workplace_address_address] = workplace_address;
    cfields[smarthr_custom_fields.workplace_address_country_number] = dissectedWorkplaceAddress.country_number;
    cfields[smarthr_custom_fields.workplace_address_zip_code] = workplace_postal_code;
    cfields[smarthr_custom_fields.workplace_address_prefecture] = dissectedWorkplaceAddress.pref;
    cfields[smarthr_custom_fields.workplace_address_city] = dissectedWorkplaceAddress.city;
    cfields[smarthr_custom_fields.workplace_address_street] = dissectedWorkplaceAddress.street;
    cfields[smarthr_custom_fields.workplace_address_building] = dissectedWorkplaceAddress.building;
    cfields[smarthr_custom_fields.workplace_address_literal_yomi] = dissectedWorkplaceAddress.literal_yomi;

    cfields[smarthr_custom_fields.probation_period_start] = start_trial_period;
    cfields[smarthr_custom_fields.probation_period_end] = end_trial_period;
    //cfields[smarthr_custom_fields.work_hours] = work_hours || '';
    cfields[smarthr_custom_fields.work_hours_starting_time] = this.formatTime(work_hours_starting_time) || '';
    cfields[smarthr_custom_fields.work_hours_closing_time] = this.formatTime(work_hours_closing_time) || '';
    cfields[smarthr_custom_fields.work_hours_break_time] = this.formatTime(work_hours_break_time);
    cfields[smarthr_custom_fields.work_hours_work_type] = work_type;
    cfields[smarthr_custom_fields.work_hours_holiday] = this.transformHolidayValue(holiday);
    cfields[smarthr_custom_fields.wages_display_of_fixed_premiums] = fixed_monthly_overtime_hours;
    cfields[smarthr_custom_fields.wages_annual_salary] = this.formatCurrency(annual_salary);
    cfields[smarthr_custom_fields.wages_monthly] = this.formatCurrency(fixed_monthly_salary);
    cfields[smarthr_custom_fields.wages_fixed_premium] = this.formatCurrency(fixed_premium_wage);
    cfields[smarthr_custom_fields.wages_fixed_overtime_hours] = this.formatHours(fixed_monthly_overtime_hours);

    cfields[smarthr_custom_fields.salary_classification] = salary_classification;
    cfields[smarthr_custom_fields.job_description] = occupation;
    cfields[smarthr_custom_fields.trial_start_date] = start_trial_period;
    cfields[smarthr_custom_fields.trial_end_date] = end_trial_period;

    cfields[smarthr_custom_fields.position_allowance] = this.sanitizeAllowanceValue(this.formatCurrency(position_allowance));
    cfields[smarthr_custom_fields.managers_allowance] = this.sanitizeAllowanceValue(this.formatCurrency(managers_allowance));
    cfields[smarthr_custom_fields.special_allowace] = this.sanitizeAllowanceValue(this.formatCurrency(special_allowace));
    cfields[smarthr_custom_fields.relocation_allowance] = this.sanitizeAllowanceValue(this.formatCurrency(relocation_allowance));
    cfields[smarthr_custom_fields.vehicle_allowance] = this.sanitizeAllowanceValue(this.formatCurrency(vehicle_allowance));
    cfields[smarthr_custom_fields.other_allowance] = this.sanitizeAllowanceValue(this.formatCurrency(total_allowances_2));

    //if (commuting_allowance === "1ヶ月") {
    //  cfields[smarthr_custom_fields.commuting_allowance_monthly] = commuting_expenses;
    //} else {
    cfields[smarthr_custom_fields.commuting_allowance_daily] = commuting_expenses;
    //}

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
      emp_code: emp_code,
      emp_type: 'full_timer',
      emp_status: 'employed',
      last_name: (!lastName || lastName.trim() === '') ? lastNameKanji : lastName,
      first_name: (!combinedFirstName || combinedFirstName.trim() === '') ? firstNameKanji : combinedFirstName,
      last_name_yomi: lastNameKanji,
      first_name_yomi: firstNameKanji,
      birth_at: birthDate,
      gender: gender,
      tel_number: FormatterUtil.formatPhoneNumber(phone_number),
      address: dissectedCurrentAddress,
      email,
      resident_card_address: dissectedResidentCardAddress,
      position: division,
      occupation: occupation || '',
      entered_at: joining_date,
      emp_ins_qualified_at: employment_insurance_enrollment_date || null,
      soc_ins_qualified_at: social_insurance_enrollment_date || null,
      having_spouse: spouse === '無' || spouse === '' ? false : true,
      monthly_base_salary: monthly_salary || null,
      monthly_income_currency: monthly_income_currency ? this.sanitizeCurrency(monthly_income_currency) : '',
      monthly_income_goods: monthly_income_goods ? this.sanitizeCurrency(monthly_income_goods) : null,
      foreign_resident_last_name: foreigner_category ? romanization?.split(' ')?.[1] || '' : '',
      foreign_resident_first_name: foreigner_category ? romanization?.split(' ')?.[0] || '' : '',
      nationality_code: nationality && NATIONALITY_CODE[nationality] ? NATIONALITY_CODE[nationality] : '',
      resident_status_type: residence_status_category || null,
      resident_end_at: this.isValidDate(residence_card_expiration_date) ? residence_card_expiration_date : null,
      ...(department_ids.length > 0 ? { department_ids } : { department }),
      payment_period_id: salary_classification,
      contract_type: employee_classification === '有期雇用' ? 'fixed_term' : 'unlimited',
      contract_start_on: this.isValidDate(fixed_term_contract_start_date) ? this.formatJapaneseDate(fixed_term_contract_start_date) : null,
      contract_end_on: this.isValidDate(fixed_term_contract_end_date) ? this.formatJapaneseDate(fixed_term_contract_end_date) : null,
      custom_fields
    };
    //console.log(crewData);
    logger.debug('Transformed Garoon data to SmartHR format', {
      name: `${combinedFirstName} ${lastName}`,
      customFieldsCount: custom_fields.length
    });

    return crewData;
  }

  async dissectAddress(addressString) {
    if (!addressString) {
      return {};
    }

    const result = {
      country_number: '392'
    };

    const zipMatch = addressString.match(/(\d{3})-(\d{4})/);
    if (zipMatch) {
      result.zip_code = `${zipMatch[1]}-${zipMatch[2]}`;
    } else {
      const zipOnlyMatch = addressString.match(/(\d{7})/);
      if (zipOnlyMatch) {
        result.zip_code = `${zipOnlyMatch[1].slice(0, 3)}-${zipOnlyMatch[1].slice(3)}`;
      }
    }

    const prefectures = [
      '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
      '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
      '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
      '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
      '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
      '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
      '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
    ];

    for (const pref of prefectures) {
      if (addressString.includes(pref)) {
        result.pref = pref;
        const prefIndex = addressString.indexOf(pref);
        const afterPref = addressString.substring(prefIndex + pref.length);
        
        const cityMatch = afterPref.match(/^([^区町村]+[区町村])/);
        if (cityMatch) {
          result.city = cityMatch[1];
          const remaining = afterPref.substring(cityMatch[0].length);
          
          const streetBuildingMatch = remaining.match(/^([^\(]*?)(?:\(([^)]*)\))?$/);
          if (streetBuildingMatch) {
            const streetValue = streetBuildingMatch[1]?.trim();
            if (streetValue) {
              result.street = streetValue;
            }
            const buildingValue = streetBuildingMatch[2]?.trim();
            if (buildingValue) {
              result.building = buildingValue;
            }
          }
        }
        break;
      }
    }

    const literalYomi = await this.kuroshiroUtil.kanjiToKatakana(addressString) || '';
    if (literalYomi) {
      result.literal_yomi = KatakanaUtil.ensureFullWidthKatakana(literalYomi);
    }

    return result;
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

  isValidDate(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  transformHolidayValue(holiday) {
    if (!holiday) return holiday;

    // Handle the standard case where holiday === garoonFields.holiday_value ("土日祝\tその他の場合")
    if (holiday === garoonFields.holiday_value || holiday === '土日祝\tその他の場合') {
      return '土曜日、日曜日、祝日、その他の暦に基づく日およびその他の場合';
    }

    let result = holiday;
    
    // Replace 'Weekends/Holidays' or 'Weekend and Holidays' with full expansion
    result = result.replace(/Weekends\/Holidays|Weekend and Holidays/gi, '土曜日、日曜日、祝日、その他の暦に基づく日');
    
    // Replace 'Weekends' with "Saturdays, Sundays"
    result = result.replace(/Weekends/gi, '土曜日、日曜日');
    
    // Replace 'Holidays' with "National Holidays and other calendar-based days"
    result = result.replace(/Holidays/gi, '祝日、その他の暦に基づく日');
    
    // Replace 土日祝 pattern
    result = result.replace(/土日祝/g, '土曜日、日曜日、祝日');
    
    return result;
  }

  formatTime(timeString) {
    if (!timeString) return '';

    // Assume timeString is in HH:MM format
    const parts = timeString.toString().split(':').map(Number);
    const hours = parts[0];
    const minutes = parts[1];

    if (isNaN(hours) || isNaN(minutes)) return '';

    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  formatHours(value) {
    if (!value) return '';

    const str = value.toString().trim();

    if (/^\d+$/.test(str)) {
      return `${str} hours/month`;
    } else if (/^\d+\s*hours?$/i.test(str)) {
      return str.replace(/hours?/i, 'hours/month');
    } else {
      return str;
    }
  }

  formatCurrency(value) {
    if (!value) return '';

    // Convert to string and remove any characters except digits, commas, and decimals
    const sanitized = value.toString().replace(/[^0-9,.\-]/g, '');
    
    const num = parseFloat(sanitized.replace(/,/g, ''));
    if (isNaN(num)) return '';

    // Format with commas and up to 2 decimal places
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/,/g, ',');
  }

  sanitizeCurrency(value) {
    if (value === null || value === undefined) return null;

    let str = value.toString().trim();

    // Full-width → half-width
    str = str.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

    // Remove everything except digits
    str = str.replace(/[^0-9]/g, "");

    if (!str || str.length === 0) return null;

    return Number(str);
  }

  sanitizeAllowanceValue(value) {
    if (value == null) return null;

    let str = value.toString().trim();

    // convert full-width nums → half-width
    str = str.replace(/[０-９]/g, s => 
      String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    );

    // remove everything except digits
    str = str.replace(/[^0-9]/g, "");

    if (!str) return null;

    return Number(str);
  }

  formatJapaneseDate(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    if (isNaN(date)) return dateString;

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    let era = '';
    let eraYear = 0;

    if (year >= 2019) {
      era = '令和';
      eraYear = year - 2019 + 1;
    } else if (year >= 1989) {
      era = '平成';
      eraYear = year - 1989 + 1;
    } else if (year >= 1926) {
      era = '昭和';
      eraYear = year - 1926 + 1;
    } else if (year >= 1912) {
      era = '大正';
      eraYear = year - 1912 + 1;
    } else if (year >= 1868) {
      era = '明治';
      eraYear = year - 1868 + 1;
    }

    return `year ${era}${eraYear}, month ${month.toString().padStart(2, '0')}, day ${day.toString().padStart(2, '0')}`;
  }

  extractEmpCodeFromComments(garoonRequest) {
    if (!garoonRequest.steps) return null;

    const comments = Object.values(garoonRequest.steps)
      .flatMap(step => step.processors)
      .map(p => p.comment)
      .filter(c => c);

    for (const comment of comments) {
      const match = comment.match(/社員コード：(.+?)(?:\n|$)/);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }
}
    