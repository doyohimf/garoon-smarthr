import { EmailService } from '../services/email.service.js';
import { logger } from '../utils/logger.util.js';

/**
 * Test email notification system
 */
export class EmailNotificationTester {
  constructor() {
    this.emailService = new EmailService();
  }

  async testSMTPConnection() {
    logger.info('Testing SMTP connection...');
    const result = await this.emailService.testConnection();
    
    if (result) {
      logger.info('✅ SMTP connection successful');
    } else {
      logger.error('❌ SMTP connection failed');
    }
    
    return result;
  }

  async testErrorNotification() {
    logger.info('Sending test error notification email...');
    
    const testError = {
      requestId: 'TEST-001',
      requestName: 'Test Employee Change',
      errorMessage: 'This is a test error notification',
      errorStack: 'Error: Test error\n    at testErrorNotification...',
      additionalData: {
        processorType: 'EMPLOYEE_CHANGE',
        workflow: 'ETL_5',
        timestamp: new Date().toISOString()
      }
    };

    const result = await this.emailService.sendErrorNotification(testError);
    
    if (result) {
      logger.info('✅ Test error notification email sent successfully');
    } else {
      logger.error('❌ Failed to send test error notification email');
    }
    
    return result;
  }

  async testSuccessNotification() {
    logger.info('Sending test success notification email...');
    
    const testSuccess = {
      requestId: 'TEST-002',
      requestName: 'Test New Hire',
      processorType: 'NEW_HIRE',
      additionalData: {
        workflow: 'ETL_1',
        timestamp: new Date().toISOString()
      }
    };

    const result = await this.emailService.sendSuccessNotification(testSuccess);
    
    if (result) {
      logger.info('✅ Test success notification email sent successfully');
    } else {
      logger.error('❌ Failed to send test success notification email');
    }
    
    return result;
  }

  async runAllTests() {
    logger.info('Starting email notification system tests...\n');
    
    const smtpTest = await this.testSMTPConnection();
    if (!smtpTest) {
      logger.error('⚠️  SMTP connection failed. Email notifications may not work.');
      return;
    }

    await this.testErrorNotification();
    await this.testSuccessNotification();
    
    logger.info('\n✅ All email notification tests completed');
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new EmailNotificationTester();
  tester.runAllTests().catch(err => {
    logger.error('Test execution failed', err);
    process.exit(1);
  });
}
