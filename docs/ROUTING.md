# Request Routing System

Automatically routes Garoon requests to appropriate processors based on exact request name keywords.

## Flow

```
Garoon Request
  ↓
RequestRouter.route()
  ↓
Check request.name against exact keywords
  ↓
Return Processor Type
  ↓
ETLOrchestrator routes to:
  - NEW_HIRE → GaroonToSmartHRTransformer (existing flow)
  - UNIFIED_CHANGE → UnifiedEmployeeChangeProcessor
  - SECONDMENT → EmployeeSecondmentProcessor
  - LEAVE → EmployeeLeaveProcessor.processLeave()
  - RETURN → EmployeeLeaveProcessor.processReturn()
  - ALLOWANCE_CHANGE → EmployeeAllowanceChangeProcessor
  - RESIGNATION → EmployeeResignationProcessor
```

## Routing Rules (Exact Keywords Only)

### 1. New Hire

**Keyword**: `内勤社員の人事採用・更新・変更`

**Routes to**: `NEW_HIRE` → Existing new hire flow

**Description**: Internal Employee Hiring/Update/Change

---

### 2. Employee Changes

**Keyword**: `社員の異動・昇格・降格・給与変更`

**Routes to**: `UNIFIED_CHANGE` → UnifiedEmployeeChangeProcessor

**Description**: Employee transfers, promotions, demotions, and salary changes (including regular raises)

**Special**: This processor handles "Details" fields (詳細 1, 詳細 2, etc.) for batch updates

---

### 3. Secondment

**Keyword**: `社員の出向・転籍`

**Routes to**: `SECONDMENT` → EmployeeSecondmentProcessor

**Description**: Employee secondment and transfer

---

### 4. Leave and Return

**Keyword**: `社員の休業・復職`

**Routes to**: 
- `LEAVE` → EmployeeLeaveProcessor.processLeave() (if contains '休業')
- `RETURN` → EmployeeLeaveProcessor.processReturn() (if contains '復職')

**Description**: Employee leave and return to work

**Sub-type Detection**: 
- If request name contains "休業" → Routes to LEAVE
- If request name contains "復職" → Routes to RETURN

---

### 5. Allowance Changes

**Keyword**: `社員の給与・手当変更 (内勤) ※通勤費除`

**Routes to**: `ALLOWANCE_CHANGE` → EmployeeAllowanceChangeProcessor

**Description**: Employee Allowance Changes

---

### 6. Resignation

**Keyword**: `社員の退社 (内勤)`

**Routes to**: `RESIGNATION` → EmployeeResignationProcessor

**Description**: Employee Resignation

---

## Matching Rules

1. **Case Insensitive**: Converts request name to lowercase for matching
2. **Contains Match**: Checks if request name contains the keyword
3. **No Alternatives**: Only the exact keywords above are matched
4. **Sub-type Detection**: For LEAVE_RETURN, additional check for 休業 or 復職

## Examples

```javascript
// Exact matches
"内勤社員の人事採用・更新・変更" → NEW_HIRE ✅
"社員の異動・昇格・降格・給与変更申請" → UNIFIED_CHANGE ✅
"社員の出向・転籍手続き" → SECONDMENT ✅
"社員の休業・復職（休業）" → LEAVE ✅
"社員の休業・復職（復職）" → RETURN ✅
"社員の給与・手当変更 (内勤) ※通勤費除" → ALLOWANCE_CHANGE ✅
"社員の退社 (内勤)" → RESIGNATION ✅

// No match (not in keyword list)
"社員の採用" → null ❌
"社員の異動" → null ❌
"退職手続き" → null ❌
```

## Configuration

All routing rules are defined in `src/config/routing.config.js`:

```javascript
export const REQUEST_TYPE_MAP = {
  NEW_HIRE: {
    keywords: ['内勤社員の人事採用・更新・変更'],
    description: 'Internal Employee Hiring/Update/Change',
    processor: 'NEW_HIRE'
  },
  UNIFIED_CHANGE: {
    keywords: ['社員の異動・昇格・降格・給与変更'],
    description: 'Employee transfers, promotions, demotions, and salary changes',
    processor: 'UNIFIED_CHANGE'
  },
  // ...
}
```

## Usage

```javascript
import { RequestRouter } from './src/routers/request.router.js';

const router = new RequestRouter();

// Route request
const garoonRequest = { name: '社員の異動・昇格・降格・給与変更' };
const processorType = router.route(garoonRequest);
// Returns: 'UNIFIED_CHANGE'

// Get description
const description = router.getRequestTypeDescription(processorType);
// Returns: 'Employee transfers, promotions, demotions, and salary changes'

// Check if should process
const shouldProcess = router.shouldProcess(garoonRequest);
// Returns: true
```

## Testing Routes

```javascript
const testCases = [
  { name: '内勤社員の人事採用・更新・変更', expected: 'NEW_HIRE' },
  { name: '社員の異動・昇格・降格・給与変更', expected: 'UNIFIED_CHANGE' },
  { name: '社員の出向・転籍', expected: 'SECONDMENT' },
  { name: '社員の休業・復職（休業）', expected: 'LEAVE' },
  { name: '社員の休業・復職（復職）', expected: 'RETURN' },
  { name: '社員の給与・手当変更 (内勤) ※通勤費除', expected: 'ALLOWANCE_CHANGE' },
  { name: '社員の退社 (内勤)', expected: 'RESIGNATION' },
  { name: 'その他の申請', expected: null } // Not matched
];

testCases.forEach(test => {
  const router = new RequestRouter();
  const result = router.route({ name: test.name });
  console.log(`${test.name}: ${result === test.expected ? '✅' : '❌'}`);
});
```

## Priority Order

When multiple keywords could match, the first match in `REQUEST_TYPE_MAP` order wins:

1. NEW_HIRE
2. UNIFIED_CHANGE
3. SECONDMENT
4. LEAVE_RETURN
5. ALLOWANCE_CHANGE
6. RESIGNATION

**Note**: With exact keywords only, conflicts are unlikely.