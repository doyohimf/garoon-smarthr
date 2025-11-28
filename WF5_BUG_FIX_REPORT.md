# WF#5 Bug Fix - Null Date Handling

**Date:** November 27, 2025  
**Issue:** TypeError when changeDate is undefined  
**Status:** ✅ FIXED

---

## Problem Description

```
Error: Cannot read properties of undefined (reading 'trim')
  at DateUtil.parseDate (date.util.js:24:32)
  at EmployeeAllowanceChangeProcessor.process (allowance-change.processor.js:39:31)
```

The error occurred when `changeDate` was `undefined` in the allowance data extraction, causing `DateUtil.parseDate()` to fail when trying to call `.trim()` on undefined.

---

## Root Cause

1. **DateUtil.parseDate()** immediately called `.trim()` without checking if input was undefined
2. **EmployeeAllowanceChangeProcessor.process()** didn't validate changeDate before using it
3. **Missing null checks** on extracted form field values

---

## Changes Made

### 1. DateUtil.parseDate() - Enhanced Validation

**File:** `src/utils/date.util.js`

**Before:**
```javascript
static parseDate(dateString) {
  const trimmed = dateString.trim();  // ❌ Crashes if undefined
  // ...
}
```

**After:**
```javascript
static parseDate(dateString) {
  if (!dateString) {
    throw new Error('DateUtil.parseDate: dateString is required and cannot be empty');
  }

  const trimmed = dateString.toString().trim();  // ✅ Safe checks + toString()
  // ...
}
```

**Improvements:**
- Checks if dateString is null/undefined before processing
- Converts to string first (safe for various types)
- Throws meaningful error with context

### 2. EmployeeAllowanceChangeProcessor.process() - Pre-Processing Validation

**File:** `src/processors/allowance-change.processor.js`

**Before:**
```javascript
const allowanceData = await this.extractAllowanceData(garoonRequest);
// No validation, directly uses changeDate
const isChangeDateToday = DateUtil.isToday(allowanceData.changeDate);
```

**After:**
```javascript
const allowanceData = await this.extractAllowanceData(garoonRequest);

if (!allowanceData.changeDate) {
  logger.warn('Missing required fields: Change Date is required.');
  return { success: false, error: 'Missing change date' };
}

let isChangeDateToday = false;
try {
  isChangeDateToday = DateUtil.isToday(allowanceData.changeDate);
  logger.info(`Change date "${allowanceData.changeDate}" is today? ${isChangeDateToday}`);
} catch (dateError) {
  logger.error(`Error checking if date is today: ${allowanceData.changeDate}`, dateError);
  isChangeDateToday = false;
}
```

**Improvements:**
- Validates changeDate is not null/undefined before using
- Wraps date checking in try-catch
- Returns error response instead of throwing
- Graceful degradation on date errors

### 3. EmployeeAllowanceChangeProcessor.extractAllowanceData() - Debug Logging

**File:** `src/processors/allowance-change.processor.js`

**Added:**
```javascript
logger.debug(`Extracted fields - employeeCode: ${employeeCode}, allowanceName: ${allowanceName}, changeDate: ${changeDate}, changeAmount: ${changeAmount}`);
```

**Benefit:**
- Helps identify missing fields during debugging
- Logs before processing ensures visibility

### 4. Database Insertion Error Handling

**Added try-catch around BigQuery insert:**
```javascript
try {
  await this.allowanceWorkflowRepository.insertAllowanceWorkflow({
    // ...
  });
} catch (dbError) {
  logger.error(`Error storing to allowances_workflow`, dbError);
  return { success: false, error: 'Failed to store workflow data' };
}
```

---

## Impact

### Fixed Issues
✅ No more undefined trim errors  
✅ Missing changeDate is caught early  
✅ Better error messages for debugging  
✅ Graceful handling of missing fields  

### Backward Compatibility
✅ No breaking changes  
✅ Existing valid requests work same as before  
✅ Invalid requests handled gracefully  

### Error Responses
```javascript
// Missing employee code
{ success: false, error: 'Missing employee code' }

// Missing change date
{ success: false, error: 'Missing change date' }

// Database insertion failure
{ success: false, error: 'Failed to store workflow data' }
```

---

## Testing

### Test Case 1: Valid Request (Should Pass)
```
Input: changeDate = "2025-11-27"
Expected: Processing continues, no error
Result: ✅ PASS
```

### Test Case 2: Missing changeDate (Should Fail Gracefully)
```
Input: changeDate = undefined or null
Expected: Returns { success: false, error: 'Missing change date' }
Result: ✅ PASS
```

### Test Case 3: Invalid Date Format (Should Handle)
```
Input: changeDate = "invalid"
Expected: DateUtil throws error, caught by processor
Result: ✅ PASS - Returns { success: true, transmitted: false } (stored for later)
```

### Test Case 4: Empty String (Should Fail)
```
Input: changeDate = ""
Expected: Returns { success: false, error: 'Missing change date' }
Result: ✅ PASS
```

---

## Logging Examples

### Valid Date
```
DEBUG: Extracted fields - employeeCode: EMP001, allowanceName: 職位手当, changeDate: 2025-11-27, changeAmount: 50000
INFO: Change date "2025-11-27" is today? true
```

### Missing Date
```
DEBUG: Extracted fields - employeeCode: EMP001, allowanceName: 職位手当, changeDate: undefined, changeAmount: 50000
WARN: Missing required fields: Change Date is required.
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/utils/date.util.js` | Added null check in parseDate() |
| `src/processors/allowance-change.processor.js` | Added validation and error handling |

---

## Prevention Measures

1. **Input Validation:** All date inputs validated before use
2. **Error Handling:** Try-catch blocks for date operations
3. **Logging:** Debug logs for field extraction
4. **Graceful Degradation:** Errors don't crash the system
5. **Type Safety:** toString() conversion for safety

---

## How to Avoid Similar Issues

**For Developers:**
- Always validate inputs before calling methods
- Use try-catch for operations that can fail
- Add early validation checks for required fields
- Log extracted values for debugging
- Never assume values are defined

**Code Pattern:**
```javascript
// ❌ BAD - No validation
const result = someUtil.process(userData.field);

// ✅ GOOD - With validation
if (!userData.field) {
  logger.warn('Missing required field');
  return { success: false, error: 'Missing field' };
}

try {
  const result = someUtil.process(userData.field);
} catch (error) {
  logger.error('Error processing field', error);
  return { success: false, error: error.message };
}
```

---

## Rollout Notes

- No database migrations needed
- No configuration changes required
- No API changes
- Drop-in replacement for existing files
- All fixes are backward compatible

---

## Summary

The bug occurred due to missing null validation on the changeDate field. The fix adds comprehensive input validation at multiple levels:

1. **DateUtil:** Validates input is not null before processing
2. **Processor:** Validates changeDate exists before using
3. **Process:** Wraps operations in try-catch for robustness
4. **Logging:** Added debug output for troubleshooting

All changes maintain backward compatibility while significantly improving error handling and robustness.

---

**Status:** ✅ FIXED AND TESTED  
**No Further Issues Expected**
