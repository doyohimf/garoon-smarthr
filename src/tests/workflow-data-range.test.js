import { DateRangeCalculator } from '../utils/date-range.util.js';
import { GCPStorageService } from '../services/gcp-storage.service.js';
import { GaroonService } from '../services/garoon.service.js';

// Test the workflow data range logic implementation
export class WorkflowDataRangeTest {
  
  static async testDateRangeCalculator() {
    console.log('\n=== Testing DateRangeCalculator ===');
    
    // Test 1: New workflow (less than 30 days)
    const launchDate1 = new Date('2025-11-20T00:00:00.000Z');
    const currentDate1 = new Date('2025-11-28T00:00:00.000Z');
    const range1 = DateRangeCalculator.calculateDataRange(
      launchDate1.toISOString(), 
      currentDate1
    );
    
    console.log('Test 1 - New workflow (8 days):', {
      input: {
        launchDate: launchDate1.toISOString(),
        currentDate: currentDate1.toISOString()
      },
      output: range1
    });
    
    // Test 2: Mature workflow (30+ days)
    const launchDate2 = new Date('2025-10-15T00:00:00.000Z');
    const currentDate2 = new Date('2025-11-28T00:00:00.000Z');
    const range2 = DateRangeCalculator.calculateDataRange(
      launchDate2.toISOString(), 
      currentDate2
    );
    
    console.log('Test 2 - Mature workflow (44 days):', {
      input: {
        launchDate: launchDate2.toISOString(),
        currentDate: currentDate2.toISOString()
      },
      output: range2
    });
    
    // Test 3: Edge case - exactly 30 days
    const launchDate3 = new Date('2025-10-29T00:00:00.000Z');
    const currentDate3 = new Date('2025-11-28T00:00:00.000Z');
    const range3 = DateRangeCalculator.calculateDataRange(
      launchDate3.toISOString(), 
      currentDate3
    );
    
    console.log('Test 3 - Edge case (exactly 30 days):', {
      input: {
        launchDate: launchDate3.toISOString(),
        currentDate: currentDate3.toISOString()
      },
      output: range3
    });
  }
  
  static async testWorkflowStartingPointManagement() {
    console.log('\n=== Testing Workflow Starting Point Management ===');
    
    const storageService = new GCPStorageService();
    const testWorkflowId = 'test_workflow_999';
    
    try {
      // Test 1: Check if starting point exists (should not exist initially)
      const exists1 = await storageService.workflowStartingPointExists(testWorkflowId);
      console.log('Test 1 - Starting point exists (initial):', exists1);
      
      // Test 2: Get or create starting point (should create new one)
      const startingPoint = await storageService.getOrCreateWorkflowStartingPoint(testWorkflowId);
      console.log('Test 2 - Get or create starting point:', startingPoint);
      
      // Test 3: Check if starting point exists (should exist now)
      const exists2 = await storageService.workflowStartingPointExists(testWorkflowId);
      console.log('Test 3 - Starting point exists (after creation):', exists2);
      
      // Test 4: Read existing starting point
      const readPoint = await storageService.readWorkflowStartingPoint(testWorkflowId);
      console.log('Test 4 - Read starting point:', readPoint);
      
      // Test 5: Get or create again (should read existing)
      const existingPoint = await storageService.getOrCreateWorkflowStartingPoint(testWorkflowId);
      console.log('Test 5 - Get existing starting point:', existingPoint);
      
    } catch (error) {
      console.error('Error in starting point management test:', error);
    }
  }
  
  static async testGaroonServiceIntegration() {
    console.log('\n=== Testing GaroonService Integration ===');
    
    const garoonService = new GaroonService();
    const testWorkflowId = 'test_workflow_integration';
    
    try {
      // Test 1: Check if workflow has starting point
      const hasStartingPoint = await garoonService.hasWorkflowStartingPoint(testWorkflowId);
      console.log('Test 1 - Has starting point:', hasStartingPoint);
      
      // Test 2: Get starting point (should create if not exists)
      const startingPoint = await garoonService.createWorkflowStartingPoint(
        testWorkflowId, 
        new Date('2025-11-01T00:00:00.000Z')
      );
      console.log('Test 2 - Create starting point:', startingPoint);
      
      // Test 3: Get starting point info
      const pointInfo = await garoonService.getWorkflowStartingPoint(testWorkflowId);
      console.log('Test 3 - Get starting point info:', pointInfo);
      
      // Test 4: Test fetchRequests without workflowId (fallback behavior)
      console.log('Test 4 - Fetch requests (fallback mode):');
      console.log('  (This would call Garoon API, skipping in test environment)');
      
      // Test 5: Test fetchRequests with workflowId (would use dynamic range)
      console.log('Test 5 - Fetch requests (workflow mode):');
      console.log('  (This would call Garoon API with dynamic date range, skipping in test environment)');
      
    } catch (error) {
      console.error('Error in Garoon service integration test:', error);
    }
  }
  
  static async runAllTests() {
    console.log('🧪 Starting Workflow Data Range Logic Tests...\n');
    
    await this.testDateRangeCalculator();
    await this.testWorkflowStartingPointManagement();
    await this.testGaroonServiceIntegration();
    
    console.log('\n✅ All tests completed!');
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  WorkflowDataRangeTest.runAllTests().catch(console.error);
}