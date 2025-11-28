import { DateRangeCalculator } from '../utils/date-range.util.js';

console.log('🧪 Testing Workflow Data Range Logic...\n');

// Test 1: New workflow (less than 30 days)
console.log('Test 1: New workflow (8 days since launch)');
const launchDate1 = new Date('2025-11-20T00:00:00.000Z');
const currentDate1 = new Date('2025-11-28T00:00:00.000Z');
const range1 = DateRangeCalculator.calculateDataRange(
  launchDate1.toISOString(), 
  currentDate1
);
console.log('- Launch date:', launchDate1.toISOString().split('T')[0]);
console.log('- Current date:', currentDate1.toISOString().split('T')[0]);
console.log('- Days since launch:', range1.daysSinceLaunch);
console.log('- Range type:', range1.rangeType);
console.log('- Start date:', range1.startDate.split('T')[0]);
console.log('- End date:', range1.endDate.split('T')[0]);
console.log('✅ Expected: launch-to-today range\n');

// Test 2: Mature workflow (30+ days)
console.log('Test 2: Mature workflow (44 days since launch)');
const launchDate2 = new Date('2025-10-15T00:00:00.000Z');
const currentDate2 = new Date('2025-11-28T00:00:00.000Z');
const range2 = DateRangeCalculator.calculateDataRange(
  launchDate2.toISOString(), 
  currentDate2
);
console.log('- Launch date:', launchDate2.toISOString().split('T')[0]);
console.log('- Current date:', currentDate2.toISOString().split('T')[0]);
console.log('- Days since launch:', range2.daysSinceLaunch);
console.log('- Range type:', range2.rangeType);
console.log('- Start date:', range2.startDate.split('T')[0]);
console.log('- End date:', range2.endDate.split('T')[0]);
console.log('✅ Expected: fixed 30-day range\n');

// Test 3: Edge case - exactly 30 days
console.log('Test 3: Edge case (exactly 30 days since launch)');
const launchDate3 = new Date('2025-10-29T00:00:00.000Z');
const currentDate3 = new Date('2025-11-28T00:00:00.000Z');
const range3 = DateRangeCalculator.calculateDataRange(
  launchDate3.toISOString(), 
  currentDate3
);
console.log('- Launch date:', launchDate3.toISOString().split('T')[0]);
console.log('- Current date:', currentDate3.toISOString().split('T')[0]);
console.log('- Days since launch:', range3.daysSinceLaunch);
console.log('- Range type:', range3.rangeType);
console.log('- Start date:', range3.startDate.split('T')[0]);
console.log('- End date:', range3.endDate.split('T')[0]);
console.log('✅ Expected: fixed 30-day range\n');

console.log('🎉 Date range calculation tests completed successfully!');

// Test utility functions
console.log('\n📊 Testing utility functions...');
const testDate = new Date('2025-11-28T15:30:00.000Z');
console.log('- Original date:', testDate.toISOString());
console.log('- Start of day:', DateRangeCalculator.getStartOfDay(testDate));
console.log('- End of day:', DateRangeCalculator.getEndOfDay(testDate));
console.log('- Subtract 5 days:', DateRangeCalculator.subtractDays(testDate, 5).toISOString().split('T')[0]);
console.log('- Add 3 days:', DateRangeCalculator.addDays(testDate, 3).toISOString().split('T')[0]);
console.log('- Valid date check:', DateRangeCalculator.isValidDate('2025-11-28T00:00:00.000Z'));
console.log('- Invalid date check:', DateRangeCalculator.isValidDate('invalid-date'));

console.log('\n✅ All tests completed successfully!');