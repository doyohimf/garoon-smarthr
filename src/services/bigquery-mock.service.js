import { logger } from '../utils/logger.util.js';
import fs from 'fs/promises';
import path from 'path';

export class BigQueryMockService {
  constructor() {
    this.dataDir = path.join(process.cwd(), 'data', 'bigquery-mock');
  }

  async ensureDir() {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  async insertRequest(request) {
    await this.ensureDir();
    const file = path.join(this.dataDir, 'requests.jsonl');
    await fs.appendFile(file, JSON.stringify(request) + '\n');
    logger.info(`[MOCK] Request inserted: ${request.request_id}`);
  }

  async insertFormFields(formFields) {
    await this.ensureDir();
    const file = path.join(this.dataDir, 'form_fields.jsonl');
    for (const field of formFields) {
      await fs.appendFile(file, JSON.stringify(field) + '\n');
    }
    logger.info(`[MOCK] ${formFields.length} form fields inserted`);
  }

  async insertSteps(steps) {
    await this.ensureDir();
    const file = path.join(this.dataDir, 'steps.jsonl');
    for (const step of steps) {
      await fs.appendFile(file, JSON.stringify(step) + '\n');
    }
    logger.info(`[MOCK] ${steps.length} steps inserted`);
  }

  async insertProcessors(processors) {
    await this.ensureDir();
    const file = path.join(this.dataDir, 'processors.jsonl');
    for (const processor of processors) {
      await fs.appendFile(file, JSON.stringify(processor) + '\n');
    }
    logger.info(`[MOCK] ${processors.length} processors inserted`);
  }

  async updateRequestStatus(requestId, status) {
    logger.info(`[MOCK] Request ${requestId} status updated to: ${status}`);
  }

  async insertGaroonRequest(garoonRequest) {
    await this.ensureDir();
    const file = path.join(this.dataDir, 'garoon_requests.jsonl');
    await fs.appendFile(file, JSON.stringify(garoonRequest) + '\n');
    logger.info(`[MOCK] Garoon request inserted: ${garoonRequest.request_id}`);
  }

  async updateGaroonRequestStatus(requestId, status) {
    logger.info(`[MOCK] Garoon request ${requestId} status updated to: ${status}`);
  }

  async checkGaroonRequestExists(requestId, requestNumber = null) {
    try {
      await this.ensureDir();
      const file = path.join(this.dataDir, 'garoon_requests.jsonl');
      try {
        const content = await fs.readFile(file, 'utf8');
        const lines = content.trim().split('\n').filter(line => line);
        for (const line of lines) {
          const record = JSON.parse(line);
          if (record.request_id === requestId || (requestNumber && record.request_number === requestNumber)) {
            return true;
          }
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          return false;
        }
        throw error;
      }
      return false;
    } catch (error) {
      logger.error(`[MOCK] Error checking garoon request exists for ${requestId}`, error);
      return false;
    }
  }
}
