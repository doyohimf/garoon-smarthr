import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmployeeTransferProcessor } from './src/processors/transfer.processor.js';
import { EmployeeSecondmentProcessor } from './src/processors/secondment.processor.js';
import { EmployeeLeaveProcessor } from './src/processors/leave.processor.js';
import { EmployeeSalaryChangeProcessor } from './src/processors/salary-change.processor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const transferProc = new EmployeeTransferProcessor();
const secondmentProc = new EmployeeSecondmentProcessor();
const leaveProc = new EmployeeLeaveProcessor();
const salaryProc = new EmployeeSalaryChangeProcessor();

async function processTransfers() {
  console.log('📤 Processing transfers...');
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/mock-garoon-data/2_jp.json')));
  const requests = data.requests || data;
  
  const results = [];
  for (const req of requests) {
    try {
      const extracted = transferProc.extractTransferData(req);
      results.push({ id: req.id, status: 'extracted', data: extracted });
    } catch (e) {
      results.push({ id: req.id, status: 'error', error: e.message });
    }
  }
  return results;
}

async function processSecondments() {
  console.log('📤 Processing secondments...');
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/mock-garoon-data/3_jp.json')));
  const requests = data.requests || data;
  
  const results = [];
  for (const req of requests) {
    try {
      const extracted = secondmentProc.extractSecondmentData(req);
      const type = secondmentProc.determineSecondmentType(extracted);
      results.push({ id: req.id, status: 'extracted', type, data: extracted });
    } catch (e) {
      results.push({ id: req.id, status: 'error', error: e.message });
    }
  }
  return results;
}

async function processLeaves() {
  console.log('📤 Processing leaves...');
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/mock-garoon-data/4_jp.json')));
  const requests = data.requests || data;
  
  const results = [];
  for (const req of requests) {
    try {
      const formFields = Object.values(req.items || {}).map(item => ({
        field_name: item.name,
        field_value: item.value
      }));
      const adaptedReq = { ...req, formFields };
      const extracted = leaveProc.extractReturnLeaveData(adaptedReq);
      results.push({ id: req.id, status: 'extracted', data: extracted });
    } catch (e) {
      results.push({ id: req.id, status: 'error', error: e.message });
    }
  }
  return results;
}

async function processSalaries() {
  console.log('📤 Processing salary changes...');
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/mock-garoon-data/5_jp.json')));
  const requests = data.requests || data;
  
  const results = [];
  for (const req of requests) {
    try {
      const extracted = salaryProc.extractSalaryData(req);
      const changes = salaryProc.calculateSalaryChange(extracted);
      results.push({ id: req.id, status: 'extracted', data: extracted, changes });
    } catch (e) {
      results.push({ id: req.id, status: 'error', error: e.message });
    }
  }
  return results;
}

async function main() {
  console.log('🔄 Mock Data → Processors → SmartHR Transfer\n');

  const transfers = await processTransfers();
  const secondments = await processSecondments();
  const leaves = await processLeaves();
  const salaries = await processSalaries();

  const summary = {
    timestamp: new Date().toISOString(),
    processors: {
      transfer: { total: transfers.length, extracted: transfers.filter(r => r.status === 'extracted').length },
      secondment: { total: secondments.length, extracted: secondments.filter(r => r.status === 'extracted').length },
      leave: { total: leaves.length, extracted: leaves.filter(r => r.status === 'extracted').length },
      salary: { total: salaries.length, extracted: salaries.filter(r => r.status === 'extracted').length }
    },
    details: {
      transfers,
      secondments,
      leaves,
      salaries
    }
  };

  const outputPath = path.join(__dirname, 'processor-transfer-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

  console.log('\n✅ Transfer Summary:');
  console.log('====================');
  console.log(`Transfer Requests: ${summary.processors.transfer.extracted}/${summary.processors.transfer.total}`);
  console.log(`Secondment Requests: ${summary.processors.secondment.extracted}/${summary.processors.secondment.total}`);
  console.log(`Leave Requests: ${summary.processors.leave.extracted}/${summary.processors.leave.total}`);
  console.log(`Salary Requests: ${summary.processors.salary.extracted}/${summary.processors.salary.total}`);
  console.log(`\n📁 Results: ${outputPath}`);

  const totalExtracted = 
    summary.processors.transfer.extracted +
    summary.processors.secondment.extracted +
    summary.processors.leave.extracted +
    summary.processors.salary.extracted;
  
  const totalRequests =
    summary.processors.transfer.total +
    summary.processors.secondment.total +
    summary.processors.leave.total +
    summary.processors.salary.total;

  console.log(`\n🎯 Total: ${totalExtracted}/${totalRequests} records processed`);
  console.log(`✅ Ready for SmartHR transfer`);
}

main().catch(console.error);
