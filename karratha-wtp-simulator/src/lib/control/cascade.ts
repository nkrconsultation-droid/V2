/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CASCADE CONTROL SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Implements true cascade control architecture:
 * - Quality Master (QIC-001) controls water OiW
 * - Master output adjusts slave setpoints (TIC, FIC, SIC)
 * - Saturation handling with anti-windup
 * - Proper sequencing and enable logic
 *
 * @version 1.0.0
 * @standard ISA-88, ISA-5.1
 */

import { PIDState, ControlMode } from './pid';

export type CascadeMode = 'OFF' | 'SLAVE_ONLY' | 'CASCADE' | 'CONSTRAINT';

export type SequenceState =
  | 'IDLE'
  | 'HEATER_WARMUP'
  | 'HEATER_STABLE'
  | 'CENTRIFUGE_START'
  | 'CENTRIFUGE_STABLE'
  | 'CHEMISTRY_START'
  | 'CHEMISTRY_STABLE'
  | 'FEED_START'
  | 'FEED_STABLE'
  | 'CASCADE_READY'
  | 'CASCADE_ACTIVE'
  | 'CONSTRAINT_OVERRIDE'
  | 'SHUTDOWN'
  | 'FAULT';

export interface CascadeConfig {
  // Quality targets
  oiwTarget: number;          // ppm
  oiwAlarmHigh: number;       // ppm
  oiwAlarmHighHigh: number;   // ppm

  // Slave SP mapping (demand 0-100% to SP range)
  tempMapping: {
    demandMin: number;        // Demand % at which temp = tempMin
    demandMax: number;        // Demand % at which temp = tempMax
    tempMin: number;          // Minimum temperature SP (°C)
    tempMax: number;          // Maximum temperature SP (°C)
    rateLimit: number;        // Max change per second (°C/s)
  };

  flowMapping: {
    demandMin: number;
    demandMax: number;
    flowMin: number;          // Minimum flow SP (m³/h)
    flowMax: number;          // Maximum flow SP (m³/h)
    rateLimit: number;        // Max change per second
  };

  speedMapping: {
    demandMin: number;
    demandMax: number;
    speedMin: number;         // Minimum speed SP (RPM)
    speedMax: number;         // Maximum speed SP (RPM)
    rateLimit: number;        // Max change per second
  };

  // Stability criteria
  stabilityWindow: number;    // Time window to assess stability (s)
  stabilityTolerance: number; // Max deviation for "stable" (%)

  // Sequencing timeouts
  warmupTimeout: number;      // Max warmup time (s)
  stabilityTimeout: number;   // Max time to achieve stability (s)

  // Constraint thresholds
  minEffectiveTemp: number;   // Minimum separation temp (°C)
  maxVibration: number;       // Vibration limit (mm/s)
  maxTorqueProxy: number;     // Torque proxy limit (%)
}

export interface CascadeState {
  mode: CascadeMode;
  sequenceState: SequenceState;
  sequenceStartTime: number;

  // Master loop state
  masterEnabled: boolean;
  masterDemand: number;       // 0-100%
  masterIntegral: number;
  masterSaturated: boolean;
  masterSaturationDir: 'HI' | 'LO' | null;
  lastOiW: number;
  oiwError: number;

  // Calculated slave setpoints
  tempSP: number;
  flowSP: number;
  speedSP: number;

  // Slave stability tracking
  slaveStability: {
    temp: { stable: boolean; history: number[]; lastCheck: number };
    flow: { stable: boolean; history: number[]; lastCheck: number };
    speed: { stable: boolean; history: number[]; lastCheck: number };
    chemistry: { stable: boolean; sequenceComplete: boolean };
  };

  // Constraint status
  constraints: {
    tempLow: boolean;
    vibrationHigh: boolean;
    torqueHigh: boolean;
    phOutOfBand: boolean;
    anyActive: boolean;
  };

  // Alarms
  alarms: CascadeAlarm[];

  // Diagnostics
  lastUpdate: number;
  fault: boolean;
  faultReason: string;
}

export interface CascadeAlarm {
  id: string;
  timestamp: number;
  tag: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  value?: number;
  limit?: number;
  acknowledged: boolean;
  autoAction?: string;
}

// Alias for compatibility with DiagnosticPanels
export interface Alarm {
  id: string;
  tag: string;
  message: string;
  priority: number;  // 1=CRITICAL, 2=HIGH, 3=MEDIUM, 4=LOW
  timestamp: number;
  active: boolean;
  acknowledged: boolean;
}

