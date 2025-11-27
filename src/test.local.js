import { config } from 'dotenv';
config();

process.env.NODE_ENV = 'local';

import { ETLOrchestrator } from './orchestrator/etl.orchestrator.js';
import { logger } from './utils/logger.util.js';

async function testLocalETL() {
  console.log('🧪 Starting Local ETL Test...\n');

  try {
    const orchestrator = new ETLOrchestrator();
    const result = await orchestrator.execute();

    console.log('\n✅ ETL Test Completed Successfully!');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n❌ ETL Test Failed:');
    console.error(error);
    process.exit(1);
  }
}

testLocalETL();