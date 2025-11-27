# SmartHR Error Extraction - Summary

## What Was Updated

The email notification system now intelligently extracts and displays SmartHR API error messages in error notification emails.

## Files Changed

### Modified
- **`src/services/email.service.js`**
  - Added `extractSmartHRError()` method to parse SmartHR API errors
  - Added `escapeHtml()` method for safe HTML display
  - Updated `sendErrorNotification()` to extract SmartHR errors
  - Updated `formatErrorEmail()` to display SmartHR errors with special styling

### Created Documentation
- **`SMARTHR_ERROR_EXTRACTION.md`** - Technical details of error extraction
- **`SMARTHR_ERROR_EXAMPLE.md`** - Real-world example with request 839007
- **Updated `EMAIL_NOTIFICATIONS.md`** - Added SmartHR error extraction section
- **Updated `EMAIL_NOTIFICATION_IMPLEMENTATION.md`** - Added features list

## Key Feature: SmartHR Error Extraction

### Input
```
SmartHR API error: 400 - {"code":1,"type":"bad_request","message":"不正なリクエストパラメータです。","errors":[...]}
```

### Processing
1. Detects SmartHR API error pattern in error message
2. Parses JSON error object
3. Extracts main error message
4. Extracts validation errors with field names
5. Formats as human-readable text

### Output in Email
```
SmartHR API Error [Yellow highlight]

不正なリクエストパラメータです。

Validation Errors:
• occupation: 業務内容は30文字以内で入力してください。
• literal_yomi: 従業員の住所（ヨミガナ）は全角カタカナで入力してください。
• emp_ins_qualified_at: 雇用保険の資格取得年月日は正しい形式で入力してください。
• soc_ins_qualified_at: 社会保険の資格取得年月日は正しい形式で入力してください。
```

## Benefits

✅ **Quick Fix**: Recipient immediately sees which fields have validation issues
✅ **No Log Parsing**: All information in one email
✅ **Japanese Text**: Full support for SmartHR error messages in Japanese
✅ **Field Names**: Shows exact field that failed (e.g., `occupation`)
✅ **Actionable**: Error messages explain how to fix the data
✅ **Visual Emphasis**: Yellow highlighting for SmartHR errors
✅ **Graceful Fallback**: If extraction fails, shows generic error message

## Implementation Details

### Code Location
- Method: `EmailService.extractSmartHRError()`
- File: `src/services/email.service.js` (lines ~124-155)

### Regex Pattern
```javascript
/SmartHR API error: (\d+) - ({.*?})\s*$/s
```

### Error Format Detection
- Looks for "SmartHR API error: " prefix
- Followed by HTTP status code
- Followed by JSON error object
- Handles multi-line error messages with `s` flag

### JSON Parsing
- Safely parses extracted JSON
- Catches parsing errors silently
- Returns null if parsing fails (graceful degradation)

### Email Display
- SmartHR errors displayed in yellow (#fff3cd)
- Yellow left border for visual emphasis
- Orange heading (#ff6f00)
- Plain text display for errors (not generic error section)

## Usage Example

The system works automatically when errors occur:

```javascript
// Error occurs in ETL pipeline
try {
  await smartHRService.createCrew(crewData);
} catch (error) {
  // Error automatically triggers email with SmartHR extraction
  await errorLogger.logRequestError(requestId, requestName, error, { processorType });
}
```

No changes needed to existing error handling code - the SmartHR extraction happens automatically.

## Testing

To test email notifications:
```bash
node src/utils/email-notification.tester.js
```

To manually test with SmartHR error:
```javascript
import { EmailService } from './src/services/email.service.js';

const emailService = new EmailService();
const error = {
  errorMessage: 'SmartHR API error: 400 - {"code":1,"type":"bad_request","message":"不正なリクエストパラメータです。","errors":[...]}'
};

const extracted = emailService.extractSmartHRError(error);
console.log(extracted);
```

## Related Files

- `EMAIL_NOTIFICATIONS.md` - Complete email system documentation
- `EMAIL_NOTIFICATION_IMPLEMENTATION.md` - Implementation overview
- `SMARTHR_ERROR_EXTRACTION.md` - Technical details
- `SMARTHR_ERROR_EXAMPLE.md` - Real-world example
- `src/services/email.service.js` - Email service implementation
- `src/utils/error-logger.util.js` - Error logging with email integration