/**
 * Convert CascadeAlarm to Alarm format
 */
export function toAlarm(cascadeAlarm: CascadeAlarm, active: boolean = true): Alarm {
  const priorityMap: Record<string, number> = {
    'CRITICAL': 1,
    'HIGH': 2,
    'MEDIUM': 3,
    'LOW': 4,
  };
  return {
    id: cascadeAlarm.id,
    tag: cascadeAlarm.tag,
    message: cascadeAlarm.message,
    priority: priorityMap[cascadeAlarm.priority] || 4,
    timestamp: cascadeAlarm.timestamp,
    active,
    acknowledged: cascadeAlarm.acknowledged,
  };
}

export interface SlaveStates {
  tic: PIDState;
  fic: PIDState;
  sic: PIDState;
}

export interface ProcessValues {
  oiw: number;            // Water OiW (ppm)
  temperature: number;    // Heater outlet temp (°C)
  feedFlow: number;       // Feed flow (m³/h)
  bowlSpeed: number;      // Bowl speed (RPM)
  vibration: number;      // Vibration (mm/s)
  torqueProxy: number;    // Torque proxy (%)
  pH: number;             // pH value
  oiwValid: boolean;      // OiW measurement valid
}

const DEFAULT_CONFIG: CascadeConfig = {
  oiwTarget: 15,
  oiwAlarmHigh: 30,
  oiwAlarmHighHigh: 50,

  tempMapping: {
    demandMin: 0,
    demandMax: 100,
    tempMin: 55,
    tempMax: 85,
    rateLimit: 0.5,
  },

  flowMapping: {
    demandMin: 0,
    demandMax: 100,
    flowMin: 20,      // High demand = low flow (more residence time)
    flowMax: 8,       // Inverted: low demand allows high flow
    rateLimit: 0.5,
  },

  speedMapping: {
    demandMin: 0,
    demandMax: 100,
    speedMin: 2400,
    speedMax: 3400,
    rateLimit: 20,
  },

  stabilityWindow: 30,
  stabilityTolerance: 5,
  warmupTimeout: 600,
  stabilityTimeout: 300,

  minEffectiveTemp: 50,
  maxVibration: 7,
  maxTorqueProxy: 90,
};

/**
 * Create initial cascade state
 */
export function createCascadeState(): CascadeState {
  return {
    mode: 'OFF',
    sequenceState: 'IDLE',
    sequenceStartTime: 0,

    masterEnabled: false,
    masterDemand: 50,
    masterIntegral: 0,
    masterSaturated: false,
    masterSaturationDir: null,
    lastOiW: 0,
    oiwError: 0,

    tempSP: 65,
    flowSP: 15,
    speedSP: 3200,

    slaveStability: {
      temp: { stable: false, history: [], lastCheck: 0 },
      flow: { stable: false, history: [], lastCheck: 0 },
      speed: { stable: false, history: [], lastCheck: 0 },
      chemistry: { stable: false, sequenceComplete: false },
    },

    constraints: {
      tempLow: false,
      vibrationHigh: false,
      torqueHigh: false,
      phOutOfBand: false,
      anyActive: false,
    },

    alarms: [],
    lastUpdate: Date.now(),
    fault: false,
    faultReason: '',
  };
}

/**
 * Check slave stability
 */
function checkStability(
  history: number[],
  currentValue: number,
  tolerance: number,
  windowSize: number
): { stable: boolean; newHistory: number[] } {
  const newHistory = [...history, currentValue].slice(-windowSize);

  if (newHistory.length < windowSize / 2) {
    return { stable: false, newHistory };
  }

  const mean = newHistory.reduce((a, b) => a + b, 0) / newHistory.length;
  const maxDev = Math.max(...newHistory.map(v => Math.abs(v - mean)));
  const deviationPct = mean !== 0 ? (maxDev / Math.abs(mean)) * 100 : 0;

  return {
    stable: deviationPct <= tolerance,
    newHistory,
  };
}

/**
 * Map master demand to slave setpoint
 */
