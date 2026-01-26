/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CALCULATION INTEGRITY GATES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Deterministic validation gates that verify calculation results
 * before they are displayed or used. Invalid results are flagged
 * and optionally gated from output.
 *
 * Principle: Every calculated value has an explicit validity state.
 *
 * @standard ISA-95, NIST SP 800-82
 */

export type ValidationStatus = 'VALID' | 'WARNING' | 'INVALID' | 'MISSING' | 'STALE';

export interface ValidatedValue<T> {
  value: T;
  status: ValidationStatus;
  confidence: number;       // 0-100%
  source: string;           // Where this value came from
  timestamp: number;        // When calculated
  validationNotes: string[]; // Reasons for status
}

export interface ValidationRule {
  id: string;
  description: string;
  type: 'RANGE' | 'PHYSICS' | 'CONSISTENCY' | 'RATE' | 'CUSTOM';
  evaluate: (value: number, context: ValidationContext) => ValidationResult;
}

export interface ValidationContext {
  relatedValues: Record<string, number>;
  previousValue?: number;
  previousTimestamp?: number;
  dt: number;               // Time since last update (seconds)
  equipmentState: string;   // 'RUNNING' | 'STOPPED' | 'STARTING' | etc.
}

export interface ValidationResult {
  valid: boolean;
  status: ValidationStatus;
  confidence: number;
  notes: string[];
}

export interface IntegrityGate {
  id: string;
  description: string;
  variable: string;
  rules: ValidationRule[];
  gateMode: 'HARD' | 'SOFT' | 'REPORT_ONLY';
  lastValue: ValidatedValue<number> | null;
  violations: number;
  lastViolation?: number;
}

