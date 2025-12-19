-- garoon_requests table
CREATE TABLE IF NOT EXISTS data-integration-474311.etl_db.garoon_requests (
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
CREATE TABLE IF NOT EXISTS data-integration-474311.etl_db.allowances_workflow (
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

-- empchanges_workflow table (WF#2)
CREATE TABLE IF NOT EXISTS data-integration-474311.etl_db.empchanges_workflow (
  employee_code STRING NOT NULL,
  change_date DATE NOT NULL,
  type STRING NOT NULL,
  position STRING,
  classification STRING,
  new_salary NUMERIC,
  position_allowance NUMERIC,
  for_process INTEGER NOT NULL,
  custom_fields STRING,
  inserted_at TIMESTAMP NOT NULL,
  transmitted_at TIMESTAMP,
  request_id STRING,
  request_number STRING
) CLUSTER BY employee_code, change_date;

