# ETL-5 Preprocessing - Quick Reference

## What Was Added

**Preprocessing Step:** Automatic batch transfer of deferred allowances before Garoon fetch
- **When:** Every ETL-5 loop iteration (before fetching new requests)
- **What:** Checks allowances_workflow for records ready to transfer
- **How:** Queries for `change_date = TODAY` AND `for_process = 1`
- **Action:** Transmits to SmartHR if records found

## Files Created/Modified

### Created
- `src/services/allowance-batch-processing.service.js` (NEW)
- `docs/ETL5_PREPROCESSING_IMPLEMENTATION.md` (NEW)
- `docs/ETL5_PREPROCESSING_DIAGRAMS.md` (NEW)

### Modified
- `src/orchestrator/etl-5.orchestrator.js` - Added preprocessing call
- `src/repositories/allowance-workflow.repository.js` - Added markAsTransmitted() method

## Quick Command Reference

### Query Ready Allowances
```sql
SELECT 
  employee_code, 
  change_date, 
  type, 
  amount,
  for_process,
  inserted_at,
  transmitted_at
FROM `data-integration-474311.saasdb.allowances_workflow`
WHERE for_process = 1 
AND change_date = CURRENT_DATE()
ORDER BY inserted_at ASC;
```

### Manually Mark for Processing
```sql
UPDATE `data-integration-474311.saasdb.allowances_workflow`
SET for_process = 1
WHERE employee_code = 'EMP001' 
AND change_date = CURRENT_DATE();
```

### Check Transmission Status
```sql
SELECT 
  employee_code,
  change_date,
  transmitted_at,
  for_process
FROM `data-integration-474311.saasdb.allowances_workflow`
WHERE change_date = CURRENT_DATE()
ORDER BY transmitted_at DESC;
```

### Reset for Retry
```sql
UPDATE `data-integration-474311.saasdb.allowances_workflow`
SET for_process = 1
WHERE employee_code = 'EMP001' 
AND transmitted_at IS NULL;
```

## Log Patterns

### Success Pattern
```
═══════════════════════════════════════════════════════
🔄 [PREPROCESSING] Checking for deferred allowances...
📋 Found N deferred allowances ready for processing
⚙️  Processing deferred allowance for employee: EMPXXX
✅ Successfully transmitted deferred allowance for: EMPXXX
✨ [PREPROCESSING] Preprocessing completed: {...processed:N, failed:0}
═══════════════════════════════════════════════════════
```

### No Records Pattern
```
═══════════════════════════════════════════════════════
🔄 [PREPROCESSING] Checking for deferred allowances...
📭 No deferred allowances ready for transfer
✨ [PREPROCESSING] Preprocessing completed: {...processed:0, failed:0}
═══════════════════════════════════════════════════════
```

### Partial Failure Pattern
```
═══════════════════════════════════════════════════════
🔄 [PREPROCESSING] Checking for deferred allowances...
📋 Found 3 deferred allowances ready for processing
⚙️  Processing deferred allowance for employee: EMP001
✅ Successfully transmitted deferred allowance for: EMP001
⚙️  Processing deferred allowance for employee: EMP002
❌ Failed to process deferred allowance for EMP002
⚙️  Processing deferred allowance for employee: EMP003
✅ Successfully transmitted deferred allowance for: EMP003
✨ [PREPROCESSING] Preprocessing completed: {...processed:2, failed:1}
═══════════════════════════════════════════════════════
```

## Workflow States

| State | for_process | transmitted_at | Meaning |
|-------|-------------|----------------|---------|
| NEW | 0 | NULL | Just inserted, awaiting processing date |
| READY | 1 | NULL | Ready to process, waiting for preprocessing |
| TRANSMITTED | 0 | TIMESTAMP | Successfully sent to SmartHR |
| RETRY | 1 | NULL | Failed, retrying in next iteration |

## Service Methods

### AllowanceBatchProcessingService

#### processDeferredAllowances()
```javascript
const result = await service.processDeferredAllowances();
// Returns:
// {
//   success: boolean,
//   processed: number,
//   failed: number,
//   totalRecords: number,
//   message: string
// }
```

## Repository Methods

### AllowanceWorkflowRepository

#### getReadyForTransfer()
```javascript
const records = await repo.getReadyForTransfer();
// Returns: Array of records matching:
// - change_date = CURRENT_DATE()
// - for_process = 1
// - Ordered by inserted_at ASC
```

