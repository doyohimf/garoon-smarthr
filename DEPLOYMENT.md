# Garoon to SmartHR ETL - GCP Deployment Guide

## Prerequisites

### 1. GCP Account and Project Setup
- GCP Project with billing enabled
- Project ID: Configure in environment variables
- Required APIs enabled:
  - BigQuery API
  - Cloud Functions API
  - Cloud Storage API
  - Cloud Logging API
  - Cloud Monitoring API

### 2. Required Tools
```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash
gcloud init

# Authenticate
gcloud auth login
gcloud auth application-default login

# Set project
gcloud config set project YOUR_PROJECT_ID
```

## GCP Resources Required

### 1. BigQuery
```bash
# Create dataset
bq mk --dataset --location=asia-northeast1 YOUR_PROJECT_ID:saasdb

# Create required tables (run SQL scripts in src/sql/schema.sql)
bq query --use_legacy_sql=false < src/sql/schema.sql
```

### 2. Cloud Storage
```bash
# Create bucket for temporary files and backups
gsutil mb -l asia-northeast1 gs://YOUR_BUCKET_NAME
```

### 3. Service Account
```bash
# Create service account
gcloud iam service-accounts create garoon-smarthr-etl \
  --description="Service account for Garoon SmartHR ETL" \
  --display-name="Garoon SmartHR ETL"

# Grant required permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:garoon-smarthr-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:garoon-smarthr-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:garoon-smarthr-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/logging.logWriter"

# Create and download key
gcloud iam service-accounts keys create data-integration-key.json \
  --iam-account=garoon-smarthr-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com

# Create service account for Cloud Scheduler (for authenticated function calls)
gcloud iam service-accounts create cloud-scheduler-etl \
  --description="Service account for Cloud Scheduler ETL jobs" \
  --display-name="Cloud Scheduler ETL"

# Grant Cloud Scheduler service account permission to invoke functions
gcloud functions add-iam-policy-binding garoonToSmartHRETL \
  --member="serviceAccount:cloud-scheduler-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.invoker" \
  --region=asia-northeast1
```

## Environment Configuration

### 1. Create Environment Variables File
```yaml
# .env.yaml
GAROON_BASE_URL: "https://jcg.cybozu.com"
GAROON_API_ENDPOINT: "https://jcg.cybozu.com/g/api/v1/workflow/admin/requests"
CYBOZU_AUTHORIZATION: "cybozu-developer YOUR_API_TOKEN"
SMARTHR_BASE_URL: "https://e10379b3050f91760fb5d051.daruma.space/api/v1"
SMARTHR_ACCESS_TOKEN: "YOUR_SMARTHR_TOKEN"
GCP_PROJECT_ID: "YOUR_PROJECT_ID"
BIGQUERY_DATASET_ID: "saasdb"
GCS_BUCKET_NAME: "YOUR_BUCKET_NAME"
LOG_LEVEL: "info"
NODE_ENV: "production"
```

### 2. Service Account Authentication

**SECURITY WARNING: Never store service account keys inside the repository!**

**Option A: Workload Identity (Recommended for GCP environments)**
```bash
# Configure workload identity for Cloud Functions
gcloud functions deploy garoon-smarthr-etl \
  --runtime nodejs18 \
  --trigger-http \
  --service-account your-service-account@project.iam.gserviceaccount.com
```

**Option B: Secret Manager (Recommended for key-based auth)**
```bash
# Store key in Secret Manager
gcloud secrets create service-account-key --data-file=/path/to/external/key.json

# Grant Cloud Function access to the secret
gcloud secrets add-iam-policy-binding service-account-key \
  --member=serviceAccount:your-cf-sa@project.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

**Option C: External Key File (Use only if A/B are not possible)**
```bash
# Store key OUTSIDE the repository
mkdir -p ~/.gcp-keys
cp data-integration-key.json ~/.gcp-keys/data-integration-474311-01459c9d6f7b.json

# Set environment variable to point to external location
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.gcp-keys/data-integration-474311-01459c9d6f7b.json"

