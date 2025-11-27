import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.util.js';

export class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize SMTP transporter with credentials from .env
   */
  initializeTransporter() {
    try {
      const smtpConfig = {
        host: process.env.SMTP__HOST,
        port: parseInt(process.env.SMTP__PORT || '465'),
        secure: parseInt(process.env.SMTP__PORT || '465') === 465,
        auth: {
          user: process.env.SMTP__USER,
          pass: process.env.SMTP__PASS
        }
      };

      this.transporter = nodemailer.createTransport(smtpConfig);
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service', error);
      this.transporter = null;
    }
  }

  /**
   * Send error notification email
   * @param {Object} errorDetails - Error information
   * @param {string} errorDetails.requestId - Request ID
   * @param {string} errorDetails.requestName - Request name
   * @param {string} errorDetails.errorMessage - Error message
   * @param {string} errorDetails.errorStack - Error stack trace
   * @param {Object} errorDetails.additionalData - Additional context
   * @param {string} recipientEmail - Email recipient (uses SMTP__TO from .env if not provided)
   */
  async sendErrorNotification(errorDetails, recipientEmail = null) {
    if (!this.transporter) {
      logger.warn('Email service not initialized. Skipping email notification.');
      return false;
    }

    try {
      const recipient = recipientEmail || process.env.SMTP__TO;
      if (!recipient) {
        logger.warn('No email recipient configured. Skipping email notification.');
        return false;
      }

      // Extract SmartHR error message if available
      const extractedError = this.extractSmartHRError(errorDetails);
      const displayMessage = extractedError || errorDetails.errorMessage;

      const emailBody = this.formatErrorEmail({
        ...errorDetails,
        errorMessage: displayMessage,
        smarthrError: extractedError
      });
      const subject = `[ERROR] Processing Failed - Request: ${errorDetails.requestId || 'Unknown'}`;

      const mailOptions = {
        from: process.env.SMTP__FROM,
        to: recipient,
        subject,
        html: emailBody
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Error notification email sent successfully. Message ID: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('Failed to send error notification email', error);
      return false;
    }
  }

  /**
   * Send success notification email
   * @param {Object} processDetails - Processing information
   * @param {string} processDetails.requestId - Request ID
   * @param {string} processDetails.requestName - Request name
   * @param {string} processDetails.processorType - Processor type
   * @param {string} recipientEmail - Email recipient (uses SMTP__TO from .env if not provided)
   */
  async sendSuccessNotification(processDetails, recipientEmail = null) {
    if (!this.transporter) {
      logger.warn('Email service not initialized. Skipping email notification.');
      return false;
    }

    try {
      const recipient = recipientEmail || process.env.SMTP__TO;
      if (!recipient) {
        logger.warn('No email recipient configured. Skipping email notification.');
        return false;
      }

      const emailBody = this.formatSuccessEmail(processDetails);
      const subject = `[SUCCESS] Processing Completed - Request: ${processDetails.requestId || 'Unknown'}`;

      const mailOptions = {
        from: process.env.SMTP__FROM,
        to: recipient,
        subject,
        html: emailBody
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Success notification email sent successfully. Message ID: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('Failed to send success notification email', error);
      return false;
    }
  }

  /**
   * Extract SmartHR error message from error object
   * @param {Object} errorDetails - Error details object
   * @returns {string|null} SmartHR error message or null
   */
  extractSmartHRError(errorDetails) {
    try {
      let errorMessage = errorDetails.errorMessage || '';
      
      // Handle case where errorMessage might be escaped
      if (typeof errorMessage === 'string') {
        // Look for SmartHR API error pattern
        const smarthrMatch = errorMessage.match(/SmartHR API error: (\d+) - ({[\s\S]*})/);
        
        if (smarthrMatch && smarthrMatch[2]) {
          let jsonStr = smarthrMatch[2];
          
          // Clean up escaped quotes if present
          if (jsonStr.includes('\\"')) {
            jsonStr = jsonStr.replace(/\\"/g, '"');
          }
          
          // Parse JSON with brace matching fallback
          let errorObj;
          try {
            errorObj = JSON.parse(jsonStr);
          } catch (parseError) {
            // Try to find balanced braces
            let braceCount = 0;
            let endIndex = -1;
            for (let i = 0; i < jsonStr.length; i++) {
              if (jsonStr[i] === '{') braceCount++;
              if (jsonStr[i] === '}') braceCount--;
              if (braceCount === 0 && i > 0) {
                endIndex = i + 1;
                break;
              }
            }
            
            if (endIndex > 0) {
              jsonStr = jsonStr.substring(0, endIndex);
              errorObj = JSON.parse(jsonStr);
            } else {
              return null;
            }
          }
          
          if (errorObj.message) {
            // Include validation errors if available
            if (errorObj.errors && Array.isArray(errorObj.errors) && errorObj.errors.length > 0) {
              const validationErrors = errorObj.errors
                .map(e => `• ${e.field}: ${e.message}`)
                .join('\n');
              return `${errorObj.message}\n\nValidation Errors:\n${validationErrors}`;
            }
            
            return errorObj.message;
          }
        }
      }
      
      return null;
    } catch (error) {
      // If parsing fails, return null
      return null;
    }
  }

  /**
   * Format error details into HTML email body (Bilingual: Japanese/English)
   */
  formatErrorEmail(errorDetails) {
    const timestamp = new Date().toISOString();
    const smarthrErrorMessage = errorDetails.smarthrError;
    
    return `
      <html>
        <head>
          <meta charset="UTF-8">
        </head>
        <body style="font-family: 'Segoe UI', 'YuGothic', 'Hiragino Sans', sans-serif; line-height: 1.6; color: #333;">
          <!-- JAPANESE VERSION (PRIMARY) -->
          <h2 style="color: #d32f2f; margin-bottom: 5px;">🚨 エラー通知</h2>
          <p style="color: #666; font-size: 12px; margin: 0 0 20px 0;">
            <em>Error Notification</em>
          </p>
          
          <div style="background-color: #ffebee; padding: 15px; border-left: 4px solid #d32f2f; margin: 15px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold; width: 30%;">リクエストID:</td>
                <td style="padding: 8px;">${errorDetails.requestId || 'N/A'}</td>
              </tr>
              <tr style="background-color: rgba(255,255,255,0.5);">
                <td style="padding: 8px; font-weight: bold;">リクエスト名:</td>
                <td style="padding: 8px;">${errorDetails.requestName || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">プロセッサタイプ:</td>
                <td style="padding: 8px;">${errorDetails.processorType || 'N/A'}</td>
              </tr>
            </table>
          </div>

          ${smarthrErrorMessage ? `
          <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0;">
            <h4 style="color: #ff6f00; margin-top: 0; margin-bottom: 10px;">SmartHR APIエラー</h4>
            <pre style="background-color: #fff; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px; white-space: pre-wrap; word-wrap: break-word;">
${this.escapeHtml(smarthrErrorMessage)}
            </pre>
          </div>
          ` : `
          <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #ccc; margin: 15px 0;">
            <h4 style="margin-top: 0; margin-bottom: 10px;">エラーメッセージ:</h4>
            <pre style="background-color: #fff; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px; white-space: pre-wrap; word-wrap: break-word;">
${this.escapeHtml(errorDetails.errorMessage || '不明なエラー')}
            </pre>
          </div>
          `}

          ${errorDetails.additionalData ? `
          <div style="background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <h4 style="margin-top: 0; margin-bottom: 10px;">追加情報:</h4>
            <pre style="overflow-x: auto; background-color: #fff; padding: 10px; border-radius: 4px; font-size: 11px; white-space: pre-wrap; word-wrap: break-word;">
${this.escapeHtml(JSON.stringify(errorDetails.additionalData, null, 2))}
            </pre>
          </div>
          ` : ''}

          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

          <!-- ENGLISH VERSION (SMALL) -->
          <div style="background-color: #f9f9f9; padding: 12px 15px; margin: 15px 0; border-radius: 4px; font-size: 11px; color: #666;">
            <p style="margin: 5px 0;"><strong>English Summary:</strong></p>
            <p style="margin: 5px 0;">
              <strong>Error occurred in request processing:</strong>
            </p>
            <ul style="margin: 5px 0; padding-left: 20px;">
              <li>Request ID: ${errorDetails.requestId || 'N/A'}</li>
              <li>Request Name: ${errorDetails.requestName || 'N/A'}</li>
              <li>Processor Type: ${errorDetails.processorType || 'N/A'}</li>
            </ul>
            ${smarthrErrorMessage ? `
            <p style="margin: 5px 0;">
              <strong>Error Details:</strong> ${this.escapeHtml(smarthrErrorMessage.substring(0, 150))}${smarthrErrorMessage.length > 150 ? '...' : ''}
            </p>
            ` : `
            <p style="margin: 5px 0;">
              <strong>Error:</strong> ${this.escapeHtml((errorDetails.errorMessage || 'Unknown error').substring(0, 150))}...
            </p>
            `}
          </div>

          <p style="color: #999; font-size: 11px; margin-top: 20px;">
            Timestamp: ${timestamp} UTC
          </p>
        </body>
      </html>
    `;
  }

  /**
   * Escape HTML special characters for safe display in email
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Format success details into HTML email body (Bilingual: Japanese/English)
   */
  formatSuccessEmail(processDetails) {
    const timestamp = new Date().toISOString();
    return `
      <html>
        <head>
          <meta charset="UTF-8">
        </head>
        <body style="font-family: 'Segoe UI', 'YuGothic', 'Hiragino Sans', sans-serif; line-height: 1.6; color: #333;">
          <!-- JAPANESE VERSION (PRIMARY) -->
          <h2 style="color: #388e3c; margin-bottom: 5px;">✅ 処理が正常に完了しました</h2>
          <p style="color: #666; font-size: 12px; margin: 0 0 20px 0;">
            <em>Processing Completed Successfully</em>
          </p>
          
          <div style="background-color: #e8f5e9; padding: 15px; border-left: 4px solid #388e3c; margin: 15px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold; width: 30%;">リクエストID:</td>
                <td style="padding: 8px;">${processDetails.requestId || 'N/A'}</td>
              </tr>
              <tr style="background-color: rgba(255,255,255,0.5);">
                <td style="padding: 8px; font-weight: bold;">リクエスト名:</td>
                <td style="padding: 8px;">${processDetails.requestName || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">プロセッサタイプ:</td>
                <td style="padding: 8px;">${processDetails.processorType || 'N/A'}</td>
              </tr>
              <tr style="background-color: rgba(255,255,255,0.5);">
                <td style="padding: 8px; font-weight: bold;">ステータス:</td>
                <td style="padding: 8px;">
                  <span style="color: #388e3c; font-weight: bold; background-color: #e8f5e9; padding: 4px 8px; border-radius: 3px;">
                    完了
                  </span>
                </td>
              </tr>
            </table>
          </div>

          ${processDetails.additionalData ? `
          <div style="background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <h4 style="margin-top: 0; margin-bottom: 10px;">詳細:</h4>
            <pre style="overflow-x: auto; background-color: #fff; padding: 10px; border-radius: 4px; font-size: 12px;">
${JSON.stringify(processDetails.additionalData, null, 2)}
            </pre>
          </div>
          ` : ''}

          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

          <!-- ENGLISH VERSION (SMALL) -->
          <div style="background-color: #f9f9f9; padding: 12px 15px; margin: 15px 0; border-radius: 4px; font-size: 11px; color: #666;">
            <p style="margin: 5px 0;"><strong>English Summary:</strong></p>
            <p style="margin: 5px 0;">
              <strong>Processing completed successfully:</strong>
            </p>
            <ul style="margin: 5px 0; padding-left: 20px;">
              <li>Request ID: ${processDetails.requestId || 'N/A'}</li>
              <li>Request Name: ${processDetails.requestName || 'N/A'}</li>
              <li>Processor Type: ${processDetails.processorType || 'N/A'}</li>
              <li>Status: Completed ✅</li>
            </ul>
          </div>

          <p style="color: #999; font-size: 11px; margin-top: 20px;">
            Timestamp: ${timestamp} UTC
          </p>
        </body>
      </html>
    `;
  }

  /**
   * Send resignation tagging notification email
   * @param {Object} resignationDetails - Resignation details
   * @param {string} resignationDetails.emp_code - Employee code
   * @param {string} resignationDetails.resigned_at - Resignation date
   * @param {string} resignationDetails.tagging_date - Tagging date (current timestamp)
   * @param {string} recipientEmail - Email recipient (uses SMTP__TO from .env if not provided)
   */
  async sendResignationTaggingNotification(resignationDetails, recipientEmail = null) {
    if (!this.transporter) {
      logger.warn('Email service not initialized. Skipping resignation tagging notification.');
      return false;
    }

    try {
      const recipient = recipientEmail || process.env.SMTP__TO;
      if (!recipient) {
        logger.warn('No email recipient configured. Skipping resignation tagging notification.');
        return false;
      }

      const emailBody = this.formatResignationTaggingEmail(resignationDetails);
      const subject = `[AUTO-TAGGING] Employee Resignation Tagged as Retired - EMP: ${resignationDetails.emp_code}`;

      const mailOptions = {
        from: process.env.SMTP__FROM,
        to: recipient,
        subject,
        html: emailBody
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Resignation tagging notification email sent successfully. Message ID: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('Failed to send resignation tagging notification email', error);
      return false;
    }
  }

  /**
   * Format resignation tagging details into HTML email body
   */
  formatResignationTaggingEmail(resignationDetails) {
    const timestamp = new Date().toISOString();
    const resignedDate = new Date(resignationDetails.resigned_at);
    const daysSinceResignation = Math.floor(
      (new Date() - resignedDate) / (1000 * 60 * 60 * 24)
    );

    return `
      <html>
        <head>
          <meta charset="UTF-8">
        </head>
        <body style="font-family: 'Segoe UI', 'YuGothic', 'Hiragino Sans', sans-serif; line-height: 1.6; color: #333;">
          <!-- JAPANESE VERSION (PRIMARY) -->
          <h2 style="color: #1976d2; margin-bottom: 5px;">🏷️ 退職者の自動タギング処理</h2>
          <p style="color: #666; font-size: 12px; margin: 0 0 20px 0;">
            <em>Automatic Resignation Tagging</em>
          </p>
          
          <div style="background-color: #e3f2fd; padding: 15px; border-left: 4px solid #1976d2; margin: 15px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold; width: 40%;">従業員コード:</td>
                <td style="padding: 8px;">${resignationDetails.emp_code}</td>
              </tr>
              <tr style="background-color: rgba(255,255,255,0.5);">
                <td style="padding: 8px; font-weight: bold;">退職日:</td>
                <td style="padding: 8px;">${resignationDetails.resigned_at}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">退職からの経過日数:</td>
                <td style="padding: 8px;">${daysSinceResignation} 日</td>
              </tr>
              <tr style="background-color: rgba(255,255,255,0.5);">
                <td style="padding: 8px; font-weight: bold;">更新されたステータス:</td>
                <td style="padding: 8px;">
                  <span style="color: #d32f2f; font-weight: bold; background-color: #ffebee; padding: 4px 8px; border-radius: 3px;">
                    退職 (Retired)
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">タギング日時:</td>
                <td style="padding: 8px;">${resignationDetails.tagging_date}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <h4 style="margin-top: 0; margin-bottom: 10px;">実行されたアクション:</h4>
            <ul style="margin: 0; padding-left: 20px;">
              <li>従業員の退職ステータスが2ヶ月以上前であることを確認</li>
              <li>SmartHRで従業員ステータスを「退職」に更新</li>
              <li>レコードをBigQueryのresign_taggingテーブルに保存（ステータス: 完了）</li>
            </ul>
          </div>

          <div style="background-color: #fff3e0; padding: 15px; border-left: 4px solid #ff9800; margin: 15px 0;">
            <h4 style="margin-top: 0; color: #e65100; margin-bottom: 10px;">自動タギング処理の詳細:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
              <li><strong>ワークフロー:</strong> WF#7 (退職者タギング)</li>
              <li><strong>処理方式:</strong> 自動</li>
              <li><strong>システム:</strong> SmartHR ETL パイプライン</li>
            </ul>
          </div>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          
          <!-- ENGLISH VERSION (SMALL) -->
          <div style="background-color: #f9f9f9; padding: 12px 15px; margin: 15px 0; border-radius: 4px; font-size: 11px; color: #666;">
            <p style="margin: 5px 0;"><strong>English Summary:</strong></p>
            <p style="margin: 5px 0;">
              Employee <strong>${resignationDetails.emp_code}</strong> resigned on <strong>${resignationDetails.resigned_at}</strong> 
              (${daysSinceResignation} days ago). Their employment status has been automatically updated to "Retired" in SmartHR and 
              the record has been saved to the BigQuery resign_tagging table.
            </p>
            <p style="margin: 5px 0;">
              <strong>Workflow:</strong> WF#7 | <strong>Processing:</strong> Automated | <strong>System:</strong> SmartHR ETL Pipeline
            </p>
          </div>

          <p style="color: #999; font-size: 11px; margin-top: 20px;">
            Timestamp: ${timestamp} UTC
          </p>
        </body>
      </html>
    `;
  }

  /**
   * Test SMTP connection
   */
  async testConnection() {
    if (!this.transporter) {
      logger.warn('Email service not initialized');
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error('SMTP connection verification failed', error);
      return false;
    }
  }
}
