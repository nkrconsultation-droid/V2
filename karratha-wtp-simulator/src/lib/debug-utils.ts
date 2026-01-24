/**
 * DEBUG UTILITIES
 * ================
 * Debugging tools for the centrifuge process simulator
 * Provides logging, performance monitoring, and state inspection
 */

import type { LogLevel, DebugLogEntry, SimulationState, DebugInfo } from './process-types';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const DEBUG_CONFIG = {
  enabled: process.env.NODE_ENV === 'development',
  logToConsole: true,
  maxLogEntries: 1000,
  performanceTracking: true,
  stateSnapshots: true,
  snapshotInterval: 5000, // ms
};

// ═══════════════════════════════════════════════════════════════════════════
// LOG STORAGE
// ═══════════════════════════════════════════════════════════════════════════

const logEntries: DebugLogEntry[] = [];
const performanceMarks: Map<string, number> = new Map();
const stateSnapshots: Array<{ time: number; state: Partial<SimulationState> }> = [];

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log a debug message
 */
export function log(
  level: LogLevel,
  category: string,
  message: string,
  data?: unknown
): void {
  if (!DEBUG_CONFIG.enabled) return;

  const entry: DebugLogEntry = {
    timestamp: new Date(),
    level,
    category,
    message,
    data,
  };

  logEntries.push(entry);

  // Trim old entries
  if (logEntries.length > DEBUG_CONFIG.maxLogEntries) {
    logEntries.shift();
  }

  // Console output
  if (DEBUG_CONFIG.logToConsole) {
    const prefix = `[${category}]`;
    const style = getLogStyle(level);

    switch (level) {
      case 'error':
        console.error(`%c${prefix}`, style, message, data ?? '');
        break;
      case 'warn':
        console.warn(`%c${prefix}`, style, message, data ?? '');
        break;
      case 'info':
        console.info(`%c${prefix}`, style, message, data ?? '');
        break;
      default:
        console.log(`%c${prefix}`, style, message, data ?? '');
    }
  }
}

/**
 * Get console style for log level
 */
function getLogStyle(level: LogLevel): string {
  switch (level) {
    case 'error': return 'color: #ff4444; font-weight: bold';
    case 'warn': return 'color: #ffaa00; font-weight: bold';
    case 'info': return 'color: #44aaff';
    default: return 'color: #888888';
  }
}

// Convenience logging functions
export const debug = (cat: string, msg: string, data?: unknown) => log('debug', cat, msg, data);
export const info = (cat: string, msg: string, data?: unknown) => log('info', cat, msg, data);
export const warn = (cat: string, msg: string, data?: unknown) => log('warn', cat, msg, data);
export const error = (cat: string, msg: string, data?: unknown) => log('error', cat, msg, data);

// ═══════════════════════════════════════════════════════════════════════════
// PERFORMANCE MONITORING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Start a performance measurement
 */
export function perfStart(label: string): void {
  if (!DEBUG_CONFIG.performanceTracking) return;
  performanceMarks.set(label, performance.now());
}

/**
 * End a performance measurement and log result
 */
export function perfEnd(label: string): number {
  if (!DEBUG_CONFIG.performanceTracking) return 0;

  const start = performanceMarks.get(label);
  if (start === undefined) {
    warn('Performance', `No start mark found for: ${label}`);
    return 0;
  }

  const duration = performance.now() - start;
  performanceMarks.delete(label);

  if (duration > 16.67) { // Longer than one frame at 60fps
    warn('Performance', `Slow operation: ${label}`, { duration: `${duration.toFixed(2)}ms` });
  } else {
    debug('Performance', `${label}: ${duration.toFixed(2)}ms`);
  }

  return duration;
}

/**
 * Measure a function's execution time
 */
export function measure<T>(label: string, fn: () => T): T {
  perfStart(label);
  const result = fn();
  perfEnd(label);
  return result;
}

/**
 * Measure an async function's execution time
 */
export async function measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  perfStart(label);
  const result = await fn();
  perfEnd(label);
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE INSPECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Take a snapshot of the current state for debugging
 */