# IMPORTANT: Rotate any keys that were previously stored in the repo
# Generate new key and delete the old one from GCP Console
```

**⚠️  SECURITY ALERT: Service Account Key Detected**
A service account key file exists in `data/keys/`. This poses a security risk if committed to version control.

**IMMEDIATE ACTION REQUIRED:**
1. Generate a new service account key in GCP Console
2. Delete the old key from GCP to revoke access
3. Use one of the secure authentication methods above (Workload Identity or Secret Manager)
4. Remove the key file from the repository: `rm -rf data/keys/`

## Deployment Steps

### 1. Prepare Files
```bash
# Ensure all required files are present
ls -la src/
ls -la .env.yaml

# Verify no service account keys are in the repository
[ ! -d "data/keys" ] && echo "✅ No keys directory found (secure)" || echo "⚠️  Keys directory exists - remove it!"
```

### 2. Deploy Cloud Function
```bash
# Using npm script (recommended)
npm run deploy

# Or manual deployment (SECURE VERSION)
gcloud functions deploy garoonToSmartHRETL \
  --gen2 \
  --runtime=nodejs20 \
  --region=asia-northeast1 \
  --source=. \
  --entry-point=garoonToSmartHRETL \
  --trigger-http \
  --memory=512MB \
  --timeout=540s \
  --env-vars-file=.env.yaml \
  --service-account=garoon-smarthr-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com

# IMPORTANT: Function is now AUTHENTICATED - only authorized users can invoke
```

### 2.1. Verify Cloud Function Deployment
```bash
# Check function status
gcloud functions describe garoonToSmartHRETL --region=asia-northeast1

# Test function endpoint with authentication
# Get access token for testing
TOKEN=$(gcloud auth print-access-token)

# Test authenticated request
curl -X POST "https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Test specific workflows with authentication
curl -X POST "https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workflow": "etl-1", "test": true}'

# Check function logs
gcloud functions logs read garoonToSmartHRETL --region=asia-northeast1 --limit=10
```

### 3. Set Up Cloud Scheduler (Authenticated)
```bash
# ETL Workflow 1 - New Hire (runs at :00 minutes hourly)
gcloud scheduler jobs create http garoon-smarthr-etl-1-hourly \
  --location=asia-northeast1 \
  --schedule="0 * * * *" \
  --uri="https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"workflow":"etl-1","trigger":"scheduled"}' \
  --oidc-service-account-email="cloud-scheduler-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com"

# ETL Workflow 2 - Employee Changes (runs at :05 minutes hourly)
gcloud scheduler jobs create http garoon-smarthr-etl-2-hourly \
  --location=asia-northeast1 \
  --schedule="5 * * * *" \
  --uri="https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"workflow":"etl-2","trigger":"scheduled"}' \
  --oidc-service-account-email="cloud-scheduler-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com"

# ETL Workflow 3 - Secondment (runs at :10 minutes hourly)
gcloud scheduler jobs create http garoon-smarthr-etl-3-hourly \
  --location=asia-northeast1 \
  --schedule="10 * * * *" \
  --uri="https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"workflow":"etl-3","trigger":"scheduled"}' \
  --oidc-service-account-email="cloud-scheduler-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com"

# ETL Workflow 4 - Leave Management (runs at :15 minutes hourly)
gcloud scheduler jobs create http garoon-smarthr-etl-4-hourly \
  --location=asia-northeast1 \
  --schedule="15 * * * *" \
  --uri="https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"workflow":"etl-4","trigger":"scheduled"}' \
  --oidc-service-account-email="cloud-scheduler-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com"

# ETL Workflow 5 - Allowance Management (runs at :20 minutes hourly)
gcloud scheduler jobs create http garoon-smarthr-etl-5-hourly \
  --location=asia-northeast1 \
  --schedule="20 * * * *" \
  --uri="https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"workflow":"etl-5","trigger":"scheduled"}' \
  --oidc-service-account-email="cloud-scheduler-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com"

