/**
 * Pure math functions for Freight calculations.
 */

export type WeightUnit = 'kg' | 'ton' | 'qtl' | 'quintal';
export type RateUnit = 'per kg' | 'per ton';

export interface FreightParams {
  weight: number | string;
  weightUnit: WeightUnit | string;
  rate: number | string;
  rateUnit: RateUnit | string;
}

export interface FreightResult {
  weightKg: number;
  weightTon: number;
  total: number;
}

function parseNum(val: unknown): number {
  if (typeof val === 'number') {
    return isFinite(val) ? val : 0;
  }
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Normalizes weight to kg:
 * - kg: as is
 * - ton: * 1000
 * - qtl / quintal: * 100
 */
export function convertToKg(weight: number | string, unit: WeightUnit | string): number {
  const w = parseNum(weight);
  const u = unit.toLowerCase().trim();
  if (u === 'ton') return w * 1000;
  if (u === 'qtl' || u === 'quintal') return w * 100;
  return w; // kg
}

/**
 * Calculates Freight:
 * Total = per-kg rate * kg, or per-ton rate * tons.
 */
export function computeFreight(params: FreightParams): FreightResult {
  const weightKg = convertToKg(params.weight, params.weightUnit);
  const weightTon = weightKg / 1000;
  const rate = parseNum(params.rate);
  const rUnit = params.rateUnit.toLowerCase().trim();

  const total = rUnit === 'per kg' ? weightKg * rate : weightTon * rate;

  return {
    weightKg,
    weightTon,
    total,
  };
}
