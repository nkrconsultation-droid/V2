/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EQUIPMENT CONSTRAINTS AND INTERLOCKS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Enforced constraints (not advisory) for equipment protection and
 * process safety. These constraints override operator commands.
 *
 * Equipment: SACOR Delta-Canter 20-843A
 *
 * @standard ISA-84, IEC 61511 (Safety Instrumented Systems)
 */

export type ConstraintSeverity = 'SOFT' | 'HARD' | 'TRIP';

export interface Constraint {
  id: string;
  description: string;
  variable: string;
  severity: ConstraintSeverity;
  minValue?: number;
  maxValue?: number;
  unit: string;
  action: ConstraintAction;
  bypassable: boolean;
  bypassed: boolean;
  violated: boolean;
  violationTime?: number;
  currentValue: number;
}

export type ConstraintAction =
  | 'LIMIT'           // Clamp to limit
  | 'ALARM'           // Generate alarm only
  | 'REDUCE_SPEED'    // Reduce centrifuge speed
  | 'REDUCE_FEED'     // Reduce feed rate
  | 'STOP_FEED'       // Stop feed completely
  | 'SHUTDOWN'        // Emergency shutdown
  | 'LOCKOUT';        // Prevent restart

export interface Interlock {
  id: string;
  description: string;
  type: 'PERMISSIVE' | 'TRIP' | 'SAFETY';
  conditions: InterlockCondition[];
  logic: 'AND' | 'OR';
  action: InterlockAction;
  active: boolean;
  triggered: boolean;
  triggerTime?: number;
  resetRequired: boolean;
  autoReset: boolean;
  resetDelay: number;    // seconds
}

export interface InterlockCondition {
  variable: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number;
  met: boolean;
  hysteresis?: number;
}

export type InterlockAction =
  | 'BLOCK_START'       // Prevent startup
  | 'STOP_FEED'         // Stop feed pump
  | 'REDUCE_SPEED'      // Reduce bowl speed
  | 'STOP_CENTRIFUGE'   // Stop bowl
  | 'STOP_CONVEYOR'     // Stop scroll conveyor
  | 'CLOSE_VALVE'       // Close feed valve
  | 'EMERGENCY_STOP'    // Full E-stop
  | 'ACTIVATE_FLUSH';   // Activate flush sequence

export interface EquipmentState {
  running: boolean;
  speed: number;          // RPM
  torque: number;         // Nm
  vibration: number;      // mm/s
  bearingTemp: number;    // °C
  motorTemp: number;      // °C
  feedRate: number;       // m³/hr
  feedTemp: number;       // °C
  feedPressure: number;   // kPa
  pondDepth: number;      // mm
  differentialSpeed: number; // RPM
  powerDraw: number;      // kW
  runtime: number;        // hours
}

export interface ConstraintConfig {
  // SACOR Delta-Canter 20-843A Nameplate Limits
  maxBowlSpeed: number;       // 3200 RPM
  minBowlSpeed: number;       // 1800 RPM
  maxDifferential: number;    // 25 RPM
  minDifferential: number;    // 2 RPM
  maxTorque: number;          // 650 Nm
  maxVibration: number;       // 4.5 mm/s
  maxBearingTemp: number;     // 80°C
  maxMotorTemp: number;       // 85°C
  maxFeedRate: number;        // 15 m³/hr
  minFeedTemp: number;        // 55°C
  maxFeedTemp: number;        // 85°C
  maxFeedPressure: number;    // 400 kPa
  minPondDepth: number;       // 100 mm
  maxPondDepth: number;       // 170 mm
  maxPowerDraw: number;       // 75 kW
  maxRuntime: number;         // 168 hours (before maintenance)
}

export interface ConstraintResult {
  constraints: Constraint[];
  interlocks: Interlock[];
  anyViolated: boolean;
  anyTripped: boolean;
  actions: ConstraintAction[];
  status: 'NORMAL' | 'LIMITED' | 'ALARM' | 'TRIP' | 'LOCKOUT';
  statusMessage: string;
  enforcedLimits: {
    speed?: number;
    feedRate?: number;
    differential?: number;
  };
}

// SACOR Delta-Canter 20-843A Default Configuration
const DEFAULT_CONFIG: ConstraintConfig = {
  maxBowlSpeed: 3200,
  minBowlSpeed: 1800,
  maxDifferential: 25,
  minDifferential: 2,
  maxTorque: 650,
  maxVibration: 4.5,
  maxBearingTemp: 80,
  maxMotorTemp: 85,
  maxFeedRate: 15,
  minFeedTemp: 55,
  maxFeedTemp: 85,
  maxFeedPressure: 400,
  minPondDepth: 100,
  maxPondDepth: 170,
  maxPowerDraw: 75,
  maxRuntime: 168,
};