# ETL Workflow 6 - Resignation (runs at :25 minutes hourly)
gcloud scheduler jobs create http garoon-smarthr-etl-6-hourly \
  --location=asia-northeast1 \
  --schedule="25 * * * *" \
  --uri="https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"workflow":"etl-6","trigger":"scheduled"}' \
  --oidc-service-account-email="cloud-scheduler-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com"

# ETL Workflow 7 - Advanced Processing (runs at :30 minutes hourly)
gcloud scheduler jobs create http garoon-smarthr-etl-7-hourly \
  --location=asia-northeast1 \
  --schedule="30 * * * *" \
  --uri="https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"workflow":"etl-7","trigger":"scheduled"}' \
  --oidc-service-account-email="cloud-scheduler-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com"

# View all scheduled jobs
gcloud scheduler jobs list --location=asia-northeast1
```

### 3.1. Verify Cloud Scheduler Setup
```bash
# Check all scheduler jobs status
gcloud scheduler jobs list --location=asia-northeast1

# Test individual scheduler job manually
gcloud scheduler jobs run garoon-smarthr-etl-1-hourly --location=asia-northeast1

# Check job execution history
gcloud scheduler jobs describe garoon-smarthr-etl-1-hourly --location=asia-northeast1

# Verify job execution logs
gcloud logging read "resource.type=cloud_scheduler_job AND resource.labels.job_id=garoon-smarthr-etl-1-hourly" --limit=5

# Test all workflows manually
for i in {1..7}; do
  echo "Testing ETL Workflow $i..."
  gcloud scheduler jobs run garoon-smarthr-etl-$i-hourly --location=asia-northeast1
  sleep 10
done
```

## Security Considerations

### 1. IAM and Permissions
- Use least privilege principle
- Regularly rotate service account keys
- Monitor access logs

### 2. Network Security
```bash
# Function is now secured by default (no --allow-unauthenticated)
# Only authenticated users and service accounts can invoke

# Grant specific users access to invoke function (if needed)
gcloud functions add-iam-policy-binding garoonToSmartHRETL \
  --member="user:admin@YOUR_DOMAIN.com" \
  --role="roles/cloudfunctions.invoker" \
  --region=asia-northeast1

# Grant specific service accounts access (already done for scheduler)
gcloud functions add-iam-policy-binding garoonToSmartHRETL \
  --member="serviceAccount:cloud-scheduler-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.invoker" \
  --region=asia-northeast1

# Verify function IAM policy
gcloud functions get-iam-policy garoonToSmartHRETL --region=asia-northeast1

# Add additional security with VPC Service Controls (optional)
# gcloud access-context-manager perimeters create etl-perimeter \
#   --title="ETL Security Perimeter" \
#   --resources="projects/YOUR_PROJECT_ID" \
#   --restricted-services="cloudfunctions.googleapis.com,bigquery.googleapis.com"
```

### 3. Secret Management
```bash
# Use Secret Manager for sensitive data
gcloud secrets create cybozu-auth --data-file=- <<< "YOUR_CYBOZU_TOKEN"
gcloud secrets create smarthr-token --data-file=- <<< "YOUR_SMARTHR_TOKEN"

# Grant access to service account
gcloud secrets add-iam-policy-binding cybozu-auth \
  --member="serviceAccount:garoon-smarthr-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Monitoring and Logging

### 1. Cloud Logging
```bash
# View function logs
gcloud functions logs read garoonToSmartHRETL --region=asia-northeast1

# Set up log-based alerts
gcloud alpha logging sinks create etl-error-sink \
  bigquery.googleapis.com/projects/YOUR_PROJECT_ID/datasets/logs \
  --log-filter='resource.type="cloud_function" AND severity="ERROR"'
```

### 2. Cloud Monitoring
```bash
# Create uptime check
gcloud alpha monitoring uptime create \
  --display-name="ETL Function Health" \
  --http-check-path="/health" \
  --http-check-port=443 \
  --monitored-resource-type="uptime_url" \
  --monitored-resource-labels="host=YOUR_FUNCTION_URL"
```

