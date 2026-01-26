/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INDEPENDENT MASS BALANCE VALIDATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This module validates mass balance WITHOUT forcing closure.
 * Each outlet stream is calculated independently based on physics,
 * then compared against conservation laws.
 *
 * Key principle: Mass balance error is REPORTED, not hidden.
 *
 * @standard ISA-95, NIST SP 800-82
 */

export interface StreamComposition {
  totalMass: number;      // kg/hr
  waterMass: number;      // kg/hr
  oilMass: number;        // kg/hr
  solidsMass: number;     // kg/hr
  temperature: number;    // °C
  density: number;        // kg/m³
  flowRate: number;       // m³/hr
}

export interface MassBalanceInput {
  feed: StreamComposition;
  centrate: StreamComposition;
  cake: StreamComposition;
  oilRecovered: number;   // kg/hr (from skimmer)
  timestamp: number;
}

export interface MassBalanceResult {
  valid: boolean;
  toleranceExceeded: boolean;

  // Mass balance closure
  totalIn: number;
  totalOut: number;
  closure: number;          // % (100 = perfect)
  closureError: number;     // kg/hr absolute
  closureErrorPct: number;  // % of feed

  // Component balances
  waterBalance: ComponentBalance;
  oilBalance: ComponentBalance;
  solidsBalance: ComponentBalance;

  // Quality metrics
  centrateSolids: number;   // % (should be low)
  cakeMoisture: number;     // % (should match target)
  oilRecovery: number;      // % of inlet oil

  // Validation status
  alerts: MassBalanceAlert[];
  status: 'OK' | 'WARNING' | 'ALARM' | 'FAULT';
  statusCode: string;

  // Audit trail
  calculatedAt: number;
  inputHash: string;        // For integrity verification
}

export interface ComponentBalance {
  inlet: number;      // kg/hr
  outlet: number;     // kg/hr
  closure: number;    // %
  error: number;      // kg/hr
  valid: boolean;
}

