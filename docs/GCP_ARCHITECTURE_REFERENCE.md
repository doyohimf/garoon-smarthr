# GCP Authentication - Architecture & Reference

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Startup                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Environment Configuration (src/config/environment.js)       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ GCP_CREDENTIALS_PATH: ./data/keys/...json (default)    ││
│  │ GCP_PROJECT_ID: data-integration-474311                ││
│  │ BIGQUERY_DATASET_ID: jc_etl                            ││
│  │ GCS_BUCKET_NAME: jc-etl-tracking                       ││
│  └─────────────────────────────────────────────────────────┘│
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  GCP Authentication Utility (src/utils/gcp-auth.util.js)    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 1. Load service account key from file                  ││
│  │ 2. Validate JSON structure                             ││
│  │ 3. Check required fields                               ││
│  │ 4. Extract project ID                                  ││
│  │ 5. Create singleton instance                           ││
│  └─────────────────────────────────────────────────────────┘│
└──────────────────────┬──────────────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
   ┌──────────────────┐  ┌──────────────────┐
   │   BigQuery       │  │ Cloud Storage    │
   │   Clients        │  │ Clients          │
   └────────┬─────────┘  └────────┬─────────┘
            │                     │
            ▼                     ▼
   ┌──────────────────┐  ┌──────────────────┐
   │BigQueryRepository│  │ OffsetTracker    │
   │                  │  │                  │
   │ - insert()       │  │ - getOffset()    │
   │ - query()        │  │ - updateOffset() │
   │ - updateStatus() │  │                  │
   └────────┬─────────┘  └────────┬─────────┘
            │                     │
            ▼                     ▼
   ┌──────────────────┐  ┌──────────────────┐
   │ BigQueryService  │  │  ETL Pipelines   │
   │                  │  │                  │
   │ - insertRequest()│  │ - Track progress │
   │ - insertForm()   │  │ - Resume from    │
   │ - insertSteps()  │  │   checkpoint     │
   └────────┬─────────┘  └──────────────────┘
            │
            ▼
   ┌──────────────────┐
   │ ETL Orchestrators│
   │ ETL Processors   │
   │ All Operations   │
   └──────────────────┘
```

## File Structure

```
garoon-smarthr/
├── src/
│   ├── config/
│   │   └── environment.js ────────────── Environment variables
│   │
│   ├── utils/
│   │   ├── gcp-auth.util.js ─────────── GCP Authentication (NEW)
│   │   └── offset-tracker.util.js ───── Cloud Storage integration
│   │
│   ├── repositories/
│   │   └── bigquery.repository.js ───── BigQuery client
│   │
│   ├── services/
│   │   └── bigquery.service.js ──────── BigQuery operations
│   │
│   └── orchestrator/
│       └── etl.orchestrator.js ──────── Main ETL pipeline
│
├── data/
│   └── keys/
│       └── data-integration-474311-01459c9d6f7b.json ─ Service account key
│
├── .env.example ──────────────────────── Environment template
├── .env (optional) ───────────────────── Environment overrides
├── .gitignore ────────────────────────── Excludes data/keys/ and .env
│
└── Documentation/
    ├── GCP_QUICK_START.md ────────────── Quick start guide
    ├── GCP_AUTHENTICATION_SETUP.md ───── Comprehensive setup
    ├── GCP_SETUP_SUMMARY.md ──────────── Implementation details
    ├── GCP_VERIFICATION_CHECKLIST.md ─── Verification steps
    └── GCP_SETUP_COMPLETE.md ─────────── This setup (complete)
```

## Authentication Flow Diagram

```
Start Application
    │
    ├─ Load .env file (if exists)
    │
    ├─ Import environment.js
    │  └─ Sets GCP_CREDENTIALS_PATH, GCP_PROJECT_ID, etc.
    │
    ├─ Create BigQueryRepository
    │  ├─ Call initializeGCPAuth()
    │  │  ├─ Load key from GCP_CREDENTIALS_PATH
    │  │  ├─ Validate JSON structure
    │  │  └─ Store in singleton instance
    │  ├─ Create BigQuery client with credentials
    │  └─ Ready for database operations
    │
    ├─ Create OffsetTracker
    │  ├─ Call initializeGCPAuth()
    │  │  └─ Return existing singleton (no reload)
    │  ├─ Create Storage client with credentials
    │  └─ Ready for file operations
    │
    └─ Application ready
       └─ All GCP operations use authenticated credentials
```

## Authentication Initialization Sequence

```
Sequence: GCP Authentication Initialization

  Application                  GCPAuth                BigQuery/Storage
      │                           │                          │
      │──initializeGCPAuth()────→ │                          │
      │                           │                          │
      │                     Load key file                    │
      │                           │                          │
      │                     Validate JSON                    │
      │                           │                          │
      │                     Store singleton                  │
      │                           │                          │
      │                    Extract config                    │
      │◄──return instance────────│                          │
      │                           │                          │
      │                                                      │
      │──getBigQueryConfig()─────→ │                          │
      │◄──config object──────────│                          │
      │                           │                          │
      │                    Create client───────────────────→ │
      │                                        │ Initialize  │
      │                                        └── Ready    │
      │                                                      │
      │                           │          BigQuery Client│
      └─ Use authenticated client for queries ──────────────→
```

## Service Account Permissions Matrix

```
┌─────────────────────────────────────────────────────────────┐
│                Service Account Permissions                   │
└─────────────────────────────────────────────────────────────┘

Service          | Resource            | Permissions
─────────────────┼────────────────────┼──────────────────────
BigQuery         | Datasets           | • get
                 |                    | • list
                 |                    | • update