### 3. Error Tracking
- Errors are automatically logged to `data/errors/`
- Monitor BigQuery for data quality issues
- Set up alerting for failed ETL runs

## Testing and Verification

### 1. Health Check Tests
```bash
# Get access token for authenticated testing
TOKEN=$(gcloud auth print-access-token)

# Test Cloud Function health with authentication
curl -f -H "Authorization: Bearer $TOKEN" \
  "https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL" \
  || echo "Function health check failed"

# Test BigQuery connectivity
bq query --use_legacy_sql=false 'SELECT COUNT(*) as table_count FROM `YOUR_PROJECT_ID.saasdb.INFORMATION_SCHEMA.TABLES`'

# Test Cloud Storage connectivity
gsutil ls gs://YOUR_BUCKET_NAME/ || echo "Cloud Storage access failed"

# Test service account permissions
gcloud iam service-accounts get-iam-policy garoon-smarthr-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### 2. End-to-End Workflow Tests
```bash
# Get access token for testing
TOKEN=$(gcloud auth print-access-token)

# Test ETL Workflow 1 (New Hire)
curl -X POST "https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workflow": "etl-1", "test": true, "limit": 1}'

# Test ETL Workflow 2 (Employee Changes)
curl -X POST "https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workflow": "etl-2", "test": true, "limit": 1}'

# Monitor test results
gcloud functions logs read garoonToSmartHRETL --region=asia-northeast1 --limit=20
```

### 3. Scheduler Integration Tests
```bash
# Create test script for all schedulers
cat > test_schedulers.sh << 'EOF'
#!/bin/bash
for i in {1..7}; do
  echo "Testing scheduler for ETL-$i..."
  JOB_NAME="garoon-smarthr-etl-$i-hourly"
  
  # Run job manually
  gcloud scheduler jobs run $JOB_NAME --location=asia-northeast1
  
  # Wait and check execution
  sleep 30
  
  # Get last execution status
  STATUS=$(gcloud scheduler jobs describe $JOB_NAME --location=asia-northeast1 --format="value(status.lastAttemptTime, status.state)")
  echo "ETL-$i Status: $STATUS"
  
  # Check function logs for this execution
  echo "Recent logs for ETL-$i:"
  gcloud functions logs read garoonToSmartHRETL --region=asia-northeast1 --limit=5
  echo "---"
done
EOF

# Make executable and run
chmod +x test_schedulers.sh
./test_schedulers.sh
```

### 4. Performance and Load Tests
```bash
# Get access token for testing
TOKEN=$(gcloud auth print-access-token)

# Test concurrent workflow execution
for i in {1..3}; do
  curl -X POST "https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"workflow\": \"etl-$i\", \"test\": true}" &
done
wait

# Monitor function performance
gcloud monitoring metrics list --filter="metric.type=cloudfunctions.googleapis.com/function/executions"

# Check memory and CPU usage
gcloud functions logs read garoonToSmartHRETL --region=asia-northeast1 --format="table(timestamp, severity, textPayload)" --limit=10
```

### 5. Error Simulation Tests
```bash
# Get access token for testing
TOKEN=$(gcloud auth print-access-token)

# Test with invalid workflow
curl -X POST "https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workflow": "invalid", "test": true}'

# Test with malformed request
curl -X POST "https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{malformed json}'

# Test unauthenticated request (should fail)
curl -X POST "https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Verify error handling
gcloud functions logs read garoonToSmartHRETL --region=asia-northeast1 --format="table(timestamp, severity, textPayload)" --filter="severity>=ERROR" --limit=5
```

### 6. Monitoring Verification
```bash
# Check if monitoring is working
gcloud logging metrics list --filter="name:etl"

# Verify log-based alerts
gcloud alpha logging sinks list

