# GCP Authentication Setup - Verification Checklist

Use this checklist to verify the GCP authentication setup is complete and working correctly.

## Pre-Setup Verification

- [ ] Service account key file exists at: `data/keys/data-integration-474311-01459c9d6f7b.json`
- [ ] File is readable: `ls -la data/keys/data-integration-474311-01459c9d6f7b.json`
- [ ] File is valid JSON: `cat data/keys/data-integration-474311-01459c9d6f7b.json | jq .`
- [ ] Node.js version >= 20.0.0: Run `node --version`
- [ ] Dependencies installed: Run `npm install` if needed

## Code Changes Verification

- [ ] File `src/config/environment.js` has been updated with GCP configuration
- [ ] File `src/utils/gcp-auth.util.js` exists (new file)
- [ ] File `src/repositories/bigquery.repository.js` uses `initializeGCPAuth()`
- [ ] File `src/utils/offset-tracker.util.js` uses `initializeGCPAuth()`
- [ ] File `.env.example` includes GCP configuration variables

## Environment Configuration

- [ ] If using custom key path, create `.env` file: `cp .env.example .env`
- [ ] If custom `.env` is used, verify `GCP_CREDENTIALS_PATH` is set correctly
- [ ] If custom `.env` is used, verify `GCP_PROJECT_ID` is set to `data-integration-474311`

## File Permissions

```bash
# Run this command and verify permissions are 600
ls -l data/keys/data-integration-474311-01459c9d6f7b.json

# If permissions are not 600, fix them:
chmod 600 data/keys/data-integration-474311-01459c9d6f7b.json
```

- [ ] Key file has permissions: 600 (owner read/write only)

## Startup Verification

Run the application and check for successful authentication messages:

```bash
npm start
```

Look for these log messages (should appear within first few seconds):

```
[INFO] GCP authentication initialized successfully {
  projectId: "data-integration-474311",
  serviceAccount: "data-integration-sprobe@data-integration-474311.iam.gserviceaccount.com",
  credentialsPath: "/path/to/data/keys/data-integration-474311-01459c9d6f7b.json"
}

[INFO] BigQuery repository initialized for project: data-integration-474311, dataset: jc_etl

[INFO] Offset tracker initialized with bucket: jc-etl-tracking
```

- [ ] Application starts without authentication errors
- [ ] Authentication log messages appear
- [ ] No "Permission denied" errors
- [ ] No "File not found" errors

## BigQuery Connection Test

Run the first ETL pipeline:

```bash
npm run etl:1
```

Expected results:
- [ ] ETL completes without BigQuery authentication errors
- [ ] Data is successfully written to BigQuery
- [ ] No "403 Forbidden" or "401 Unauthorized" errors
- [ ] No credential-related error messages

## Cloud Storage Connection Test

Cloud Storage is tested through offset tracking in ETL pipelines:

```bash
npm run etl:1
```

Expected results:
- [ ] Offset tracker successfully reads/writes to Cloud Storage
- [ ] No bucket access errors
- [ ] offset-tracker.json is created/updated in the GCS bucket
- [ ] No "Permission denied" or "NotFound" errors for the bucket

## GCP Console Verification (Optional but Recommended)

1. Go to [GCP Console](https://console.cloud.google.com)
2. Select project: `data-integration-474311`
3. Verify service account permissions:

   - [ ] Navigate to: IAM & Admin → Service Accounts
   - [ ] Find: `data-integration-sprobe@data-integration-474311.iam.gserviceaccount.com`
   - [ ] Verify roles:
     - [ ] `BigQuery Data Editor`
     - [ ] `BigQuery Job User`
     - [ ] `Storage Object Creator`
     - [ ] `Storage Object Viewer`

4. Verify BigQuery dataset:
   - [ ] Navigate to: BigQuery → Datasets
   - [ ] Find: `jc_etl` dataset
   - [ ] Verify tables are created/accessible

5. Verify Cloud Storage bucket:
   - [ ] Navigate to: Cloud Storage → Buckets
   - [ ] Find: `jc-etl-tracking` bucket
   - [ ] Check for `offset-tracker.json` file

## Application Usage Verification

Test that authenticated operations work correctly:

```bash
# Test ETL pipeline
npm run etl:1

# Or test individual components
npm test

# Check test results
cat src/test-results.json
```

- [ ] All ETL processes complete successfully
- [ ] No authentication errors in logs
- [ ] Data is stored in BigQuery
- [ ] Offset tracking is working

## Troubleshooting

If any verification step fails:

### If getting "File not found" error:
```bash
# Verify the key file exists
ls -la data/keys/data-integration-474311-01459c9d6f7b.json

# Check the path in environment:
cat .env | grep GCP_CREDENTIALS_PATH
```
- [ ] Key file path is correct
- [ ] Path exists and is accessible

### If getting "Permission denied" error:
```bash
# Check if it's a file permissions issue
ls -l data/keys/data-integration-474311-01459c9d6f7b.json

# Check if it's a GCP permission issue
# Go to GCP Console and verify service account roles
```
- [ ] File permissions are correct (600)
- [ ] Service account has required GCP roles
- [ ] Service account has access to BigQuery dataset
- [ ] Service account has access to Cloud Storage bucket

### If getting "Invalid JSON" error:
```bash
# Validate the key file
cat data/keys/data-integration-474311-01459c9d6f7b.json | jq .

# If jq returns an error, the JSON is invalid
# Restore from backup or recreate the key in GCP Console
```
- [ ] Key file is valid JSON
- [ ] Key file contains all required fields

### If BigQuery operations fail:
```bash
# Check BigQuery connectivity
npm run etl:1

# Check logs for specific errors
# Look for error messages in console output
```
- [ ] Service account has `bigquery.jobs.create` permission
- [ ] Service account has `bigquery.rows.insertAll` permission
- [ ] Dataset `jc_etl` exists and is accessible
- [ ] Tables exist in the dataset

## Final Checklist

- [ ] All pre-setup checks passed
- [ ] All code changes verified
- [ ] Environment configuration correct
- [ ] File permissions are 600
- [ ] Application starts with authentication logs
- [ ] BigQuery tests pass
- [ ] Cloud Storage tests pass
- [ ] GCP Console shows no errors
- [ ] ETL pipelines complete successfully
- [ ] No credential-related errors in logs

## Documentation Review

- [ ] Read `GCP_QUICK_START.md` for quick reference
- [ ] Read `GCP_AUTHENTICATION_SETUP.md` for detailed information
- [ ] Read `GCP_SETUP_SUMMARY.md` for implementation details

## Success Criteria

✅ **Setup is complete and working when:**

1. Application starts without authentication errors
2. BigQuery operations complete successfully
3. Cloud Storage operations complete successfully
4. All log messages indicate successful authentication
5. No credential-related errors appear in logs
6. ETL pipelines can read from Garoon and write to BigQuery
7. Offset tracking is persisted to Cloud Storage

---

## Questions or Issues?

If you encounter problems:

1. Check the troubleshooting section above
2. Review `GCP_AUTHENTICATION_SETUP.md` for detailed guidance
3. Verify all items in this checklist
4. Check application logs for specific error messages
5. Verify GCP Console shows correct permissions and resources

**You're all set!** 🎉

Your application is now authenticated with GCP and ready to use BigQuery and Cloud Storage services.
