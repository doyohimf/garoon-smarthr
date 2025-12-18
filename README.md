# Garoon to SmartHR ETL Pipeline

Multi-workflow ETL system for Google Cloud Platform that extracts employee data from Garoon workflows, processes it through BigQuery, and transfers it to SmartHR API for employee lifecycle management.

## Architecture

```
Garoon API → BigQuery → SmartHR API
     ↓
7 Specialized ETL Workflows
     ↓
Processor Factory → Smart Routing → Data Transformation
```

### Design Pattern: Multi-Workflow Orchestration

```
├── index.js (Main Entry Point - All Workflows)
├── etl-[1-7].js (Individual Workflow Entry Points)
├── orchestrator/ (Workflow Orchestration Logic)
│   ├── base.orchestrator.js (Shared Base Logic)
│   ├── etl.orchestrator.js (Main Orchestrator)
│   └── etl-[1-7].orchestrator.js (Workflow-Specific Logic)
├── processors/ (Business Logic Processors)
├── services/ (API Integration)
├── transformers/ (Data Transformation)
├── routers/ (Request Routing Logic)
├── repositories/ (Data Access)
├── utils/ (Utilities & Error Handling)
└── config/ (Configuration & Routing Rules)
```

## ETL Workflows Overview

The system operates through 7 specialized workflows, each handling different employee lifecycle events:

### Workflow 1: New Employee Onboarding (ETL-1)
**Form ID**: 1032 | **File**: `etl-1.js` | **Processor**: NEW_HIRE
- **Purpose**: Process new employee hiring and initial setup
- **Features**: 
  - Validates employee full name (よみがな) before processing
  - Creates new employee records in SmartHR
  - Handles employee registration and initial data setup
- **Execution**: Continuous polling with pause mechanism
- **Test Command**: `npm run etl:1`

### Workflow 2: Employee Change Management (ETL-2)  
**Form ID**: 1041 | **File**: `etl-2.js` | **Processor**: UNIFIED_CHANGE
- **Purpose**: Handle transfers, promotions, demotions, and salary changes
- **Features**:
  - Pre-processes pending employee changes from previous workflows
  - Unified processor for multiple change types
  - Automatic change type detection and routing
- **Execution**: Preprocessing + continuous polling
- **Test Command**: `npm run etl:2`

### Workflow 3: Employee Secondment (ETL-3)
**Form ID**: 1038 | **File**: `etl-3.js` | **Processor**: SECONDMENT  
- **Purpose**: Process employee secondments and company transfers
- **Features**:
  - Temporary and permanent transfers to other companies
  - Maintains employee relationship tracking
  - Handles complex employment status changes
- **Execution**: Continuous polling with pause mechanism
- **Test Command**: `npm run etl:3`

### Workflow 4: Leave Management (ETL-4)
**Form ID**: 1042 | **File**: `etl-4.js` | **Processor**: LEAVE_RETURN
- **Purpose**: Handle employee leave and return to work processes
- **Features**:
  - Medical leave, parental leave, sabbaticals
  - Leave start and return date tracking
  - Employment status updates during leave periods
- **Execution**: Continuous polling with pause mechanism  
- **Test Command**: `npm run etl:4`

### Workflow 5: Allowance Management (ETL-5)
**Form ID**: 1044 | **File**: `etl-5.js` | **Processor**: ALLOWANCE_CHANGE
- **Purpose**: Process employee allowance and benefit changes
- **Features**:
  - **Batch Processing**: Handles deferred allowances from previous workflows
  - **Preprocessing Step**: Checks for pending allowances before new request processing
  - Various allowance types (excluding commute expenses)
  - Complex allowance calculations and adjustments
- **Execution**: Preprocessing + continuous polling
- **Test Command**: `npm run etl:5`

### Workflow 6: Employee Resignation (ETL-6)
**Form ID**: 1236 | **File**: `etl-6.js` | **Processor**: RESIGNATION
- **Purpose**: Handle employee resignations and exits
- **Features**:
  - Employee exit processing
  - Final payroll and benefit calculations
  - Employment status finalization
  - Asset and access management