# Test alerting (this should trigger alerts if configured)
gcloud functions logs write garoonToSmartHRETL "TEST ERROR: This is a test error for monitoring" --severity=ERROR --region=asia-northeast1
```

### 7. Automated Test Script
```bash
# Create comprehensive test script
cat > comprehensive_test.sh << 'EOF'
#!/bin/bash
set -e

echo "🧪 Starting Comprehensive ETL System Tests"

# Get access token for authenticated testing
TOKEN=$(gcloud auth print-access-token)

# Test 1: Function availability
echo "\n1. Testing function availability..."
FUNCTION_URL="https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/garoonToSmartHRETL"
if curl -f -s -H "Authorization: Bearer $TOKEN" $FUNCTION_URL > /dev/null; then
  echo "✅ Function is accessible with authentication"
else
  echo "❌ Function is not accessible with authentication"
  exit 1
fi

# Test 1.1: Verify unauthenticated access is denied
echo "\n1.1 Testing unauthenticated access (should fail)..."
if curl -f -s $FUNCTION_URL > /dev/null 2>&1; then
  echo "❌ SECURITY ISSUE: Function accessible without authentication!"
  exit 1
else
  echo "✅ Unauthenticated access properly denied"
fi

# Test 2: Basic functionality
echo "\n2. Testing basic functionality..."
RESPONSE=$(curl -s -X POST "$FUNCTION_URL" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"test": true}')
if echo "$RESPONSE" | grep -q "success\|completed"; then
  echo "✅ Function responds correctly"
else
  echo "❌ Function response unexpected: $RESPONSE"
fi

# Test 3: Workflow routing
echo "\n3. Testing workflow routing..."
for i in {1..3}; do
  RESPONSE=$(curl -s -X POST "$FUNCTION_URL" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"workflow\": \"etl-$i\", \"test\": true}")
  if echo "$RESPONSE" | grep -q "success\|completed\|started"; then
    echo "✅ ETL-$i workflow responds correctly"
  else
    echo "⚠️ ETL-$i workflow response: $RESPONSE"
  fi
done

# Test 4: Scheduler jobs
echo "\n4. Testing scheduler jobs..."
JOBS=$(gcloud scheduler jobs list --location=asia-northeast1 --format="value(name)" | grep garoon-smarthr-etl)
if [ -n "$JOBS" ]; then
  echo "✅ Scheduler jobs found:"
  echo "$JOBS"
else
  echo "❌ No scheduler jobs found"
fi

# Test 5: BigQuery connectivity
echo "\n5. Testing BigQuery connectivity..."
if bq query --use_legacy_sql=false 'SELECT 1' > /dev/null 2>&1; then
  echo "✅ BigQuery is accessible"
else
  echo "❌ BigQuery connection failed"
fi

# Test 6: Cloud Storage connectivity
echo "\n6. Testing Cloud Storage connectivity..."
if gsutil ls gs://YOUR_BUCKET_NAME/ > /dev/null 2>&1; then
  echo "✅ Cloud Storage is accessible"
else
  echo "❌ Cloud Storage connection failed"
fi

echo "\n🎉 Security-enhanced tests completed!"
EOF

# Make executable
chmod +x comprehensive_test.sh

# Run tests
./comprehensive_test.sh
```

## Emergency Procedures

### 1. Immediate Stop/Halt Operations

#### Quick Stop All Schedulers
```bash
# Emergency stop all scheduled jobs immediately
for i in {1..7}; do
  gcloud scheduler jobs pause garoon-smarthr-etl-${i}-hourly --location=asia-northeast1
  echo "⏸️ Paused ETL Workflow $i scheduler"
done

# Verify all jobs are paused
gcloud scheduler jobs list --location=asia-northeast1 --format="table(name, state)"
```

#### Disable Cloud Function (Nuclear Option)
```bash
# Completely disable the function (prevents all access)
gcloud functions delete garoonToSmartHRETL --region=asia-northeast1 --quiet

