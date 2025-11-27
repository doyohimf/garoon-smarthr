/**
 * Request routing configuration
 * Maps ETL workflows to processor types
 * Form IDs are used for filtering at the Garoon API level
 */

export const REQUEST_TYPE_MAP = {
  // New Hire Requests WF1 - Form ID: 1032
  NEW_HIRE: {
    formId: 1032,
    description: 'Internal Employee Hiring/Update/Change',
    processor: 'NEW_HIRE'
  },

  // Employee Changes (Unified Processor) WF2 - Form ID: 1041
  UNIFIED_CHANGE: {
    formId: 1041,
    description: 'Employee transfers, promotions, demotions, and salary changes',
    processor: 'UNIFIED_CHANGE'
  },

  // Secondment WF3 - Form ID: 1038
  SECONDMENT: {
    formId: 1038,
    description: 'Employee secondment and transfer',
    processor: 'SECONDMENT'
  },

  // Leave and Return WF4 - Form ID: 1042
  LEAVE_RETURN: {
    formId: 1042,
    description: 'Employee leave and return to work',
    processor: 'LEAVE_RETURN'
  },

  // Allowance Changes WF5 - Form ID: 1044
  ALLOWANCE_CHANGE: {
    formId: 1044,
    description: 'Employee Allowance Changes (Internal) ※Excluding commute expenses',
    processor: 'ALLOWANCE_CHANGE'
  },

  // Resignation WF6 - Form ID: 1236
  RESIGNATION: {
    formId: 1236,
    description: 'Employee Resignation (Internal)',
    processor: 'RESIGNATION'
  }
};

/**
 * Get processor type by form ID
 */
export function getProcessorTypeByFormId(formId) {
  for (const [type, config] of Object.entries(REQUEST_TYPE_MAP)) {
    if (config.formId === formId) {
      return config.processor;
    }
  }
  return null;
}

/**
 * Get processor type from request (legacy support)
 */
export function getProcessorType(requestName) {
  // This function is kept for backward compatibility
  // In the new system, processor type is determined by form ID at ETL level
  return null;
}

/**
 * Get description for processor type
 */
export function getProcessorDescription(processorType) {
  for (const config of Object.values(REQUEST_TYPE_MAP)) {
    if (config.processor === processorType) {
      return config.description;
    }
  }
  return 'Unknown';
}

/**
 * Check if request should be processed (legacy support)
 */
export function shouldProcessRequest(requestName) {
  // In the new system, all requests from specific forms are processed
  return true;
}