- **Execution**: Continuous polling with pause mechanism
- **Test Command**: `npm run etl:6`

### Workflow 7: Advanced Processing (ETL-7)
**File**: `etl-7.js` | **Purpose**: Specialized processing
- **Features**:
  - Advanced data processing logic
  - Complex business rule handling
  - Multi-step transformation workflows
- **Execution**: Specialized orchestration
- **Test Command**: `npm run etl:7`

## Smart Request Routing

The system uses intelligent routing to automatically process different request types:

```javascript
// Routing Configuration (src/config/routing.config.js)
REQUEST_TYPE_MAP = {
  NEW_HIRE: { formId: 1032, processor: 'NEW_HIRE' },
  UNIFIED_CHANGE: { formId: 1041, processor: 'UNIFIED_CHANGE' },
  SECONDMENT: { formId: 1038, processor: 'SECONDMENT' },
  LEAVE_RETURN: { formId: 1042, processor: 'LEAVE_RETURN' },
  ALLOWANCE_CHANGE: { formId: 1044, processor: 'ALLOWANCE_CHANGE' },
  RESIGNATION: { formId: 1236, processor: 'RESIGNATION' }
}
```

**Auto-Detection Features**:
- Form ID-based request filtering at API level
- Request name pattern matching
- Processor factory for dynamic processor creation
- Automatic skipping of unrecognized requests

## Features

- ✅ **7 Specialized Workflows** handling different employee lifecycle events
- ✅ **Smart Request Routing** with automatic processor selection
- ✅ **Batch Processing** for deferred operations (ETL-5)
- ✅ **Preprocessing Steps** for pending changes (ETL-2, ETL-5)
- ✅ **Pause Mechanisms** to prevent API rate limiting
- ✅ **Comprehensive Error Handling** with detailed logging
- ✅ **BigQuery Integration** for data persistence and analytics
- ✅ **SmartHR API Integration** with retry logic
- ✅ **Local Testing Environment** with mock services
- ✅ **Offset Tracking** for reliable data processing
- ✅ **Structured Logging** for monitoring and debugging

## Local Testing

### Individual Workflow Testing

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your credentials

# Test specific workflows
npm run etl:1  # New Hire workflow
npm run etl:2  # Employee Changes workflow
npm run etl:3  # Secondment workflow
npm run etl:4  # Leave Management workflow
npm run etl:5  # Allowance Management workflow
npm run etl:6  # Resignation workflow
npm run etl:7  # Advanced Processing workflow

# Test all workflows (main orchestrator)
npm test
```

### Option 1: Quick Test (Single Run)

```bash
# Test main orchestrator (all workflows)
npm test

# Test specific workflow
npm run etl:1
```

### Option 2: Local Server (HTTP Endpoint)

```bash
# Start local server
npm start

# Test main ETL endpoint (all workflows)
curl http://localhost:8080/etl

# Test specific workflow endpoints
curl http://localhost:8080/etl/1  # New Hire
curl http://localhost:8080/etl/2  # Employee Changes  
curl http://localhost:8080/etl/3  # Secondment
curl http://localhost:8080/etl/4  # Leave Management
curl http://localhost:8080/etl/5  # Allowance Management
curl http://localhost:8080/etl/6  # Resignation
curl http://localhost:8080/etl/7  # Advanced Processing

