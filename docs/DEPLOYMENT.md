# Deployment Guide - Garoon to SmartHR ETL

Complete step-by-step guide to deploy this ETL application to Google Cloud Platform.

---

## Prerequisites

### 1. Install Required Tools

#### Google Cloud SDK (gcloud)
```bash
# macOS
brew install --cask google-cloud-sdk

# Windows
# Download from: https://cloud.google.com/sdk/docs/install

# Linux
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

#### Node.js (v20+)
```bash
# macOS
brew install node@20

# Windows
# Download from: https://nodejs.org

# Linux
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify installations:
```bash
gcloud --version
node --version  # Should be v20+
npm --version
```

---

## Step 1: GCP Project Setup

### 1.1 Create or Select GCP Project

```bash
# Login to GCP
gcloud auth login

# List existing projects
gcloud projects list

# Create new project (optional)
gcloud projects create jc-etl-project --name="JC ETL Project"

# Set active project
gcloud config set project jc-etl-project
```

### 1.2 Enable Required APIs

```bash
# Enable all required APIs
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable bigquery.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable logging.googleapis.com
```

Wait 2-3 minutes for APIs to be fully enabled.

### 1.3 Set Up Billing

1. Go to: https://console.cloud.google.com/billing
2. Link billing account to your project
3. Verify: `gcloud beta billing accounts list`

---

## Step 2: BigQuery Setup

### 2.1 Create Dataset

```bash
# Set variables
export PROJECT_ID=$(gcloud config get-value project)
export DATASET_ID="jc_etl"

# Create dataset
bq mk --dataset \
  --location=asia-northeast1 \
  ${PROJECT_ID}:${DATASET_ID}
```

### 2.2 Create Tables

Create file `create-tables.sql`:
```sql
-- requests table
CREATE TABLE IF NOT EXISTS jc_etl.requests (
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
CREATE TABLE IF NOT EXISTS jc_etl.request_form_fields (
  request_id STRING NOT NULL,
  field_code STRING NOT NULL,
  field_name STRING,
  field_name_eng STRING,
  field_type STRING,
  field_value STRING,
  extracted_at TIMESTAMP
) CLUSTER BY request_id, field_code;

-- request_steps table
CREATE TABLE IF NOT EXISTS jc_etl.request_steps (
  request_id STRING NOT NULL,
  step_id STRING NOT NULL,
  step_code STRING NOT NULL,
  step_name STRING,
  is_approval_step INTEGER,
  requirement STRING,
  extracted_at TIMESTAMP
) CLUSTER BY request_id, step_id;

-- request_step_processors table
CREATE TABLE IF NOT EXISTS jc_etl.request_step_processors (
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
```

Execute:
```bash
bq query --use_legacy_sql=false < create-tables.sql
```

Verify tables:
```bash
bq ls ${PROJECT_ID}:${DATASET_ID}
```

---

## Step 3: Cloud Storage Setup

### 3.1 Create Bucket for Offset Tracking

```bash
export BUCKET_NAME="jc-etl-tracking"

# Create bucket
gsutil mb -l asia-northeast1 gs://${BUCKET_NAME}

# Verify
gsutil ls
```

### 3.2 Initialize Offset File

```bash
# Create initial offset file
echo '{
  "offset": 0,
  "stats": {
    "totalRequests": 0,
    "totalFormFields": 0,
    "totalSteps": 0,
    "totalProcessors": 0,
    "batches": 0,
    "startTime": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
  },
  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
}' > offset-tracker.json

# Upload to bucket
gsutil cp offset-tracker.json gs://${BUCKET_NAME}/

# Verify
gsutil cat gs://${BUCKET_NAME}/offset-tracker.json
```

---

## Step 4: Prepare Application Code

### 4.1 Clone/Download Code

```bash
# If using git
git clone <repository-url>
cd garoon-smarthr-etl

# Or if you have files locally, navigate to project directory
cd /path/to/garoon-smarthr-etl
```

### 4.2 Install Dependencies

```bash
npm install
```

### 4.3 Configure Environment Variables

Create `.env.yaml` for Cloud Functions:

```bash
cat > .env.yaml << 'EOF'
GAROON_BASE_URL: "https://jcg.cybozu.com"
GAROON_API_ENDPOINT: "https://jcg.cybozu.com/g/api/v1/workflow/admin/requests"
CYBOZU_AUTHORIZATION: "YOUR_CYBOZU_AUTH_TOKEN"
SMARTHR_BASE_URL: "https://e10379b3050f91760fb5d051.daruma.space/api/v1"
SMARTHR_ACCESS_TOKEN: "YOUR_SMARTHR_TOKEN"
GCP_PROJECT_ID: "jc-etl-project"
BIGQUERY_DATASET_ID: "jc_etl"
GCS_BUCKET_NAME: "jc-etl-tracking"
LOG_LEVEL: "info"
EOF
```

**Replace tokens:**
- `YOUR_CYBOZU_AUTH_TOKEN` - Get from Garoon admin
- `YOUR_SMARTHR_TOKEN` - Get from SmartHR API settings