export interface IntegrityReport {
  timestamp: number;
  gates: IntegrityGate[];
  overallStatus: ValidationStatus;
  validCount: number;
  warningCount: number;
  invalidCount: number;
  missingCount: number;
  staleCount: number;
  messages: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION RULE LIBRARY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Range validation - value must be within min/max
 */
export function createRangeRule(
  id: string,
  min: number,
  max: number,
  unit: string
): ValidationRule {
  return {
    id,
    description: `Value must be between ${min} and ${max} ${unit}`,
    type: 'RANGE',
    evaluate: (value: number) => {
      if (value < min || value > max) {
        return {
          valid: false,
          status: 'INVALID',
          confidence: 0,
          notes: [`Value ${value.toFixed(2)} outside valid range [${min}, ${max}] ${unit}`],
        };
      }
      // Penalize values near limits
      const range = max - min;
      const distFromCenter = Math.abs(value - (min + max) / 2);
      const confidence = Math.max(0, 100 - (distFromCenter / range) * 50);
      return {
        valid: true,
        status: 'VALID',
        confidence,
        notes: [],
      };
    },
  };
}

/**
 * Physics conservation rule - outlet sum must equal inlet
 */
export function createConservationRule(
  id: string,
  inletKey: string,
  outletKeys: string[],
  tolerancePct: number
): ValidationRule {
  return {
    id,
    description: `Conservation: ${inletKey} = Σ(${outletKeys.join(' + ')}) ±${tolerancePct}%`,
    type: 'PHYSICS',
    evaluate: (_value: number, context: ValidationContext) => {
      const inlet = context.relatedValues[inletKey] || 0;
      const outletSum = outletKeys.reduce(
        (sum, key) => sum + (context.relatedValues[key] || 0),
        0
      );

      const error = inlet - outletSum;
      const errorPct = inlet !== 0 ? Math.abs(error / inlet) * 100 : 0;

      if (errorPct > tolerancePct) {
        return {
          valid: false,
          status: 'INVALID',
          confidence: Math.max(0, 100 - errorPct * 2),
          notes: [`Conservation error: ${errorPct.toFixed(2)}% (tolerance: ${tolerancePct}%)`],
        };
      }

      if (errorPct > tolerancePct * 0.5) {
        return {
          valid: true,
          status: 'WARNING',
          confidence: 100 - errorPct,
          notes: [`Conservation warning: ${errorPct.toFixed(2)}%`],
        };
      }

      return {
        valid: true,
        status: 'VALID',
        confidence: 100 - errorPct,
        notes: [],
      };
    },
  };
}

/**
 * Rate of change validation - value cannot change too fast
 */
export function createRateRule(
  id: string,
  maxRate: number,
  unit: string
): ValidationRule {
  return {
    id,
    description: `Rate limit: ≤${maxRate} ${unit}/s`,
    type: 'RATE',
    evaluate: (value: number, context: ValidationContext) => {
      if (context.previousValue === undefined || context.dt <= 0) {
        return {
          valid: true,
          status: 'VALID',
          confidence: 100,
          notes: ['No previous value for rate check'],
        };
      }

      const rate = Math.abs(value - context.previousValue) / context.dt;

      if (rate > maxRate * 2) {
        return {
          valid: false,
          status: 'INVALID',
          confidence: 0,
          notes: [`Rate ${rate.toFixed(2)} ${unit}/s exceeds limit ${maxRate} ${unit}/s`],
        };
      }

      if (rate > maxRate) {
        return {
          valid: true,
          status: 'WARNING',
          confidence: Math.max(0, 100 - ((rate - maxRate) / maxRate) * 100),
          notes: [`Rate ${rate.toFixed(2)} ${unit}/s above normal`],
        };
      }

      return {
        valid: true,
        status: 'VALID',
        confidence: 100,
        notes: [],
      };
    },
  };
}

/**
 * Consistency rule - values must be related correctly
 */
export function createConsistencyRule(
  id: string,
  description: string,
  check: (value: number, related: Record<string, number>) => { ok: boolean; note?: string }
): ValidationRule {
  return {
    id,
    description,
    type: 'CONSISTENCY',
    evaluate: (value: number, context: ValidationContext) => {
      const result = check(value, context.relatedValues);

      if (!result.ok) {
        return {
          valid: false,
          status: 'INVALID',
          confidence: 0,
          notes: [result.note || 'Consistency check failed'],
        };
      }

      return {
        valid: true,
        status: 'VALID',
        confidence: 100,
        notes: [],
      };
    },
  };
}

/**
 * Staleness check - data must be recent
 */
export function createStalenessRule(
  id: string,
  maxAgeSeconds: number
): ValidationRule {
  return {
    id,
    description: `Data must be <${maxAgeSeconds}s old`,
    type: 'CUSTOM',
    evaluate: (_value: number, context: ValidationContext) => {
      if (context.dt > maxAgeSeconds) {
        return {
          valid: false,
          status: 'STALE',
          confidence: Math.max(0, 100 - (context.dt - maxAgeSeconds) * 10),
          notes: [`Data is ${context.dt.toFixed(1)}s old (max: ${maxAgeSeconds}s)`],
        };
      }

      return {
        valid: true,
        status: 'VALID',
        confidence: 100,
        notes: [],
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRITY GATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create default integrity gates for centrifuge process
 */
export function createCentrifugeIntegrityGates(): IntegrityGate[] {
  return [
    // Feed flow validation
    {
      id: 'IG-001',
      description: 'Feed flow rate validation',
      variable: 'feedFlow',
      rules: [
        createRangeRule('FEED_RANGE', 0, 20, 'm³/hr'),
        createRateRule('FEED_RATE', 2, 'm³/hr'),
      ],
      gateMode: 'HARD',
      lastValue: null,
      violations: 0,
    },

    // Temperature validation
    {
      id: 'IG-002',
      description: 'Feed temperature validation',
      variable: 'feedTemp',
      rules: [
        createRangeRule('TEMP_RANGE', 10, 95, '°C'),
        createRateRule('TEMP_RATE', 5, '°C'),
      ],
      gateMode: 'HARD',
      lastValue: null,
      violations: 0,
    },

    // Bowl speed validation
    {
      id: 'IG-003',
      description: 'Bowl speed validation',
      variable: 'bowlSpeed',
      rules: [
        createRangeRule('SPEED_RANGE', 0, 3500, 'RPM'),
        createRateRule('SPEED_RATE', 500, 'RPM'),
      ],
      gateMode: 'HARD',
      lastValue: null,
      violations: 0,
    },

    // Differential speed validation
    {
      id: 'IG-004',
      description: 'Differential speed validation',
      variable: 'differential',
      rules: [
        createRangeRule('DIFF_RANGE', 0, 30, 'RPM'),
        createConsistencyRule('DIFF_VS_SPEED', 'Differential must be < bowl speed',
          (val, related) => ({
            ok: val < (related['bowlSpeed'] || Infinity) * 0.02,
            note: 'Differential exceeds 2% of bowl speed',
          })
        ),
      ],
      gateMode: 'HARD',
      lastValue: null,
      violations: 0,
    },

    // Centrate flow validation
    {
      id: 'IG-005',
      description: 'Centrate flow validation',
      variable: 'centrateFlow',
      rules: [
        createRangeRule('CENTRATE_RANGE', 0, 25, 'm³/hr'),
        createConsistencyRule('CENTRATE_VS_FEED', 'Centrate must be < feed',
          (val, related) => ({
            ok: val <= (related['feedFlow'] || 0) * 1.05, // Allow 5% margin
            note: 'Centrate exceeds feed flow',
          })
        ),
      ],
      gateMode: 'HARD',
      lastValue: null,
      violations: 0,
    },

    // Cake production validation
    {
      id: 'IG-006',
      description: 'Cake production validation',
      variable: 'cakeRate',
      rules: [
        createRangeRule('CAKE_RANGE', 0, 5000, 'kg/hr'),
      ],
      gateMode: 'SOFT',
      lastValue: null,
      violations: 0,
    },

    // Mass balance validation
    {
      id: 'IG-007',
      description: 'Overall mass balance',
      variable: 'massBalance',
      rules: [
        createConservationRule('MASS_CONS', 'feedMass', ['centrateMass', 'cakeMass', 'oilMass'], 3),
      ],
      gateMode: 'SOFT',
      lastValue: null,
      violations: 0,
    },

    // Solids balance validation
    {
      id: 'IG-008',
      description: 'Solids mass balance',
      variable: 'solidsBalance',
      rules: [
        createConservationRule('SOLIDS_CONS', 'feedSolids', ['centrateSolids', 'cakeSolids'], 5),
      ],
      gateMode: 'SOFT',
      lastValue: null,
      violations: 0,
    },

    // Torque validation
    {
      id: 'IG-009',
      description: 'Scroll torque validation',
      variable: 'torque',
      rules: [
        createRangeRule('TORQUE_RANGE', 0, 800, 'Nm'),
        createRateRule('TORQUE_RATE', 50, 'Nm'),
      ],
      gateMode: 'HARD',
      lastValue: null,
      violations: 0,
    },

    // Power validation
    {
      id: 'IG-010',
      description: 'Power draw validation',
      variable: 'power',
      rules: [
        createRangeRule('POWER_RANGE', 0, 100, 'kW'),
        createConsistencyRule('POWER_VS_SPEED', 'Power proportional to speed',
          (val, related) => {
            const speed = related['bowlSpeed'] || 0;
            const expectedPower = (speed / 3200) ** 3 * 75; // Cubic relationship
            const deviation = Math.abs(val - expectedPower) / (expectedPower || 1);
            return {
              ok: deviation < 0.3, // 30% tolerance
              note: `Power ${val.toFixed(1)} kW deviates ${(deviation * 100).toFixed(0)}% from expected`,
            };
          }
        ),
      ],
      gateMode: 'REPORT_ONLY',
      lastValue: null,
      violations: 0,
    },

    // G-force validation
    {
      id: 'IG-011',
      description: 'G-force validation',
      variable: 'gForce',
      rules: [
        createRangeRule('G_RANGE', 0, 4500, 'g'),
        createConsistencyRule('G_VS_SPEED', 'G-force must match RPM²',
          (val, related) => {
            const speed = related['bowlSpeed'] || 0;
            const radius = 0.25; // 250mm bowl radius
            const expectedG = (speed * Math.PI / 30) ** 2 * radius / 9.81;
            const deviation = Math.abs(val - expectedG) / (expectedG || 1);
            return {
              ok: deviation < 0.05, // 5% tolerance
              note: `G-force ${val.toFixed(0)} deviates ${(deviation * 100).toFixed(1)}% from expected ${expectedG.toFixed(0)}`,
            };
          }
        ),
      ],
      gateMode: 'HARD',
      lastValue: null,
      violations: 0,
    },

    // Separation efficiency validation
    {
      id: 'IG-012',
      description: 'Separation efficiency validation',
      variable: 'separationEfficiency',
      rules: [
        createRangeRule('EFF_RANGE', 0, 100, '%'),
        createRateRule('EFF_RATE', 5, '%'),
      ],
      gateMode: 'SOFT',
      lastValue: null,
      violations: 0,
    },
  ];
}

/**
 * Validate a single value through a gate
 */
export function validateValue(
  gate: IntegrityGate,
  value: number,
  context: ValidationContext
): { gate: IntegrityGate; validated: ValidatedValue<number> } {
  const now = Date.now();
  const validationNotes: string[] = [];
  let worstStatus: ValidationStatus = 'VALID';
  let minConfidence = 100;

  // Run all rules
  for (const rule of gate.rules) {
    const result = rule.evaluate(value, context);

    validationNotes.push(...result.notes);
    minConfidence = Math.min(minConfidence, result.confidence);

    // Track worst status
    const statusPriority: Record<ValidationStatus, number> = {
      'VALID': 0,
      'WARNING': 1,
      'STALE': 2,
      'MISSING': 3,
      'INVALID': 4,
    };

    if (statusPriority[result.status] > statusPriority[worstStatus]) {
      worstStatus = result.status;
    }
  }

  // Create validated value
  const validated: ValidatedValue<number> = {
    value: worstStatus === 'INVALID' && gate.gateMode === 'HARD'
      ? (gate.lastValue?.value ?? 0) // Use last good value for hard gates
      : value,
    status: worstStatus,
    confidence: minConfidence,
    source: gate.variable,
    timestamp: now,
    validationNotes,
  };

  // Update gate state
  const updatedGate = { ...gate, lastValue: validated };
  if (worstStatus === 'INVALID' || worstStatus === 'WARNING') {
    updatedGate.violations++;
    updatedGate.lastViolation = now;
  }

  return { gate: updatedGate, validated };
}

/**
 * Run all integrity gates on a set of values
 */
export function runIntegrityCheck(
  gates: IntegrityGate[],
  values: Record<string, number>,
  previousValues: Record<string, number>,
  dt: number,
  equipmentState: string
): IntegrityReport {
  const now = Date.now();
  const updatedGates: IntegrityGate[] = [];
  const messages: string[] = [];
  let validCount = 0;
  let warningCount = 0;
  let invalidCount = 0;
  let missingCount = 0;
  let staleCount = 0;

  for (const gate of gates) {
    const value = values[gate.variable];

    if (value === undefined) {
      missingCount++;
      const missingGate = {
        ...gate,
        lastValue: {
          value: 0,
          status: 'MISSING' as ValidationStatus,
          confidence: 0,
          source: gate.variable,
          timestamp: now,
          validationNotes: ['Value not provided'],
        },
      };
      updatedGates.push(missingGate);
      messages.push(`[MISSING] ${gate.description}`);
      continue;
    }

    const context: ValidationContext = {
      relatedValues: values,
      previousValue: previousValues[gate.variable],
      previousTimestamp: now - dt * 1000,
      dt,
      equipmentState,
    };

    const { gate: updatedGate, validated } = validateValue(gate, value, context);
    updatedGates.push(updatedGate);

    switch (validated.status) {
      case 'VALID':
        validCount++;
        break;
      case 'WARNING':
        warningCount++;
        messages.push(`[WARNING] ${gate.description}: ${validated.validationNotes.join(', ')}`);
        break;
      case 'INVALID':
        invalidCount++;
        messages.push(`[INVALID] ${gate.description}: ${validated.validationNotes.join(', ')}`);
        break;
      case 'STALE':
        staleCount++;
        messages.push(`[STALE] ${gate.description}: ${validated.validationNotes.join(', ')}`);
        break;
    }
  }

  // Determine overall status
  let overallStatus: ValidationStatus = 'VALID';
  if (missingCount > 0) overallStatus = 'MISSING';
  if (staleCount > 0) overallStatus = 'STALE';
  if (warningCount > 0) overallStatus = 'WARNING';
  if (invalidCount > 0) overallStatus = 'INVALID';

  return {
    timestamp: now,
    gates: updatedGates,
    overallStatus,
    validCount,
    warningCount,
    invalidCount,
    missingCount,
    staleCount,
    messages,
  };
}

/**
 * Get gated values (only valid/warning values pass through hard gates)
 */
export function getGatedValues(
  gates: IntegrityGate[],
  rawValues: Record<string, number>
): Record<string, ValidatedValue<number>> {
  const result: Record<string, ValidatedValue<number>> = {};

  for (const gate of gates) {
    if (gate.lastValue) {
      result[gate.variable] = gate.lastValue;
    } else {
      // No validation yet, pass through with warning
      result[gate.variable] = {
        value: rawValues[gate.variable] ?? 0,
        status: 'WARNING',
        confidence: 50,
        source: gate.variable,
        timestamp: Date.now(),
        validationNotes: ['Value not yet validated'],
      };
    }
  }

  return result;
}

/**
 * Format integrity report for display
 */
export function formatIntegrityReport(report: IntegrityReport): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    '                  INTEGRITY CHECK REPORT',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Timestamp: ${new Date(report.timestamp).toISOString()}`,
    `Overall Status: ${report.overallStatus}`,
    '',
    '─────────────────────────────────────────────────────────────────',
    '                       SUMMARY',
    '─────────────────────────────────────────────────────────────────',
    `Valid:   ${report.validCount}`,
    `Warning: ${report.warningCount}`,
    `Invalid: ${report.invalidCount}`,
    `Missing: ${report.missingCount}`,
    `Stale:   ${report.staleCount}`,
    '',
  ];

  if (report.messages.length > 0) {
    lines.push('─────────────────────────────────────────────────────────────────');
    lines.push('                      MESSAGES');
    lines.push('─────────────────────────────────────────────────────────────────');
    report.messages.forEach(msg => lines.push(msg));
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Check if a calculation can proceed based on input validity
 */
export function canProceed(
  gatedValues: Record<string, ValidatedValue<number>>,
  requiredVariables: string[]
): { proceed: boolean; reason?: string } {
  for (const variable of requiredVariables) {
    const gv = gatedValues[variable];

    if (!gv) {
      return { proceed: false, reason: `Missing required value: ${variable}` };
    }

    if (gv.status === 'INVALID' || gv.status === 'MISSING') {
      return { proceed: false, reason: `Invalid required value: ${variable}` };
    }
  }

  return { proceed: true };
}