echo "🛑 Cloud Function has been deleted - all ETL operations stopped"
```

#### Soft Disable (Redirect Traffic)
```bash
# Deploy a "maintenance mode" version that returns maintenance message
cat > maintenance.js << 'EOF'
exports.garoonToSmartHRETL = (req, res) => {
  res.status(503).json({
    success: false,
    message: "ETL System is currently under maintenance. All operations have been temporarily suspended.",
    timestamp: new Date().toISOString(),
    contact: "Please contact the development team for more information"
  });
};
EOF

# Quick deploy maintenance mode
gcloud functions deploy garoonToSmartHRETL \
  --runtime=nodejs20 \
  --region=asia-northeast1 \
  --source=. \
  --entry-point=garoonToSmartHRETL \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=60s

echo "🔧 Function is now in maintenance mode"
```

### 2. Rollback Procedures

#### Quick Rollback to Previous Version
```bash
# List recent deployments to find previous version
gcloud functions list --regions=asia-northeast1
gcloud functions describe garoonToSmartHRETL --region=asia-northeast1 --format="value(versionId)"

# If you have the previous source code in Git
git log --oneline -5  # Find previous working commit
git checkout PREVIOUS_WORKING_COMMIT

# Redeploy previous version
npm run deploy

echo "↩️ Rolled back to previous version"
```

#### Rollback Using Cloud Console
```bash
# Get deployment history
gcloud logging read 'resource.type="cloud_function" AND protoPayload.methodName="google.cloud.functions.v1.CloudFunctionsService.CreateFunction"' \
  --format="table(timestamp, protoPayload.resourceName)" \
  --limit=10

# Manual process:
# 1. Go to Cloud Console > Cloud Functions
# 2. Select garoonToSmartHRETL function
# 3. Go to "Revisions" tab
# 4. Select previous working revision
# 5. Click "Deploy" to activate previous revision
```

#### Emergency Rollback with Backup
```bash
# If you created backups during deployment
gsutil ls gs://YOUR_BUCKET_NAME/code-backups/

# Download previous working version
gsutil -m cp -r gs://YOUR_BUCKET_NAME/code-backups/YYYYMMDD/ ./rollback-version/
cd rollback-version/

# Deploy the backup
npm run deploy

echo "📦 Rolled back to backup version"
```

### 3. Selective Workflow Disable

#### Disable Specific Problematic Workflows
```bash
# If only ETL-5 (Allowance) is causing issues
gcloud scheduler jobs pause garoon-smarthr-etl-5-hourly --location=asia-northeast1
echo "⏸️ ETL-5 (Allowance Management) workflow paused"

# Keep other workflows running
for i in 1 2 3 4 6 7; do
  gcloud scheduler jobs resume garoon-smarthr-etl-${i}-hourly --location=asia-northeast1
  echo "▶️ ETL-$i workflow resumed"
done
```

#### Create Workflow-Specific Circuit Breaker
```bash
# Add environment variable to disable specific workflow
gcloud functions deploy garoonToSmartHRETL \
  --update-env-vars DISABLED_WORKFLOWS="etl-5,etl-6" \
  --region=asia-northeast1

echo "🚫 Specific workflows disabled via environment variables"
```

### 4. Data Safety Measures

#### Backup Current State Before Rollback
```bash
# Backup all BigQuery tables
DATE=$(date +%Y%m%d_%H%M%S)
echo "📊 Creating emergency backup: $DATE"

for table in garoon_requests garoon_request_form_fields garoon_request_steps garoon_process_logs emp_changes; do
  bq extract --destination_format=AVRO \
    "saasdb.$table" \
    "gs://YOUR_BUCKET_NAME/emergency-backups/$DATE/${table}.avro"
  echo "✅ Backed up table: $table"
done

# Backup offset tracking
gsutil cp gs://YOUR_BUCKET_NAME/offset-tracker.json gs://YOUR_BUCKET_NAME/emergency-backups/$DATE/offset-tracker.json
```

#### Read-Only Mode (Prevent Data Modifications)
```bash
# Remove BigQuery write permissions temporarily
gcloud projects remove-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:garoon-smarthr-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"

# Add read-only permission
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:garoon-smarthr-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer"