/**
 * Create equipment constraints for SACOR Delta-Canter
 */
export function createConstraints(config: Partial<ConstraintConfig> = {}): Constraint[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return [
    // Bowl Speed Constraints
    {
      id: 'CS-001',
      description: 'Bowl speed maximum limit',
      variable: 'speed',
      severity: 'HARD',
      maxValue: cfg.maxBowlSpeed,
      unit: 'RPM',
      action: 'LIMIT',
      bypassable: false,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },
    {
      id: 'CS-002',
      description: 'Bowl speed minimum limit',
      variable: 'speed',
      severity: 'SOFT',
      minValue: cfg.minBowlSpeed,
      unit: 'RPM',
      action: 'ALARM',
      bypassable: true,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },

    // Differential Speed Constraints
    {
      id: 'CS-003',
      description: 'Differential speed maximum',
      variable: 'differentialSpeed',
      severity: 'HARD',
      maxValue: cfg.maxDifferential,
      unit: 'RPM',
      action: 'LIMIT',
      bypassable: false,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },
    {
      id: 'CS-004',
      description: 'Differential speed minimum',
      variable: 'differentialSpeed',
      severity: 'SOFT',
      minValue: cfg.minDifferential,
      unit: 'RPM',
      action: 'ALARM',
      bypassable: true,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },

    // Torque Constraints
    {
      id: 'CS-005',
      description: 'Scroll torque high limit',
      variable: 'torque',
      severity: 'HARD',
      maxValue: cfg.maxTorque,
      unit: 'Nm',
      action: 'REDUCE_FEED',
      bypassable: false,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },
    {
      id: 'CS-006',
      description: 'Scroll torque trip',
      variable: 'torque',
      severity: 'TRIP',
      maxValue: cfg.maxTorque * 1.1, // 110% = trip
      unit: 'Nm',
      action: 'STOP_FEED',
      bypassable: false,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },

    // Vibration Constraints
    {
      id: 'CS-007',
      description: 'Vibration high alarm',
      variable: 'vibration',
      severity: 'HARD',
      maxValue: cfg.maxVibration,
      unit: 'mm/s',
      action: 'REDUCE_SPEED',
      bypassable: false,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },
    {
      id: 'CS-008',
      description: 'Vibration trip',
      variable: 'vibration',
      severity: 'TRIP',
      maxValue: cfg.maxVibration * 1.5, // 150% = trip
      unit: 'mm/s',
      action: 'SHUTDOWN',
      bypassable: false,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },

    // Temperature Constraints
    {
      id: 'CS-009',
      description: 'Bearing temperature high',
      variable: 'bearingTemp',
      severity: 'HARD',
      maxValue: cfg.maxBearingTemp,
      unit: '°C',
      action: 'REDUCE_SPEED',
      bypassable: false,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },
    {
      id: 'CS-010',
      description: 'Motor temperature high',
      variable: 'motorTemp',
      severity: 'HARD',
      maxValue: cfg.maxMotorTemp,
      unit: '°C',
      action: 'REDUCE_SPEED',
      bypassable: false,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },

    // Feed Constraints
    {
      id: 'CS-011',
      description: 'Feed rate maximum',
      variable: 'feedRate',
      severity: 'HARD',
      maxValue: cfg.maxFeedRate,
      unit: 'm³/hr',
      action: 'LIMIT',
      bypassable: false,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },
    {
      id: 'CS-012',
      description: 'Feed temperature low',
      variable: 'feedTemp',
      severity: 'SOFT',
      minValue: cfg.minFeedTemp,
      unit: '°C',
      action: 'ALARM',
      bypassable: true,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },
    {
      id: 'CS-013',
      description: 'Feed temperature high',
      variable: 'feedTemp',
      severity: 'HARD',
      maxValue: cfg.maxFeedTemp,
      unit: '°C',
      action: 'REDUCE_FEED',
      bypassable: false,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },

    // Pond Depth Constraints
    {
      id: 'CS-014',
      description: 'Pond depth minimum',
      variable: 'pondDepth',
      severity: 'SOFT',
      minValue: cfg.minPondDepth,
      unit: 'mm',
      action: 'ALARM',
      bypassable: true,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },
    {
      id: 'CS-015',
      description: 'Pond depth maximum',
      variable: 'pondDepth',
      severity: 'HARD',
      maxValue: cfg.maxPondDepth,
      unit: 'mm',
      action: 'ALARM',
      bypassable: true,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },

    // Power and Runtime
    {
      id: 'CS-016',
      description: 'Power draw high',
      variable: 'powerDraw',
      severity: 'HARD',
      maxValue: cfg.maxPowerDraw,
      unit: 'kW',
      action: 'REDUCE_SPEED',
      bypassable: false,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },
    {
      id: 'CS-017',
      description: 'Runtime maintenance due',
      variable: 'runtime',
      severity: 'SOFT',
      maxValue: cfg.maxRuntime,
      unit: 'hr',
      action: 'ALARM',
      bypassable: true,
      bypassed: false,
      violated: false,
      currentValue: 0,
    },
  ];
}

