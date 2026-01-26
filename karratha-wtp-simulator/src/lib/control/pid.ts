/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INDUSTRIAL PID CONTROLLER WITH ANTI-WINDUP
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ISA-compliant PID implementation with:
 * - Anti-windup (back-calculation method)
 * - Bumpless transfer between modes
 * - Output clamping with saturation detection
 * - Derivative filtering
 * - Rate limiting on setpoint changes
 *
 * @version 1.0.0
 * @standard ISA-5.1, ISA-88
 */

export type ControlMode = 'OFF' | 'MAN' | 'AUTO' | 'CAS';

export interface PIDConfig {
  tag: string;
  description: string;
  unit: string;
  // Tuning parameters
  kp: number;           // Proportional gain
  ki: number;           // Integral gain (1/s)
  kd: number;           // Derivative gain (s)
  // Limits
  pvMin: number;        // PV range minimum
  pvMax: number;        // PV range maximum
  spMin: number;        // SP range minimum
  spMax: number;        // SP range maximum
  opMin: number;        // Output minimum (%)
  opMax: number;        // Output maximum (%)
  // Anti-windup
  antiWindupGain: number; // Back-calculation gain (default: 1/Ti)
  // Derivative filter
  derivativeFilterCoeff: number; // 0-1, higher = more filtering
  // Rate limits
  spRateLimit: number;  // Max SP change per second
  opRateLimit: number;  // Max OP change per second
}

export interface PIDState {
  tag: string;
  description: string;
  unit: string;
  mode: ControlMode;
  pv: number;           // Process variable
  sp: number;           // Setpoint (internal, after rate limiting)
  spTarget: number;     // Target setpoint (before rate limiting)
  op: number;           // Output (%)
  opManual: number;     // Manual output setting
  error: number;        // Current error
  integral: number;     // Integral term accumulator
  derivative: number;   // Filtered derivative term
  lastPV: number;       // Previous PV for derivative
  lastError: number;    // Previous error
  saturated: boolean;   // True if output at limits
  saturationDir: 'HI' | 'LO' | null; // Direction of saturation
  enabled: boolean;     // Controller enabled
  tracking: boolean;    // Tracking mode for cascade
  trackValue: number;   // Value to track when in tracking mode
  fault: boolean;       // Controller fault
  faultReason: string;  // Fault description
  lastUpdate: number;   // Timestamp of last update
}

export interface PIDResult {
  state: PIDState;
  output: number;
  saturated: boolean;
  error: number;
}

const DEFAULT_CONFIG: Partial<PIDConfig> = {
  kp: 1.0,
  ki: 0.1,
  kd: 0.0,
  pvMin: 0,
  pvMax: 100,
  spMin: 0,
  spMax: 100,
  opMin: 0,
  opMax: 100,
  antiWindupGain: 1.0,
  derivativeFilterCoeff: 0.8,
  spRateLimit: 10,
  opRateLimit: 50,
};

/**
 * Create initial PID state
 */
export function createPIDState(
  config: Partial<PIDConfig> & { tag: string; description: string; unit: string },
  initialSP: number = 50,
  initialOP: number = 50
): PIDState {
  return {
    tag: config.tag,
    description: config.description,
    unit: config.unit,
    mode: 'MAN',
    pv: initialSP,
    sp: initialSP,
    spTarget: initialSP,
    op: initialOP,
    opManual: initialOP,
    error: 0,
    integral: 0,
    derivative: 0,
    lastPV: initialSP,
    lastError: 0,
    saturated: false,
    saturationDir: null,
    enabled: true,
    tracking: false,
    trackValue: initialOP,
    fault: false,
    faultReason: '',
    lastUpdate: Date.now(),
  };
}

/**
 * Clamp value within range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Check for invalid numbers
 */
