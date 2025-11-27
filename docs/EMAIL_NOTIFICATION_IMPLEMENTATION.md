# Email Notification System - Implementation Summary

## What Was Implemented

Error detection now triggers automatic email notifications to configured recipients based on SMTP settings in `.env`.

## Files Created

### 1. Email Service (`src/services/email.service.js`)
- Manages SMTP connection and email sending
- Sends error notifications with full context
- Optionally sends success notifications
- Formats emails as HTML with detailed information
- Tests SMTP connectivity

### 2. Email Notification Tester (`src/utils/email-notification.tester.js`)
- Tests SMTP connection
- Sends sample error notification
- Sends sample success notification
- Can be run independently: `node src/utils/email-notification.tester.js`

### 3. Documentation (`EMAIL_NOTIFICATIONS.md`)
- Complete setup and usage guide
- Configuration reference
- Testing instructions
- Troubleshooting guide

## Files Modified

### `src/utils/error-logger.util.js`
- Integrated EmailService
- `logRequestError()` now sends email notifications
- `logProcessorError()` now sends email notifications
- No changes to file logging behavior

## Configuration

Email setup is already in `.env`:

```
SMTP__HOST=red-koala-0a1239ffb68d8722.znlc.jp
SMTP__PORT=465
SMTP__USER=kyuuyo-fromdb@jc-grp.com
SMTP__PASS=say6_wB3PMJb
SMTP__FROM=kyuuyo-fromdb@jc-grp.com
SMTP__TO=doyohim.f@sprobe.com
```

## How It Works

1. When an error occurs in any ETL orchestrator, `ErrorLogger.logRequestError()` or `logRequestError.logProcessorError()` is called
2. Error is logged to file as before
3. EmailService automatically sends notification email to `SMTP__TO` recipient
4. Email includes:
   - Request ID and name
   - Error message and stack trace
   - Processor type and context
   - Timestamp

## Automatic Integration

The system automatically works with all ETL orchestrators:
- etl-1.orchestrator.js (New Hire)
- etl-2.orchestrator.js (Employee Change)
- etl-3.orchestrator.js (Leave)
- etl-4.orchestrator.js (Allowance Change)
- etl-5.orchestrator.js (Promotion/Secondment)
- etl-6.orchestrator.js (Resignation/Transfer)
- etl.orchestrator.js (General)

## Dependencies

Added: `nodemailer` (npm package for email sending)

## Testing

To verify email notifications work:

```bash
node src/utils/email-notification.tester.js
```

## SmartHR Error Extraction Feature

The email service automatically detects and extracts SmartHR API errors from error messages.

### What it does:
1. **Parses SmartHR API errors** from the format: `SmartHR API error: 400 - {...}`
2. **Extracts validation errors** with field names and descriptions
3. **Displays prominently** in email with yellow highlighting
4. **Shows field-specific messages** in an easy-to-read format

### Example Email Output:

When a SmartHR validation error occurs, the email shows:
```
SmartHR API Error

不正なリクエストパラメータです。

Validation Errors:
• occupation: 業務内容は30文字以内で入力してください。
• literal_yomi: 従業員の住所（ヨミガナ）は全角カタカナで入力してください。
• emp_ins_qualified_at: 雇用保険の資格取得年月日は正しい形式で入力してください。
• soc_ins_qualified_at: 社会保険の資格取得年月日は正しい形式で入力してください。
```

This allows quick identification of which fields have validation issues without digging through logs.

## Features

✅ Automatic error notifications
✅ HTML formatted emails
✅ **SmartHR API error message extraction** (highlighted in email)
✅ **Validation error details** (field names + messages)
✅ Complete error context included
✅ SMTP connection verification
✅ Graceful failure handling (warnings if email fails)
✅ Optional success notifications
✅ Custom recipient support
✅ Integration with existing error logging
