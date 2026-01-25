-- empchanges_workflow table for WF#2 revamp
CREATE TABLE IF NOT EXISTS data-integration-474311.saasdb.empchanges_workflow (
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