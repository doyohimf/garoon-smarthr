-- requests table
CREATE TABLE IF NOT EXISTS data-integration-474311.saasdb.requests (
  request_id STRING NOT NULL,
  request_number STRING,
  request_name STRING,
  status STRING,
  status_type STRING,
  created_at TIMESTAMP,
  processing_step_code STRING,
  is_urgent BOOLEAN,
  applicant_id STRING,
  applicant_code STRING,
  applicant_name STRING,
  extracted_at TIMESTAMP
) CLUSTER BY request_id, created_at;

-- request_form_fields table
CREATE TABLE IF NOT EXISTS data-integration-474311.saasdb.request_form_fields (
  request_id STRING NOT NULL,
  field_code STRING NOT NULL,
  field_name STRING,
  field_name_eng STRING,
  field_type STRING,
  field_value STRING,
  extracted_at TIMESTAMP
) CLUSTER BY request_id, field_code;

-- request_steps table
CREATE TABLE IF NOT EXISTS data-integration-474311.saasdb.request_steps (
  request_id STRING NOT NULL,
  step_id STRING NOT NULL,
  step_code STRING NOT NULL,
  step_name STRING,
  is_approval_step INTEGER,
  requirement STRING,
  extracted_at TIMESTAMP
) CLUSTER BY request_id, step_id;

-- request_step_processors table
CREATE TABLE IF NOT EXISTS data-integration-474311.saasdb.request_step_processors (
  request_id STRING NOT NULL,
  step_id STRING NOT NULL,
  processor_id STRING,
  processor_code STRING,
  processor_name STRING,
  result STRING,
  comment STRING,
  operated_at TIMESTAMP,
  extracted_at TIMESTAMP
) CLUSTER BY request_id, step_id;

-- garoon_requests table
CREATE TABLE IF NOT EXISTS data-integration-474311.saasdb.garoon_requests (
  id STRING NOT NULL,
  request_id STRING NOT NULL,
  request_number STRING,
  status STRING NOT NULL,
  workflow INTEGER NOT NULL,
  garoon_request_create_date TIMESTAMP,
  etl_updated_date TIMESTAMP,
  etl_extracted_date TIMESTAMP
) CLUSTER BY request_id, status;

-- allowances_workflow table (WF#5)
CREATE TABLE IF NOT EXISTS data-integration-474311.saasdb.allowances_workflow (
  employee_code STRING NOT NULL,
  change_date DATE NOT NULL,
  type STRING NOT NULL,
  amount NUMERIC NOT NULL,
  date_registered TIMESTAMP NOT NULL,
  for_process INTEGER NOT NULL,
  custom_fields STRING,
  inserted_at TIMESTAMP NOT NULL,
  transmitted_at TIMESTAMP,
  request_id STRING,
  request_number STRING
) CLUSTER BY employee_code, change_date;

