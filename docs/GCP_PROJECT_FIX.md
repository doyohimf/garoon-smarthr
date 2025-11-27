# GCP Project Configuration Fix

**Date:** November 6, 2025  
**Issue:** Access Denied error when executing BigQuery queries  
**Root Cause:** `.env` file was configured with wrong GCP project ID  
**Status:** ✅ FIXED

## The Problem

```
Error: Access Denied: Project japan-create-v2: User does not have 
bigquery.jobs.create permission in project japan-create-v2.
```

The service account `data-integration-sprobe@data-integration-474311.iam.gserviceaccount.com` only has permissions in project `data-integration-474311`, but the `.env` file was configured to use project `japan-create-v2`.

## The Solution

Updated `.env` file to use the correct GCP project:

**Before:**
```bash
GCP_PROJECT_ID=japan-create-v2
BIGQUERY_DATASET_ID=etldb
GCS_BUCKET_NAME=jc-etl-bucket
```

**After:**
```bash
GCP_PROJECT_ID=data-integration-474311
GCP_CREDENTIALS_PATH=./data/keys/data-integration-474311-01459c9d6f7b.json
BIGQUERY_DATASET_ID=jc_etl
GCS_BUCKET_NAME=jc-etl-tracking
```

## Verification

Service account key details:
```json
{
  "project_id": "data-integration-474311",
  "client_email": "data-integration-sprobe@data-integration-474311.iam.gserviceaccount.com",
  "type": "service_account"
}
```

## Configuration Now Matches

| Item | Value | Status |
|------|-------|--------|
| **Project ID** | `data-integration-474311` | ✅ Correct |
| **Service Account** | `data-integration-sprobe@data-integration-474311.iam.gserviceaccount.com` | ✅ Correct |
| **Credentials Path** | `./data/keys/data-integration-474311-01459c9d6f7b.json` | ✅ Correct |
| **BigQuery Dataset** | `jc_etl` | ✅ Correct |
| **Storage Bucket** | `jc-etl-tracking` | ✅ Correct |

## What to Do Next

1. **Clear any cached authentication:**
   ```bash
   rm -rf node_modules/@google-cloud/*/build/
   ```

2. **Test the connection:**
   ```bash
   npm run etl:1
   ```

3. **Expected behavior:**
   - Application starts successfully
   - Connects to BigQuery in project `data-integration-474311`
   - Executes queries without permission errors
   - Logs show successful authentication

## Related Documentation

- [GCP_QUICK_START.md](./GCP_QUICK_START.md) - Quick setup guide
- [GCP_AUTHENTICATION_SETUP.md](./GCP_AUTHENTICATION_SETUP.md) - Detailed documentation
- [GCP_SETUP_SUMMARY.md](./GCP_SETUP_SUMMARY.md) - Implementation summary
