import { config } from 'dotenv';
config();

import express from 'express';
import { garoonToSmartHRETL } from './index.js';

const app = express();
const PORT = process.env.PORT || 8081;

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Garoon to SmartHR ETL',
    environment: 'local'
  });
});

// ETL endpoint
app.post('/etl', async (req, res) => {
  await garoonToSmartHRETL(req, res);
});

app.get('/etl', async (req, res) => {
  await garoonToSmartHRETL(req, res);
});

app.listen(PORT, () => {
  console.log(`🚀 Local server running at http://localhost:${PORT}`);
  console.log(`📊 Test ETL: curl http://localhost:${PORT}/etl`);
});