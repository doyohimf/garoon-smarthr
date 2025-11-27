# Employee Data Processors

Additional processors for handling various employee data changes from Garoon to SmartHR.

## Overview

These processors handle employee lifecycle events beyond initial onboarding:

1. **Employee Transfer** - Department/location transfers
2. **Employee Promotion/Demotion** - Position changes
3. **Salary Changes** - Regular raises, adjustments
4. **Secondment** - Temporary or permanent transfers to other companies
5. **Leave & Return** - Medical leave, parental leave, etc.
6. **Allowance Changes** - Various allowance modifications
7. **Resignation** - Employee exits

## Architecture

```
ProcessorFactory
  ↓
[Determines Request Type]
  ↓
Specific Processor → SmartHR Extended Service → SmartHR API
  ↓
BigQuery Process Logs
```

## Usage Example

```javascript
import { ProcessorFactory } from './src/processors/processor.factory.js';

const factory = new ProcessorFactory();

// Auto-detect and process
const result = await factory.processRequest(garoonRequest);

// Or manually select processor
const processor = factory.getProcessor('TRANSFER');
const result = await processor.process(garoonRequest);
```

## Processors

### 1. Employee Transfer Processor

**File**: `employee-transfer.processor.js`

**Handles**: Department transfers, location changes

**Garoon Fields**:
- 社員番号 (Employee ID)
- 異動前部署 (From Department)
- 異動後部署 (To Department)
- 異動前役職 (From Position)
- 異動後役職 (To Position)
- 発令日 (Effective Date)
- 異動区分 (Transfer Type)
- 勤務地 (Work Location)

**SmartHR Update**:
- `department_id`
- `position`
- `work_location`
- `effective_date`

---

### 2. Employee Promotion Processor

**File**: `employee-promotion.processor.js`

**Handles**: Promotions, demotions, lateral moves

**Garoon Fields**:
- 社員番号 (Employee ID)
- 現職位 (Current Position)
- 新職位 (New Position)
- 現等級 (Current Grade)
- 新等級 (New Grade)
- 発令日 (Effective Date)

**Change Detection**:
- Promotion: New grade > Current grade
- Demotion: New grade < Current grade
- Lateral: Same grade

**SmartHR Update**:
- `position`
- `job_title`
- `grade`
- `effective_date`

---

### 3. Salary Change Processor

**File**: `employee-salary-change.processor.js`

**Handles**: Salary adjustments, regular raises

**Garoon Fields**:
- 社員番号 (Employee ID)
- 現基本給 (Current Base Salary)
- 新基本給 (New Base Salary)
- 現年俸 (Current Annual Salary)
- 新年俸 (New Annual Salary)
- 改定理由 (Change Reason)
- 発令日 (Effective Date)

**Calculations**:
- Change amount
- Change percentage
- Change type (INCREASE/DECREASE/NO_CHANGE)

**SmartHR Update**:
- `monthly_base_salary`
- `annual_salary`
- `effective_date`

---

### 4. Secondment Processor

**File**: `employee-secondment.processor.js`

**Handles**: Temporary/permanent transfers to other companies

**Garoon Fields**:
- 社員番号 (Employee ID)
- 出向区分 (Secondment Type)
- 出向元会社 (From Company)
- 出向先会社 (To Company)
- 出向開始日 (Start Date)
- 出向終了日 (End Date)
- 転籍フラグ (Permanent Transfer Flag)

**Types**:
- PERMANENT_TRANSFER (転籍)
- TEMPORARY_SECONDMENT (期限付き出向)
- INDEFINITE_SECONDMENT (期限なし出向)
- DISPATCH (派遣)

**SmartHR Update**:
- `secondment_status`
- `secondment_company`
- `secondment_start_date`
- `secondment_end_date`

---

### 5. Leave & Return Processor

**File**: `employee-leave.processor.js`

**Handles**: Medical leave, parental leave, and returns

**Leave Garoon Fields**:
- 社員番号 (Employee ID)
- 休職区分 (Leave Type)
- 休職開始日 (Start Date)
- 休職終了予定日 (Expected End Date)
- 有給無給 (Paid/Unpaid)

**Return Garoon Fields**:
- 復職日 (Return Date)
- 復職部署 (Return Department)
- 復職後勤務形態 (Work Arrangements)
- 勤務時間短縮 (Reduced Hours)

**Methods**:
- `processLeave()` - Handle leave of absence
- `processReturn()` - Handle return to work

**SmartHR Update**:
- Leave: `employment_status = 'ON_LEAVE'`
- Return: `employment_status = 'ACTIVE'`

---

### 6. Allowance Change Processor

**File**: `employee-allowance-change.processor.js`

**Handles**: Changes to various allowances

**Allowance Types**:
- Commuting (通勤手当)
- Housing (住宅手当)
- Family (家族手当)
- Position (役職手当)
- Overtime (固定残業手当)
- Special (特別手当)
- Area (地域手当)

