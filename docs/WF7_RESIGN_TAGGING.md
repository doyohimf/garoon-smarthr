# WF#7: Automatic Resignation Tagging Workflow

## Overview

Workflow #7 (WF#7) is an independent ETL pipeline that automatically identifies employees whose resignation date is older than 2 months and marks them as "retired" in SmartHR.

**Key Characteristic:** This workflow operates independently of Garoon data. It sources employee information directly from SmartHR's crew records.

---

## Workflow Architecture

### Components

1. **ResignTaggingProcessor** (`src/processors/resign-tagging.processor.js`)
   - Fetches resigned employees from SmartHR
   - Filters those with resignation date > 2 months old
   - Updates employee status to "retired"
   - Saves records to BigQuery
   - Sends email notifications

2. **ETL7Orchestrator** (`src/orchestrator/etl-7.orchestrator.js`)
   - Orchestrates the resign tagging processor execution
   - Handles error logging and statistics
   - Runs once per execution (not a continuous loop)

3. **Entry Point** (`src/etl-7.js`)
   - Command-line entry point for executing WF#7
   - Runs the orchestrator and exits

### Data Flow

```
SmartHR API (crews with resigned_at)
    ↓
ResignTaggingProcessor.getAllResignedEmployees()
    ↓
Filter (resigned_at > 2 months old)
    ↓
For each eligible employee:
    ├─ Update emp_status to "retired" in SmartHR
    ├─ Save record to BigQuery resign_tagging table
    └─ Send email notification
    ↓
Return execution statistics
```

---

## Data Processing Steps

### Step 1: Fetch Resigned Employees
```javascript
const employees = await processor.getAllResignedEmployees();
// Returns all employees from SmartHR with resigned_at field set
```

### Step 2: Filter by Resignation Age
```javascript
const twoMonthsAgo = new Date();
twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

// Filter employees whose resignation_at < twoMonthsAgo
const eligibleEmployees = employees.filter(emp => {
  return new Date(emp.resigned_at) < twoMonthsAgo;
});
```

### Step 3: Update Employee Status
For each eligible employee:
```javascript
await smartHRService.updateEmployeeUnified({
  employeeCode: emp_code,
  emp_status: 'retired'  // Changed from current status to 'retired'
});
```

### Step 4: Record to BigQuery
Save successful updates to `resign_tagging` table:
```javascript
{
  id: `${emp_code}_${timestamp}`,
  emp_code: "E0001234",
  resigned_at: "2025-09-15T00:00:00Z",
  tagging_date: "2025-11-24T14:30:45.123Z",
  status: "COMPLETE"
}
```

### Step 5: Send Notification
Email notification includes:
- Employee code
- Resignation date
- Days elapsed since resignation
- Action taken (status update to retired)
- Tagging timestamp

---

## BigQuery Table Schema

Table Name: `resign_tagging`

| Column | Type | Description |
|--------|------|-------------|
| id | STRING | Primary key (emp_code + timestamp) |
| emp_code | STRING | Employee code from SmartHR |
| resigned_at | TIMESTAMP | Date employee resigned |
| tagging_date | TIMESTAMP | When employee was tagged as retired |
| status | STRING | COMPLETE or FAILED |
| created_at | TIMESTAMP | Record creation timestamp |

### Partitioning & Clustering
- **Partitioned by:** `DATE(tagging_date)` - Daily partitions for efficient querying
- **Clustered by:** `emp_code` - Optimizes lookups by employee code

### Indexes
- `idx_resign_tagging_emp_code` - Fast employee lookups
- `idx_resign_tagging_status_date` - Status and date filtering

---

## Setup Instructions

### 1. Create BigQuery Table

Replace `{PROJECT_ID}` and `{DATASET_ID}` with your actual values:

```bash
bq query --use_legacy_sql=false < data/sql/resign_tagging.sql
```