---

## Step 5: Deploy to Cloud Functions

### 5.1 Deploy Function

```bash
gcloud functions deploy garoonToSmartHRETL \
  --gen2 \
  --runtime=nodejs20 \
  --region=asia-northeast1 \
  --source=. \
  --entry-point=garoonToSmartHRETL \
  --trigger-http \
  --allow-unauthenticated \
  --memory=512MB \
  --timeout=540s \
  --env-vars-file=.env.yaml
```

**Deployment flags explained:**
- `--gen2` - Use 2nd generation Cloud Functions (better performance)
- `--runtime=nodejs20` - Node.js version
- `--region=asia-northeast1` - Tokyo region (choose closest to your services)
- `--memory=512MB` - Memory allocation
- `--timeout=540s` - Max 9 minutes (default is 60s)
- `--allow-unauthenticated` - Allow HTTP triggers without auth

Wait 3-5 minutes for deployment.

### 5.2 Get Function URL

```bash
gcloud functions describe garoonToSmartHRETL \
  --region=asia-northeast1 \
  --gen2 \
  --format='value(serviceConfig.uri)'
```

Save this URL. Example: `https://garoontosmarthretl-xxx-an.a.run.app`

---

## Step 6: Test Deployment

### 6.1 Manual Test

```bash
# Save function URL
FUNCTION_URL=$(gcloud functions describe garoonToSmartHRETL \
  --region=asia-northeast1 \
  --gen2 \
  --format='value(serviceConfig.uri)')

# Test ETL
curl -X POST $FUNCTION_URL
```

Expected response:
```json
{
  "success": true,
  "message": "ETL process completed successfully",
  "data": {
    "requestId": "...",
    "transferStatus": "COMPLETED",
    "stats": {...}
  }
}
```

### 6.2 Check Logs

```bash
# View logs
gcloud functions logs read garoonToSmartHRETL \
  --region=asia-northeast1 \
  --gen2 \
  --limit=50

# Or use Cloud Console
echo "https://console.cloud.google.com/functions/details/asia-northeast1/garoonToSmartHRETL?project=${PROJECT_ID}"
```

### 6.3 Verify Data in BigQuery

```bash
# Check requests table
bq query --use_legacy_sql=false \
  "SELECT * FROM ${PROJECT_ID}.${DATASET_ID}.requests LIMIT 10"

# Check form fields
bq query --use_legacy_sql=false \
  "SELECT * FROM ${PROJECT_ID}.${DATASET_ID}.request_form_fields LIMIT 10"
```

### 6.4 Check Offset Update

```bash
gsutil cat gs://${BUCKET_NAME}/offset-tracker.json
```

---

## Step 7: Schedule Automated Runs (Cloud Scheduler)

### 7.1 Enable Cloud Scheduler API

```bash
gcloud services enable cloudscheduler.googleapis.com
```

### 7.2 Create Scheduler Job

```bash
# Run every hour
gcloud scheduler jobs create http garoon-etl-hourly \
  --location=asia-northeast1 \
  --schedule="0 * * * *" \
  --uri="${FUNCTION_URL}" \
  --http-method=POST \
  --time-zone="Asia/Tokyo"

# Or run every 30 minutes
gcloud scheduler jobs create http garoon-etl-30min \
  --location=asia-northeast1 \
  --schedule="*/30 * * * *" \
  --uri="${FUNCTION_URL}" \
  --http-method=POST \
  --time-zone="Asia/Tokyo"
```

### 7.3 Test Scheduler

```bash
# Trigger manually
gcloud scheduler jobs run garoon-etl-hourly \
  --location=asia-northeast1

# Check execution
gcloud scheduler jobs describe garoon-etl-hourly \
  --location=asia-northeast1
```

---

## Step 8: Monitoring & Alerts

### 8.1 Set Up Log-Based Metrics

```bash
# Create metric for errors
gcloud logging metrics create etl_errors \
  --description="Count of ETL errors" \
  --log-filter='resource.type="cloud_function"
    resource.labels.function_name="garoonToSmartHRETL"
    severity="ERROR"'
```

### 8.2 Create Alert Policy

Go to Cloud Console:
1. Navigate to **Monitoring** > **Alerting**
2. Create alert policy for `etl_errors` metric
3. Set threshold: > 3 errors in 5 minutes
4. Add notification channel (email/Slack)

### 8.3 Create Dashboard

```bash
# Open monitoring dashboard
echo "https://console.cloud.google.com/monitoring/dashboards?project=${PROJECT_ID}"
```

Add widgets for:
- Function invocations
- Error rate
- Execution time
- BigQuery row counts

---

## Step 9: Security Hardening

### 9.1 Restrict Function Access