#### markAsTransmitted(employee_code, change_date)
```javascript
await repo.markAsTransmitted('EMP001', '2025-12-15');
// Sets: for_process = 0, transmitted_at = NOW
```

## Integration in ETL-5

### Before (Old Flow)
```
ETL-5 Loop
  └─ Fetch from Garoon
      └─ Process requests
```

### After (New Flow)
```
ETL-5 Loop
  ├─ PREPROCESSING: Check deferred allowances
  │   └─ If records found, transmit to SmartHR
  └─ Fetch from Garoon
      └─ Process requests
```

## Execution Path in Code

```javascript
// In ETL5Orchestrator.execute()

while (true) {
  // NEW: Preprocessing step
  try {
    const preprocessingResult = await 
      this.allowanceBatchProcessingService.processDeferredAllowances();
  } catch (error) {
    logger.error('[PREPROCESSING] Error', error);
    // Continue anyway - don't block main loop
  }

  // Existing: Garoon fetch
  const requests = await this.garoonService.fetchRequests(500, 1044);
  
  // ... process requests normally ...
}
```

## Troubleshooting

### Issue: Preprocessing finds records but doesn't process
**Check:**
- Is `for_process` flag actually set to 1?
- Is `change_date` equal to today?
- Check SmartHR API availability
- Review logs for specific error messages

### Issue: Records stay with `for_process = 1` after transmission
**Cause:** SmartHR API call failed even after retries
**Solution:** 
1. Verify SmartHR service is running
2. Check custom_fields JSON is valid
3. Manually retry or reset flag

### Issue: No logs showing preprocessing
**Check:**
- Logger level is set to DEBUG or INFO
- ETL-5 is actually running
- Wait for next loop iteration (runs every 5 seconds)

### Issue: High latency in preprocessing
**Cause:** Many records ready at same time
**Solution:**
- Records are processed sequentially (safe but slower)
- Future enhancement: batch size control

## Performance Notes

- **Query Time:** Minimal (<100ms typically)
- **Per-Record Time:** ~500ms-2s (includes API call + retries)
- **Total Time:** Negligible if no records, variable if many records
- **No Blocking:** Failures don't block ETL pipeline

## Testing

### Unit Test
```javascript
const service = new AllowanceBatchProcessingService();
const result = await service.processDeferredAllowances();
console.log(result);
```

### Integration Test
1. Insert test record with `for_process = 1`
2. Run ETL-5
3. Check BigQuery for `transmitted_at` timestamp
4. Verify SmartHR received the update

### Manual Test
```bash
# Insert test record
bq query --use_legacy_sql=false \
  "INSERT INTO \`data-integration-474311.saasdb.allowances_workflow\` \
   VALUES('TEST001', CURRENT_DATE(), '職位手当', 50000, \
   CURRENT_TIMESTAMP(), 1, '{}', CURRENT_TIMESTAMP(), NULL, NULL)"

# Run ETL-5 and watch logs
npm start etl-5

# Verify
bq query --use_legacy_sql=false \
  "SELECT * FROM \`data-integration-474311.saasdb.allowances_workflow\` \
   WHERE employee_code = 'TEST001'"
```

## Configuration

No configuration needed - preprocessing runs automatically on each iteration.

**Optional Future Enhancements:**
- Add environment variable to enable/disable preprocessing
- Add batch size limit
- Add specific execution time window

## Monitoring

**Metrics to Watch:**
- Preprocessing execution time per iteration
- Number of records processed per iteration
- Number of failures per iteration
- SmartHR API response times

**Alerting:** Consider setting up alerts if:
- Preprocessing fails 3+ times in a row
- Process failure rate > 10%
- Execution time > 30 seconds

## Related Documentation

- `docs/ETL5_PREPROCESSING_IMPLEMENTATION.md` - Full implementation details
- `docs/ETL5_PREPROCESSING_DIAGRAMS.md` - Visual diagrams
- `docs/WF5_REVAMP_IMPLEMENTATION.md` - Original WF#5 setup
- `WF5_QUICK_REFERENCE.md` - Common WF#5 tasks

## Summary

The preprocessing step enables **automatic batch processing** of deferred allowances. Records marked as ready (`for_process = 1`) with today's date are automatically transmitted to SmartHR before fetching new requests, ensuring timely processing without manual intervention.