echo "👀 ETL system is now in READ-ONLY mode"
```

### 5. Investigation and Monitoring During Issues

#### Real-time Monitoring During Crisis
```bash
# Monitor function execution in real-time
gcloud functions logs tail garoonToSmartHRETL --region=asia-northeast1 &
MONITOR_PID=$!

# Monitor BigQuery job status
watch -n 5 'bq ls -j --max_results=10 | head -15'

# Monitor scheduler execution
watch -n 10 'gcloud scheduler jobs list --location=asia-northeast1 --format="table(name, state, schedule, lastAttemptTime)"'

# Stop monitoring (run when investigation is complete)
kill $MONITOR_PID
```

#### Quick Health Check During Issues
```bash
# Quick diagnostic script
cat > emergency_diagnostic.sh << 'EOF'
#!/bin/bash
echo "🚨 EMERGENCY DIAGNOSTIC REPORT - $(date)"
echo "==========================================="

echo "\n📊 Function Status:"
gcloud functions describe garoonToSmartHRETL --region=asia-northeast1 --format="value(status, updateTime)"

echo "\n⏰ Scheduler Status:"
gcloud scheduler jobs list --location=asia-northeast1 --format="table(name, state, lastAttemptTime)"

echo "\n📈 Recent Errors (Last 10 minutes):"
gcloud logging read 'resource.type="cloud_function" AND severity>=ERROR AND timestamp>="'$(date -u -d '10 minutes ago' '+%Y-%m-%dT%H:%M:%SZ')'"' --limit=5

echo "\n💾 BigQuery Recent Jobs:"
bq ls -j --max_results=5

echo "\n🔍 Function Metrics (Last hour):"
gcloud monitoring metrics list --filter="metric.type=cloudfunctions.googleapis.com/function/executions" --format="table(metric.type, metricKind)"

echo "\n==========================================="
echo "📋 Report completed - $(date)"
EOF

chmod +x emergency_diagnostic.sh
./emergency_diagnostic.sh > emergency_report_$(date +%Y%m%d_%H%M%S).txt
```

### 6. Recovery Procedures

#### Safe Recovery Steps
```bash
# 1. Verify the issue is resolved
echo "🔍 Step 1: Verify issue resolution"
./comprehensive_test.sh

# 2. Restore permissions if in read-only mode
echo "🔓 Step 2: Restore write permissions"
gcloud projects remove-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:garoon-smarthr-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:garoon-smarthr-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"

# 3. Resume workflows gradually
echo "▶️ Step 3: Resume workflows gradually"
for i in {1..7}; do
  read -p "Resume ETL Workflow $i? (y/n): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    gcloud scheduler jobs resume garoon-smarthr-etl-${i}-hourly --location=asia-northeast1
    echo "✅ ETL-$i resumed"
    sleep 10  # Wait between resumptions
  fi
done

# 4. Monitor for 15 minutes
echo "👀 Step 4: Monitoring for 15 minutes..."
timeout 900 gcloud functions logs tail garoonToSmartHRETL --region=asia-northeast1

echo "✅ Recovery process completed"
```

#### Emergency Contact Checklist
```bash
# Create emergency contact info
cat > EMERGENCY_CONTACTS.md << 'EOF'
# Emergency ETL Response Team

## Primary Contacts
- **Development Team Lead**: [Your Contact]
- **DevOps Engineer**: [Your Contact] 
- **Business Owner**: [Your Contact]

## Emergency Commands Quick Reference
```bash
# STOP ALL: Pause all schedulers immediately
for i in {1..7}; do gcloud scheduler jobs pause garoon-smarthr-etl-${i}-hourly --location=asia-northeast1; done

# NUCLEAR OPTION: Delete function
gcloud functions delete garoonToSmartHRETL --region=asia-northeast1 --quiet

# ROLLBACK: Deploy previous version
git checkout HEAD~1 && npm run deploy
```

## Escalation Path
1. Try emergency stop procedures
2. Contact Development Team Lead
3. If data integrity issues: Contact Business Owner
4. Document all actions taken
EOF

