/**
 * SIMULATION HOOK
 * ================
 * Custom React hook for managing simulation state
 * Provides optimized state updates and debugging integration
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type {
  SimulationState,
  ProcessState,
  ProcessAlarm,
  TrendDataPoint,
} from '@/lib/process-types';
import { debug, info, warn, perfStart, perfEnd, updateFPS, snapshotState } from '@/lib/debug-utils';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const SIM_CONFIG = {
  maxTrendPoints: 300,
  logIntervalSec: 1,
  smoothWindowMs: 8000,
  smoothUpdateIntervalMs: 250,
};

// ═══════════════════════════════════════════════════════════════════════════
// SMOOTHING HOOK
// ═══════════════════════════════════════════════════════════════════════════

interface ValueHistoryEntry {
  time: number;
  value: number;
}

/**
 * Hook for smoothing process values over time (reduces UI flicker)
 */
export function useSmoothedValues<T extends Record<string, number>>(
  rawValues: T,
  windowMs: number = SIM_CONFIG.smoothWindowMs
): T {
  const historyRef = useRef<Record<string, ValueHistoryEntry[]>>({});
  const lastUpdateRef = useRef<number>(Date.now());
  const [smoothed, setSmoothed] = useState<T>(rawValues);

  useEffect(() => {
    const now = Date.now();
    const cutoff = now - windowMs;

    // Update history for each value
    Object.entries(rawValues).forEach(([key, value]) => {
      if (typeof value !== 'number') return;

      if (!historyRef.current[key]) {
        historyRef.current[key] = [];
      }

      historyRef.current[key].push({ time: now, value });
      historyRef.current[key] = historyRef.current[key].filter(v => v.time > cutoff);
    });

    // Only update smoothed values periodically
    if (now - lastUpdateRef.current > SIM_CONFIG.smoothUpdateIntervalMs) {
      lastUpdateRef.current = now;

      const newSmoothed = { ...rawValues };
      Object.keys(historyRef.current).forEach(key => {
        const history = historyRef.current[key];
        if (history.length > 0) {
          (newSmoothed as Record<string, number>)[key] =
            history.reduce((sum, v) => sum + v.value, 0) / history.length;
        }
      });

      setSmoothed(newSmoothed as T);
    }
  }, [rawValues, windowMs]);

  return smoothed;
}

// ═══════════════════════════════════════════════════════════════════════════
// TREND DATA HOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook for managing trend data with automatic logging
 */
export function useTrendData(
  proc: ProcessState,
  simTime: number,
  isRunning: boolean,
  maxPoints: number = SIM_CONFIG.maxTrendPoints
) {
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const lastLogRef = useRef<number>(0);

  useEffect(() => {
    if (!isRunning) return;

    // Log data at regular intervals
    if (simTime - lastLogRef.current >= SIM_CONFIG.logIntervalSec) {
      lastLogRef.current = simTime;

      setTrendData(prev => {
        const newPoint: TrendDataPoint = {
          time: simTime,
          feedFlow: proc.feedFlow,
          heaterTemp: proc.heaterTemp,
          bowlSpeed: proc.bowlSpeed,
          oilEff: proc.oilEff,
          solidsEff: proc.solidsEff,
          waterQuality: proc.waterQuality,
          vibration: proc.vibration,
          totalPower: proc.totalPower,
          pH: proc.pH,
          turbidity: proc.turbidity,
        };

        const updated = [...prev, newPoint];
        // Trim to max points
        if (updated.length > maxPoints) {
          return updated.slice(-maxPoints);
        }
        return updated;
      });
    }
  }, [proc, simTime, isRunning, maxPoints]);

  const clearTrends = useCallback(() => {
    setTrendData([]);
    lastLogRef.current = 0;
    info('Trends', 'Trend data cleared');
  }, []);

  return { trendData, clearTrends };
}

// ═══════════════════════════════════════════════════════════════════════════
// ALARM MANAGEMENT HOOK
// ═══════════════════════════════════════════════════════════════════════════

interface AlarmConfig {
  id: string;
  tag: string;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  getValue: () => number;
  getLimit: () => number;
  condition: 'HIGH' | 'LOW';
  unit?: string;
  onDelay?: number;
  offDelay?: number;
}

/**
 * Hook for managing alarms with proper ISA-18.2 state machine
 */