**Features**:
- Tracks before/after amounts for each allowance
- Calculates total allowance change
- Percentage change calculation

**SmartHR Update**:
- Individual allowance fields
- `effective_date`

---

### 7. Resignation Processor

**File**: `employee-resignation.processor.js`

**Handles**: Employee exits

**Garoon Fields**:
- 社員番号 (Employee ID)
- 退職区分 (Resignation Type)
- 退職理由 (Reason)
- 最終出勤日 (Last Working Date)
- 退職日 (Retirement Date)
- 退職金 (Retirement Allowance)
- 未消化有給日数 (Unused Vacation Days)
- 再雇用可否 (Eligible for Rehire)

**Resignation Types**:
- VOLUNTARY (自己都合)
- COMPANY_INITIATED (会社都合)
- RETIREMENT_AGE (定年)
- CONTRACT_EXPIRATION (契約満了)
- DISCIPLINARY_DISMISSAL (懲戒解雇)

**Calculations**:
- Years of service
- Unused vacation payout

**SmartHR Update**:
- `employment_status = 'RESIGNED'`
- `resignation_type`
- `retirement_date`
- `eligible_for_rehire`

---

## Processor Factory

**File**: `processor.factory.js`

### Auto-Detection Logic

The factory determines request type by:

1. **Request Name Pattern Matching**:
   - "異動" or "転勤" → TRANSFER
   - "昇格" or "昇進" → PROMOTION
   - "給与改定" → SALARY_CHANGE
   - etc.

2. **Form Field Analysis** (fallback):
   - "異動先部署" field → TRANSFER
   - "新職位" field → PROMOTION
   - etc.

### Methods

```javascript
// Get specific processor
const processor = factory.getProcessor('TRANSFER');

// Auto-detect and get processor
const requestType = factory.determineRequestType(garoonRequest);

// Process with auto-detection
const result = await factory.processRequest(garoonRequest);

// List available types
const types = factory.getAvailableTypes();
// ['TRANSFER', 'PROMOTION', 'SALARY_CHANGE', ...]
```

---

## BigQuery Process Logs

**Table**: `employee_process_logs`

**Schema**: See `bigquery_process_logs_schema.sql`

**Fields**:
- Common: request_id, process_type, employee_id, status
- Type-specific fields for each processor
- Audit: processed_at, error_message

**Partitioning**: By `processed_at` date
**Clustering**: By `process_type`, `employee_id`, `status`

**Query Examples**:

```sql
-- Get all transfers
SELECT * FROM employee_process_logs
WHERE process_type = 'EMPLOYEE_TRANSFER'
AND status = 'COMPLETED';

-- Get failed processes
SELECT * FROM employee_process_logs
WHERE status = 'ERROR'
ORDER BY processed_at DESC;

-- Salary changes by employee
SELECT 
  employee_id,
  COUNT(*) as changes,
  SUM(salary_change_amount) as total_increase
FROM employee_process_logs
WHERE process_type = 'SALARY_CHANGE'
GROUP BY employee_id;
```

---

## Integration (Not Yet Implemented)

To integrate processors into the main ETL flow, you'll need to:

1. **Modify ETL Orchestrator** to call ProcessorFactory
2. **Add routing logic** based on request type
3. **Handle new employee vs existing employee** flows
4. **Update offset tracking** for processed requests

Example integration:

```javascript
// In etl.orchestrator.js
import { ProcessorFactory } from '../processors/processor.factory.js';

async execute() {
  const factory = new ProcessorFactory();
  
  // Determine if new hire or employee change
  const requestType = factory.determineRequestType(request);
  
  if (requestType && requestType !== 'NEW_HIRE') {
    // Use processor for employee changes
    const result = await factory.processRequest(request);
  } else {
    // Use existing flow for new hires
    const smartHRData = await this.garoonToSHRTransformer.transform(request);
    await this.transferToSmartHR(smartHRData, requestId);
  }
}
```

---

## Error Handling

All processors include:
- ✅ 3-retry logic with exponential backoff
- ✅ BigQuery process logging
- ✅ Detailed error messages
- ✅ Status tracking (COMPLETED/ERROR)

---

## Testing

```javascript
// Test individual processor
import { EmployeeTransferProcessor } from './src/processors/employee-transfer.processor.js';

const processor = new EmployeeTransferProcessor();
const result = await processor.process(garoonRequest);

// Test factory
import { ProcessorFactory } from './src/processors/processor.factory.js';

const factory = new ProcessorFactory();
const result = await factory.processRequest(garoonRequest);
```

---

## Future Enhancements

- [ ] Batch processing support
- [ ] Dry-run mode
- [ ] Validation rules engine
- [ ] Approval workflow integration
- [ ] Notification system
- [ ] Audit trail export