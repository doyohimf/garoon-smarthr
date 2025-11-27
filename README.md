# Garoon to SmartHR ETL Pipeline

Serverless ETL application for Google Cloud Platform that extracts data from Garoon API, stores it in BigQuery, and transfers it to SmartHR API.

## Architecture

```
Garoon API → BigQuery → SmartHR API
```

### Design Pattern: Layered Architecture

```
├── index.js (Entry Point)
├── orchestrator/ (Business Logic Orchestration)
├── services/ (Business Logic)
├── repositories/ (Data Access)
├── transformers/ (Data Transformation)
├── utils/ (Utilities)
└── config/ (Configuration)
```

## Features

- ✅ Fetches requests from Garoon API (sorted DESC)
- ✅ Validates fullName field before processing
- ✅ Stores data in BigQuery tables (requests, form_fields, steps, processors)
- ✅ Transforms and transfers to SmartHR API
- ✅ Retry logic (3 attempts) for SmartHR transfers
- ✅ Status tracking (ON-GOING, COMPLETED, ERROR)
- ✅ Offset tracking in GCS
- ✅ Structured logging
- ✅ Local testing with mock BigQuery

## Local Testing

### Option 1: Quick Test (Single Run)

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your credentials

# Run single ETL execution
npm test
```

### Option 2: Local Server (HTTP Endpoint)

```bash
# Start local server
npm start

# Test ETL endpoint
curl http://localhost:8080/etl

# Or use browser
open http://localhost:8080/etl
```

### Local Mode Features

- **Mock BigQuery**: Writes to `data/bigquery-mock/*.jsonl` files instead of BigQuery
- **Local Offset Tracking**: Saves to `data/offset-tracker.json` instead of GCS
- **Full Garoon & SmartHR API calls**: Still connects to real APIs

### Testing Without SmartHR

To test without calling SmartHR API, create `src/services/smarthr-mock.service.js`:

```javascript
export class SmartHRMockService {
  async getCustomFields() {
    return [];
  }
  
  async createCrew(crewData) {
    console.log('[MOCK] SmartHR crew created:', crewData);
    return { id: 'mock-' + Date.now() };
  }
}
```

Then update orchestrator to use mock when `process.env.MOCK_SMARTHR === 'true'`.

## Environment Variables

```bash
# Garoon
GAROON_BASE_URL=https://jcg.cybozu.com
GAROON_API_ENDPOINT=https://jcg.cybozu.com/g/api/v1/workflow/admin/requests
CYBOZU_AUTHORIZATION=<your-auth-token>

# SmartHR
SMARTHR_BASE_URL=https://e10379b3050f91760fb5d051.daruma.space/api/v1
SMARTHR_ACCESS_TOKEN=<your-access-token>

# GCP
GCP_PROJECT_ID=<your-project-id>
BIGQUERY_DATASET_ID=jc_etl
GCS_BUCKET_NAME=jc-etl-tracking

# Optional
LOG_LEVEL=info
```

## Deployment

### Quick Deployment (Automated)

```bash
# Make script executable
chmod +x quick-deploy.sh

# Run deployment
./quick-deploy.sh
```

The script will:
1. ✅ Verify prerequisites
2. ✅ Enable required GCP APIs
3. ✅ Create BigQuery dataset and tables
4. ✅ Create Cloud Storage bucket
5. ✅ Store credentials in Secret Manager
6. ✅ Deploy Cloud Function
7. ✅ Provide function URL and testing commands

### Manual Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed step-by-step instructions.

### Prerequisites

1. GCP Project with enabled APIs:
   - Cloud Functions
   - BigQuery
   - Cloud Storage

2. Create BigQuery dataset and tables:
```bash
bq mk --dataset ${GCP_PROJECT_ID}:jc_etl
bq mk --table jc_etl.requests bigquery_schema_jc_etl.sql
```

3. Create GCS bucket for offset tracking:
```bash
gsutil mb gs://jc-etl-tracking
```

### Deploy to GCP

```bash
npm run deploy
```

Or manual deployment:

```bash
gcloud functions deploy garoonToSmartHRETL \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point garoonToSmartHRETL \
  --set-env-vars GAROON_BASE_URL=...,SMARTHR_BASE_URL=...,GCP_PROJECT_ID=...
```

## Process Flow

1. **Fetch**: Get current offset from GCS
2. **Loop**: Keep fetching requests until finding a processable one
   - Check if request name matches any processor keywords
   - If no match, skip and increment offset
   - Continue until processable request found (max 100 attempts)
3. **Validate**: 
   - For NEW_HIRE: Check if fullName (よみがな) exists
   - For other types: No additional validation
4. **Transform**: Convert Garoon data to BigQuery schema
5. **Store**: Insert into BigQuery tables
6. **Transfer**: Transform and send to SmartHR API (with retry)
7. **Update**: Update request status in BigQuery
8. **Track**: Save new offset to GCS

## Auto-Skip Unrecognized Requests

The ETL automatically skips requests that don't match any processor:
- Checks request name against routing keywords
- If no match found → increments offset and fetches next request
- Continues until finding a processable request
- Max 100 attempts per execution to prevent infinite loops

**Processable Request Types**:
- `内勤社員の人事採用・更新・変更` → NEW_HIRE
- `社員の異動・昇格・降格・給与変更` → UNIFIED_CHANGE
- `社員の出向・転籍` → SECONDMENT
- `社員の休業・復職` → LEAVE/RETURN
- `社員の給与・手当変更 (内勤) ※通勤費除` → ALLOWANCE_CHANGE
- `社員の退社 (内勤)` → RESIGNATION

All other request types are automatically skipped.

## Data Flow

### Garoon → BigQuery

```
Request → requests table
Items → request_form_fields table
Steps → request_steps table
Processors → request_step_processors table
```

### BigQuery → SmartHR

```
Garoon fields → SmartHR crew object
Custom fields → SmartHR custom_fields array
```

## Error Handling

- **SmartHR Transfer Fails**: 
  - Retries 3 times with exponential backoff
  - Status set to "ERROR" in BigQuery
  - Offset still increments to avoid reprocessing

- **BigQuery Insert Fails**: 
  - Transaction rolls back
  - Offset not incremented
  - Next execution retries same request

## Monitoring

Check logs in GCP Console:
```bash
gcloud functions logs read garoonToSmartHRETL --limit 50
```

## Offset Tracker Format

```json
{
  "offset": 365,
  "stats": {
    "totalRequests": 10,
    "totalFormFields": 580,
    "totalSteps": 90,
    "totalProcessors": 91,
    "batches": 10,
    "startTime": "2025-10-18T08:47:54.672Z"
  },
  "timestamp": "2025-10-18T09:48:51.553Z"
}
```

## Future Enhancements

- Batch processing support
- Data validation layer
- Webhook notifications
- Dashboard for monitoring
- Dead letter queue for failed transfers