/**
 * Create safety interlocks
 */
export function createInterlocks(config: Partial<ConstraintConfig> = {}): Interlock[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return [
    // Start Permissives
    {
      id: 'IL-001',
      description: 'Start permissive - Feed temperature',
      type: 'PERMISSIVE',
      conditions: [
        { variable: 'feedTemp', operator: '>=', threshold: cfg.minFeedTemp, met: false },
      ],
      logic: 'AND',
      action: 'BLOCK_START',
      active: true,
      triggered: false,
      resetRequired: false,
      autoReset: true,
      resetDelay: 0,
    },
    {
      id: 'IL-002',
      description: 'Start permissive - Bowl at speed',
      type: 'PERMISSIVE',
      conditions: [
        { variable: 'speed', operator: '>=', threshold: cfg.minBowlSpeed, met: false },
      ],
      logic: 'AND',
      action: 'BLOCK_START',
      active: true,
      triggered: false,
      resetRequired: false,
      autoReset: true,
      resetDelay: 0,
    },

    // Process Trips
    {
      id: 'IL-003',
      description: 'High torque trip',
      type: 'TRIP',
      conditions: [
        { variable: 'torque', operator: '>', threshold: cfg.maxTorque * 1.1, met: false, hysteresis: 20 },
      ],
      logic: 'AND',
      action: 'STOP_FEED',
      active: true,
      triggered: false,
      resetRequired: true,
      autoReset: false,
      resetDelay: 30,
    },
    {
      id: 'IL-004',
      description: 'High vibration trip',
      type: 'TRIP',
      conditions: [
        { variable: 'vibration', operator: '>', threshold: cfg.maxVibration * 1.5, met: false, hysteresis: 0.5 },
      ],
      logic: 'AND',
      action: 'STOP_CENTRIFUGE',
      active: true,
      triggered: false,
      resetRequired: true,
      autoReset: false,
      resetDelay: 60,
    },
    {
      id: 'IL-005',
      description: 'Bearing temperature trip',
      type: 'TRIP',
      conditions: [
        { variable: 'bearingTemp', operator: '>', threshold: cfg.maxBearingTemp + 10, met: false, hysteresis: 5 },
      ],
      logic: 'AND',
      action: 'STOP_CENTRIFUGE',
      active: true,
      triggered: false,
      resetRequired: true,
      autoReset: false,
      resetDelay: 300,
    },

    // Safety Interlocks
    {
      id: 'IL-006',
      description: 'Low speed - Stop feed',
      type: 'SAFETY',
      conditions: [
        { variable: 'speed', operator: '<', threshold: cfg.minBowlSpeed * 0.9, met: false, hysteresis: 50 },
      ],
      logic: 'AND',
      action: 'STOP_FEED',
      active: true,
      triggered: false,
      resetRequired: false,
      autoReset: true,
      resetDelay: 5,
    },
    {
      id: 'IL-007',
      description: 'Feed pressure trip',
      type: 'SAFETY',
      conditions: [
        { variable: 'feedPressure', operator: '>', threshold: cfg.maxFeedPressure, met: false, hysteresis: 20 },
      ],
      logic: 'AND',
      action: 'CLOSE_VALVE',
      active: true,
      triggered: false,
      resetRequired: false,
      autoReset: true,
      resetDelay: 10,
    },
  ];
}

/**
 * Evaluate a single condition
 */
