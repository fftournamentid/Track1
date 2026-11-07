'use strict';

const assert = require('assert');

// ── Tests for CFT & Freight math ──

function calculateCftFeet({ lengthFt = 0, lengthIn = 0, widthFt = 0, widthIn = 0, heightFt = 0, heightIn = 0 }) {
  const l = Number(lengthFt) + Number(lengthIn) / 12;
  const w = Number(widthFt) + Number(widthIn) / 12;
  const h = Number(heightFt) + Number(heightIn) / 12;
  return l * w * h;
}

function calculateCftInches({ length = 0, width = 0, height = 0 }) {
  return (Number(length) * Number(width) * Number(height)) / 1728;
}

function calculateCftMeters({ length = 0, width = 0, height = 0 }) {
  return Number(length) * Number(width) * Number(height) * 35.3147;
}

function calculateCftYards({ length = 0, width = 0, height = 0 }) {
  return Number(length) * Number(width) * Number(height) * 27;
}

function computeFreight({ weight, weightUnit, rate, rateUnit }) {
  const w = Number(weight) || 0;
  const u = String(weightUnit).toLowerCase().trim();
  const weightKg = u === 'ton' ? w * 1000 : (u === 'qtl' || u === 'quintal') ? w * 100 : w;
  const weightTon = weightKg / 1000;
  const r = Number(rate) || 0;
  const ru = String(rateUnit).toLowerCase().trim();
  const total = ru === 'per kg' ? weightKg * r : weightTon * r;
  return { weightKg, weightTon, total };
}

console.log('Running CFT Math Tests...');

// 1. Pure feet
{
  const cft = calculateCftFeet({ lengthFt: 10, widthFt: 5, heightFt: 2 });
  assert.strictEqual(cft, 100, '10ft x 5ft x 2ft should be 100 CFT');
}

// 2. Mixed feet + inches
{
  // 10 ft 6 in = 10.5 ft, 4 ft 0 in = 4 ft, 2 ft 6 in = 2.5 ft
  // 10.5 * 4 * 2.5 = 105 CFT
  const cft = calculateCftFeet({ lengthFt: 10, lengthIn: 6, widthFt: 4, widthIn: 0, heightFt: 2, heightIn: 6 });
  assert.strictEqual(cft, 105, '10ft 6in x 4ft x 2ft 6in should be 105 CFT');
}

// 3. Inches
{
  // 12 x 12 x 12 = 1728 cubic inches = 1 CFT
  const cft = calculateCftInches({ length: 12, width: 12, height: 12 });
  assert.strictEqual(cft, 1, '12in x 12in x 12in should be 1 CFT');
}

// 4. Meters
{
  // 1 x 1 x 1 m = 35.3147 CFT
  const cft = calculateCftMeters({ length: 1, width: 1, height: 1 });
  assert.strictEqual(cft, 35.3147, '1m x 1m x 1m should be 35.3147 CFT');
}

// 5. Yards
{
  // 1 x 1 x 1 yd = 27 CFT
  const cft = calculateCftYards({ length: 1, width: 1, height: 1 });
  assert.strictEqual(cft, 27, '1yd x 1yd x 1yd should be 27 CFT');
}

console.log('Running Freight Math Tests...');

// 6. kg with per kg rate
{
  const res = computeFreight({ weight: 500, weightUnit: 'kg', rate: 2, rateUnit: 'per kg' });
  assert.strictEqual(res.weightKg, 500);
  assert.strictEqual(res.weightTon, 0.5);
  assert.strictEqual(res.total, 1000);
}

// 7. kg with per ton rate
{
  const res = computeFreight({ weight: 2500, weightUnit: 'kg', rate: 1000, rateUnit: 'per ton' });
  assert.strictEqual(res.weightKg, 2500);
  assert.strictEqual(res.weightTon, 2.5);
  assert.strictEqual(res.total, 2500);
}

// 8. ton with per ton rate
{
  const res = computeFreight({ weight: 10, weightUnit: 'ton', rate: 1500, rateUnit: 'per ton' });
  assert.strictEqual(res.weightKg, 10000);
  assert.strictEqual(res.weightTon, 10);
  assert.strictEqual(res.total, 15000);
}

// 9. ton with per kg rate
{
  const res = computeFreight({ weight: 2, weightUnit: 'ton', rate: 5, rateUnit: 'per kg' });
  assert.strictEqual(res.weightKg, 2000);
  assert.strictEqual(res.weightTon, 2);
  assert.strictEqual(res.total, 10000);
}

// 10. quintal (qtl) with per kg and per ton
{
  const resQtl = computeFreight({ weight: 20, weightUnit: 'qtl', rate: 3, rateUnit: 'per kg' });
  assert.strictEqual(resQtl.weightKg, 2000, '20 qtl = 2000 kg');
  assert.strictEqual(resQtl.weightTon, 2);
  assert.strictEqual(resQtl.total, 6000);

  const resQuintal = computeFreight({ weight: 10, weightUnit: 'quintal', rate: 2000, rateUnit: 'per ton' });
  assert.strictEqual(resQuintal.weightKg, 1000, '10 quintal = 1000 kg');
  assert.strictEqual(resQuintal.weightTon, 1);
  assert.strictEqual(resQuintal.total, 2000);
}

console.log('✓ All CFT and Freight math tests PASSED!');
