import { logger } from '../utils/logger.util.js';

export class GaroonToBigQueryTransformer {
  transform(garoonRequest) {
    const extractedAt = new Date().toISOString();
    
    const request = this.transformRequest(garoonRequest, extractedAt);
    const formFields = this.transformFormFields(garoonRequest, extractedAt);
    const steps = this.transformSteps(garoonRequest, extractedAt);
    const processors = this.transformProcessors(garoonRequest, extractedAt);

    logger.debug('Transformed Garoon data to BigQuery format', {
      requestId: request.request_id,
      formFieldsCount: formFields.length,
      stepsCount: steps.length,
      processorsCount: processors.length
    });

    return { request, formFields, steps, processors };
  }

  transformRequest(garoonRequest, extractedAt) {
    return {
      request_id: garoonRequest.id,
      request_number: garoonRequest.number || null,
      request_name: garoonRequest.name || null,
      status: 'ON-GOING',
      status_type: garoonRequest.status?.type || null,
      created_at: garoonRequest.createdAt || null,
      processing_step_code: garoonRequest.processingStep?.code || null,
      is_urgent: garoonRequest.urgent || false,
      applicant_id: garoonRequest.applicant?.id || null,
      applicant_code: garoonRequest.applicant?.code || null,
      applicant_name: garoonRequest.applicant?.name || null,
      extracted_at: extractedAt
    };
  }

  transformFormFields(garoonRequest, extractedAt) {
    if (!garoonRequest.items) return [];

    return Object.entries(garoonRequest.items).map(([code, field]) => ({
      request_id: garoonRequest.id,
      field_code: code,
      field_name: field.name || null,
      field_name_eng: field.nameEng || null,
      field_type: field.type || null,
      field_value: this.extractFieldValue(field),
      extracted_at: extractedAt
    }));
  }

  transformSteps(garoonRequest, extractedAt) {
    const rawSteps = garoonRequest.steps;
    if (!rawSteps) return [];

    const steps = Array.isArray(rawSteps) ? rawSteps : Object.values(rawSteps);
    if (!steps.length) return [];

    return steps.map(step => ({
      request_id: garoonRequest.id,
      step_id: step.id,
      step_code: step.code || step.id || 'UNKNOWN',
      step_name: step.name || null,
      is_approval_step: step.isApprovalStep ? 1 : 0,
      requirement: step.requirement || null,
      extracted_at: extractedAt
    }));
  }

  transformProcessors(garoonRequest, extractedAt) {
    const rawSteps = garoonRequest.steps;
    if (!rawSteps) return [];

    const steps = Array.isArray(rawSteps) ? rawSteps : Object.values(rawSteps);
    if (!steps.length) return [];

    const processors = [];
    
    steps.forEach(step => {
      const rawProcessors = step.processors;
      if (!rawProcessors) return;

      const stepProcessors = Array.isArray(rawProcessors) ? rawProcessors : Object.values(rawProcessors);
      stepProcessors.forEach(processor => {
        processors.push({
          request_id: garoonRequest.id,
          step_id: step.id,
          processor_id: processor.id || null,
          processor_code: processor.code || null,
          processor_name: processor.name || null,
          result: processor.result || null,
          comment: processor.comment || null,
          operated_at: processor.operatedAt || null,
          extracted_at: extractedAt
        });
      });
    });

    return processors;
  }

  extractFieldValue(field) {
    if (field.value !== undefined && field.value !== null) {
      return String(field.value);
    }
    return null;
  }
}
