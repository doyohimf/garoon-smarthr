# WF#5 Quick Reference Guide

## Files Modified/Created

### Core Implementation Files
1. **`src/utils/date.util.js`** (NEW)
   - Date parsing and comparison utility
   - Supports multiple date formats

2. **`src/repositories/allowance-workflow.repository.js`** (NEW)
   - Repository for allowances_workflow table operations
   - Insert, query, and update methods

3. **`src/processors/allowance-change.processor.js`** (MODIFIED)
   - Updated to use DateUtil and AllowanceWorkflowRepository
   - Added conditional SmartHR transmission logic
   - Stores all allowance data in BigQuery first

4. **`data/sql/schema.sql`** (MODIFIED)
   - Added allowances_workflow table definition

### Documentation & Reference Files
5. **`docs/WF5_REVAMP_IMPLEMENTATION.md`** (NEW)
   - Complete implementation documentation

6. **`data/sql/wf5_allowances_workflow.sql`** (NEW)
   - Standalone SQL for table creation and sample queries

7. **`src/utils/wf5-validation.util.js`** (NEW)
   - Validation tests for DateUtil and repository

## Key Processing Logic

```javascript
// In EmployeeAllowanceChangeProcessor.process()

1. Extract allowance data from request
2. Check if changeDate == today using DateUtil.isToday()
3. INSERT into allowances_workflow table
4. IF changeDate is today:
     - Call SmartHRExtendedService.updateEmployeeAllowances()
     - Return { success: true, transmitted: true }
   ELSE:
     - Skip SmartHR transmission
     - Return { success: true, transmitted: false }
```

## Deployment Steps

### 1. Create BigQuery Table
```bash
# Run one of these:
bq query --use_legacy_sql=false < data/sql/wf5_allowances_workflow.sql
# OR manually execute in BigQuery console
```

### 2. Verify Files
- Confirm all 7 files are in place
- Check for any syntax errors: `npm run lint` (if configured)

### 3. Test Date Utility
```javascript
import { DateUtil } from './src/utils/date.util.js';
console.log(DateUtil.isToday('2025-11-27')); // true or false based on system date
```

### 4. Run Integration Test
```javascript
import { WF5ValidationUtil } from './src/utils/wf5-validation.util.js';
await WF5ValidationUtil.runAllTests();
```

## Database Queries

### View Pending Allowances
```sql
SELECT * FROM `data-integration-474311.saasdb.allowances_workflow`
WHERE for_process = 0
ORDER BY inserted_at DESC;
```

### View Ready for Transfer
```sql
SELECT * FROM `data-integration-474311.saasdb.allowances_workflow`
WHERE for_process = 1 AND change_date = CURRENT_DATE()
ORDER BY inserted_at ASC;
```

### Check Employee History
```sql
SELECT * FROM `data-integration-474311.saasdb.allowances_workflow`
WHERE employee_code = 'EMP001'
ORDER BY inserted_at DESC;
```

## Log Examples

### Successful Immediate Transfer
```
Change date "2025-11-27" is today? true
✅ Change date is today - transmitting to SmartHR for EMP001
✓ Allowance change completed: EMP001
```

### Deferred Processing
```
Change date "2025-12-01" is today? false
⏸️  Change date is not today - data stored, awaiting processing date. Employee: EMP001
```

## Error Handling

- **Date parsing errors**: Logged with original date string, returns `false` for `isToday()`
- **BigQuery insert errors**: Caught and logged, throws for caller
- **Missing required fields**: Logged as warnings, processing continues

## Future Enhancements

1. Implement scheduled batch transfer for future dates
2. Add status tracking (PENDING → READY → TRANSMITTED → COMPLETED)
3. Implement retry mechanism for failed transfers
4. Add audit logging for all state changes
