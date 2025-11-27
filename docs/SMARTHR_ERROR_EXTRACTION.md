# SmartHR Error Extraction - Technical Details

## Overview

The email notification system includes intelligent error parsing that extracts SmartHR API error messages from the error stack and displays them prominently in notification emails.

## How It Works

### 1. Error Detection Pattern

The `extractSmartHRError()` method in `EmailService` looks for SmartHR API errors in this format:

```
SmartHR API error: [HTTP_CODE] - {JSON_ERROR_OBJECT}
```

### 2. Parsing Process

```javascript
// Input error message
"SmartHR API error: 400 - {\"code\":1,\"type\":\"bad_request\",\"message\":\"不正なリクエストパラメータです。\",\"errors\":[...]}"

// Regex pattern
/SmartHR API error: (\d+) - ({.*?})\s*$/s

// Extracted JSON
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
    },
    ...
  ]
}
```

### 3. Formatted Output

The extracted error is formatted in the email as:

```
SmartHR API Error

不正なリクエストパラメータです。

Validation Errors:
• occupation: 業務内容は30文字以内で入力してください。
• literal_yomi: 従業員の住所（ヨミガナ）は全角カタカナで入力してください。
• emp_ins_qualified_at: 雇用保険の資格取得年月日は正しい形式で入力してください。
• soc_ins_qualified_at: 社会保険の資格取得年月日は正しい形式で入力してください。
```

## Email Display

### SmartHR Error Email Section

```html
<div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107;">
  <h4 style="color: #ff6f00;">SmartHR API Error</h4>
  <pre>不正なリクエストパラメータです。

Validation Errors:
• occupation: 業務内容は30文字以内で入力してください。
• literal_yomi: 従業員の住所（ヨミガナ）は全角カタカナで入力してください。
• emp_ins_qualified_at: 雇用保険の資格取得年月日は正しい形式で入力してください。
• soc_ins_qualified_at: 社会保険の資格取得年月日は正しい形式で入力してください。</pre>
</div>
```

**Styling:**
- Yellow background (#fff3cd) - indicates a specific API error
- Yellow left border - visual emphasis
- Orange heading - stands out from other error sections

## Benefits

1. **Quick identification** of which fields failed validation
2. **Precise error messages** in Japanese from SmartHR API
3. **No need to parse logs** - information is right in the email
4. **Field names included** - easy to locate problematic data
5. **Human readable** - formatted for easy comprehension

## Error Handling

If SmartHR error extraction fails:
- Falls back to displaying original error message
- No error is thrown - graceful degradation
- Stack trace still included if available

## Non-SmartHR Errors

For errors not from SmartHR API:
- Generic error section displays (gray background)
- Stack trace shown (if not SmartHR error)
- Additional context included

## Code Reference

Location: `src/services/email.service.js`

Method: `extractSmartHRError(errorDetails)`
- Input: `errorDetails` object with `errorMessage` property
- Output: Formatted error string or `null` if not SmartHR error

Method: `formatErrorEmail(errorDetails)`
- Checks for `errorDetails.smarthrError` property
- Displays SmartHR section if error was extracted
- Falls back to generic error section otherwise

Method: `escapeHtml(text)`
- Safely escapes HTML characters for email display
- Prevents formatting issues with special characters
- Handles Japanese text properly
