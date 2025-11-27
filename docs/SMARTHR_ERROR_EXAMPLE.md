# SmartHR Error Notification - Example

## Scenario

A new hire request (ID: 839007) fails when attempting to create a crew record in SmartHR due to multiple validation errors.

## Input Error Message

```json
{
  "timestamp": "2025-11-17T23:58:00.807Z",
  "level": "ERROR",
  "message": "Failed to transfer to SmartHR for request 839007",
  "data": {
    "message": "SmartHR API error: 400 - {\"code\":1,\"type\":\"bad_request\",\"message\":\"不正なリクエストパラメータです。\",\"errors\":[{\"message\":\"業務内容は30文字以内で入力してください。\",\"resource\":\"Crew\",\"field\":\"occupation\"},{\"message\":\"従業員の住所（ヨミガナ）は全角カタカナで入力してください。\",\"resource\":\"Crew\",\"field\":\"literal_yomi\"},{\"message\":\"雇用保険の資格取得年月日は正しい形式で入力してください。\",\"resource\":\"Crew\",\"field\":\"emp_ins_qualified_at\"},{\"message\":\"社会保険の資格取得年月日は正しい形式で入力してください。\",\"resource\":\"Crew\",\"field\":\"soc_ins_qualified_at\"}]}",
    "stack": "Error: SmartHR API error: 400..."
  }
}
```

## Processing Flow

### 1. Error Detection
```
ErrorLogger.logRequestError() is called
├── Error logged to file: data/errors/error-REQUEST_PROCESSING-2025-11-17T23-58-00-807Z.log
└── EmailService.sendErrorNotification() is called
```

### 2. SmartHR Error Extraction
```
extractSmartHRError() parses the error message:
├── Finds pattern: SmartHR API error: 400 - {...}
├── Extracts JSON from error object
├── Parses validation errors array
└── Formats output:
    不正なリクエストパラメータです。
    
    Validation Errors:
    • occupation: 業務内容は30文字以内で入力してください。
    • literal_yomi: 従業員の住所（ヨミガナ）は全角カタカナで入力してください。
    • emp_ins_qualified_at: 雇用保険の資格取得年月日は正しい形式で入力してください。
    • soc_ins_qualified_at: 社会保険の資格取得年月日は正しい形式で入力してください。
```

### 3. Email Formatting
```
formatErrorEmail() creates HTML email:
├── Main section: Request details (ID, Name, Processor type)
├── SmartHR section: Extracted error message (YELLOW HIGHLIGHT)
├── Validation errors list (formatted with bullet points)
└── Footer: Timestamp
```

## Email Output

### Subject Line
```
[ERROR] Processing Failed - Request: 839007
```

### Email Body

```
🚨 Error Notification

Request ID:      839007
Request Name:    [Employee Name from Garoon]
Processor Type:  NEW_HIRE

SmartHR API Error

不正なリクエストパラメータです。

Validation Errors:
• occupation: 業務内容は30文字以内で入力してください。
• literal_yomi: 従業員の住所（ヨミガナ）は全角カタカナで入力してください。
• emp_ins_qualified_at: 雇用保険の資格取得年月日は正しい形式で入力してください。
• soc_ins_qualified_at: 社会保険の資格取得年月日は正しい形式で入力してください。

Timestamp: 2025-11-17T23:58:00.807Z
```

## What the Recipient Sees

1. **Immediate Understanding**: The yellow-highlighted SmartHR API Error section immediately draws attention
2. **Clear Cause**: Japanese error message explains what's wrong
3. **Actionable Information**: Each validation error shows:
   - **Field name** (e.g., `occupation`) - where to fix data
   - **Error message** (e.g., "30文字以内で入力してください") - how to fix it
4. **No Log Digging Required**: All necessary information in one email

## Data Fixes Needed

Based on the validation errors, the recipient would need to:

| Field | Issue | Fix |
|-------|-------|-----|
| `occupation` | Text exceeds 30 characters | Shorten job description to ≤30 chars |
| `literal_yomi` | Not full-width katakana | Convert address reading to full-width katakana |
| `emp_ins_qualified_at` | Invalid date format | Ensure employment insurance date is valid |
| `soc_ins_qualified_at` | Invalid date format | Ensure social insurance date is valid |

## Code Implementation

The entire flow is handled by:

```javascript
// In src/utils/error-logger.util.js
async logRequestError(requestId, requestName, error, additionalData = {}, failedData = null) {
  // ... log to file ...
  
  // Automatically sends email with SmartHR error extraction
  await this.emailService.sendErrorNotification({
    requestId,
    requestName,
    errorMessage: error.message,
    errorStack: error.stack,
    additionalData
  });
}
```

The `sendErrorNotification()` automatically:
1. Extracts SmartHR error if present
2. Formats it beautifully
3. Sends to configured recipient
4. Handles failures gracefully
