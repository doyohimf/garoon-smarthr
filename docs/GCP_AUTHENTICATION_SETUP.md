# GCP Authentication Setup

This document provides detailed instructions for setting up authentication with Google Cloud Platform (GCP) for all GCP-related operations including BigQuery and Cloud Storage.

## Overview

The application uses a GCP service account key file for authentication. The service account provides secure, long-lived credentials for interacting with GCP services without exposing personal credentials.

**Service Account Email:** `data-integration-sprobe@data-integration-474311.iam.gserviceaccount.com`  
**Project ID:** `data-integration-474311`

## Key File Location

The GCP service account key file is located at:
```
data/keys/data-integration-474311-01459c9d6f7b.json
```

This JSON file contains:
- Service account email
- Private key for authentication
- Project ID
- OAuth token URI
- Certificate URLs

⚠️ **IMPORTANT:** This file is sensitive and contains credentials. Keep it secure and never commit it to version control.

## Environment Configuration

### Default Setup (Automatic)

By default, the application automatically loads the service account key from:
```
data/keys/data-integration-474311-01459c9d6f7b.json
```

No additional configuration is required if the key file is in the expected location.

### Custom Path Setup

If your service account key is stored in a different location, set the `GCP_CREDENTIALS_PATH` environment variable:

#### Using .env file:
```bash
# .env
GCP_CREDENTIALS_PATH=/path/to/your/service-account-key.json
GCP_PROJECT_ID=data-integration-474311
```

#### Using environment variables:
```bash
export GCP_CREDENTIALS_PATH=/path/to/your/service-account-key.json
export GCP_PROJECT_ID=data-integration-474311
npm start
```

#### Using .env.example template:
```bash
cp .env.example .env
# Edit .env and set GCP_CREDENTIALS_PATH to your key file location
nano .env
```

## Authentication Initialization

The application uses a centralized GCP authentication utility (`src/utils/gcp-auth.util.js`) that:

1. **Loads the service account key** from the configured path
2. **Validates the key structure** to ensure it contains required fields
3. **Extracts project information** from the key
4. **Initializes GCP client libraries** with proper credentials
5. **Provides singleton pattern** to avoid re-authentication

### GCP Auth Utility

Location: `src/utils/gcp-auth.util.js`

**Public Functions:**

```javascript
import { initializeGCPAuth, getGCPAuth } from './utils/gcp-auth.util.js';

// Initialize GCP authentication (automatically validates credentials)
const gcpAuth = initializeGCPAuth();

// Get existing instance (after initialization)
const auth = getGCPAuth();

// Access authentication configuration
const bigQueryConfig = gcpAuth.getBigQueryConfig();
const storageConfig = gcpAuth.getStorageConfig();
const projectId = gcpAuth.getProjectId();
const serviceAccountEmail = gcpAuth.getServiceAccountEmail();
```

## Configured Services

### BigQuery Integration

**File:** `src/repositories/bigquery.repository.js`

The BigQuery repository automatically uses the GCP service account credentials:

```javascript
import { BigQueryRepository } from './repositories/bigquery.repository.js';

// Automatically authenticated with service account credentials
const repository = new BigQueryRepository();
await repository.insert('table_name', rows);
```

**Configuration in environment.js:**
```javascript
GCP_PROJECT_ID: "data-integration-474311"
BIGQUERY_DATASET_ID: "jc_etl"
GCP_CREDENTIALS_PATH: "./data/keys/data-integration-474311-01459c9d6f7b.json"
```

### Cloud Storage Integration

**File:** `src/utils/offset-tracker.util.js`

Cloud Storage access automatically uses the GCP service account credentials:

```javascript
import { OffsetTracker } from './utils/offset-tracker.util.js';

// Automatically authenticated with service account credentials
const tracker = new OffsetTracker();
const offset = await tracker.getOffset();
```

**Configuration in environment.js:**
```javascript
GCS_BUCKET_NAME: "jc-etl-tracking"
GCP_CREDENTIALS_PATH: "./data/keys/data-integration-474311-01459c9d6f7b.json"
```

## Service Account Permissions

The service account `data-integration-sprobe@data-integration-474311.iam.gserviceaccount.com` has been granted the following permissions:

### BigQuery Permissions:
- `bigquery.datasets.get`
- `bigquery.datasets.update`
- `bigquery.tables.get`
- `bigquery.tables.update`
- `bigquery.tables.list`
- `bigquery.datasets.list`
- `bigquery.jobs.create`
- `bigquery.rows.insertAll`

### Cloud Storage Permissions:
- `storage.buckets.get`
- `storage.objects.create`
- `storage.objects.delete`
- `storage.objects.get`
- `storage.objects.list`