export function snapshotState(state: Partial<SimulationState>): void {
  if (!DEBUG_CONFIG.stateSnapshots) return;

  stateSnapshots.push({
    time: Date.now(),
    state: JSON.parse(JSON.stringify(state)), // Deep clone
  });

  // Keep only last 100 snapshots
  if (stateSnapshots.length > 100) {
    stateSnapshots.shift();
  }
}

/**
 * Get recent state snapshots
 */
export function getSnapshots(): typeof stateSnapshots {
  return stateSnapshots;
}

/**
 * Compare two states and return differences
 */
export function diffStates(
  before: Partial<SimulationState>,
  after: Partial<SimulationState>
): Record<string, { before: unknown; after: unknown }> {
  const diffs: Record<string, { before: unknown; after: unknown }> = {};

  function compare(path: string, a: unknown, b: unknown): void {
    if (typeof a !== typeof b) {
      diffs[path] = { before: a, after: b };
      return;
    }

    if (typeof a === 'object' && a !== null && b !== null) {
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);

      for (const key of keys) {
        compare(`${path}.${key}`, aObj[key], bObj[key]);
      }
    } else if (a !== b) {
      diffs[path] = { before: a, after: b };
    }
  }

  compare('state', before, after);
  return diffs;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEBUG INFO COLLECTION
// ═══════════════════════════════════════════════════════════════════════════

let lastFrameTime = performance.now();
let frameCount = 0;
let fps = 0;

/**
 * Update FPS counter (call once per frame)
 */
export function updateFPS(): void {
  frameCount++;
  const now = performance.now();

  if (now - lastFrameTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastFrameTime = now;
  }
}

/**
 * Get current debug info
 */
export function getDebugInfo(state?: Partial<SimulationState>): DebugInfo {
  return {
    fps,
    lastUpdateTime: performance.now(),
    stateSize: state ? JSON.stringify(state).length : 0,
    activeAlarms: state?.alarms?.filter(a => a.state !== 'NORMAL').length ?? 0,
    memoryUsage: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate a numeric value is within expected range
 */
export function validateRange(
  name: string,
  value: number,
  min: number,
  max: number
): boolean {
  if (value < min || value > max) {
    warn('Validation', `${name} out of range: ${value} (expected ${min}-${max})`);
    return false;
  }
  return true;
}

/**
 * Validate phase fractions sum to 1.0
 */
export function validatePhaseFractions(
  water: number,
  oil: number,
  solids: number
): boolean {
  const sum = water + oil + solids;
  if (Math.abs(sum - 1.0) > 0.001) {
    warn('Validation', `Phase fractions don't sum to 1.0: ${sum}`, { water, oil, solids });
    return false;
  }
  return true;
}

/**
 * Validate mass balance
 */
export function validateMassBalance(
  feedIn: number,
  waterOut: number,
  oilOut: number,
  solidsOut: number,
  tolerance: number = 0.05
): boolean {
  const totalOut = waterOut + oilOut + solidsOut;
  const error = Math.abs(feedIn - totalOut) / feedIn;

  if (error > tolerance) {
    warn('Validation', `Mass balance error: ${(error * 100).toFixed(1)}%`, {
      feedIn,
      waterOut,
      oilOut,
      solidsOut,
      totalOut,
    });
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT LOG FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all log entries
 */
export function getLogs(): DebugLogEntry[] {
  return [...logEntries];
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  logEntries.length = 0;
}

/**
 * Export logs as JSON
 */
export function exportLogs(): string {
  return JSON.stringify(logEntries, null, 2);
}

/**
 * Download logs as file
 */
export function downloadLogs(): void {
  const blob = new Blob([exportLogs()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `debug-logs-${new Date().toISOString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════════
// REACT DEVTOOLS INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Add debug info to window for React DevTools inspection
 */
export function exposeToDevTools(name: string, value: unknown): void {
  if (DEBUG_CONFIG.enabled && typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>)[`__DEBUG_${name}__`] = value;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default {
  log,
  debug,
  info,
  warn,
  error,
  perfStart,
  perfEnd,
  measure,
  measureAsync,
  snapshotState,
  getSnapshots,
  diffStates,
  updateFPS,
  getDebugInfo,
  validateRange,
  validatePhaseFractions,
  validateMassBalance,
  getLogs,
  clearLogs,
  exportLogs,
  downloadLogs,
  exposeToDevTools,
};