Or manually:
```sql
CREATE TABLE IF NOT EXISTS `{PROJECT_ID}.{DATASET_ID}.resign_tagging` (
  id STRING NOT NULL,
  emp_code STRING NOT NULL,
  resigned_at TIMESTAMP NOT NULL,
  tagging_date TIMESTAMP NOT NULL,
  status STRING NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(tagging_date)
CLUSTER BY emp_code;
```

### 2. Configure Environment Variables

Ensure these are set in `.env`:
```env
# SmartHR
SMARTHR_BASE_URL=https://[your-instance].daruma.space/api/v1
SMARTHR_ACCESS_TOKEN=[your-token]

# BigQuery
GCP_PROJECT_ID=your-project-id
BIGQUERY_DATASET_ID=your-dataset-id
GCS_BUCKET_NAME=your-bucket-name

# Email
SMTP__HOST=smtp.gmail.com
SMTP__PORT=465
SMTP__USER=your-email@gmail.com
SMTP__PASS=[your-app-password]
SMTP__FROM=your-email@gmail.com
SMTP__TO=recipient@company.com

# Node Environment
NODE_ENV=production
```

### 3. Add npm Script

Already added to `package.json`:
```bash
"etl:7": "node src/etl-7.js"
```

---

## Usage

### Run WF#7

```bash
# Using npm script
npm run etl:7

# Direct execution
node src/etl-7.js
```

### Expected Output

```
INFO: [Workflow 7] Starting Resign Tagging ETL
INFO: Fetching all resigned employees from SmartHR
INFO: Fetched 47 resigned employees from SmartHR
INFO: 12 employees eligible for tagging (resigned > 2 months ago)
INFO: Processing resigned employee: E0001234, resigned_at: 2025-09-15
INFO: Employee status updated to retired: E0001234
INFO: Resign tagging record saved for: E0001234
INFO: Resignation notification email sent for: E0001234
...
INFO: [Workflow 7] Resign Tagging completed successfully
```

---

## Error Handling

### Processing Errors (Non-Fatal)
If updating a single employee fails:
- Error is logged with employee details
- That employee is skipped (not added to BigQuery)
- Processing continues with next employee
- Statistics show count of failed employees

### Critical Errors (Fatal)
If the workflow itself fails:
- Error is logged to GCP Cloud Storage bucket
- Partial results are not committed
- Process exits with code 1

### Recovery
Failed employees will be reprocessed in the next WF#7 execution since they weren't recorded in BigQuery.

---

## Statistics Output

After execution, logs include:

```json
{
  "totalFetched": 47,
  "eligibleForTagging": 12,
  "successfullyTagged": 12,
  "failedTagging": 0,
  "startTime": "2025-11-24T14:30:00.000Z",
  "endTime": "2025-11-24T14:32:15.456Z"
}
```

---

## Email Notifications

### Recipient
Configured via `SMTP__TO` environment variable

