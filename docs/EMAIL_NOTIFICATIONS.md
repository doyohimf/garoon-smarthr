# Email Notification System

## Overview

The email notification system automatically sends email alerts when errors are detected during ETL processing. This provides real-time notifications to configured recipients about processing failures.

## Configuration

Email settings are configured in the `.env` file:

```
SMTP__HOST=red-koala-0a1239ffb68d8722.znlc.jp
SMTP__PORT=465
SMTP__USER=kyuuyo-fromdb@jc-grp.com
SMTP__PASS=say6_wB3PMJb
SMTP__FROM=kyuuyo-fromdb@jc-grp.com
SMTP__TO=doyohim.f@sprobe.com
```

| Variable | Description |
|----------|-------------|
| `SMTP__HOST` | SMTP server hostname |
| `SMTP__PORT` | SMTP server port (typically 465 for SSL) |
| `SMTP__USER` | SMTP authentication username |
| `SMTP__PASS` | SMTP authentication password |
| `SMTP__FROM` | Sender email address |
| `SMTP__TO` | Default recipient email address |

## Services

### EmailService (`src/services/email.service.js`)

Core email sending functionality:

```javascript
import { EmailService } from './services/email.service.js';

const emailService = new EmailService();

// Send error notification
await emailService.sendErrorNotification({
  requestId: 'REQ-001',
  requestName: 'New Hire Request',
  errorMessage: 'Processing failed',
  errorStack: 'Error stack trace...',
  additionalData: { /* context */ }
});

// Send success notification (optional)
await emailService.sendSuccessNotification({
  requestId: 'REQ-001',
  requestName: 'New Hire Request',
  processorType: 'NEW_HIRE'
});
```

**Methods:**

- `sendErrorNotification(errorDetails, recipientEmail)` - Sends error alert
- `sendSuccessNotification(processDetails, recipientEmail)` - Sends success confirmation
- `testConnection()` - Verifies SMTP connection
- `extractSmartHRError(errorDetails)` - Extracts SmartHR API error messages

## SmartHR Error Message Extraction

When errors originate from SmartHR API, the email service automatically extracts and displays the SmartHR error message prominently in the email.

### Example

If an error contains:
```
SmartHR API error: 400 - {"code":1,"type":"bad_request","message":"不正なリクエストパラメータです。","errors":[{"message":"業務内容は30文字以内で入力してください。","resource":"Crew","field":"occupation"},{"message":"従業員の住所（ヨミガナ）は全角カタカナで入力してください。","resource":"Crew","field":"literal_yomi"}]}
```

The email will display:
- **SmartHR API Error** (highlighted in yellow)
- Main error message: "不正なリクエストパラメータです。"
- Individual validation errors with field names and descriptions

This makes it easy to identify and fix data validation issues.

### ErrorLogger Updates (`src/utils/error-logger.util.js`)

The ErrorLogger now automatically sends email notifications when errors occur:

- `logRequestError()` - Logs error AND sends email notification
- `logProcessorError()` - Logs processor error AND sends email notification
- `logError()` - Logs general errors (configurable for email)

## Automatic Error Notifications

When an error occurs during ETL processing, the system automatically:

1. Logs error details to file (`data/errors/`)
2. Sends email notification to configured recipient
3. Includes request context and error details in email

### Integration Points

Errors are automatically notified in these orchestrators:

- `src/orchestrator/etl-1.orchestrator.js` - New Hire requests
- `src/orchestrator/etl-2.orchestrator.js` - Employee Change requests
- `src/orchestrator/etl-3.orchestrator.js` - Leave requests
- `src/orchestrator/etl-4.orchestrator.js` - Allowance Change requests
- `src/orchestrator/etl-5.orchestrator.js` - Promotion/Secondment requests
- `src/orchestrator/etl-6.orchestrator.js` - Resignation/Transfer requests
- `src/orchestrator/etl.orchestrator.js` - General ETL orchestration

## Testing

### Test Email Notifications

To test the email notification system:

```bash
node src/utils/email-notification.tester.js
```

This will:
1. Verify SMTP connection
2. Send test error notification
3. Send test success notification

### Manual Testing

```javascript
import { EmailService } from './services/email.service.js';

const emailService = new EmailService();

// Test SMTP connection
const connected = await emailService.testConnection();

// Send error notification
await emailService.sendErrorNotification({
  requestId: 'TEST-001',
  requestName: 'Test Request',
  errorMessage: 'Test error message',
  errorStack: 'Test stack trace',
  additionalData: { workflow: 'TEST' }
});
```

## Email Format

### Error Notification Email

Contains:
- Request ID and name
- Processor type
- Error message
- Stack trace (if available)
- Additional context data
- Timestamp

### Success Notification Email

Contains:
- Request ID and name
- Processor type
- Processing status
- Additional details
- Timestamp

## Troubleshooting

### SMTP Connection Failed

1. Verify `.env` variables are set correctly
2. Check SMTP credentials and permissions
3. Ensure firewall allows outbound connections to SMTP port
4. Test with: `node src/utils/email-notification.tester.js`

### Emails Not Sending

- Check application logs for email service errors
- Verify `SMTP__TO` recipient email is valid
- Ensure SMTP server is accessible
- Review SMTP server firewall settings

### Email Service Not Initialized

If email notifications fail silently:
- Check that all SMTP environment variables are set
- Verify nodemailer package is installed: `npm install nodemailer`
- Enable debug logging for SMTP issues

## Recipients

The default notification recipient is configured in `.env`:

```
SMTP__TO=doyohim.f@sprobe.com
```

To send to different recipients, pass email address to methods:

```javascript
await emailService.sendErrorNotification(errorDetails, 'other@example.com');
```

## Dependencies

- `nodemailer` - Email sending library (installed via `npm install nodemailer`)

## Disabling Email Notifications

To disable email notifications temporarily:

1. Clear the `SMTP__TO` variable in `.env`
2. Or remove `.env` file temporarily

Email service will log warnings instead of errors if notification fails.