echo "📞 Emergency contact info created"
```

## Troubleshooting

### Common Issues

1. **Memory Issues**
```bash
# Increase memory allocation
gcloud functions deploy garoonToSmartHRETL --memory=1GB
```

2. **Timeout Issues**
```bash
# Increase timeout (max 540s for HTTP functions)
gcloud functions deploy garoonToSmartHRETL --timeout=540s
```

3. **Permission Errors**
```bash
# Check service account permissions
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --filter="bindings.members:garoon-smarthr-etl@YOUR_PROJECT_ID.iam.gserviceaccount.com"
```

4. **BigQuery Connection Issues**
```bash
# Test BigQuery connection
bq query --use_legacy_sql=false 'SELECT 1'
```

### Logs and Debugging
```bash
# Real-time logs
gcloud functions logs tail garoonToSmartHRETL --region=asia-northeast1

# Check function status
gcloud functions describe garoonToSmartHRETL --region=asia-northeast1

# Test function locally
npm run test
```

## Backup and Recovery

### 1. Data Backup
```bash
# Backup BigQuery tables
bq extract --destination_format=AVRO \
  saasdb.garoon_requests \
  gs://YOUR_BUCKET_NAME/backups/garoon_requests_$(date +%Y%m%d).avro
```

### 2. Code Backup
```bash
# Version control is primary backup
git push origin main

# Additional backup to GCS
gsutil -m cp -r . gs://YOUR_BUCKET_NAME/code-backups/$(date +%Y%m%d)/
```

## Performance Optimization

### 1. Function Optimization
- Use minimum required memory (512MB default)
- Optimize BigQuery queries with proper indexing
- Implement data pagination for large datasets

### 2. Cost Optimization
- Use Cloud Scheduler for regular ETL runs
- Monitor function invocation costs
- Optimize BigQuery slot usage

### 3. Scaling Considerations
- Functions auto-scale by default
- Monitor concurrent executions
- Consider Cloud Run for more control

## Maintenance

### Regular Tasks
1. Monitor error logs weekly
2. Review BigQuery storage costs monthly
3. Rotate service account keys quarterly
4. Update dependencies regularly
5. Test disaster recovery procedures

### Updates and Rollbacks
```bash
# Safe deployment with backup
DATE=$(date +%Y%m%d_%H%M%S)
echo "📦 Creating pre-deployment backup: $DATE"

# Backup current code
gsutil -m cp -r . gs://YOUR_BUCKET_NAME/code-backups/$DATE/

# Backup current function configuration
gcloud functions describe garoonToSmartHRETL --region=asia-northeast1 \
  --format=json > function-config-backup-$DATE.json

# Deploy new version with canary testing
npm run deploy

# Test new deployment
./comprehensive_test.sh

# If tests fail, automatic rollback
if [ $? -ne 0 ]; then
  echo "⚠️ Tests failed, initiating automatic rollback"
  # Restore from backup
  gsutil -m cp -r gs://YOUR_BUCKET_NAME/code-backups/$DATE/* .
  npm run deploy
  echo "↩️ Rollback completed"
fi

# Manual rollback to specific version
gcloud functions deploy garoonToSmartHRETL --source=gs://gcf-sources-YOUR_PROJECT_ID-asia-northeast1/garoonToSmartHRETL/PREVIOUS_VERSION.zip

# View deployment history
gcloud functions list --regions=asia-northeast1

# Emergency rollback using git
git log --oneline -10  # Find working version
git checkout WORKING_COMMIT_HASH
npm run deploy
git checkout -  # Return to current branch after rollback
```

## Support and Documentation

- Function logs: Cloud Console > Cloud Functions > garoonToSmartHRETL > Logs
- BigQuery logs: Cloud Console > BigQuery > Job history
- Error tracking: `data/errors/` directory in the function
- Performance metrics: Cloud Console > Cloud Functions > Metrics

For additional support, check the error logs and processor documentation in `src/PROCESSORS.md`.