### Email Format
- **Subject:** `[AUTO-TAGGING] Employee Resignation Tagged as Retired - EMP: {emp_code}`
- **Body includes:**
  - Employee code
  - Resignation date
  - Days since resignation
  - Action taken
  - Tagging timestamp
  - Workflow reference (WF#7)

### Example
```
🏷️ Automatic Resignation Tagging

Employee Code: E0001234
Resignation Date: 2025-09-15
Days Since Resignation: 70 days
Status Updated To: Retired
Tagging Date & Time: 2025-11-24T14:31:22.456Z

Action Taken:
• Employee resignation status identified as > 2 months old
• SmartHR employee status updated to "Retired"
• Record saved to BigQuery resign_tagging table with COMPLETE status
```

---

## Query Examples

### Get all employees tagged as retired
```sql
SELECT 
  emp_code,
  resigned_at,
  tagging_date,
  TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), tagging_date, DAY) as days_since_tagging
FROM `project.dataset.resign_tagging`
WHERE status = 'COMPLETE'
ORDER BY tagging_date DESC
LIMIT 100;
```

### Get employees tagged in last 7 days
```sql
SELECT 
  emp_code,
  resigned_at,
  tagging_date
FROM `project.dataset.resign_tagging`
WHERE DATE(tagging_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  AND status = 'COMPLETE'
ORDER BY tagging_date DESC;
```

### Count by day
```sql
SELECT 
  DATE(tagging_date) as tagging_date,
  COUNT(*) as employees_tagged
FROM `project.dataset.resign_tagging`
WHERE status = 'COMPLETE'
GROUP BY DATE(tagging_date)
ORDER BY tagging_date DESC;
```

---

## SmartHR API Integration

### API Endpoint Used
- **GET** `/crews?resigned_at=*&per_page=100`
  - Fetches all crews with resigned_at field set
  - Returns up to 100 employees per page

### Update Operation
- **PATCH** `/crews/{crew_id}`
  - Updates `emp_status` field to "retired"
  - Uses retry logic (3 attempts, 1 second delay)

---

## Scheduling Recommendations

### Frequency
- **Recommended:** Weekly (e.g., every Monday at 2 AM)
- **Minimum:** Monthly

### Rationale
- Identifies 2-month-old resignations
- Reduces manual tracking effort
- Ensures SmartHR data is current
- Prevents backlog of stale records

### Cloud Scheduler Setup
```bash
gcloud scheduler jobs create app-engine resign-tagging-job \
  --schedule="0 2 * * 1" \
  --time-zone="Asia/Tokyo" \
  --http-method=POST \
  --uri="https://[your-function-url]/api/etl/resign-tagging" \
  --oidc-service-account-email=[your-service-account]@appspot.gserviceaccount.com
```

---

## Troubleshooting

### Issue: No employees eligible for tagging
**Possible Causes:**
- All resigned employees are < 2 months old
- SmartHR API not returning resigned_at data
- Employee data not properly synchronized

**Solution:**
- Check SmartHR for employees with resigned_at > 2 months old
- Verify SmartHR API connection
- Review error logs in GCP

### Issue: Email not being sent
**Possible Causes:**
- SMTP configuration incorrect
- `SMTP__TO` not configured
- Email service not initialized

**Solution:**
- Verify SMTP credentials in `.env`
- Check logs for SMTP errors
- Test SMTP connection: `emailService.testConnection()`

### Issue: BigQuery insert fails
**Possible Causes:**
- `resign_tagging` table doesn't exist
- Wrong dataset or project ID
- GCP authentication issue

**Solution:**
- Create table using provided SQL
- Verify `BIGQUERY_DATASET_ID` environment variable
- Check GCP credentials

---

## Implementation Details

### SmartHR Employee Status Values
- `employed` - Active employee
- `on_leave` - Currently on leave
- `return_work` - Returning from leave
- `retired` - Separated from company (set by WF#7)

### Two-Month Calculation
```javascript
const twoMonthsAgo = new Date();
twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
// More accurate than hardcoding 60 days for variable-length months
```

### Retry Logic
- Attempts: 3
- Backoff: 1000ms between attempts
- Applied to SmartHR API update operations

---

## Notes

- **Idempotent:** Safe to run multiple times - employees already tagged won't be retagged
- **Non-destructive:** Only marks employees as "retired", doesn't delete data
- **Independent:** Doesn't depend on Garoon workflow data
- **Auditable:** All changes recorded in BigQuery with timestamps

---

## Related Files

- **Processor:** `src/processors/resign-tagging.processor.js`
- **Orchestrator:** `src/orchestrator/etl-7.orchestrator.js`
- **Entry Point:** `src/etl-7.js`
- **Schema:** `data/sql/resign_tagging.sql`
- **Tests:** `src/tests/resign-tagging.processor.test.js` (if created)

---

## Support

For issues or questions about WF#7:
1. Check error logs in GCP Cloud Logging
2. Review BigQuery `resign_tagging` table for recent records
3. Verify SmartHR API connectivity
4. Check email service SMTP logs
