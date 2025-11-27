# SmartHR Error Extraction Feature

## Overview

When errors from SmartHR API occur during ETL processing, the email notification system automatically extracts and displays validation error details in a human-readable format.

## Before and After

### Before (Without Smart Extraction)
```
Error: SmartHR API error: 400 - {"code":1,"type":"bad_request","message":"...","errors":[...]}
```
❌ Recipient has to parse JSON manually

### After (With Smart Extraction)
```
SmartHR API Error

不正なリクエストパラメータです。

Validation Errors:
• occupation: 業務内容は30文字以内で入力してください。
• literal_yomi: 従業員の住所（ヨミガナ）は全角カタカナで入力してください。
```
✅ Clear, actionable information in email

## How to Use (It's Automatic!)

No code changes needed. When an error occurs:

```javascript
// In any ETL orchestrator...
try {
  await smartHRService.createCrew(data);
} catch (error) {
  // This automatically:
  // 1. Logs error to file
  // 2. Detects if it's a SmartHR error
  // 3. Extracts validation fields
  // 4. Sends formatted email
  await errorLogger.logRequestError(requestId, requestName, error, additionalData);
}
```

That's it. The email service handles everything automatically.

## What Gets Extracted

From this SmartHR API response:
```json
{
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

The system extracts:
- **Main message**: "不正なリクエストパラメータです。"
- **Field errors**: Each field with its validation message

## Email Display

The extracted information appears in the email with:

- **Yellow highlight** - Draws attention to SmartHR errors
- **Field names** - Shows exactly which fields failed
- **Error messages** - Explains what's wrong with each field
- **Bullet format** - Easy to scan

```
┌─────────────────────────────────────────┐
│ SmartHR API Error                       │ ← Yellow background
│                                         │
│ 不正なリクエストパラメータです。        │
│                                         │
│ Validation Errors:                      │
│ • occupation: 業務内容は30文字以内...  │
│ • literal_yomi: 従業員の住所（ヨミガナ...│
└─────────────────────────────────────────┘
```

## Testing It

```bash
# Test SMTP connection and send sample emails
node src/utils/email-notification.tester.js
```

## Configuration

All set in `.env`:
```
SMTP__HOST=red-koala-0a1239ffb68d8722.znlc.jp
SMTP__PORT=465
SMTP__USER=kyuuyo-fromdb@jc-grp.com
SMTP__PASS=say6_wB3PMJb
SMTP__FROM=kyuuyo-fromdb@jc-grp.com
SMTP__TO=doyohim.f@sprobe.com
```

No changes needed - it's ready!

## Files Involved

### Code
- `src/services/email.service.js` - Main email service
  - `extractSmartHRError()` - Extracts validation errors
  - `formatErrorEmail()` - Creates HTML email with formatting

- `src/utils/error-logger.util.js` - Calls EmailService
  - `logRequestError()` - Automatically triggers email
  - `logProcessorError()` - Automatically triggers email

### Testing
- `src/utils/email-notification.tester.js` - Test utility

### Documentation
- `SMARTHR_ERROR_EXTRACTION_SUMMARY.md` - Quick reference
- `SMARTHR_ERROR_EXTRACTION.md` - Technical deep dive
- `SMARTHR_ERROR_VISUAL_GUIDE.md` - Visual diagrams
- `SMARTHR_ERROR_EXAMPLE.md` - Real-world example
- And more...

## How It Works (Technical)

### Detection
Regex pattern: `SmartHR API error: (\d+) - ({.*?})\s*$/s`

This matches:
- "SmartHR API error:" prefix
- HTTP status code (e.g., 400)
- JSON error object

### Parsing
1. Extract JSON string from error message
2. Parse as JSON object
3. Read `message` field (main error)
4. Read `errors` array (validation details)
5. Format as human-readable text

### Formatting
```javascript
// Input error object
{
  message: "不正なリクエストパラメータです。",
  errors: [
    { field: "occupation", message: "業務内容は30文字以内で入力してください。" },
    { field: "literal_yomi", message: "従業員の住所（ヨミガナ）は全角カタカナで入力してください。" }
  ]
}

// Output text
"不正なリクエストパラメータです。

Validation Errors:
• occupation: 業務内容は30文字以内で入力してください。
• literal_yomi: 従業員の住所（ヨミガナ）は全角カタカナで入力してください。"
```

## Error Handling

### What if extraction fails?
- Silent failure - returns null
- Email still sent with generic error section
- No exceptions thrown
- Processing unaffected

### What if SMTP fails?
- Error logged
- Email not sent
- Processing continues
- File logging still works

### What if email service not initialized?
- Warning logged
- Email notification skipped
- Processing continues

All failures are graceful - the system is very robust.

## Supported SmartHR Errors

✅ 400 Bad Request (validation errors)
✅ Multiple field validation errors
✅ Japanese error messages
✅ Nested error objects

Other errors fall back to generic error display.

## Benefits

1. **Recipient doesn't need to:**
   - Parse JSON
   - Look at logs
   - Debug the error manually

2. **Immediate actionable info:**
   - Which fields failed
   - What's wrong with each field
   - How to fix the data

3. **Full language support:**
   - Japanese error messages intact
   - Japanese field names
   - No translation needed

4. **Professional presentation:**
   - HTML formatted
   - Color highlighting
   - Easy to read

## Integration with ETL

The feature is **automatically integrated** with all ETL orchestrators:

| ETL | File | Trigger |
|-----|------|---------|
| 1 | etl-1.orchestrator.js | New Hire error |
| 2 | etl-2.orchestrator.js | Employee Change error |
| 3 | etl-3.orchestrator.js | Leave error |
| 4 | etl-4.orchestrator.js | Allowance error |
| 5 | etl-5.orchestrator.js | Promo/Secondment error |
| 6 | etl-6.orchestrator.js | Resignation/Transfer error |
| General | etl.orchestrator.js | Any processing error |

When an error occurs, EmailService automatically:
1. Detects if it's a SmartHR error
2. Extracts validation fields
3. Formats beautifully
4. Sends email

## Example Email

**Subject:** `[ERROR] Processing Failed - Request: 839007`

**Body:**
```
🚨 Error Notification

Request ID: 839007
Request Name: 新入社員: 山田太郎
Processor Type: NEW_HIRE

SmartHR API Error

不正なリクエストパラメータです。

Validation Errors:
• occupation: 業務内容は30文字以内で入力してください。
• literal_yomi: 従業員の住所（ヨミガナ）は全角カタカナで入力してください。
• emp_ins_qualified_at: 雇用保険の資格取得年月日は正しい形式で入力してください。
• soc_ins_qualified_at: 社会保険の資格取得年月日は正しい形式で入力してください。

Timestamp: 2025-11-17T23:58:00.807Z
```

## Customization

### Change recipient
Edit `.env`:
```
SMTP__TO=your-email@example.com
```

### Change email styling
Edit `src/services/email.service.js`:
- `formatErrorEmail()` method
- Modify color/styling as needed

### Add more fields to extraction
Edit `extractSmartHRError()` method:
- Add additional JSON fields
- Enhance formatting

## Ready to Use

✅ No setup needed
✅ Automatically integrated
✅ Configuration complete
✅ Ready for production

When errors occur, you'll receive detailed, actionable notification emails!

---

**Last Updated**: November 18, 2025