export function useAlarms(
  configs: AlarmConfig[],
  isRunning: boolean
) {
  const [alarms, setAlarms] = useState<ProcessAlarm[]>([]);
  const pendingRef = useRef<Map<string, { startTime: number; type: 'on' | 'off' }>>(new Map());

  // Check alarm conditions
  const checkAlarms = useCallback(() => {
    if (!isRunning) return;

    perfStart('alarmCheck');
    const now = Date.now();

    setAlarms(prev => {
      const updated = [...prev];

      configs.forEach(config => {
        const value = config.getValue();
        const limit = config.getLimit();
        const isTriggered = config.condition === 'HIGH' ? value >= limit : value <= limit;

        const existingIndex = updated.findIndex(a => a.id === config.id);
        const existing = existingIndex >= 0 ? updated[existingIndex] : null;
        const pending = pendingRef.current.get(config.id);

        if (isTriggered) {
          if (!existing || existing.state === 'NORMAL') {
            // Alarm condition detected
            const onDelay = (config.onDelay ?? 3) * 1000;

            if (!pending || pending.type !== 'on') {
              // Start on-delay timer
              pendingRef.current.set(config.id, { startTime: now, type: 'on' });
            } else if (now - pending.startTime >= onDelay) {
              // On-delay elapsed, activate alarm
              const newAlarm: ProcessAlarm = {
                id: config.id,
                tag: config.tag,
                description: config.description,
                priority: config.priority,
                state: 'UNACK_ACTIVE',
                timestamp: new Date(),
                value,
                limit,
                unit: config.unit,
                acknowledged: false,
              };

              if (existingIndex >= 0) {
                updated[existingIndex] = newAlarm;
              } else {
                updated.push(newAlarm);
              }

              pendingRef.current.delete(config.id);
              warn('Alarms', `Alarm activated: ${config.tag}`, { value, limit });
            }
          }
        } else {
          // Condition cleared
          if (existing && existing.state !== 'NORMAL') {
            const offDelay = (config.offDelay ?? 5) * 1000;

            if (!pending || pending.type !== 'off') {
              pendingRef.current.set(config.id, { startTime: now, type: 'off' });
            } else if (now - pending.startTime >= offDelay) {
              // Off-delay elapsed
              if (existing.acknowledged) {
                updated[existingIndex] = { ...existing, state: 'NORMAL' };
              } else {
                updated[existingIndex] = { ...existing, state: 'UNACK_RTN' };
              }
              pendingRef.current.delete(config.id);
              info('Alarms', `Alarm cleared: ${config.tag}`);
            }
          } else {
            pendingRef.current.delete(config.id);
          }
        }
      });

      return updated;
    });

    perfEnd('alarmCheck');
  }, [configs, isRunning]);

  // Acknowledge alarm
  const acknowledge = useCallback((id: string) => {
    setAlarms(prev =>
      prev.map(alarm =>
        alarm.id === id
          ? {
              ...alarm,
              state: alarm.state === 'UNACK_RTN' ? 'NORMAL' : 'ACK_ACTIVE',
              acknowledged: true,
              acknowledgedAt: new Date(),
            }
          : alarm
      )
    );
    info('Alarms', `Alarm acknowledged: ${id}`);
  }, []);

  // Acknowledge all
  const acknowledgeAll = useCallback(() => {
    setAlarms(prev =>
      prev.map(alarm =>
        alarm.state === 'UNACK_ACTIVE' || alarm.state === 'UNACK_RTN'
          ? {
              ...alarm,
              state: alarm.state === 'UNACK_RTN' ? 'NORMAL' : 'ACK_ACTIVE',
              acknowledged: true,
              acknowledgedAt: new Date(),
            }
          : alarm
      )
    );
    info('Alarms', 'All alarms acknowledged');
  }, []);

  // Get active alarms
  const activeAlarms = useMemo(
    () => alarms.filter(a => a.state !== 'NORMAL'),
    [alarms]
  );

  const criticalCount = useMemo(
    () => activeAlarms.filter(a => a.priority === 'CRITICAL').length,
    [activeAlarms]
  );

  return {
    alarms,
    activeAlarms,
    criticalCount,
    checkAlarms,
    acknowledge,
    acknowledgeAll,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMULATION LOOP HOOK
// ═══════════════════════════════════════════════════════════════════════════

interface SimulationLoopOptions {
  onTick: (dt: number) => void;
  speed?: number;
}

/**
 * Hook for managing the simulation loop with proper timing
 */
export function useSimulationLoop(
  isRunning: boolean,
  options: SimulationLoopOptions
) {
  const frameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());
  const { onTick, speed = 1 } = options;

  useEffect(() => {
    if (!isRunning) {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    const loop = () => {
      updateFPS();
      perfStart('simLoop');

      const now = Date.now();
      const realDt = (now - lastUpdateRef.current) / 1000; // Real seconds elapsed
      const simDt = realDt * speed; // Simulation seconds

      lastUpdateRef.current = now;

      // Cap dt to prevent huge jumps (e.g., after tab was inactive)
      const cappedDt = Math.min(simDt, 1);

      onTick(cappedDt);

      perfEnd('simLoop');
      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isRunning, onTick, speed]);
}

// ═══════════════════════════════════════════════════════════════════════════
// DEBUG PANEL HOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook for debug panel visibility
 */
export function useDebugPanel() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+D to toggle debug panel
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible(prev => !prev);
        info('Debug', `Debug panel ${!isVisible ? 'shown' : 'hidden'}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  return { isVisible, setIsVisible };
}

export default {
  useSmoothedValues,
  useTrendData,
  useAlarms,
  useSimulationLoop,
  useDebugPanel,
};
