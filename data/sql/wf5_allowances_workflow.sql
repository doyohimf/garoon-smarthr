-- WF#5 Allowances Workflow Table Creation
-- Run this query in BigQuery to create the table

CREATE TABLE IF NOT EXISTS `data-integration-474311.saasdb.allowances_workflow` (
  employee_code STRING NOT NULL,
  change_date DATE NOT NULL,
  type STRING NOT NULL,
  amount NUMERIC NOT NULL,
  date_registered TIMESTAMP NOT NULL,
  for_process INTEGER NOT NULL,
  custom_fields STRING,
  inserted_at TIMESTAMP NOT NULL,
  request_id STRING
) 
CLUSTER BY employee_code, change_date
OPTIONS(
  description="WF#5 Allowance change workflow - stores allowance changes before SmartHR transmission"
);

-- Create index for faster queries on date-based lookups
CREATE OR REPLACE INDEX idx_allowances_change_date
ON `data-integration-474311.saasdb.allowances_workflow` (change_date, for_process);

-- Sample query to retrieve allowances ready for today's processing
SELECT
  employee_code,
  change_date,
  type,
  amount,
  custom_fields,
  request_id
FROM `data-integration-474311.saasdb.allowances_workflow`
WHERE for_process = 1
  AND change_date = CURRENT_DATE()
ORDER BY inserted_at ASC;
