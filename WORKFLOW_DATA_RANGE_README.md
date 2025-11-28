# Workflow Data Range Logic Implementation

This implementation provides dynamic date range calculation for workflows based on their starting points, stored in GCP Cloud Storage.

## Overview

The system automatically manages workflow starting points and calculates appropriate date ranges for data fetching operations:

- **New workflows** (< 30 days): Fetch data from launch date to current date
- **Mature workflows** (≥ 30 days): Fetch data using a fixed 30-day window

## Architecture

### Components

1. **GCPStorageService** (`src/services/gcp-storage.service.js`)
   - Manages workflow starting point files in GCP bucket
   - Handles local fallback for development environments
   - Automatically creates starting point files when needed

2. **DateRangeCalculator** (`src/utils/date-range.util.js`)
   - Calculates date differences and appropriate data ranges
   - Provides utility functions for date manipulation
   - Implements the 30-day threshold logic

3. **Updated GaroonService** (`src/services/garoon.service.js`)
   - Enhanced `fetchRequests()` method with workflow-aware date ranges
   - Backwards compatible with existing code
   - Automatic workflow starting point management

## Usage

### Basic Usage with Workflow ID

```javascript
import { GaroonService } from './src/services/garoon.service.js';

const garoonService = new GaroonService();

// Fetch requests for a specific workflow
// The system will automatically:
// 1. Check if workflow has a starting point file
// 2. Create one if it doesn't exist (with current date as launch date)
// 3. Calculate appropriate date range based on time since launch
// 4. Fetch data using the calculated range
const requests = await garoonService.fetchRequests(500, 'form123', 'workflow_1');
```

### Fallback Mode (Existing Behavior)

```javascript
// Without workflowId, uses original 1-month range
const requests = await garoonService.fetchRequests(500, 'form123');
```

### Manual Starting Point Management

```javascript
// Check if workflow has starting point
const hasStartingPoint = await garoonService.hasWorkflowStartingPoint('workflow_1');

// Create starting point with specific date
await garoonService.createWorkflowStartingPoint('workflow_1', new Date('2025-11-01'));

// Get starting point information
const startingPoint = await garoonService.getWorkflowStartingPoint('workflow_1');
```

## Starting Point File Structure

Files are stored in GCP bucket at path: `workflow-starting-points/workflow_{ID}_startoff_point.json`

```json
{
  "date_launched": "2025-11-28T00:00:00.000Z"
}
```

## Date Range Logic

### For New Workflows (< 30 days since launch):
- **Start Date**: `date_launched` from starting point file
- **End Date**: Current date
- **Range Type**: `launch-to-today`

### For Mature Workflows (≥ 30 days since launch):
- **Start Date**: Current date minus 30 days
- **End Date**: Current date  
- **Range Type**: `fixed-30-day`

## Environment Configuration

### Production (GCP Storage)
```env
NODE_ENV=production
GCP_PROJECT_ID=data-integration-474311
GCP_CREDENTIALS_PATH=data/keys/data-integration-474311-01459c9d6f7b.json
GCS_BUCKET_NAME=jc-etl-tracking
```

### Development (Local Storage)
```env
NODE_ENV=development
# Files stored in: data/workflow-starting-points/
```

## Testing

Run the test suite to verify implementation:

```bash
# Test date range calculation logic
node src/tests/simple-date-test.js

# Full integration test (requires GCP setup)
node src/tests/workflow-data-range.test.js
```

## Integration Examples

### ETL Orchestrator Integration

```javascript
import { GaroonService } from '../services/garoon.service.js';

export class ETLOrchestrator {
  async processWorkflow(workflowId, formId) {
    const garoonService = new GaroonService();
    
    // Get requests with automatic date range calculation
    const requests = await garoonService.fetchRequests(500, formId, workflowId);
    
    // Process requests...
    console.log(`Processing ${requests.length} requests for workflow ${workflowId}`);
  }
}
```

### Workflow Factory Integration

```javascript
import { GaroonService } from '../services/garoon.service.js';

export class WorkflowFactory {
  static async createNewWorkflow(workflowId, formId, startDate = new Date()) {
    const garoonService = new GaroonService();
    
    // Create starting point for new workflow
    await garoonService.createWorkflowStartingPoint(workflowId, startDate);
    
    // Initial data fetch will use launch-to-today range
    return await garoonService.fetchRequests(500, formId, workflowId);
  }
}
```

## Error Handling

The system includes comprehensive error handling:

- **GCP unavailable**: Automatic fallback to local storage
- **Missing starting point**: Automatic creation with current date
- **Invalid dates**: Validation and error logging
- **Network issues**: Graceful degradation with detailed logging

## Migration Path

Existing workflows will automatically get starting points created when first accessed, using the current date as the launch date. This ensures immediate compatibility without data loss.

## Benefits

1. **Efficient Data Fetching**: Only fetches relevant data based on workflow age
2. **Automatic Management**: No manual intervention required for starting points
3. **Backwards Compatible**: Existing code continues to work unchanged
4. **Environment Aware**: Works in both development and production environments
5. **Scalable**: Handles unlimited number of workflows
6. **Fault Tolerant**: Graceful handling of storage and network issues