# Or use browser
open http://localhost:8080/etl
```

### Local Mode Features

- **Mock BigQuery**: Writes to `data/bigquery-mock/*.jsonl` files instead of BigQuery
- **Local Offset Tracking**: Saves to `data/offset-tracker.json` instead of GCS
- **Full Garoon & SmartHR API calls**: Still connects to real APIs
- **Workflow Isolation**: Test individual workflows independently
- **Debug Mode**: Enhanced logging for development

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

  async updateCrew(empCode, updateData) {
    console.log('[MOCK] SmartHR crew updated:', empCode, updateData);
    return { id: empCode, updated: true };
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

### Main Orchestrator Flow (index.js)
1. **Initialize**: Set up services and transformers
2. **Routing**: Determine request type using smart routing
3. **Processing**: Route to appropriate processor via factory
4. **Transformation**: Convert data for SmartHR format
5. **Transfer**: Send to SmartHR with retry logic
6. **Tracking**: Update status and save offset

### Individual Workflow Flow (etl-[1-7].js)
1. **Preprocessing**: Handle deferred/pending operations (ETL-2, ETL-5)
2. **Fetch**: Get requests by specific form ID
3. **Filter**: Apply workflow-specific filtering
4. **Process**: Execute workflow-specific business logic
5. **Pause Management**: Implement pause mechanisms to prevent rate limiting
6. **Loop**: Continue until manually stopped or error threshold reached

### Workflow-Specific Logic

**ETL-1 (New Hire)**:
- Validates employee full name (よみがな) before processing
- Creates new employee records with complete profile setup
- Handles employment contract and benefit enrollment

**ETL-2 (Employee Changes)**:
- Pre-processes pending employee changes from ETL queue
- Routes changes to unified change processor
- Handles transfers, promotions, demotions, salary changes

**ETL-3 (Secondment)**:
- Processes complex employment status changes
- Handles temporary and permanent company transfers
- Maintains employment relationship tracking

**ETL-4 (Leave Management)**:
- Processes leave start and return dates
- Updates employment status during leave periods
- Handles various leave types (medical, parental, sabbatical)

**ETL-5 (Allowance Management)**:
- **Preprocessing**: Processes deferred allowances from previous workflows
- Handles complex allowance calculations
- Manages various benefit and compensation adjustments

**ETL-6 (Resignation)**:
- Processes employee exit workflows
- Handles final compensation and benefit calculations
- Updates employment status to terminated

**ETL-7 (Advanced Processing)**:
- Specialized processing for complex business rules
- Multi-step transformation workflows
- Advanced data validation and cleanup

## Auto-Skip & Smart Routing

The ETL automatically routes and processes requests based on form IDs and request patterns:

### Form ID-Based Processing
- **1032** → NEW_HIRE processor (ETL-1)
- **1041** → UNIFIED_CHANGE processor (ETL-2) 
- **1038** → SECONDMENT processor (ETL-3)
- **1042** → LEAVE_RETURN processor (ETL-4)
- **1044** → ALLOWANCE_CHANGE processor (ETL-5)
- **1236** → RESIGNATION processor (ETL-6)

### Intelligent Request Handling
- **Auto-Detection**: Form ID and request name pattern matching
- **Processor Factory**: Dynamic processor creation based on request type
- **Fallback Logic**: Graceful handling of unrecognized requests
- **Error Recovery**: Continues processing after individual request failures

**Max Processing Limits**:
- **Main Orchestrator**: 100 attempts per execution to prevent infinite loops
- **Individual Workflows**: Configurable pause limits with exponential backoff
- **Rate Limiting**: Built-in pause mechanisms to respect API limits

## Data Flow

### Garoon → BigQuery (Data Storage)

```
Garoon Request → garoon_requests table
Request Items → garoon_request_form_fields table  
Workflow Steps → garoon_request_steps table
Step Processors → garoon_request_step_processors table
Process Logs → garoon_process_logs table
Employee Changes → emp_changes table (for deferred processing)
```

### BigQuery → SmartHR (Data Transfer)

```
Garoon Employee Data → SmartHR Crew Object
Custom Field Mapping → SmartHR custom_fields array
Employment Status → SmartHR employment_status
Department/Position → SmartHR organizational structure
```

### Workflow-Specific Data Handling

**ETL-1 (New Hire)**:
- `garoon_requests` → Complete employee profile creation
- Employee validation → SmartHR crew creation with full onboarding

**ETL-2 (Employee Changes)**:
- `emp_changes` queue → Pending change processing
- Unified change data → SmartHR crew updates

**ETL-5 (Allowance Management)**:
- Deferred allowance queue → Batch allowance processing  
- Complex allowance calculations → SmartHR compensation updates

**All Workflows**:
- Process logs → `garoon_process_logs` for audit trail
- Error tracking → `data/errors/` directory for debugging

## Error Handling

### Comprehensive Error Management

- **Workflow-Level Errors**: Each workflow has independent error handling
- **Processor-Level Errors**: Individual processor failure doesn't stop other workflows
- **SmartHR Transfer Failures**: 
  - Retries with exponential backoff (3 attempts)
  - Status tracking in BigQuery (`ERROR`, `COMPLETED`, `ON-GOING`)
  - Detailed error logging to `data/errors/` directory
- **BigQuery Insert Failures**: 
  - Transaction rollback for data consistency
  - Request reprocessing on next execution
- **API Rate Limiting**: 
  - Built-in pause mechanisms
  - Exponential backoff for API calls
  - Configurable pause limits per workflow

### Error Recovery Strategies

**Deferred Processing**:
- Failed allowance changes → Queued for ETL-5 batch processing
- Failed employee changes → Queued for ETL-2 preprocessing
- Automatic retry on next workflow execution

**Graceful Degradation**:
- Individual request failures don't stop workflow execution
- Comprehensive logging for debugging and monitoring
- Offset tracking ensures no data loss during failures

**Monitoring & Alerting**:
- Error logs automatically saved to `data/errors/` with timestamps
- BigQuery process logs for audit trail
- Structured logging for GCP monitoring integration

## Monitoring

### Cloud Logging
```bash
# View all ETL logs
gcloud functions logs read garoonToSmartHRETL --limit 50

# View workflow-specific logs
gcloud logging read "resource.type=cloud_function AND labels.function_name=garoonToSmartHRETL AND textPayload:\"Workflow 1\""

# View error logs only
gcloud logging read "resource.type=cloud_function AND severity>=ERROR"
```

### Local Monitoring
```bash
# Monitor local BigQuery mock files
ls -la data/bigquery-mock/

# Check offset tracking
cat data/offset-tracker.json

# View error logs
ls -la data/errors/
```

### Performance Metrics
- **Request Processing Rate**: Tracked per workflow
- **Success/Failure Ratios**: Logged in process statistics  
- **API Response Times**: Monitored for Garoon and SmartHR calls
- **Error Frequency**: Tracked by processor type and error category

### Workflow Status Tracking
Each workflow maintains independent status tracking:
- **ETL-1**: New hire processing statistics
- **ETL-2**: Employee change processing + preprocessing results
- **ETL-3**: Secondment processing statistics  
- **ETL-4**: Leave management processing statistics
- **ETL-5**: Allowance processing + batch processing results
- **ETL-6**: Resignation processing statistics
- **ETL-7**: Advanced processing statistics

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

### Workflow Improvements
- **Parallel Workflow Execution**: Run multiple workflows simultaneously
- **Dynamic Workflow Scheduling**: Smart scheduling based on data volume
- **Workflow Dependencies**: Handle inter-workflow dependencies automatically

### Data Processing  
- **Real-time Processing**: Webhook-based triggers for immediate processing
- **Batch Optimization**: Enhanced batch processing for large data volumes
- **Data Validation Layer**: Advanced validation rules per processor type
- **Conflict Resolution**: Automatic handling of conflicting employee data

### Monitoring & Operations
- **Dashboard**: Real-time monitoring dashboard for all workflows
- **Alerting System**: Advanced alerting for failures and anomalies  
- **Dead Letter Queue**: Enhanced handling for permanently failed transfers
- **Performance Analytics**: Detailed performance metrics and optimization recommendations

### Integration Enhancements
- **Multi-tenant Support**: Support for multiple SmartHR environments
- **API Versioning**: Support for different Garoon and SmartHR API versions
- **Custom Field Mapping**: Dynamic custom field mapping configuration
- **Audit Trail**: Enhanced audit trail with detailed change tracking