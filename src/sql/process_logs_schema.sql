-- Employee process logs table
-- Tracks all employee changes processed from Garoon to SmartHR

CREATE TABLE IF NOT EXISTS employee_process_logs (
  -- Request identification
  request_id STRING NOT NULL,
  process_type STRING NOT NULL,  -- EMPLOYEE_TRANSFER, PROMOTION, SALARY_CHANGE, etc.
  
  -- Employee information
  employee_id STRING,
  
  -- Transfer specific
  from_department STRING,
  to_department STRING,
  
  -- Promotion/Demotion specific
  current_position STRING,
  new_position STRING,
  current_grade STRING,
  new_grade STRING,
  
  -- Salary change specific
  current_base_salary FLOAT64,
  new_base_salary FLOAT64,
  salary_change_amount FLOAT64,
  salary_change_percent FLOAT64,
  change_type STRING,  -- INCREASE, DECREASE, NO_CHANGE
  change_reason STRING,
  
  -- Secondment specific
  from_company STRING,
  to_company STRING,
  is_permanent BOOLEAN,
  
  -- Leave/Return specific
  leave_type STRING,
  is_paid BOOLEAN,
  leave_duration_days INTEGER,
  work_arrangements STRING,
  
  -- Allowance change specific
  total_allowance_before FLOAT64,
  total_allowance_after FLOAT64,
  total_change_amount FLOAT64,
  total_change_percent FLOAT64,
  commuting_change FLOAT64,
  housing_change FLOAT64,
  family_change FLOAT64,
  position_change FLOAT64,
  
  -- Resignation specific
  resignation_type STRING,
  resignation_reason STRING,
  last_working_date DATE,
  retirement_date DATE,
  years_of_service FLOAT64,
  retirement_allowance FLOAT64,
  unused_vacation_days INTEGER,
  eligible_for_rehire BOOLEAN,
  
  -- Common fields
  start_date DATE,
  end_date DATE,
  expected_end_date DATE,
  effective_date DATE,
  
  -- Processing metadata
  status STRING,  -- COMPLETED, ERROR
  error_message STRING,
  processed_at TIMESTAMP,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
) 
PARTITION BY DATE(processed_at)
CLUSTER BY process_type, employee_id, status;