function mapDemandToSP(
  demand: number,
  mapping: { demandMin: number; demandMax: number; spMin: number; spMax: number },
  currentSP: number,
  rateLimit: number,
  dt: number
): number {
  // Linear interpolation
  const demandRange = mapping.demandMax - mapping.demandMin;
  const spRange = mapping.spMax - mapping.spMin;
  const normalizedDemand = (demand - mapping.demandMin) / demandRange;
  const targetSP = mapping.spMin + normalizedDemand * spRange;

  // Rate limit
  const maxChange = rateLimit * dt;
  const delta = targetSP - currentSP;

  if (Math.abs(delta) > maxChange) {
    return currentSP + Math.sign(delta) * maxChange;
  }

  return targetSP;
}

/**
 * Add alarm with deduplication
 */
function addAlarm(
  state: CascadeState,
  tag: string,
  priority: CascadeAlarm['priority'],
  message: string,
  value?: number,
  limit?: number,
  autoAction?: string
): CascadeAlarm[] {
  // Check if alarm already exists (not acknowledged)
  const existing = state.alarms.find(a => a.tag === tag && !a.acknowledged);
  if (existing) {
    return state.alarms;
  }

  const newAlarm: CascadeAlarm = {
    id: `${tag}-${Date.now()}`,
    timestamp: Date.now(),
    tag,
    priority,
    message,
    value,
    limit,
    acknowledged: false,
    autoAction,
  };

  return [...state.alarms, newAlarm].slice(-100); // Keep last 100 alarms
}

/**
 * Main cascade control calculation
 */
