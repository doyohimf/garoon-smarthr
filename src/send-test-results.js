import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/environment.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tests = [
  { name: 'Transfer', file: 'transfer.processor.test.js', cases: 2 },
  { name: 'Secondment', file: 'secondment.processor.test.js', cases: 1 },
  { name: 'Leave', file: 'leave.processor.test.js', cases: 3 },
  { name: 'Salary Change', file: 'salary-change.processor.test.js', cases: 3 }
];

async function runTest(testFile) {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const proc = spawn('node', [path.join(__dirname, 'tests', testFile)]);
    let output = '';
    
    proc.stdout.on('data', (data) => { output += data; });
    proc.stderr.on('data', (data) => { output += data; });
    proc.on('close', (code) => {
      resolve({ status: code === 0 ? 'PASSED' : 'FAILED', output });
    });
  });
}

async function sendToSmartHR(testResults) {
  try {
    const payload = {
      title: 'Employee Processor Tests',
      description: 'Test results for processor functions 2-5',
      timestamp: new Date().toISOString(),
      summary: {
        total: tests.length,
        passed: testResults.filter(r => r.status === 'PASSED').length,
        failed: testResults.filter(r => r.status === 'FAILED').length,
        totalCases: tests.reduce((sum, t) => sum + t.cases, 0)
      },
      results: testResults
    };

    const response = await fetch(`${env.SMARTHR_BASE_URL}/test_results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.SMARTHR_ACCESS_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('✅ Test results sent to SmartHR');
      return true;
    } else {
      console.log('⚠️  SmartHR API not available, saving locally');
      return false;
    }
  } catch (error) {
    console.log('ℹ️  SmartHR unavailable, saving test results locally');
    return false;
  }
}

async function saveLocally(testResults) {
  const report = {
    timestamp: new Date().toISOString(),
    total: tests.length,
    passed: testResults.filter(r => r.status === 'PASSED').length,
    failed: testResults.filter(r => r.status === 'FAILED').length,
    totalCases: tests.reduce((sum, t) => sum + t.cases, 0),
    tests: testResults.map(r => ({
      name: r.name,
      status: r.status,
      cases: r.cases
    }))
  };

  const reportPath = path.join(__dirname, '..', 'test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`✅ Test results saved to ${reportPath}`);
}

async function main() {
  console.log('🚀 Running processor tests...\n');

  const testResults = [];
  
  for (const test of tests) {
    const result = await runTest(test.file);
    testResults.push({
      name: test.name,
      file: test.file,
      cases: test.cases,
      status: result.status
    });
  }

  console.log('\n📊 Test Summary:');
  console.log('================');
  testResults.forEach(r => {
    const icon = r.status === 'PASSED' ? '✅' : '❌';
    console.log(`${icon} ${r.name}: ${r.cases} cases`);
  });

  const passed = testResults.filter(r => r.status === 'PASSED').length;
  const total = testResults.length;
  console.log(`\nTotal: ${passed}/${total} tests passed`);

  const sent = await sendToSmartHR(testResults);
  if (!sent) {
    await saveLocally(testResults);
  }
}

main().catch(console.error);