```bash
# Remove public access
gcloud functions remove-iam-policy-binding garoonToSmartHRETL \
  --region=asia-northeast1 \
  --gen2 \
  --member="allUsers" \
  --role="roles/cloudfunctions.invoker"

# Add service account
gcloud functions add-iam-policy-binding garoonToSmartHRETL \
  --region=asia-northeast1 \
  --gen2 \
  --member="serviceAccount:scheduler@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.invoker"
```

### 9.2 Use Secret Manager for Credentials

```bash
# Enable Secret Manager
gcloud services enable secretmanager.googleapis.com

# Store Cybozu token
echo -n "YOUR_CYBOZU_TOKEN" | \
  gcloud secrets create cybozu-auth-token --data-file=-

# Store SmartHR token
echo -n "YOUR_SMARTHR_TOKEN" | \
  gcloud secrets create smarthr-access-token --data-file=-

# Grant access to function
gcloud secrets add-iam-policy-binding cybozu-auth-token \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding smarthr-access-token \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Update function to use secrets:
```bash
gcloud functions deploy garoonToSmartHRETL \
  --gen2 \
  --runtime=nodejs20 \
  --region=asia-northeast1 \
  --source=. \
  --entry-point=garoonToSmartHRETL \
  --trigger-http \
  --memory=512MB \
  --timeout=540s \
  --set-secrets='CYBOZU_AUTHORIZATION=cybozu-auth-token:latest,SMARTHR_ACCESS_TOKEN=smarthr-access-token:latest' \
  --set-env-vars=GAROON_BASE_URL=https://jcg.cybozu.com,SMARTHR_BASE_URL=https://e10379b3050f91760fb5d051.daruma.space/api/v1,GCP_PROJECT_ID=${PROJECT_ID},BIGQUERY_DATASET_ID=jc_etl,GCS_BUCKET_NAME=${BUCKET_NAME}
```

---

## Step 10: Update & Redeploy

### 10.1 Update Code

```bash
# Make changes to code
vim src/services/garoon.service.js

# Redeploy
gcloud functions deploy garoonToSmartHRETL \
  --gen2 \
  --runtime=nodejs20 \
  --region=asia-northeast1 \
  --source=. \
  --entry-point=garoonToSmartHRETL \
  --trigger-http \
  --memory=512MB \
  --timeout=540s \
  --env-vars-file=.env.yaml
```

### 10.2 Rollback (if needed)

```bash
# List revisions
gcloud functions list \
  --region=asia-northeast1 \
  --gen2

# Rollback to previous version
gcloud functions deploy garoonToSmartHRETL \
  --region=asia-northeast1 \
  --gen2 \
  --revision=<previous-revision-id>
```

---

## Troubleshooting

### Issue: "Permission Denied" Error

```bash
# Add required roles
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

### Issue: Function Timeout

```bash
# Increase timeout to max (60 minutes for gen2)
gcloud functions deploy garoonToSmartHRETL \
  --timeout=3600s \
  --memory=1GB \
  # ... other flags
```

### Issue: Out of Memory

```bash
# Increase memory
gcloud functions deploy garoonToSmartHRETL \
  --memory=1GB \
  # ... other flags
```

### Issue: Can't Find Offset File

```bash
# Re-create offset file
echo '{"offset":0,"stats":{},"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}' | \
  gsutil cp - gs://${BUCKET_NAME}/offset-tracker.json
```

### View Detailed Logs

```bash
# Stream logs in real-time
gcloud functions logs tail garoonToSmartHRETL \
  --region=asia-northeast1 \
  --gen2

# Export logs to file
gcloud logging read "resource.type=cloud_function resource.labels.function_name=garoonToSmartHRETL" \
  --limit=1000 \
  --format=json > function-logs.json
```

---

## Cost Estimation

**Monthly costs (approximate):**
- Cloud Functions: $0 - $5 (generous free tier)
- BigQuery: $0 - $10 (first 1TB queries free)
- Cloud Storage: $0 - $1 (minimal storage)
- Cloud Scheduler: $0.10 per job
- **Total: ~$1 - $20/month**

Free tier limits:
- 2M function invocations/month
- 400,000 GB-seconds compute time
- 10GB BigQuery storage

---

## Quick Reference Commands

```bash
# View function details
gcloud functions describe garoonToSmartHRETL --region=asia-northeast1 --gen2

# Trigger manually
curl -X POST $(gcloud functions describe garoonToSmartHRETL --region=asia-northeast1 --gen2 --format='value(serviceConfig.uri)')

# Check logs
gcloud functions logs read garoonToSmartHRETL --region=asia-northeast1 --gen2 --limit=20

# Query BigQuery
bq query --use_legacy_sql=false "SELECT COUNT(*) FROM jc_etl.requests"

# Check offset
gsutil cat gs://jc-etl-tracking/offset-tracker.json

# Delete function
gcloud functions delete garoonToSmartHRETL --region=asia-northeast1 --gen2
```

---

## Support

- GCP Documentation: https://cloud.google.com/functions/docs
- BigQuery: https://cloud.google.com/bigquery/docs
- Cloud Scheduler: https://cloud.google.com/scheduler/docs

**Deployment complete! 🎉**