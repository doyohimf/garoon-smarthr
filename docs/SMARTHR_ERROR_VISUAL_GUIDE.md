# SmartHR Error Extraction - Visual Guide

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Error Occurs in ETL Pipeline (e.g., SmartHR API call)      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Error Object Created with Message:                          │
│ "SmartHR API error: 400 - {...validation errors...}"        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ ErrorLogger.logRequestError() called                        │
│ ├─ Logs error to: data/errors/error-REQUEST_*.log          │
│ └─ Calls: EmailService.sendErrorNotification()             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ EmailService.sendErrorNotification()                        │
│ └─ Calls: extractSmartHRError(errorDetails)                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ extractSmartHRError() - Parsing                            │
│ ├─ Regex: /SmartHR API error: (\d+) - ({.*?})\s*$/s        │
│ ├─ Finds: HTTP code + JSON object                          │
│ └─ Returns: formatted error string OR null                 │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │ Extraction Result       │
        │                        │
        ▼                        ▼
    [SmartHR Error]         [No SmartHR Error]
        │                        │
        ├─ Parse JSON            └─ Use original message
        ├─ Extract main msg          (generic error section)
        ├─ Extract field errors
        └─ Format output
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ formatErrorEmail() - Email Rendering                       │
│ ├─ Request details (header)                                │
│ ├─ SmartHR API Error Section [YELLOW]                      │
│ │  ├─ Main error message (Japanese)                        │
│ │  └─ Validation errors list (field: message)              │
│ ├─ Additional info (optional)                              │
│ └─ Timestamp                                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ SMTP Send Email                                            │
│ ├─ Subject: [ERROR] Processing Failed - Request: XXX      │
│ └─ Body: HTML formatted email                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Email Delivered to: SMTP__TO recipient                     │
│ (doyohim.f@sprobe.com by default)                          │
└─────────────────────────────────────────────────────────────┘
```

## Input vs Output

### Input (Error Stack)
```
Error: SmartHR API error: 400 - {
  "code": 1,
  "type": "bad_request",
  "message": "不正なリクエストパラメータです。",
  "errors": [
    {
      "message": "業務内容は30文字以内で入力してください。",
      "resource": "Crew",
      "field": "occupation"
    },
    {
      "message": "従業員の住所（ヨミガナ）は全角カタカナで入力してください。",
      "resource": "Crew",
      "field": "literal_yomi"
    }
  ]
}
```

### Processing
```
1. Detect SmartHR API error ✓
2. Extract JSON object ✓
3. Parse JSON ✓
4. Format error output:
   - Main message: "不正なリクエストパラメータです。"
   - Field 1: occupation → "業務内容は30文字以内で入力してください。"
   - Field 2: literal_yomi → "従業員の住所（ヨミガナ）は全角カタカナで入力してください。"
```

### Output (Email Display)
```
┌─ HEADER ─────────────────────────────────────────┐
│ Request ID: 839007                               │
│ Request Name: [Employee Name]                    │
│ Processor Type: NEW_HIRE                         │
└──────────────────────────────────────────────────┘

┌─ SmartHR API Error [YELLOW HIGHLIGHT] ─────────┐
│                                                  │
│ 不正なリクエストパラメータです。                │
│                                                  │
│ Validation Errors:                              │
│ • occupation: 業務内容は30文字以内で入力し...  │
│ • literal_yomi: 従業員の住所（ヨミガナ）は... │
│                                                  │
└──────────────────────────────────────────────────┘
```

## Code Flow

```javascript
sendErrorNotification(errorDetails) {
  │
  ├─► extractSmartHRError(errorDetails)
  │   │
  │   ├─ Match regex pattern
  │   ├─ Extract JSON string
  │   ├─ JSON.parse(jsonStr)
  │   ├─ Format validation errors
  │   └─ Return formatted string OR null
  │
  ├─ formatErrorEmail({
  │     ...errorDetails,
  │     smarthrError: extractedError
  │   })
  │   │
  │   └─ If (smarthrError) {
  │       ├─ Render SmartHR section [YELLOW]
  │       ├─ escapeHtml(smarthrError)
  │       └─ Display with formatting
  │     } Else {
  │       ├─ Render generic error section
  │       └─ escapeHtml(errorMessage)
  │     }
  │
  └─ transporter.sendMail(mailOptions)
     └─ SENT ✓
```

## Error Handling

```
What if extraction fails?

extractSmartHRError()
  │
  ├─ Try: Regex match + JSON parse
  │
  └─ Catch: Return null
       │
       └─► formatErrorEmail() uses generic error section instead
           (graceful degradation - email still sent)
```

## Comparison

### Before (Generic Error)
```
Error Message: SmartHR API error: 400 - {\"code\":1,\"type\":\"bad_request\",...}

[Long stack trace displayed]

Recipient has to parse JSON manually to find validation errors ❌
```

### After (SmartHR Extraction)
```
SmartHR API Error [YELLOW]

不正なリクエストパラメータです。

Validation Errors:
• occupation: 業務内容は30文字以内で入力してください。
• literal_yomi: 従業員の住所（ヨミガナ）は全角カタカナで入力してください。

Recipient immediately sees which fields need fixing ✓
```

## Performance

- **Extraction time**: < 1ms (simple regex + JSON parse)
- **Email size**: Similar (formatted text is comparable to raw JSON)
- **Processing**: Happens during email send (no additional overhead)

## Supported Error Types

✓ SmartHR validation errors (400 Bad Request)
✓ Multiple field validation errors
✓ Japanese error messages
✓ Nested error details

Other errors fall back to generic error display ✓
