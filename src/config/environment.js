import 'dotenv/config';
import path from 'path';

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'production',
  GAROON_BASE_URL: process.env.GAROON_BASE_URL || 'https://jcg.cybozu.com',
  GAROON_API_ENDPOINT: process.env.GAROON_API_ENDPOINT || 'https://jcg.cybozu.com/g/api/v1/workflow/admin/requests',
  CYBOZU_AUTHORIZATION: process.env.CYBOZU_AUTHORIZATION,
  
  SMARTHR_BASE_URL: process.env.SMARTHR_BASE_URL || 'https://e10379b3050f91760fb5d051.daruma.space/api/v1',
  SMARTHR_ACCESS_TOKEN: process.env.SMARTHR_ACCESS_TOKEN,
  
  // GCP Configuration - environment-specific
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
  GCP_CREDENTIALS_PATH: process.env.GCP_CREDENTIALS_PATH,
  BIGQUERY_DATASET_ID: process.env.BIGQUERY_DATASET_ID,
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
  
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};