function isValidNumber(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Execute one PID calculation step
 */
export function calculatePID(
  state: PIDState,
  pv: number,
  config: PIDConfig,
  dt: number // seconds
): PIDResult {
  const newState = { ...state };
  newState.lastUpdate = Date.now();

  // Validate inputs
  if (!isValidNumber(pv)) {
    newState.fault = true;
    newState.faultReason = 'PV_INVALID';
    return { state: newState, output: state.op, saturated: false, error: 0 };
  }

  if (!isValidNumber(dt) || dt <= 0) {
    newState.fault = true;
    newState.faultReason = 'DT_INVALID';
    return { state: newState, output: state.op, saturated: false, error: 0 };
  }

  // Clear fault if inputs valid
  if (newState.fault && newState.faultReason.includes('INVALID')) {
    newState.fault = false;
    newState.faultReason = '';
  }

  // Update PV
  newState.pv = clamp(pv, config.pvMin, config.pvMax);

  // Handle mode-specific behavior
  switch (newState.mode) {
    case 'OFF':
      // Controller disabled, hold output
      newState.integral = 0;
      newState.derivative = 0;
      return { state: newState, output: newState.op, saturated: false, error: 0 };

    case 'MAN':
      // Manual mode - use manual setpoint, track output for bumpless transfer
      newState.op = clamp(newState.opManual, config.opMin, config.opMax);
      // Track integral to match current output for bumpless transfer
      newState.integral = (newState.op - 50) / Math.max(config.ki, 0.001);
      newState.error = newState.sp - newState.pv;
      return { state: newState, output: newState.op, saturated: false, error: newState.error };

    case 'CAS':
      // Cascade mode - SP comes from master, calculate normally
      // Fall through to AUTO
    case 'AUTO':
      // Automatic control
      break;

    default:
      newState.fault = true;
      newState.faultReason = 'INVALID_MODE';
      return { state: newState, output: state.op, saturated: false, error: 0 };
  }

  // Rate limit SP changes
  const spDelta = newState.spTarget - newState.sp;
  const maxSpChange = config.spRateLimit * dt;
  if (Math.abs(spDelta) > maxSpChange) {
    newState.sp += Math.sign(spDelta) * maxSpChange;
  } else {
    newState.sp = newState.spTarget;
  }
  newState.sp = clamp(newState.sp, config.spMin, config.spMax);

  // Calculate error
  const error = newState.sp - newState.pv;
  newState.error = error;

  // Proportional term
  const pTerm = config.kp * error;

  // Integral term with anti-windup
  let iTerm = newState.integral;
  if (!newState.saturated || (newState.saturationDir === 'HI' && error < 0) || (newState.saturationDir === 'LO' && error > 0)) {
    // Only integrate if not saturated, or if error would reduce saturation
    iTerm += config.ki * error * dt;
  }

  // Apply back-calculation anti-windup
  if (newState.saturated) {
    const correction = config.antiWindupGain * (newState.op - (50 + pTerm + iTerm));
    iTerm += correction * dt;
  }

  // Derivative term (on PV to avoid derivative kick)
  const pvChange = newState.pv - newState.lastPV;
  const rawDerivative = -config.kd * pvChange / dt; // Negative because we use PV, not error

  // Filter derivative
  newState.derivative = config.derivativeFilterCoeff * newState.derivative +
                        (1 - config.derivativeFilterCoeff) * rawDerivative;

  const dTerm = newState.derivative;

  // Calculate raw output
  const rawOutput = 50 + pTerm + iTerm + dTerm;

  // Clamp output and detect saturation
  const clampedOutput = clamp(rawOutput, config.opMin, config.opMax);
  newState.saturated = clampedOutput !== rawOutput;
  if (newState.saturated) {
    newState.saturationDir = rawOutput > config.opMax ? 'HI' : 'LO';
  } else {
    newState.saturationDir = null;
  }

  // Rate limit output changes
  const opDelta = clampedOutput - newState.op;
  const maxOpChange = config.opRateLimit * dt;
  if (Math.abs(opDelta) > maxOpChange) {
    newState.op = newState.op + Math.sign(opDelta) * maxOpChange;
  } else {
    newState.op = clampedOutput;
  }

  // Store values for next iteration
  newState.integral = iTerm;
  newState.lastPV = newState.pv;
  newState.lastError = error;

  return {
    state: newState,
    output: newState.op,
    saturated: newState.saturated,
    error: error,
  };
}

/**
 * Change controller mode with bumpless transfer
 */
export function setMode(state: PIDState, newMode: ControlMode, config: PIDConfig): PIDState {
  const newState = { ...state };
  const oldMode = state.mode;

  if (oldMode === newMode) return newState;

  // Bumpless transfer logic
  if (newMode === 'AUTO' || newMode === 'CAS') {
    // Switching to automatic - initialize integral to match current output
    newState.integral = (state.op - 50 - config.kp * state.error) / Math.max(config.ki, 0.001);
  }

  if (newMode === 'MAN') {
    // Switching to manual - capture current output as manual value
    newState.opManual = state.op;
  }

  newState.mode = newMode;
  return newState;
}

/**
 * Set setpoint with optional tracking
 */
export function setSetpoint(state: PIDState, sp: number, config: PIDConfig, immediate: boolean = false): PIDState {
  const newState = { ...state };
  newState.spTarget = clamp(sp, config.spMin, config.spMax);
  if (immediate) {
    newState.sp = newState.spTarget;
  }
  return newState;
}

/**
 * Set manual output
 */
export function setManualOutput(state: PIDState, op: number, config: PIDConfig): PIDState {
  const newState = { ...state };
  newState.opManual = clamp(op, config.opMin, config.opMax);
  if (state.mode === 'MAN') {
    newState.op = newState.opManual;
  }
  return newState;
}

/**
 * Generate diagnostic info for loop
 */
export function getDiagnostics(state: PIDState, config: PIDConfig): {
  status: 'OK' | 'WARNING' | 'FAULT';
  statusCode: string;
  details: Record<string, any>;
} {
  if (state.fault) {
    return {
      status: 'FAULT',
      statusCode: state.faultReason,
      details: { ...state },
    };
  }

  if (state.saturated) {
    return {
      status: 'WARNING',
      statusCode: `SATURATED_${state.saturationDir}`,
      details: {
        mode: state.mode,
        pv: state.pv,
        sp: state.sp,
        op: state.op,
        saturationDir: state.saturationDir,
      },
    };
  }

  const deviation = Math.abs(state.pv - state.sp);
  const deviationPct = state.sp !== 0 ? (deviation / Math.abs(state.sp)) * 100 : 0;

  if (deviationPct > 10) {
    return {
      status: 'WARNING',
      statusCode: 'HIGH_DEVIATION',
      details: {
        mode: state.mode,
        pv: state.pv,
        sp: state.sp,
        op: state.op,
        deviationPct: deviationPct.toFixed(1),
      },
    };
  }

  return {
    status: 'OK',
    statusCode: 'NORMAL',
    details: {
      mode: state.mode,
      pv: state.pv,
      sp: state.sp,
      op: state.op,
    },
  };
}