export function calculateCascade(
  state: CascadeState,
  pv: ProcessValues,
  slaves: SlaveStates,
  config: CascadeConfig,
  dt: number // seconds
): { state: CascadeState; slaveSPs: { temp: number; flow: number; speed: number } } {
  const newState = { ...state };
  newState.lastUpdate = Date.now();
  let alarms = [...state.alarms];

  // ═══════════════════════════════════════════════════════════════
  // 1. CHECK CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════

  newState.constraints.tempLow = pv.temperature < config.minEffectiveTemp;
  newState.constraints.vibrationHigh = pv.vibration > config.maxVibration;
  newState.constraints.torqueHigh = pv.torqueProxy > config.maxTorqueProxy;
  newState.constraints.phOutOfBand = pv.pH < 6.5 || pv.pH > 8.5;
  newState.constraints.anyActive =
    newState.constraints.tempLow ||
    newState.constraints.vibrationHigh ||
    newState.constraints.torqueHigh ||
    newState.constraints.phOutOfBand;

  // Generate constraint alarms
  if (newState.constraints.tempLow) {
    alarms = addAlarm(newState, 'TAL-001', 'HIGH',
      `Temperature below effective separation: ${pv.temperature.toFixed(1)}°C < ${config.minEffectiveTemp}°C`,
      pv.temperature, config.minEffectiveTemp, 'Cap feed flow');
  }

  if (newState.constraints.vibrationHigh) {
    alarms = addAlarm(newState, 'VAH-001', 'CRITICAL',
      `Vibration high: ${pv.vibration.toFixed(1)} mm/s > ${config.maxVibration} mm/s`,
      pv.vibration, config.maxVibration, 'Reduce feed and differential');
  }

  if (newState.constraints.torqueHigh) {
    alarms = addAlarm(newState, 'JAH-001', 'HIGH',
      `Torque/load high: ${pv.torqueProxy.toFixed(0)}% > ${config.maxTorqueProxy}%`,
      pv.torqueProxy, config.maxTorqueProxy, 'Reduce feed rate');
  }

  if (newState.constraints.phOutOfBand) {
    alarms = addAlarm(newState, 'AAH-001', 'MEDIUM',
      `pH out of band: ${pv.pH.toFixed(1)} (target 6.5-8.5)`,
      pv.pH, 7.0, 'Restrict polymer dosing');
  }

  newState.alarms = alarms;

  // ═══════════════════════════════════════════════════════════════
  // 2. CHECK SLAVE STABILITY
  // ═══════════════════════════════════════════════════════════════

  const windowSize = Math.ceil(config.stabilityWindow / Math.max(dt, 0.1));

  const tempStab = checkStability(
    state.slaveStability.temp.history,
    pv.temperature,
    config.stabilityTolerance,
    windowSize
  );
  newState.slaveStability.temp = {
    stable: tempStab.stable && slaves.tic.mode === 'AUTO',
    history: tempStab.newHistory,
    lastCheck: Date.now(),
  };

  const flowStab = checkStability(
    state.slaveStability.flow.history,
    pv.feedFlow,
    config.stabilityTolerance,
    windowSize
  );
  newState.slaveStability.flow = {
    stable: flowStab.stable && slaves.fic.mode === 'AUTO',
    history: flowStab.newHistory,
    lastCheck: Date.now(),
  };

  const speedStab = checkStability(
    state.slaveStability.speed.history,
    pv.bowlSpeed,
    config.stabilityTolerance,
    windowSize
  );
  newState.slaveStability.speed = {
    stable: speedStab.stable && slaves.sic.mode === 'AUTO',
    history: speedStab.newHistory,
    lastCheck: Date.now(),
  };

  // ═══════════════════════════════════════════════════════════════
  // 3. HANDLE CONSTRAINT OVERRIDE
  // ═══════════════════════════════════════════════════════════════

  if (newState.constraints.anyActive && newState.mode === 'CASCADE') {
    newState.mode = 'CONSTRAINT';
    newState.sequenceState = 'CONSTRAINT_OVERRIDE';
    newState.masterEnabled = false;

    // Apply constraint actions
    if (newState.constraints.tempLow) {
      // Cap flow at 50% of current
      newState.flowSP = Math.min(newState.flowSP, pv.feedFlow * 0.5);
    }

    if (newState.constraints.vibrationHigh) {
      // Reduce flow by 20%
      newState.flowSP = Math.max(5, newState.flowSP * 0.8);
      // Reduce speed by 100 RPM
      newState.speedSP = Math.max(config.speedMapping.speedMin, newState.speedSP - 100);
    }

    if (newState.constraints.torqueHigh) {
      // Reduce flow by 15%
      newState.flowSP = Math.max(5, newState.flowSP * 0.85);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. CASCADE MASTER CALCULATION (if enabled)
  // ═══════════════════════════════════════════════════════════════

  if (newState.mode === 'CASCADE' && newState.masterEnabled && pv.oiwValid) {
    newState.lastOiW = pv.oiw;
    const error = config.oiwTarget - pv.oiw;
    newState.oiwError = error;

    // Simple PI control for master (inverted: positive error = reduce demand)
    const kp = 2.0;  // Proportional gain
    const ki = 0.1;  // Integral gain

    // Anti-windup: only integrate if not saturated or if error reduces saturation
    if (!newState.masterSaturated ||
        (newState.masterSaturationDir === 'HI' && error > 0) ||
        (newState.masterSaturationDir === 'LO' && error < 0)) {
      newState.masterIntegral += ki * error * dt;
      newState.masterIntegral = Math.max(-50, Math.min(50, newState.masterIntegral));
    }

    // Calculate demand (50% baseline + corrections)
    // Positive error (OiW < target) = can reduce demand
    // Negative error (OiW > target) = must increase demand
    const rawDemand = 50 - kp * error + newState.masterIntegral;

    // Clamp and detect saturation
    const clampedDemand = Math.max(0, Math.min(100, rawDemand));
    newState.masterSaturated = clampedDemand !== rawDemand;
    newState.masterSaturationDir = rawDemand > 100 ? 'HI' : rawDemand < 0 ? 'LO' : null;
    newState.masterDemand = clampedDemand;

    // Add saturation alarm
    if (newState.masterSaturated) {
      alarms = addAlarm(newState, 'QIC-001-SAT', 'MEDIUM',
        `Quality master saturated ${newState.masterSaturationDir}`,
        newState.masterDemand, newState.masterSaturationDir === 'HI' ? 100 : 0);
      newState.alarms = alarms;
    }

    // Generate OiW alarms
    if (pv.oiw > config.oiwAlarmHighHigh) {
      alarms = addAlarm(newState, 'AAHH-OIW', 'CRITICAL',
        `OiW VERY HIGH: ${pv.oiw.toFixed(0)} ppm > ${config.oiwAlarmHighHigh} ppm`,
        pv.oiw, config.oiwAlarmHighHigh);
      newState.alarms = alarms;
    } else if (pv.oiw > config.oiwAlarmHigh) {
      alarms = addAlarm(newState, 'AAH-OIW', 'HIGH',
        `OiW HIGH: ${pv.oiw.toFixed(0)} ppm > ${config.oiwAlarmHigh} ppm`,
        pv.oiw, config.oiwAlarmHigh);
      newState.alarms = alarms;
    }

    // Map demand to slave setpoints
    newState.tempSP = mapDemandToSP(
      newState.masterDemand,
      { demandMin: config.tempMapping.demandMin, demandMax: config.tempMapping.demandMax,
        spMin: config.tempMapping.tempMin, spMax: config.tempMapping.tempMax },
      state.tempSP,
      config.tempMapping.rateLimit,
      dt
    );

    // Flow is inverted: high demand = low flow (more residence time)
    newState.flowSP = mapDemandToSP(
      newState.masterDemand,
      { demandMin: config.flowMapping.demandMin, demandMax: config.flowMapping.demandMax,
        spMin: config.flowMapping.flowMax, spMax: config.flowMapping.flowMin }, // Note: inverted
      state.flowSP,
      config.flowMapping.rateLimit,
      dt
    );

    newState.speedSP = mapDemandToSP(
      newState.masterDemand,
      { demandMin: config.speedMapping.demandMin, demandMax: config.speedMapping.demandMax,
        spMin: config.speedMapping.speedMin, spMax: config.speedMapping.speedMax },
      state.speedSP,
      config.speedMapping.rateLimit,
      dt
    );
  } else if (!pv.oiwValid && newState.mode === 'CASCADE') {
    // OiW invalid - fallback
    newState.masterEnabled = false;
    alarms = addAlarm(newState, 'QIC-001-PVBAD', 'HIGH',
      'Quality PV invalid - cascade disabled, holding last setpoints');
    newState.alarms = alarms;
  }

  return {
    state: newState,
    slaveSPs: {
      temp: newState.tempSP,
      flow: newState.flowSP,
      speed: newState.speedSP,
    },
  };
}

/**
 * Execute sequencing state machine
 */
export function executeSequence(
  state: CascadeState,
  pv: ProcessValues,
  config: CascadeConfig,
  dt: number
): CascadeState {
  const newState = { ...state };
  const elapsed = (Date.now() - state.sequenceStartTime) / 1000;

  switch (state.sequenceState) {
    case 'IDLE':
      // Waiting for start command
      break;

    case 'HEATER_WARMUP':
      if (pv.temperature >= config.minEffectiveTemp) {
        newState.sequenceState = 'HEATER_STABLE';
        newState.sequenceStartTime = Date.now();
      } else if (elapsed > config.warmupTimeout) {
        newState.sequenceState = 'FAULT';
        newState.fault = true;
        newState.faultReason = 'WARMUP_TIMEOUT';
      }
      break;

    case 'HEATER_STABLE':
      if (newState.slaveStability.temp.stable) {
        newState.sequenceState = 'CENTRIFUGE_START';
        newState.sequenceStartTime = Date.now();
      } else if (elapsed > config.stabilityTimeout) {
        newState.sequenceState = 'FAULT';
        newState.fault = true;
        newState.faultReason = 'TEMP_STABILITY_TIMEOUT';
      }
      break;

    case 'CENTRIFUGE_START':
      // Wait for centrifuge to reach minimum speed
      if (pv.bowlSpeed >= config.speedMapping.speedMin) {
        newState.sequenceState = 'CENTRIFUGE_STABLE';
        newState.sequenceStartTime = Date.now();
      }
      break;

    case 'CENTRIFUGE_STABLE':
      if (newState.slaveStability.speed.stable) {
        newState.sequenceState = 'CHEMISTRY_START';
        newState.sequenceStartTime = Date.now();
      } else if (elapsed > config.stabilityTimeout) {
        newState.sequenceState = 'FAULT';
        newState.fault = true;
        newState.faultReason = 'SPEED_STABILITY_TIMEOUT';
      }
      break;

    case 'CHEMISTRY_START':
      // Chemistry sequencing would happen here
      // For now, assume stable after delay
      if (elapsed > 30) { // 30 second chemistry stabilization
        newState.sequenceState = 'CHEMISTRY_STABLE';
        newState.slaveStability.chemistry.sequenceComplete = true;
        newState.sequenceStartTime = Date.now();
      }
      break;

    case 'CHEMISTRY_STABLE':
      newState.slaveStability.chemistry.stable = true;
      newState.sequenceState = 'FEED_START';
      newState.sequenceStartTime = Date.now();
      break;

    case 'FEED_START':
      // Wait for feed flow to establish
      if (pv.feedFlow > 5) {
        newState.sequenceState = 'FEED_STABLE';
        newState.sequenceStartTime = Date.now();
      }
      break;

    case 'FEED_STABLE':
      if (newState.slaveStability.flow.stable) {
        newState.sequenceState = 'CASCADE_READY';
        newState.sequenceStartTime = Date.now();
      } else if (elapsed > config.stabilityTimeout) {
        newState.sequenceState = 'FAULT';
        newState.fault = true;
        newState.faultReason = 'FLOW_STABILITY_TIMEOUT';
      }
      break;

    case 'CASCADE_READY':
      // All slaves stable - can enable master
      newState.masterEnabled = true;
      newState.mode = 'CASCADE';
      newState.sequenceState = 'CASCADE_ACTIVE';
      break;

    case 'CASCADE_ACTIVE':
      // Running normally
      if (newState.constraints.anyActive) {
        newState.sequenceState = 'CONSTRAINT_OVERRIDE';
      }
      break;

    case 'CONSTRAINT_OVERRIDE':
      // Constraints active - check for recovery
      if (!newState.constraints.anyActive) {
        // Constraints cleared - return to cascade
        newState.sequenceState = 'CASCADE_READY';
        newState.sequenceStartTime = Date.now();
      }
      break;

    case 'SHUTDOWN':
      newState.masterEnabled = false;
      newState.mode = 'OFF';
      break;

    case 'FAULT':
      newState.masterEnabled = false;
      break;
  }

  return newState;
}

/**
 * Start the cascade sequence
 */
export function startCascade(state: CascadeState): CascadeState {
  if (state.sequenceState !== 'IDLE' && state.sequenceState !== 'SHUTDOWN') {
    return state;
  }

  return {
    ...state,
    mode: 'SLAVE_ONLY',
    sequenceState: 'HEATER_WARMUP',
    sequenceStartTime: Date.now(),
    fault: false,
    faultReason: '',
  };
}

/**
 * Stop the cascade
 */
export function stopCascade(state: CascadeState): CascadeState {
  return {
    ...state,
    mode: 'OFF',
    sequenceState: 'SHUTDOWN',
    masterEnabled: false,
  };
}

/**
 * Reset fault
 */
export function resetFault(state: CascadeState): CascadeState {
  if (!state.fault) return state;

  return {
    ...state,
    fault: false,
    faultReason: '',
    sequenceState: 'IDLE',
    mode: 'OFF',
  };
}

/**
 * Generate cascade map for display
 */
export function getCascadeMap(
  state: CascadeState,
  slaves: SlaveStates,
  config: CascadeConfig
): {
  loops: Array<{
    tag: string;
    type: 'MASTER' | 'SLAVE';
    pv: number;
    sp: number;
    mv: number;
    mode: string;
    status: string;
    saturated: boolean;
    enabled: boolean;
  }>;
  overall: {
    mode: CascadeMode;
    sequence: SequenceState;
    constraintsActive: boolean;
  };
} {
  return {
    loops: [
      {
        tag: 'QIC-001',
        type: 'MASTER',
        pv: state.lastOiW,
        sp: config.oiwTarget,
        mv: state.masterDemand,
        mode: state.masterEnabled ? 'CASCADE' : 'HOLD',
        status: state.masterSaturated ? `SAT_${state.masterSaturationDir}` : 'OK',
        saturated: state.masterSaturated,
        enabled: state.masterEnabled,
      },
      {
        tag: 'TIC-001',
        type: 'SLAVE',
        pv: slaves.tic.pv,
        sp: state.tempSP,
        mv: slaves.tic.op,
        mode: slaves.tic.mode,
        status: state.slaveStability.temp.stable ? 'STABLE' : 'UNSTABLE',
        saturated: slaves.tic.saturated,
        enabled: slaves.tic.enabled,
      },
      {
        tag: 'FIC-001',
        type: 'SLAVE',
        pv: slaves.fic.pv,
        sp: state.flowSP,
        mv: slaves.fic.op,
        mode: slaves.fic.mode,
        status: state.slaveStability.flow.stable ? 'STABLE' : 'UNSTABLE',
        saturated: slaves.fic.saturated,
        enabled: slaves.fic.enabled,
      },
      {
        tag: 'SIC-001',
        type: 'SLAVE',
        pv: slaves.sic.pv,
        sp: state.speedSP,
        mv: slaves.sic.op,
        mode: slaves.sic.mode,
        status: state.slaveStability.speed.stable ? 'STABLE' : 'UNSTABLE',
        saturated: slaves.sic.saturated,
        enabled: slaves.sic.enabled,
      },
    ],
    overall: {
      mode: state.mode,
      sequence: state.sequenceState,
      constraintsActive: state.constraints.anyActive,
    },
  };
}