function evaluateCondition(condition: InterlockCondition, value: number): boolean {
  const threshold = condition.threshold;
  const hysteresis = condition.hysteresis || 0;

  // Apply hysteresis based on previous state
  const effectiveThreshold = condition.met
    ? (condition.operator === '>' || condition.operator === '>=')
      ? threshold - hysteresis
      : threshold + hysteresis
    : threshold;

  switch (condition.operator) {
    case '>': return value > effectiveThreshold;
    case '<': return value < effectiveThreshold;
    case '>=': return value >= effectiveThreshold;
    case '<=': return value <= effectiveThreshold;
    case '==': return Math.abs(value - threshold) < 0.001;
    case '!=': return Math.abs(value - threshold) >= 0.001;
    default: return false;
  }
}

/**
 * Main constraint evaluation function
 *
 * Returns enforced limits that MUST be applied by the control system.
 * These are not suggestions - they are mandatory.
 */
export function evaluateConstraints(
  equipment: EquipmentState,
  constraints: Constraint[],
  interlocks: Interlock[],
  config: Partial<ConstraintConfig> = {}
): ConstraintResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();
  const actions: ConstraintAction[] = [];
  const enforcedLimits: { speed?: number; feedRate?: number; differential?: number } = {};

  let anyViolated = false;
  let anyTripped = false;
  let status: 'NORMAL' | 'LIMITED' | 'ALARM' | 'TRIP' | 'LOCKOUT' = 'NORMAL';
  let statusMessage = 'All constraints satisfied';

  // Evaluate constraints
  const evaluatedConstraints = constraints.map(constraint => {
    const value = equipment[constraint.variable as keyof EquipmentState] as number;
    const newConstraint = { ...constraint, currentValue: value };

    // Check violation
    let violated = false;
    if (constraint.minValue !== undefined && value < constraint.minValue) {
      violated = true;
    }
    if (constraint.maxValue !== undefined && value > constraint.maxValue) {
      violated = true;
    }

    // Handle bypassed constraints
    if (constraint.bypassed && constraint.bypassable) {
      violated = false;
    }

    newConstraint.violated = violated;
    if (violated && !constraint.violationTime) {
      newConstraint.violationTime = now;
    } else if (!violated) {
      newConstraint.violationTime = undefined;
    }

    if (violated) {
      anyViolated = true;
      actions.push(constraint.action);

      // Enforce hard limits
      if (constraint.severity === 'HARD' || constraint.severity === 'TRIP') {
        if (constraint.variable === 'speed' && constraint.maxValue !== undefined) {
          enforcedLimits.speed = Math.min(enforcedLimits.speed ?? Infinity, constraint.maxValue);
        }
        if (constraint.variable === 'feedRate' && constraint.maxValue !== undefined) {
          enforcedLimits.feedRate = Math.min(enforcedLimits.feedRate ?? Infinity, constraint.maxValue);
        }
        if (constraint.variable === 'differentialSpeed' && constraint.maxValue !== undefined) {
          enforcedLimits.differential = Math.min(enforcedLimits.differential ?? Infinity, constraint.maxValue);
        }
      }

      if (constraint.severity === 'TRIP') {
        anyTripped = true;
      }
    }

    return newConstraint;
  });

  // Evaluate interlocks
  const evaluatedInterlocks = interlocks.map(interlock => {
    const newInterlock = { ...interlock };

    // Evaluate each condition
    const evaluatedConditions = interlock.conditions.map(condition => {
      const value = equipment[condition.variable as keyof EquipmentState] as number;
      const met = evaluateCondition(condition, value);
      return { ...condition, met };
    });

    newInterlock.conditions = evaluatedConditions;

    // Determine if interlock is triggered
    const triggered = interlock.logic === 'AND'
      ? evaluatedConditions.every(c => c.met)
      : evaluatedConditions.some(c => c.met);

    // Handle trip latching
    if (triggered && !interlock.triggered) {
      newInterlock.triggered = true;
      newInterlock.triggerTime = now;
      actions.push(interlock.action as ConstraintAction);

      if (interlock.type === 'TRIP' || interlock.type === 'SAFETY') {
        anyTripped = true;
      }
    }

    // Handle auto-reset
    if (!triggered && interlock.triggered && interlock.autoReset && !interlock.resetRequired) {
      const triggerDuration = (now - (interlock.triggerTime || now)) / 1000;
      if (triggerDuration >= interlock.resetDelay) {
        newInterlock.triggered = false;
        newInterlock.triggerTime = undefined;
      }
    }

    // Apply interlock actions to enforced limits
    if (newInterlock.triggered) {
      switch (interlock.action) {
        case 'STOP_FEED':
        case 'CLOSE_VALVE':
          enforcedLimits.feedRate = 0;
          break;
        case 'REDUCE_SPEED':
          enforcedLimits.speed = Math.min(
            enforcedLimits.speed ?? Infinity,
            cfg.minBowlSpeed
          );
          break;
        case 'STOP_CENTRIFUGE':
          enforcedLimits.speed = 0;
          enforcedLimits.feedRate = 0;
          break;
      }
    }

    return newInterlock;
  });

  // Determine overall status
  const tripInterlocks = evaluatedInterlocks.filter(i => i.triggered && i.type === 'TRIP');
  const safetyInterlocks = evaluatedInterlocks.filter(i => i.triggered && i.type === 'SAFETY');
  const hardConstraints = evaluatedConstraints.filter(c => c.violated && c.severity === 'HARD');
  const tripConstraints = evaluatedConstraints.filter(c => c.violated && c.severity === 'TRIP');

  if (tripInterlocks.length > 0 || tripConstraints.length > 0) {
    status = 'TRIP';
    statusMessage = tripInterlocks[0]?.description || tripConstraints[0]?.description || 'Trip active';
  } else if (safetyInterlocks.length > 0 || hardConstraints.length > 0) {
    status = 'LIMITED';
    statusMessage = safetyInterlocks[0]?.description || hardConstraints[0]?.description || 'Constraint active';
  } else if (anyViolated) {
    status = 'ALARM';
    statusMessage = 'Soft constraint violated';
  }

  // Check for lockout (manual reset required)
  const lockoutRequired = evaluatedInterlocks.some(i => i.triggered && i.resetRequired);
  if (lockoutRequired) {
    status = 'LOCKOUT';
    const lockoutInterlock = evaluatedInterlocks.find(i => i.triggered && i.resetRequired);
    statusMessage = `Manual reset required: ${lockoutInterlock?.description}`;
  }

  return {
    constraints: evaluatedConstraints,
    interlocks: evaluatedInterlocks,
    anyViolated,
    anyTripped,
    actions: [...new Set(actions)], // Deduplicate
    status,
    statusMessage,
    enforcedLimits,
  };
}

