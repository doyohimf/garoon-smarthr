#!/bin/bash

set -e

echo "🚀 Deploying Garoon to SmartHR ETL..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | xargs)
fi

# Validate required environment variables
required_vars=(
  "GAROON_BASE_URL"
  "CYBOZU_AUTHORIZATION"
  "SMARTHR_BASE_URL"
  "SMARTHR_ACCESS_TOKEN"
  "GCP_PROJECT_ID"
  "BIGQUERY_DATASET_ID"
  "GCS_BUCKET_NAME"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Error: $var is not set"
    exit 1
  fi
done

echo "✅ Environment variables validated"

# Create GCS bucket if it doesn't exist
echo "📦 Checking GCS bucket..."
if ! gsutil ls -b gs://$GCS_BUCKET_NAME 2>/dev/null; then
  echo "Creating bucket gs://$GCS_BUCKET_NAME..."
  gsutil mb gs://$GCS_BUCKET_NAME
fi

# Create BigQuery dataset if it doesn't exist
echo "📊 Checking BigQuery dataset..."
if ! bq ls -d $GCP_PROJECT_ID:$BIGQUERY_DATASET_ID 2>/dev/null; then
  echo "Creating dataset $BIGQUERY_DATASET_ID..."
  bq mk --dataset $GCP_PROJECT_ID:$BIGQUERY_DATASET_ID
fi

# Deploy Cloud Function
echo "☁️  Deploying Cloud Function..."
gcloud functions deploy garoonToSmartHRETL \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point garoonToSmartHRETL \
  --memory 512MB \
  --timeout 540s \
  --set-env-vars "\
GAROON_BASE_URL=$GAROON_BASE_URL,\
GAROON_API_ENDPOINT=$GAROON_API_ENDPOINT,\
CYBOZU_AUTHORIZATION=$CYBOZU_AUTHORIZATION,\
SMARTHR_BASE_URL=$SMARTHR_BASE_URL,\
SMARTHR_ACCESS_TOKEN=$SMARTHR_ACCESS_TOKEN,\
GCP_PROJECT_ID=$GCP_PROJECT_ID,\
BIGQUERY_DATASET_ID=$BIGQUERY_DATASET_ID,\
GCS_BUCKET_NAME=$GCS_BUCKET_NAME,\
LOG_LEVEL=$LOG_LEVEL"

echo "✅ Deployment completed successfully!"
echo ""
echo "Function URL:"
gcloud functions describe garoonToSmartHRETL --format='value(httpsTrigger.url)'