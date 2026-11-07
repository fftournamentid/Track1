/**
 * Pure math functions for Cubic Feet (CFT) calculations.
 */

export type CftUnit = 'Feet' | 'Inches' | 'Meters' | 'Yards';

export interface CftFeetParams {
  lengthFt: number | string;
  lengthIn?: number | string;
  widthFt: number | string;
  widthIn?: number | string;
  heightFt: number | string;
  heightIn?: number | string;
}

export interface CftDirectParams {
  length: number | string;
  width: number | string;
  height: number | string;
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
 * Calculates CFT for Feet mode where each dimension is (ft + in / 12).
 * Dimensions are multiplied together.
 */
export function calculateCftFeet(params: CftFeetParams): number {
  const l = parseNum(params.lengthFt) + parseNum(params.lengthIn) / 12;
  const w = parseNum(params.widthFt) + parseNum(params.widthIn) / 12;
  const h = parseNum(params.heightFt) + parseNum(params.heightIn) / 12;
  return l * w * h;
}

/**
 * Calculates CFT for Inches: L * W * H / 1728.
 */
export function calculateCftInches(params: CftDirectParams): number {
  const l = parseNum(params.length);
  const w = parseNum(params.width);
  const h = parseNum(params.height);
  return (l * w * h) / 1728;
}

/**
 * Calculates CFT for Meters: L * W * H * 35.3147.
 */
export function calculateCftMeters(params: CftDirectParams): number {
  const l = parseNum(params.length);
  const w = parseNum(params.width);
  const h = parseNum(params.height);
  return l * w * h * 35.3147;
}

/**
 * Calculates CFT for Yards: L * W * H * 27.
 */
export function calculateCftYards(params: CftDirectParams): number {
  const l = parseNum(params.length);
  const w = parseNum(params.width);
  const h = parseNum(params.height);
  return l * w * h * 27;
}

export interface CftCalculationResult {
  cft: number;
  amount: number;
}

/**
 * Unified calculation function supporting all units.
 */
export function computeCft(
  unit: CftUnit,
  params: {
    lengthFt?: number | string;
    lengthIn?: number | string;
    widthFt?: number | string;
    widthIn?: number | string;
    heightFt?: number | string;
    heightIn?: number | string;
    length?: number | string;
    width?: number | string;
    height?: number | string;
    pricePerCft?: number | string;
  }
): CftCalculationResult {
  let cft = 0;
  if (unit === 'Feet') {
    cft = calculateCftFeet({
      lengthFt: params.lengthFt ?? 0,
      lengthIn: params.lengthIn ?? 0,
      widthFt: params.widthFt ?? 0,
      widthIn: params.widthIn ?? 0,
      heightFt: params.heightFt ?? 0,
      heightIn: params.heightIn ?? 0,
    });
  } else if (unit === 'Inches') {
    cft = calculateCftInches({
      length: params.length ?? 0,
      width: params.width ?? 0,
      height: params.height ?? 0,
    });
  } else if (unit === 'Meters') {
    cft = calculateCftMeters({
      length: params.length ?? 0,
      width: params.width ?? 0,
      height: params.height ?? 0,
    });
  } else if (unit === 'Yards') {
    cft = calculateCftYards({
      length: params.length ?? 0,
      width: params.width ?? 0,
      height: params.height ?? 0,
    });
  }

  const price = parseNum(params.pricePerCft);
  const amount = cft * price;

  return { cft, amount };
}