/**
 * Reset a specific interlock (requires operator confirmation)
 */
export function resetInterlock(interlocks: Interlock[], interlockId: string): Interlock[] {
  return interlocks.map(interlock => {
    if (interlock.id === interlockId && interlock.resetRequired) {
      return {
        ...interlock,
        triggered: false,
        triggerTime: undefined,
      };
    }
    return interlock;
  });
}

/**
 * Bypass a constraint (with audit trail)
 */
export function bypassConstraint(
  constraints: Constraint[],
  constraintId: string,
  bypass: boolean
): { constraints: Constraint[]; success: boolean; reason?: string } {
  const constraint = constraints.find(c => c.id === constraintId);

  if (!constraint) {
    return { constraints, success: false, reason: 'Constraint not found' };
  }

  if (!constraint.bypassable) {
    return { constraints, success: false, reason: 'Constraint cannot be bypassed' };
  }

  return {
    constraints: constraints.map(c =>
      c.id === constraintId ? { ...c, bypassed: bypass } : c
    ),
    success: true,
  };
}

/**
 * Get summary for display
 */
export function getConstraintSummary(result: ConstraintResult): {
  status: string;
  statusColor: string;
  activeConstraints: number;
  activeInterlocks: number;
  enforcedLimits: string[];
} {
  const enforcedLimitsList: string[] = [];

  if (result.enforcedLimits.speed !== undefined) {
    enforcedLimitsList.push(`Speed ≤ ${result.enforcedLimits.speed} RPM`);
  }
  if (result.enforcedLimits.feedRate !== undefined) {
    if (result.enforcedLimits.feedRate === 0) {
      enforcedLimitsList.push('Feed STOPPED');
    } else {
      enforcedLimitsList.push(`Feed ≤ ${result.enforcedLimits.feedRate} m³/hr`);
    }
  }
  if (result.enforcedLimits.differential !== undefined) {
    enforcedLimitsList.push(`Diff ≤ ${result.enforcedLimits.differential} RPM`);
  }

  const statusColors: Record<string, string> = {
    NORMAL: 'text-green-500',
    LIMITED: 'text-yellow-500',
    ALARM: 'text-orange-500',
    TRIP: 'text-red-500',
    LOCKOUT: 'text-red-700',
  };

  return {
    status: result.status,
    statusColor: statusColors[result.status] || 'text-gray-500',
    activeConstraints: result.constraints.filter(c => c.violated).length,
    activeInterlocks: result.interlocks.filter(i => i.triggered).length,
    enforcedLimits: enforcedLimitsList,
  };
}
