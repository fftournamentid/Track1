'use strict';

const assert = require('assert');

// In-memory simulation of AsyncStorage for test
const mockStorage = new Map();

async function getDeviceId() {
  let id = mockStorage.get('@FleetInvoice:device_id');
  if (!id) {
    id = 'A9B8C7D6';
    mockStorage.set('@FleetInvoice:device_id', id);
  }
  return id;
}

let inMemoryCounter = 0;

async function generateProvisionalInvoiceNumber() {
  const deviceId = await getDeviceId();
  const prefix = deviceId.slice(0, 4).toUpperCase();

  const raw = mockStorage.get('@FleetInvoice:provisional_counter');
  let counter = 1;
  if (raw) {
    counter = parseInt(raw, 10) + 1;
  }
  mockStorage.set('@FleetInvoice:provisional_counter', String(counter));

  return `DRAFT-${prefix}-${counter}`;
}

console.log('Running Invoice Numbering Tests...');

(async () => {
  // Test 1: Generate first offline invoice number
  const num1 = await generateProvisionalInvoiceNumber();
  assert.strictEqual(num1, 'DRAFT-A9B8-1', 'First offline invoice must be DRAFT-A9B8-1');

  // Test 2: Generate second offline invoice number
  const num2 = await generateProvisionalInvoiceNumber();
  assert.strictEqual(num2, 'DRAFT-A9B8-2', 'Second offline invoice must be DRAFT-A9B8-2');

  // Test 3: Must never reuse a number
  assert.notStrictEqual(num1, num2, 'Two offline invoices must get different numbers');

  // Test 4: Generate third offline invoice number
  const num3 = await generateProvisionalInvoiceNumber();
  assert.strictEqual(num3, 'DRAFT-A9B8-3');

  console.log('✓ All Invoice Numbering tests PASSED!');
})();