export interface MassBalanceAlert {
  code: string;
  severity: 'INFO' | 'WARNING' | 'ALARM' | 'FAULT';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export interface MassBalanceConfig {
  // Tolerances
  overallClosureTolerance: number;    // % (default 2%)
  componentClosureTolerance: number;  // % (default 5%)
  maxCentrateSolids: number;          // % (default 0.5%)
  targetCakeMoisture: number;         // % (default 65%)
  cakeMoistureTolerance: number;      // % (default ±5%)
  minOilRecovery: number;             // % (default 85%)

  // Physics constraints
  minDensity: number;                 // kg/m³
  maxDensity: number;                 // kg/m³
  minTemperature: number;             // °C
  maxTemperature: number;             // °C

  // Alert thresholds
  warningThreshold: number;           // % deviation for warning
  alarmThreshold: number;             // % deviation for alarm
}

const DEFAULT_CONFIG: MassBalanceConfig = {
  overallClosureTolerance: 2.0,
  componentClosureTolerance: 5.0,
  maxCentrateSolids: 0.5,
  targetCakeMoisture: 65,
  cakeMoistureTolerance: 5,
  minOilRecovery: 85,
  minDensity: 900,
  maxDensity: 1300,
  minTemperature: 10,
  maxTemperature: 95,
  warningThreshold: 1.5,
  alarmThreshold: 3.0,
};

/**
 * Simple hash for input validation (not cryptographic)
 */
function hashInput(input: MassBalanceInput): string {
  const data = JSON.stringify({
    feedTotal: input.feed.totalMass,
    centrateTotal: input.centrate.totalMass,
    cakeTotal: input.cake.totalMass,
    oilRecovered: input.oilRecovered,
    timestamp: input.timestamp,
  });
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Validate a single stream for physics consistency
 */
function validateStream(stream: StreamComposition, name: string, config: MassBalanceConfig): MassBalanceAlert[] {
  const alerts: MassBalanceAlert[] = [];
  const timestamp = Date.now();

  // Density check
  if (stream.density < config.minDensity || stream.density > config.maxDensity) {
    alerts.push({
      code: `${name}_DENSITY_OOR`,
      severity: 'WARNING',
      message: `${name} density out of range: ${stream.density.toFixed(1)} kg/m³`,
      value: stream.density,
      threshold: stream.density < config.minDensity ? config.minDensity : config.maxDensity,
      timestamp,
    });
  }

  // Temperature check
  if (stream.temperature < config.minTemperature || stream.temperature > config.maxTemperature) {
    alerts.push({
      code: `${name}_TEMP_OOR`,
      severity: 'WARNING',
      message: `${name} temperature out of range: ${stream.temperature.toFixed(1)}°C`,
      value: stream.temperature,
      threshold: stream.temperature < config.minTemperature ? config.minTemperature : config.maxTemperature,
      timestamp,
    });
  }

  // Mass consistency: total should equal sum of components
  const componentSum = stream.waterMass + stream.oilMass + stream.solidsMass;
  const massError = Math.abs(stream.totalMass - componentSum);
  const massErrorPct = stream.totalMass > 0 ? (massError / stream.totalMass) * 100 : 0;

  if (massErrorPct > 0.1) { // 0.1% tolerance
    alerts.push({
      code: `${name}_MASS_INCONSISTENT`,
      severity: massErrorPct > 1 ? 'ALARM' : 'WARNING',
      message: `${name} component masses don't sum to total: error ${massErrorPct.toFixed(2)}%`,
      value: massErrorPct,
      threshold: 0.1,
      timestamp,
    });
  }

  // Flow rate vs density consistency
  if (stream.flowRate > 0 && stream.density > 0) {
    const calculatedMass = stream.flowRate * stream.density;
    const flowMassError = Math.abs(stream.totalMass - calculatedMass);
    const flowMassErrorPct = stream.totalMass > 0 ? (flowMassError / stream.totalMass) * 100 : 0;

    if (flowMassErrorPct > 1) {
      alerts.push({
        code: `${name}_FLOW_MASS_MISMATCH`,
        severity: 'WARNING',
        message: `${name} flow rate inconsistent with mass: error ${flowMassErrorPct.toFixed(2)}%`,
        value: flowMassErrorPct,
        threshold: 1,
        timestamp,
      });
    }
  }

  return alerts;
}

/**
 * Calculate component balance
 */
function calculateComponentBalance(
  inlet: number,
  outlet: number,
  tolerance: number
): ComponentBalance {
  const error = inlet - outlet;
  const closure = inlet > 0 ? (outlet / inlet) * 100 : (outlet === 0 ? 100 : 0);
  const valid = Math.abs(100 - closure) <= tolerance;

  return {
    inlet,
    outlet,
    closure,
    error,
    valid,
  };
}

/**
 * Main mass balance calculation - NO FORCED CLOSURE
 *
 * This function independently validates each stream and reports
 * any mass balance discrepancies. It does NOT adjust values to
 * force closure.
 */
export function calculateMassBalance(
  input: MassBalanceInput,
  config: Partial<MassBalanceConfig> = {}
): MassBalanceResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const alerts: MassBalanceAlert[] = [];
  const timestamp = Date.now();

  // Validate input streams
  alerts.push(...validateStream(input.feed, 'FEED', cfg));
  alerts.push(...validateStream(input.centrate, 'CENTRATE', cfg));
  alerts.push(...validateStream(input.cake, 'CAKE', cfg));

  // Calculate total mass balance
  const totalIn = input.feed.totalMass;
  const totalOut = input.centrate.totalMass + input.cake.totalMass + input.oilRecovered;
  const closureError = totalIn - totalOut;
  const closureErrorPct = totalIn > 0 ? (closureError / totalIn) * 100 : 0;
  const closure = totalIn > 0 ? (totalOut / totalIn) * 100 : 100;

  // Component balances (calculated independently)
  const waterBalance = calculateComponentBalance(
    input.feed.waterMass,
    input.centrate.waterMass + input.cake.waterMass,
    cfg.componentClosureTolerance
  );

  const oilBalance = calculateComponentBalance(
    input.feed.oilMass,
    input.centrate.oilMass + input.cake.oilMass + input.oilRecovered,
    cfg.componentClosureTolerance
  );

  const solidsBalance = calculateComponentBalance(
    input.feed.solidsMass,
    input.centrate.solidsMass + input.cake.solidsMass,
    cfg.componentClosureTolerance
  );

  // Quality metrics
  const centrateSolids = input.centrate.totalMass > 0
    ? (input.centrate.solidsMass / input.centrate.totalMass) * 100
    : 0;

  const cakeMoisture = input.cake.totalMass > 0
    ? (input.cake.waterMass / input.cake.totalMass) * 100
    : 0;

  const oilRecovery = input.feed.oilMass > 0
    ? (input.oilRecovered / input.feed.oilMass) * 100
    : 0;

  // Generate alerts based on results
  const toleranceExceeded = Math.abs(100 - closure) > cfg.overallClosureTolerance;

  if (Math.abs(closureErrorPct) > cfg.alarmThreshold) {
    alerts.push({
      code: 'MASS_BALANCE_ALARM',
      severity: 'ALARM',
      message: `Mass balance closure error: ${closureErrorPct.toFixed(2)}% (${closureError.toFixed(1)} kg/hr)`,
      value: closureErrorPct,
      threshold: cfg.alarmThreshold,
      timestamp,
    });
  } else if (Math.abs(closureErrorPct) > cfg.warningThreshold) {
    alerts.push({
      code: 'MASS_BALANCE_WARNING',
      severity: 'WARNING',
      message: `Mass balance deviation: ${closureErrorPct.toFixed(2)}%`,
      value: closureErrorPct,
      threshold: cfg.warningThreshold,
      timestamp,
    });
  }

  if (!waterBalance.valid) {
    alerts.push({
      code: 'WATER_BALANCE_ERROR',
      severity: 'WARNING',
      message: `Water balance closure: ${waterBalance.closure.toFixed(1)}%`,
      value: waterBalance.closure,
      threshold: cfg.componentClosureTolerance,
      timestamp,
    });
  }

  if (!oilBalance.valid) {
    alerts.push({
      code: 'OIL_BALANCE_ERROR',
      severity: 'WARNING',
      message: `Oil balance closure: ${oilBalance.closure.toFixed(1)}%`,
      value: oilBalance.closure,
      threshold: cfg.componentClosureTolerance,
      timestamp,
    });
  }

  if (!solidsBalance.valid) {
    alerts.push({
      code: 'SOLIDS_BALANCE_ERROR',
      severity: 'WARNING',
      message: `Solids balance closure: ${solidsBalance.closure.toFixed(1)}%`,
      value: solidsBalance.closure,
      threshold: cfg.componentClosureTolerance,
      timestamp,
    });
  }

  if (centrateSolids > cfg.maxCentrateSolids) {
    alerts.push({
      code: 'CENTRATE_SOLIDS_HIGH',
      severity: 'WARNING',
      message: `Centrate solids too high: ${centrateSolids.toFixed(2)}%`,
      value: centrateSolids,
      threshold: cfg.maxCentrateSolids,
      timestamp,
    });
  }

  const moistureDeviation = Math.abs(cakeMoisture - cfg.targetCakeMoisture);
  if (moistureDeviation > cfg.cakeMoistureTolerance) {
    alerts.push({
      code: 'CAKE_MOISTURE_DEVIATION',
      severity: moistureDeviation > cfg.cakeMoistureTolerance * 2 ? 'ALARM' : 'WARNING',
      message: `Cake moisture deviation: ${cakeMoisture.toFixed(1)}% (target: ${cfg.targetCakeMoisture}%)`,
      value: cakeMoisture,
      threshold: cfg.targetCakeMoisture,
      timestamp,
    });
  }

  if (oilRecovery < cfg.minOilRecovery && input.feed.oilMass > 0) {
    alerts.push({
      code: 'OIL_RECOVERY_LOW',
      severity: 'WARNING',
      message: `Oil recovery below target: ${oilRecovery.toFixed(1)}%`,
      value: oilRecovery,
      threshold: cfg.minOilRecovery,
      timestamp,
    });
  }

  // Determine overall status
  let status: 'OK' | 'WARNING' | 'ALARM' | 'FAULT' = 'OK';
  let statusCode = 'NORMAL';

  const hasFault = alerts.some(a => a.severity === 'FAULT');
  const hasAlarm = alerts.some(a => a.severity === 'ALARM');
  const hasWarning = alerts.some(a => a.severity === 'WARNING');

  if (hasFault) {
    status = 'FAULT';
    statusCode = alerts.find(a => a.severity === 'FAULT')?.code || 'FAULT';
  } else if (hasAlarm) {
    status = 'ALARM';
    statusCode = alerts.find(a => a.severity === 'ALARM')?.code || 'ALARM';
  } else if (hasWarning) {
    status = 'WARNING';
    statusCode = alerts.find(a => a.severity === 'WARNING')?.code || 'WARNING';
  }

  const valid = !hasFault && !hasAlarm && !toleranceExceeded;

  return {
    valid,
    toleranceExceeded,
    totalIn,
    totalOut,
    closure,
    closureError,
    closureErrorPct,
    waterBalance,
    oilBalance,
    solidsBalance,
    centrateSolids,
    cakeMoisture,
    oilRecovery,
    alerts,
    status,
    statusCode,
    calculatedAt: timestamp,
    inputHash: hashInput(input),
  };
}

/**
 * Create a stream composition from raw values
 */
export function createStreamComposition(
  flowRate: number,       // m³/hr
  density: number,        // kg/m³
  waterPct: number,       // %
  oilPct: number,         // %
  solidsPct: number,      // %
  temperature: number     // °C
): StreamComposition {
  const totalMass = flowRate * density;

  return {
    totalMass,
    waterMass: totalMass * (waterPct / 100),
    oilMass: totalMass * (oilPct / 100),
    solidsMass: totalMass * (solidsPct / 100),
    temperature,
    density,
    flowRate,
  };
}

/**
 * Create zero stream (for initialization)
 */
export function createZeroStream(): StreamComposition {
  return {
    totalMass: 0,
    waterMass: 0,
    oilMass: 0,
    solidsMass: 0,
    temperature: 20,
    density: 1000,
    flowRate: 0,
  };
}

/**
 * Format mass balance result for display
 */
export function formatMassBalanceReport(result: MassBalanceResult): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    '                    MASS BALANCE REPORT',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Status: ${result.status} (${result.statusCode})`,
    `Calculated: ${new Date(result.calculatedAt).toISOString()}`,
    `Input Hash: ${result.inputHash}`,
    '',
    '─────────────────────────────────────────────────────────────────',
    '                    OVERALL BALANCE',
    '─────────────────────────────────────────────────────────────────',
    `Total In:      ${result.totalIn.toFixed(1)} kg/hr`,
    `Total Out:     ${result.totalOut.toFixed(1)} kg/hr`,
    `Closure:       ${result.closure.toFixed(2)}%`,
    `Error:         ${result.closureError.toFixed(2)} kg/hr (${result.closureErrorPct.toFixed(2)}%)`,
    '',
    '─────────────────────────────────────────────────────────────────',
    '                   COMPONENT BALANCES',
    '─────────────────────────────────────────────────────────────────',
    `Water:   In: ${result.waterBalance.inlet.toFixed(1)} → Out: ${result.waterBalance.outlet.toFixed(1)} kg/hr (${result.waterBalance.closure.toFixed(1)}%) ${result.waterBalance.valid ? '✓' : '✗'}`,
    `Oil:     In: ${result.oilBalance.inlet.toFixed(1)} → Out: ${result.oilBalance.outlet.toFixed(1)} kg/hr (${result.oilBalance.closure.toFixed(1)}%) ${result.oilBalance.valid ? '✓' : '✗'}`,
    `Solids:  In: ${result.solidsBalance.inlet.toFixed(1)} → Out: ${result.solidsBalance.outlet.toFixed(1)} kg/hr (${result.solidsBalance.closure.toFixed(1)}%) ${result.solidsBalance.valid ? '✓' : '✗'}`,
    '',
    '─────────────────────────────────────────────────────────────────',
    '                   QUALITY METRICS',
    '─────────────────────────────────────────────────────────────────',
    `Centrate Solids: ${result.centrateSolids.toFixed(3)}%`,
    `Cake Moisture:   ${result.cakeMoisture.toFixed(1)}%`,
    `Oil Recovery:    ${result.oilRecovery.toFixed(1)}%`,
    '',
  ];

  if (result.alerts.length > 0) {
    lines.push('─────────────────────────────────────────────────────────────────');
    lines.push('                       ALERTS');
    lines.push('─────────────────────────────────────────────────────────────────');
    result.alerts.forEach(alert => {
      lines.push(`[${alert.severity}] ${alert.code}: ${alert.message}`);
    });
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}
