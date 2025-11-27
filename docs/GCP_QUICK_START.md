# GCP Authentication Quick Start Guide

## Quick Setup (3 Steps)

### 1. Verify Service Account Key File Exists
```bash
ls -la data/keys/data-integration-474311-01459c9d6f7b.json
```

The key file should be present with this structure:
- **Path:** `data/keys/data-integration-474311-01459c9d6f7b.json`
- **Size:** ~2-3 KB (JSON format)
- **Permissions:** 600 (readable by owner only)

### 2. Set Environment Variables (Optional if using default location)

If your key file is in the default location (`data/keys/data-integration-474311-01459c9d6f7b.json`), no configuration is needed.

For custom location, create `.env` file in project root:
```bash
cp .env.example .env
nano .env
```

Update these variables:
```bash
GCP_CREDENTIALS_PATH=./data/keys/data-integration-474311-01459c9d6f7b.json
GCP_PROJECT_ID=data-integration-474311
BIGQUERY_DATASET_ID=jc_etl
GCS_BUCKET_NAME=jc-etl-tracking
```

### 3. Run the Application
```bash
npm start
```

The application will automatically:
- ✓ Load the service account key
- ✓ Validate credentials
- ✓ Initialize BigQuery client
- ✓ Initialize Cloud Storage client
- ✓ Log authentication status

## Authentication Flow

```
Application Start
    ↓
Load .env file (if exists)
    ↓
initializeGCPAuth()
    ↓
Load service account key from GCP_CREDENTIALS_PATH
    ↓
Validate key structure and fields
    ↓
Extract project ID
    ↓
Singleton auth instance ready
    ↓
BigQueryRepository and OffsetTracker use authenticated clients
    ↓
All GCP operations use service account credentials
```

## What Gets Authenticated

### BigQuery Operations
- `BigQueryRepository` - all database operations
- `BigQueryService` - data insertion and querying
- Used by: All ETL processors and orchestrators

### Cloud Storage Operations
- `OffsetTracker` - reading/writing offset tracking files
- Used by: ETL pipeline progress tracking

## Verification

### Check Authentication Status
```bash
npm start
# Look for log messages:
# "GCP authentication initialized successfully"
# "BigQuery repository initialized for project: data-integration-474311"
# "Offset tracker initialized with bucket: jc-etl-tracking"
```

### Test BigQuery Connection
```javascript
import { BigQueryRepository } from './src/repositories/bigquery.repository.js';

const repo = new BigQueryRepository();
// If initialized without errors, authentication is working
```

### Test Cloud Storage Connection
```javascript
import { OffsetTracker } from './src/utils/offset-tracker.util.js';

const tracker = new OffsetTracker();
const offset = await tracker.getOffset(); // Will fail gracefully if bucket doesn't exist
```

## Troubleshooting Checklist

- [ ] Service account key file exists at `data/keys/data-integration-474311-01459c9d6f7b.json`
- [ ] Key file has correct permissions: `chmod 600 data/keys/data-integration-474311-01459c9d6f7b.json`
- [ ] Key file is valid JSON: `cat data/keys/data-integration-474311-01459c9d6f7b.json | jq .`
- [ ] Service account has BigQuery permissions (check GCP Console)
- [ ] Service account has Cloud Storage permissions (check GCP Console)
- [ ] Node.js version >= 20.0.0: `node --version`
- [ ] Dependencies installed: `npm install`

## Key Files Modified

1. **`src/config/environment.js`** - Added GCP_CREDENTIALS_PATH configuration
2. **`src/utils/gcp-auth.util.js`** - New: Central authentication utility
3. **`src/repositories/bigquery.repository.js`** - Updated: Uses GCP authentication
4. **`src/utils/offset-tracker.util.js`** - Updated: Uses GCP authentication
5. **`.env.example`** - Updated: Added GCP configuration variables

## Service Account Details

- **Email:** `data-integration-sprobe@data-integration-474311.iam.gserviceaccount.com`
- **Project:** `data-integration-474311`
- **Key ID:** `01459c9d6f7b673e8eb22772cb7d01c3df3a0dcf`

## For More Information

See detailed documentation: [GCP_AUTHENTICATION_SETUP.md](./GCP_AUTHENTICATION_SETUP.md)