## Troubleshooting

### Error: "GCP service account key file not found"

**Solution:** Verify the key file exists at the configured path:
```bash
ls -la data/keys/data-integration-474311-01459c9d6f7b.json
```

If the file is missing, restore it from your secure backup or recreate it from the GCP Console:
1. Go to GCP Console → Service Accounts
2. Select the service account
3. Go to Keys tab
4. Create a new JSON key

### Error: "Invalid GCP service account key: missing required fields"

**Solution:** The key file is corrupted or incomplete. Verify it contains all required fields:
```bash
cat data/keys/data-integration-474311-01459c9d6f7b.json | jq keys
```

Required fields:
- `type`
- `project_id`
- `private_key_id`
- `private_key`
- `client_email`
- `client_id`
- `auth_uri`
- `token_uri`

### Error: "Permission denied" when accessing BigQuery/Cloud Storage

**Solution:** The service account may not have required permissions. To grant permissions:

1. Go to GCP Console → IAM & Admin → IAM
2. Find the service account email: `data-integration-sprobe@data-integration-474311.iam.gserviceaccount.com`
3. Click Edit
4. Add required roles:
   - For BigQuery: `BigQuery Data Editor` and `BigQuery Job User`
   - For Cloud Storage: `Storage Object Creator` and `Storage Object Viewer`

### Error: "EACCES: permission denied" when reading key file

**Solution:** The key file has incorrect permissions. Fix them:
```bash
chmod 600 data/keys/data-integration-474311-01459c9d6f7b.json
```

## Development & Testing

### Local Development

For local development, ensure:
1. Service account key is in `data/keys/` directory
2. Environment variables are set (or use .env file)
3. Run the application:
```bash
npm start
```

### Testing GCP Connection

To verify GCP authentication is working:

```javascript
import { initializeGCPAuth } from './src/utils/gcp-auth.util.js';

try {
  const auth = initializeGCPAuth();
  console.log('✓ GCP Authentication successful');
  console.log('Project ID:', auth.getProjectId());
  console.log('Service Account:', auth.getServiceAccountEmail());
} catch (error) {
  console.error('✗ GCP Authentication failed:', error.message);
}
```

### Mock BigQuery for Testing

When `NODE_ENV !== 'production'` and `GCP_PROJECT_ID` is not set, the application automatically uses mock services.

To use mock services during testing:
```bash
unset GCP_PROJECT_ID
npm test
```

## Production Deployment

### Cloud Functions Deployment

When deploying to Google Cloud Functions:

1. Store the service account key securely using **Google Secret Manager**:
```bash
gcloud secrets create gcp-sa-key --data-file=data/keys/data-integration-474311-01459c9d6f7b.json
```

2. Grant Cloud Functions service account access to the secret
3. Update the Cloud Function environment variables to reference the secret
4. Use the default Application Default Credentials (ADC) which automatically uses the function's service account

### Cloud Run Deployment

For Cloud Run, use the service account associated with the Cloud Run service:

```bash
gcloud run deploy garoon-smarthr \
  --service-account=data-integration-sprobe@data-integration-474311.iam.gserviceaccount.com
```

### Environment Variables for Production

```bash
# Cloud Function or Cloud Run environment variables
GCP_PROJECT_ID=data-integration-474311
BIGQUERY_DATASET_ID=jc_etl
GCS_BUCKET_NAME=jc-etl-tracking
GCP_CREDENTIALS_PATH=/path/to/mounted/key/file
```

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use .gitignore** to exclude:
   ```
   data/keys/
   .env
   .env.local
   ```

3. **Rotate keys periodically** (every 90 days recommended):
   - Go to GCP Console → Service Accounts
   - Select the service account
   - Go to Keys tab
   - Create new key
   - Delete old key

4. **Use service accounts** instead of user credentials for applications

5. **Monitor key usage** in GCP Cloud Audit Logs

6. **Use least privilege** - only grant necessary permissions to the service account

## Additional Resources

- [GCP Service Accounts Documentation](https://cloud.google.com/iam/docs/service-accounts)
- [BigQuery Authentication](https://cloud.google.com/bigquery/docs/authentication)
- [Cloud Storage Authentication](https://cloud.google.com/storage/docs/authentication)
- [Google Cloud Node.js Client Libraries](https://googleapis.dev/nodejs/)
- [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)

## Support

For issues with GCP authentication:

1. Check the application logs for detailed error messages
2. Verify the service account key file exists and is valid
3. Ensure the service account has required IAM permissions
4. Check the `src/utils/gcp-auth.util.js` implementation for details
5. Review the troubleshooting section above