─────────────────┼────────────────────┼──────────────────────
BigQuery         | Tables             | • get
                 |                    | • list
                 |                    | • update
─────────────────┼────────────────────┼──────────────────────
BigQuery         | Jobs               | • create
─────────────────┼────────────────────┼──────────────────────
BigQuery         | Rows               | • insertAll
─────────────────┼────────────────────┼──────────────────────
Cloud Storage    | Buckets            | • get
─────────────────┼────────────────────┼──────────────────────
Cloud Storage    | Objects            | • create
                 |                    | • delete
                 |                    | • get
                 |                    | • list
```

## Configuration Hierarchy

```
Priority (1 = highest)
│
├─ 1. Environment Variables
│  └─ GCP_CREDENTIALS_PATH=/custom/path.json
│
├─ 2. .env File
│  └─ GCP_CREDENTIALS_PATH=./custom/path.json
│
└─ 3. Default Configuration
   └─ GCP_CREDENTIALS_PATH=./data/keys/data-integration-474311-01459c9d6f7b.json


Default Values Used (if not overridden)
│
├─ GCP_PROJECT_ID ←────────── Extracted from key file if not set
├─ BIGQUERY_DATASET_ID ──────→ jc_etl
├─ GCS_BUCKET_NAME ──────────→ jc-etl-tracking
└─ GCP_CREDENTIALS_PATH ─────→ ./data/keys/data-integration-474311-01459c9d6f7b.json
```

## Environment Configuration Reference

```javascript
// src/config/environment.js

export const env = {
  // Garoon Configuration
  GAROON_BASE_URL: process.env.GAROON_BASE_URL || 'https://...',
  
  // SmartHR Configuration
  SMARTHR_BASE_URL: process.env.SMARTHR_BASE_URL || 'https://...',
  
  // GCP Configuration (NEW)
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
  GCP_CREDENTIALS_PATH: process.env.GCP_CREDENTIALS_PATH || 
                        path.resolve(process.cwd(), 
                        'data/keys/data-integration-474311-01459c9d6f7b.json'),
  BIGQUERY_DATASET_ID: process.env.BIGQUERY_DATASET_ID || 'jc_etl',
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || 'jc-etl-tracking',
  
  // Application Configuration
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};
```

## GCP Services Integration

```
┌─────────────────────────────────────────────────────────────┐
│                    GCP Services                              │
└─────────────────────────────────────────────────────────────┘

                         ┌──────────────┐
                         │   GCP Auth   │
                         │              │
                         │ (singleton)  │
                         └──────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
        ┌─────────────┐  ┌───────────┐  ┌──────────────┐
        │ BigQuery    │  │ Storage   │  │ Other GCP    │
        │             │  │           │  │ Services     │
        │ • Datasets  │  │ • Buckets │  │              │
        │ • Tables    │  │ • Objects │  │ (Future)     │
        │ • Rows      │  │           │  │              │
        │ • Jobs      │  │ • ACLs    │  │              │
        └──────┬──────┘  └─────┬─────┘  └──────────────┘
               │                │
               ▼                ▼
        ┌──────────────────────────────┐
        │   ETL Pipeline               │
        │                              │
        │ ┌──────────────────────────┐│
        │ │ ETL Orchestrators        ││
        │ │ • etl-1 through etl-6    ││
        │ │ • Processors             ││
        │ │ • Services               ││
        │ └──────────────────────────┘│
        │                              │
        │ ┌──────────────────────────┐│
        │ │ Data Operations          ││
        │ │ • Read from BigQuery     ││
        │ │ • Write to BigQuery      ││
        │ │ • Track progress (GCS)   ││
        │ │ • Log results            ││
        │ └──────────────────────────┘│
        └──────────────────────────────┘
```

## Error Handling Flow

```
Error Occurrence
    │
    ├─ File not found
    │  └─ Check GCP_CREDENTIALS_PATH configuration
    │
    ├─ Invalid JSON
    │  └─ Recreate key from GCP Console
    │
    ├─ Missing required fields
    │  └─ Verify key contains all service account fields
    │
    ├─ Authentication failed
    │  └─ Check service account key is valid
    │
    ├─ Permission denied (BigQuery)
    │  └─ Verify service account has BigQuery roles
    │
    ├─ Permission denied (Cloud Storage)
    │  └─ Verify service account has Storage roles
    │
    └─ Other errors
       └─ Check application logs and GCP Console
```

## Deployment Scenarios

### Local Development
```
Application
    │
    └─ Load key from: ./data/keys/data-integration-474311-01459c9d6f7b.json
              │
              ▼
              BQ: project-id (from key)
              GCS: jc-etl-tracking
```

### Cloud Functions
```
Cloud Functions
    │
    ├─ Mount secret containing key file
    │
    └─ Set GCP_CREDENTIALS_PATH=/mnt/secret/key.json
              │
              ▼
              Use mounted key file for authentication
```

### Cloud Run
```
Cloud Run Service
    │
    ├─ Use Cloud Run service account
    │
    └─ Application uses ADC (Application Default Credentials)
              │
              ▼
              Automatic authentication via service account
```

## Reference Information

| Item | Value |
|------|-------|
| Service Account Email | `data-integration-sprobe@data-integration-474311.iam.gserviceaccount.com` |
| Project ID | `data-integration-474311` |
| Key File Location | `data/keys/data-integration-474311-01459c9d6f7b.json` |
| BigQuery Dataset | `jc_etl` |
| Cloud Storage Bucket | `jc-etl-tracking` |
| Region | asia-northeast1 |
| Auth Utility | `src/utils/gcp-auth.util.js` |
| Environment Config | `src/config/environment.js` |

---

For more detailed information, see the comprehensive documentation files included in the project.
