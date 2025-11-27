import { EmailService } from '../services/email.service.js';
import { logger } from '../utils/logger.util.js';

/**
 * Test SmartHR error extraction with actual error from request 839007
 */

const emailService = new EmailService();

// Actual error message from request 839007
const testErrorMessage = 'SmartHR API error: 400 - {"code":1,"type":"bad_request","message":"不正なリクエストパラメータです。","errors":[{"message":"業務内容は30文字以内で入力してください。","resource":"Crew","field":"occupation"},{"message":"従業員の住所（ヨミガナ）は全角カタカナで入力してください。","resource":"Crew","field":"literal_yomi"},{"message":"雇用保険の資格取得年月日は正しい形式で入力してください。","resource":"Crew","field":"emp_ins_qualified_at"},{"message":"社会保険の資格取得年月日は正しい形式で入力してください。","resource":"Crew","field":"soc_ins_qualified_at"}]}';

console.log('Testing SmartHR Error Extraction\n');
console.log('Input Error Message:');
console.log(testErrorMessage);
console.log('\n---\n');

const errorDetails = {
  requestId: '839007',
  requestName: 'New Hire Request',
  errorMessage: testErrorMessage,
  processorType: 'NEW_HIRE'
};

const extracted = emailService.extractSmartHRError(errorDetails);

if (extracted) {
  console.log('✅ SmartHR Error Successfully Extracted!\n');
  console.log('Extracted Message:');
  console.log(extracted);
  console.log('\n---\n');
  
  console.log('Email will display as:');
  console.log('┌─────────────────────────────────────────┐');
  console.log('│ SmartHR API Error                       │');
  console.log('├─────────────────────────────────────────┤');
  console.log(extracted.split('\n').map(line => `│ ${line.padEnd(40)}│`).join('\n'));
  console.log('└─────────────────────────────────────────┘');
} else {
  console.log('❌ Failed to extract SmartHR error');
  console.log('This means the error will be displayed as generic error instead');
}

console.log('\n✅ Test Complete');
