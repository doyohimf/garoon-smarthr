# Email Notification System - Complete Documentation Index

## Overview

The email notification system automatically sends error alerts to configured recipients when ETL processing fails. SmartHR API errors are intelligently extracted and displayed with field-level validation details.

## Core Features

✅ Automatic error detection and notification
✅ SmartHR API error extraction with validation details
✅ HTML formatted emails with rich styling
✅ Full Japanese language support
✅ Graceful error handling
✅ SMTP configuration via .env
✅ Email logging and testing utilities

## Configuration

**Location**: `.env` file

```
SMTP__HOST=red-koala-0a1239ffb68d8722.znlc.jp
SMTP__PORT=465
SMTP__USER=kyuuyo-fromdb@jc-grp.com
SMTP__PASS=say6_wB3PMJb
SMTP__FROM=kyuuyo-fromdb@jc-grp.com
SMTP__TO=doyohim.f@sprobe.com
```

## Documentation Files

### Getting Started
- **[EMAIL_NOTIFICATIONS.md](./EMAIL_NOTIFICATIONS.md)** - Complete setup and usage guide
  - Configuration details
  - Service methods
  - Recipient management
  - Troubleshooting

- **[EMAIL_NOTIFICATION_IMPLEMENTATION.md](./EMAIL_NOTIFICATION_IMPLEMENTATION.md)** - Implementation overview
  - What was implemented
  - Files created and modified
  - How it works
  - Dependencies

### SmartHR Error Extraction
- **[SMARTHR_ERROR_EXTRACTION_SUMMARY.md](./SMARTHR_ERROR_EXTRACTION_SUMMARY.md)** - Quick reference (START HERE)
  - What changed
  - Key features
  - Benefits
  - Implementation details

- **[SMARTHR_ERROR_EXTRACTION.md](./SMARTHR_ERROR_EXTRACTION.md)** - Technical deep dive
  - Error detection pattern
  - Parsing process
  - Formatted output
  - Code reference

- **[SMARTHR_ERROR_VISUAL_GUIDE.md](./SMARTHR_ERROR_VISUAL_GUIDE.md)** - Visual flowcharts
  - Process flow diagram
  - Input/output comparison
  - Code flow
  - Before/after comparison

- **[SMARTHR_ERROR_EXAMPLE.md](./SMARTHR_ERROR_EXAMPLE.md)** - Real-world example
  - Request 839007 walkthrough
  - Error parsing example
  - Data fixes needed
  - Email output sample

## Implementation Files

### Email Service
**Location**: `src/services/email.service.js`
- Main email sending functionality
- SMTP configuration
- SmartHR error extraction
- HTML email formatting

### Error Logger Integration
**Location**: `src/utils/error-logger.util.js`
- Automatic email notifications on error
- File logging + email sending
- Request and processor error handling

### Testing Utility
**Location**: `src/utils/email-notification.tester.js`
- SMTP connection verification
- Test error notification
- Test success notification
- Can be run standalone

## Quick Start Guide

### 1. Verify Configuration
Check `.env` file has SMTP settings configured:
```bash
grep SMTP__ .env
```

### 2. Test Email System
```bash
node src/utils/email-notification.tester.js
```

### 3. System is Ready
Error notifications now automatically send when:
- ETL processing fails
- Request processing encounters errors
- Processor operations fail

## Email Examples

### SmartHR Validation Error Email
```
Subject: [ERROR] Processing Failed - Request: 839007

🚨 Error Notification

Request ID: 839007
Request Name: [Employee Name]
Processor Type: NEW_HIRE

[YELLOW SECTION]
SmartHR API Error

不正なリクエストパラメータです。

Validation Errors:
• occupation: 業務内容は30文字以内で入力してください。
• literal_yomi: 従業員の住所（ヨミガナ）は全角カタカナで入力してください。
• emp_ins_qualified_at: 雇用保険の資格取得年月日は正しい形式で入力してください。
• soc_ins_qualified_at: 社会保険の資格取得年月日は正しい形式で入力してください。

Timestamp: 2025-11-17T23:58:00.807Z
```

