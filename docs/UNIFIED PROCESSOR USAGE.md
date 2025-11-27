# Unified Employee Change Processor

Handles employee transfers, promotions, demotions, and salary changes that use "Details" fields in Garoon.

## Flow

```
BigQuery Request Data
  ↓
Parse "Details" fields → Extract employee records
  ↓
For each record:
  1. Extract Employee Code
  2. Fetch employee from SmartHR (GET /crews?emp_code=XXX)
  3. Parse change data (salary/allowance/department)
  4. Update SmartHR (PATCH /crews/:id)
  5. Log to BigQuery
```

## Example Details Field Format

### Input (Garoon Form Field)

```
Field Name: Details1 (明細1)
Field Value:
社員コード: 400SSSS
スタッフ名: Shibata Masafumi
勤務地: Nishi Ward, Nagoya City
単価変更日: June 1st
単価区分: Salary
単価:
  旧: Hourly wage 11,900 yen
  新: Monthly salary 200,000 yen
理由: Salary unit price changes as it becomes a monthly salary from June
```

### Parsed Output

```json
{
  "Employee Code": "400SSSS",
  "Staff Name": "Shibata Masafumi",
  "Work location": "Nishi Ward, Nagoya City",
  "Unit Price Change Date": "June 1st",
  "Unit Classification": "Salary",
  "Unit Price": {
    "Previous": "Hourly wage 11,900 yen",
    "New": "Monthly salary 200,000 yen"
  },
  "Reason": "Salary unit price changes as it becomes a monthly salary from June"
}
```

### SmartHR API Call

```json
PATCH /crews/12345
{
  "employee_id": "12345",
  "effective_date": "2025-06-01",
  "salary": {
    "amount": 200000
  }
}
```

## Usage

### From BigQuery Data

```javascript
import { UnifiedEmployeeChangeProcessor } from './src/processors/unified-employee-change.processor.js';

const processor = new UnifiedEmployeeChangeProcessor();

// BigQuery data format
const bqData = {
  request: {
    request_id: "REQ123",
    request_name: "Employee Changes"
  },
  formFields: [
    {
      field_code: "$5",
      field_name: "明細1",
      field_name_eng: "Details1",
      field_value: "社員コード: 400SSSS\nスタッフ名: Shibata Masafumi..."
    }
  ]
};

const result = await processor.process(bqData);
// {
//   success: true,
//   total: 1,
//   successful: 1,
//   failed: 0,
//   results: [...]
// }
```

### Using ProcessorFactory (Auto-Detection)

```javascript
import { ProcessorFactory } from './src/processors/processor.factory.js';

const factory = new ProcessorFactory();

// Automatically detects "Details" fields and uses unified processor
const result = await factory.processRequest(bqData);
```

## Supported Change Types

### 1. Salary Changes

**Fields**: `Unit Price`, `Salary`, `Base Salary`

**Format**:
- Object: `{ Previous: "11,900 yen", New: "200,000 yen" }`
- String: "200,000 yen" or "200000"

**Output**:
```json
{
  "salary": {
    "amount": 200000
  }
}
```

### 2. Allowance Changes

**Fields**: 
- `Housing Allowance` (住宅手当)
- `Transport Allowance` (通勤手当)
- `Family Allowance` (家族手当)

**Output**:
```json
{
  "allowance": {
    "housing": 50000,
    "transport": 10000,
    "family": 5000
  }
}
```

### 3. Department Changes

**Fields**: `Department`, `New Department`

**Output**:
```json
{
  "department_id": "D789"
}
```

### 4. Position Changes

**Fields**: `Position`, `New Position`

**Output**:
```json
{
  "position": "Manager"
}
```

## Complete Example

### Garoon Details Field

```
社員コード: 400SSSS
スタッフ名: Shibata Masafumi
発令日: 2025年6月1日
新基本給: 250,000円
住宅手当: 50,000円
通勤手当: 15,000円
異動先部署: Engineering
新職位: Senior Engineer
理由: Annual review promotion
```

### Processed SmartHR Update

```json
{
  "employee_id": "emp_12345",
  "effective_date": "2025-06-01",
  "salary": {
    "amount": 250000
  },
  "allowance": {
    "housing": 50000,
    "transport": 15000
  },
  "department_id": "Engineering",
  "position": "Senior Engineer"
}
```

## Details Parser

### Key Features

1. **Multi-line parsing**: Handles newline-delimited key-value pairs
2. **Japanese/English fields**: Normalizes field names
3. **Unit Price parsing**: Extracts Previous/New values
4. **Date parsing**: Supports Japanese date formats (6月1日)
5. **Amount parsing**: Handles currency symbols (円, ¥, commas)

### Supported Date Formats

- Japanese: "6月1日" → "2025-06-01"
- ISO: "2025-06-01"
- Slash: "2025/06/01"
- Natural: "June 1st, 2025"

### Supported Amount Formats

- "200,000円" → 200000
- "¥200,000" → 200000
- "200000 yen" → 200000
- "Hourly wage 11,900 yen" → 11900

