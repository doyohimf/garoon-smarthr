-- BigQuery schema for resign_tagging table
-- This table stores records of employees whose resignation status has been
-- automatically tagged as "retired" when their resignation date is > 2 months old

CREATE TABLE IF NOT EXISTS `{PROJECT_ID}.{DATASET_ID}.resign_tagging` (
  id STRING NOT NULL,
  emp_code STRING NOT NULL,
  resigned_at TIMESTAMP NOT NULL,
  tagging_date TIMESTAMP NOT NULL,
  status STRING NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(tagging_date)
CLUSTER BY emp_code
OPTIONS(
  description='Stores records of employees auto-tagged as retired when resignation > 2 months old'
);

-- Note: BigQuery automatically creates clustered indexes based on CLUSTER BY clause
-- No additional index creation needed