### Generic Error Email
```
Subject: [ERROR] Processing Failed - Request: XXX

🚨 Error Notification

Request ID: XXX
Request Name: [Name]
Processor Type: [TYPE]

Error Message:
[Full error message]

Additional Information:
[Context details]

Stack Trace:
[Stack trace if available]

Timestamp: [ISO timestamp]
```

## Key Benefits

### For Developers
- Detailed error context in emails
- Stack traces for debugging
- Field-level validation information
- No need to access logs manually

### For Operations
- Immediate error alerts
- Clear indication of which fields failed
- Japanese error messages from SmartHR
- Actionable information for fixes

### For System
- Automatic error tracking
- Email notifications + file logging
- Graceful degradation if email fails
- No impact on ETL processing

## Recipient Configuration

### Default Recipient
Set in `.env`:
```
SMTP__TO=doyohim.f@sprobe.com
```

### Custom Recipient per Email
```javascript
await emailService.sendErrorNotification(errorDetails, 'custom@example.com');
```

### Multiple Recipients
Send multiple emails by calling method multiple times:
```javascript
await emailService.sendErrorNotification(errorDetails, 'recipient1@example.com');
await emailService.sendErrorNotification(errorDetails, 'recipient2@example.com');
```

## Automatic Integration Points

The email system automatically integrates with:

| Component | File | Trigger |
|-----------|------|---------|
| ETL-1 (New Hire) | `src/orchestrator/etl-1.orchestrator.js` | Processing failure |
| ETL-2 (Employee Change) | `src/orchestrator/etl-2.orchestrator.js` | Processing failure |
| ETL-3 (Leave) | `src/orchestrator/etl-3.orchestrator.js` | Processing failure |
| ETL-4 (Allowance) | `src/orchestrator/etl-4.orchestrator.js` | Processing failure |
| ETL-5 (Promo/Secondment) | `src/orchestrator/etl-5.orchestrator.js` | Processing failure |
| ETL-6 (Resignation/Transfer) | `src/orchestrator/etl-6.orchestrator.js` | Processing failure |
| General ETL | `src/orchestrator/etl.orchestrator.js` | Processing failure |

No code changes needed - integration is automatic through ErrorLogger.

## Troubleshooting

### Emails not sending?
1. Verify SMTP settings in `.env`
2. Check network connectivity to SMTP server
3. Run test: `node src/utils/email-notification.tester.js`
4. Review logs for email service errors

### SmartHR errors not extracted?
1. Ensure error message starts with "SmartHR API error:"
2. Check JSON format in error message
3. Verify field names in validation errors

### Email formatting issues?
1. Check recipient email client supports HTML
2. Verify special characters (Japanese) display correctly
3. Review email content for HTML escape issues

## Dependencies

- **nodemailer** - Email sending library

Installed via: `npm install nodemailer`

## Files Summary

| File | Type | Purpose |
|------|------|---------|
| `src/services/email.service.js` | Code | Email service implementation |
| `src/utils/error-logger.util.js` | Code | Error logging + email integration |
| `src/utils/email-notification.tester.js` | Code | Testing utility |
| `EMAIL_NOTIFICATIONS.md` | Doc | User guide |
| `EMAIL_NOTIFICATION_IMPLEMENTATION.md` | Doc | Implementation overview |
| `SMARTHR_ERROR_EXTRACTION_SUMMARY.md` | Doc | Quick reference |
| `SMARTHR_ERROR_EXTRACTION.md` | Doc | Technical details |
| `SMARTHR_ERROR_VISUAL_GUIDE.md` | Doc | Visual diagrams |
| `SMARTHR_ERROR_EXAMPLE.md` | Doc | Real-world example |
| `EMAIL_NOTIFICATION_SYSTEM_INDEX.md` | Doc | This file |

## Next Steps

1. ✅ Configuration is complete (SMTP settings in .env)
2. ✅ System is integrated (ErrorLogger sends emails automatically)
3. ✅ Ready for use (errors will trigger notifications)

To test: `node src/utils/email-notification.tester.js`

---

**Last Updated**: November 18, 2025
**Status**: Ready for Production