## Field Name Normalization

Japanese → English mapping:

```javascript
{
  '社員コード': 'Employee Code',
  'スタッフ名': 'Staff Name',
  '発令日': 'Effective Date',
  '新基本給': 'Base Salary',
  '住宅手当': 'Housing Allowance',
  '通勤手当': 'Transport Allowance',
  // ... etc
}
```

## Error Handling

### Per-Record Error Handling

Each detail record is processed independently. If one fails, others continue:

```json
{
  "success": true,
  "total": 3,
  "successful": 2,
  "failed": 1,
  "results": [
    { "success": true, "employeeCode": "400AAA" },
    { "success": false, "employeeCode": "400BBB", "error": "Employee not found" },
    { "success": true, "employeeCode": "400CCC" }
  ]
}
```

### Common Errors

1. **Employee Code missing**: "Employee Code is missing"
2. **Employee not found**: "Employee not found in SmartHR: 400XXX"
3. **No effective date**: "Effective date is missing"
4. **SmartHR API error**: "SmartHR API error: 400 - ..."

### Retry Logic

- 3 attempts with exponential backoff
- Applies to SmartHR API calls only
- Logs each retry attempt

## BigQuery Logging

Logs to `employee_process_logs` table:

```sql
CREATE TABLE employee_process_logs (
  request_id STRING,
  process_type STRING,  -- 'UNIFIED_EMPLOYEE_CHANGE'
  employee_id STRING,
  employee_code STRING,
  staff_name STRING,
  effective_date DATE,
  has_salary_change BOOLEAN,
  has_allowance_change BOOLEAN,
  has_department_change BOOLEAN,
  has_position_change BOOLEAN,
  salary_amount FLOAT64,
  change_reason STRING,
  status STRING,  -- 'COMPLETED' or 'ERROR'
  error_message STRING,
  processed_at TIMESTAMP
);
```

## Testing

### Test with Mock Data

```javascript
const mockBQData = {
  request: {
    request_id: "TEST123"
  },
  formFields: [
    {
      field_name_eng: "Details1",
      field_value: `Employee Code: 400TEST
Staff Name: Test User
Effective Date: 2025-06-01
Base Salary: 300000
Housing Allowance: 50000
Reason: Test promotion`
    }
  ]
};

const processor = new UnifiedEmployeeChangeProcessor();
const result = await processor.process(mockBQData);
console.log(result);
```

### Test Parser Separately

```javascript
import { DetailsParserUtil } from './src/utils/details-parser.util.js';

const parser = new DetailsParserUtil();

const details = parser.parseDetailValue(`
Employee Code: 400TEST
Staff Name: Test User
Unit Price: Previous: 100000 New: 150000
`);

console.log(details);
// {
//   "Employee Code": "400TEST",
//   "Staff Name": "Test User",
//   "Unit Price": { "Previous": "100000", "New": "150000" }
// }
```

## Integration with Main ETL

Currently **not integrated** into index.js. To integrate:

1. Modify `etl.orchestrator.js` to check for Details fields
2. Route to UnifiedEmployeeChangeProcessor
3. Update offset tracking after batch processing

Example integration:

```javascript
// In etl.orchestrator.js
async execute() {
  const request = await this.fetchValidRequest(offset);
  const bqData = await this.garoonToBQTransformer.transform(request);
  
  // Check if request has Details fields
  const hasDetails = bqData.formFields.some(f => 
    f.field_name_eng?.startsWith('Details')
  );
  
  if (hasDetails) {
    // Use unified processor
    const processor = new UnifiedEmployeeChangeProcessor();
    const result = await processor.process(bqData);
  } else {
    // Use existing new hire flow
    // ...
  }
}
```

## API Endpoints Used

### SmartHR API

1. **GET /crews?emp_code={code}**
   - Fetch employee by employee code
   - Returns: `[{ id, emp_code, ... }]`

2. **PATCH /crews/{id}**
   - Update employee data
   - Body: Salary, allowances, department, position
   - Returns: Updated employee object

## Performance Considerations

### Batch Processing

For requests with multiple Details records:
- Processes sequentially (not parallel)
- Each record = 2 API calls (GET + PATCH)
- 10 records = ~20 API calls

### Optimization Options

1. **Cache employee lookups** within same request
2. **Batch PATCH requests** if API supports it
3. **Parallel processing** with rate limiting

## Troubleshooting

### Issue: Employee not found

**Cause**: Employee code mismatch between Garoon and SmartHR

**Solution**:
1. Check employee code format (leading zeros, etc.)
2. Verify employee exists in SmartHR
3. Check `emp_code` field mapping

### Issue: Date parsing fails

**Cause**: Unsupported date format

**Solution**: Update `parseDate()` method in processor

### Issue: Amount parsing returns 0

**Cause**: Unexpected currency format

**Solution**: Update `parseAmount()` regex patterns

### Issue: No Details fields detected

**Cause**: Field name doesn't match pattern

**Solution**: Check field name contains "Details" or "明細"