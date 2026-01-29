/**
 * SIMULATION CONTEXT
 * ==================
 * Shared simulation state for PFD and other components
 * Provides reactive access to simulation engine state
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { simulationEngineV2 } from '@/lib/simulation-v2';
import type { ProcessState, ProcessKPIs } from '@/lib/types-v2';

// ============================================
// TYPES
// ============================================

export interface SimulationContextValue {
  // Control
  isRunning: boolean;
  simSpeed: number;
  simTime: number;

  // State
  state: ProcessState | null;
  kpis: ProcessKPIs | null;

  // Derived values for PFD
  flowRates: Record<string, number>;
  tankLevels: Record<string, number>;
  equipmentStatus: Record<string, 'running' | 'stopped' | 'alarm' | 'standby'>;

  // Totals
  totals: {
    waterProduced: number;
    oilRecovered: number;
    solidsRemoved: number;
    energyConsumed: number;
  };

  // Actions
  start: () => void;
  stop: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  step: (dt: number) => void;
}

const defaultContext: SimulationContextValue = {
  isRunning: false,
  simSpeed: 1,
  simTime: 0,
  state: null,
  kpis: null,
  flowRates: {},
  tankLevels: {},
  equipmentStatus: {},
  totals: { waterProduced: 0, oilRecovered: 0, solidsRemoved: 0, energyConsumed: 0 },
  start: () => {},
  stop: () => {},
  reset: () => {},
  setSpeed: () => {},
  step: () => {},
};

// ============================================
// CONTEXT
// ============================================

const SimulationContext = createContext<SimulationContextValue>(defaultContext);

export function useSimulationContext() {
  return useContext(SimulationContext);
}

// ============================================
// PROVIDER
// ============================================

interface SimulationProviderProps {
  children: React.ReactNode;
}

export function SimulationProvider({ children }: SimulationProviderProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const [simTime, setSimTime] = useState(0);
  const [state, setState] = useState<ProcessState | null>(null);
  const [kpis, setKpis] = useState<ProcessKPIs | null>(null);

  const totalsRef = useRef({
    waterProduced: 0,
    oilRecovered: 0,
    solidsRemoved: 0,
    energyConsumed: 0,
  });
  const [totals, setTotals] = useState(totalsRef.current);

  const frameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  // Initialize state from engine
  useEffect(() => {
    const initialState = simulationEngineV2.getState();
    setState(initialState);
    setKpis(simulationEngineV2.calculateKPIs());
  }, []);

  // Simulation loop
  useEffect(() => {
    if (!isRunning) {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    const loop = () => {
      const now = Date.now();
      const realDt = (now - lastUpdateRef.current) / 1000;
      const simDt = Math.min(realDt * simSpeed, 1); // Cap to prevent huge jumps
      lastUpdateRef.current = now;

      // Step simulation
      const newState = simulationEngineV2.step(simDt);
      setState(newState);
      setSimTime(prev => prev + simDt);

      // Update KPIs periodically
      const newKpis = simulationEngineV2.calculateKPIs();
      setKpis(newKpis);

      // Accumulate totals
      if (newKpis) {
        const dtHours = simDt / 3600;
        totalsRef.current = {
          waterProduced: totalsRef.current.waterProduced + (newKpis.instantaneous.pondDischargeRate || 0) * dtHours,
          oilRecovered: totalsRef.current.oilRecovered + (newKpis.instantaneous.oilRecoveryRate || 0) * dtHours,
          solidsRemoved: totalsRef.current.solidsRemoved + (newKpis.instantaneous.sludgeGenerationRate || 0) * dtHours,
          energyConsumed: totalsRef.current.energyConsumed + (newKpis.instantaneous.totalPowerConsumption || 0) * dtHours,
        };
        setTotals({ ...totalsRef.current });
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    lastUpdateRef.current = Date.now();
    frameRef.current = requestAnimationFrame(loop);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isRunning, simSpeed]);

  // Derive flow rates for PFD edges
  const flowRates = React.useMemo((): Record<string, number> => {
    if (!kpis || !state) {
      return {
        E01: 0, E02: 0, E03: 0, E04: 0, E05: 0,
        E06: 0, E07: 0, E08: 0, E09: 0, E10: 0,
        E11: 0, E12: 0, E13: 0, E14: 0, E15: 0,
        E16: 0, E17: 0, E18: 0, E19: 0, E20: 0,
      };
    }

    const inst = kpis.instantaneous;
    return {
      // Main process flow
      E01: inst.infeedRate || 0,           // Tanker -> Tip
      E02: inst.infeedRate || 0,           // Tip -> Coarse Filter
      E03: (inst.infeedRate || 0) * 0.99,  // Coarse -> Pretreatment Tanks
      E04: inst.apiThroughput || 0,        // Tanks -> Fine Filter
      E05: inst.centrifugeFeedRate || 0,   // Fine Filter -> Centrifuge
      // Water stream
      E06: (inst.centrifugeFeedRate || 0) * 0.8,  // Centrifuge -> Water Storage
      E07: (inst.centrifugeFeedRate || 0) * 0.8,  // Water Storage -> DAF
      E08: (inst.centrifugeFeedRate || 0) * 0.78, // DAF -> Bio Buffer
      E09: (inst.centrifugeFeedRate || 0) * 0.78, // Bio Buffer -> MBR
      E10: inst.pondDischargeRate || 0,    // MBR -> Ponds
      // Oil stream
      E11: inst.oilRecoveryRate || 0,      // Centrifuge -> Oil Tanks
      E12: inst.oilRecoveryRate || 0,      // Oil Tanks -> Oil Out
      // Solids stream
      E13: inst.sludgeGenerationRate || 0, // Centrifuge -> Solids Storage
      E14: inst.sludgeGenerationRate || 0, // Solids Storage -> Out
      // Sludge/flush streams
      E15: (inst.sludgeGenerationRate || 0) * 0.1,  // Centrifuge flush
      E16: (inst.sludgeGenerationRate || 0) * 0.05, // DAF float
      E17: (inst.sludgeGenerationRate || 0) * 0.02, // WAS return
      // Utilities (chemical/heat - no volume flow)
      E18: state.heaters?.some(h => h.enabled) ? 1 : 0,
      E19: state.chemicalDosing?.some(c => c.pumpRunning) ? 1 : 0,
      E20: state.chemicalDosing?.some(c => c.pumpRunning) ? 1 : 0,
    };
  }, [kpis, state]);

  // Derive tank levels
  const tankLevels = React.useMemo(() => {
    if (!state) return {};

    const levels: Record<string, number> = {};

    // Map simulation tanks to PFD nodes
    state.tanks?.forEach((tank, i) => {
      if (i < 4) {
        levels['N04'] = (levels['N04'] || 0) + (tank.currentLevel / 4); // Average of pretreatment tanks
      }
    });

    // Water storage (post-centrifuge)
    levels['N07'] = state.tanks?.[4]?.currentLevel || 50;

    // Post-DAF buffer
    levels['N09'] = state.tanks?.[5]?.currentLevel || 50;

    // Oil tanks
    levels['N12'] = 50; // Default

    // Solids storage
    levels['N14'] = 30;

    // Sludge storage
    levels['N16'] = 40;

    // Evaporation pond
    const pond = state.evaporationPonds?.[0];
    if (pond) {
      levels['N11'] = (pond.currentVolume / pond.capacity) * 100;
    }

    return levels;
  }, [state]);

  // Derive equipment status
  const equipmentStatus = React.useMemo(() => {
    if (!state) return {};

    const status: Record<string, 'running' | 'stopped' | 'alarm' | 'standby'> = {};

    // Default all to standby
    for (let i = 1; i <= 19; i++) {
      status[`N${i.toString().padStart(2, '0')}`] = isRunning ? 'running' : 'standby';
    }

    // Check for alarms
    if (state.activeAlarms?.length > 0) {
      // Mark affected equipment as alarm state
      state.activeAlarms.forEach(alarm => {
        if (alarm.tag?.includes('TIC')) status['N17'] = 'alarm';
        if (alarm.tag?.includes('CENT')) status['N06'] = 'alarm';
      });
    }

    // Check centrifuge
    if (state.centrifuge) {
      status['N06'] = state.centrifuge.status === 'running' ? 'running' :
                       state.centrifuge.status === 'fault' ? 'alarm' : 'standby';
    }

    // Check pumps
    const anyPumpRunning = state.pumps?.some(p => p.status === 'running');
    if (!anyPumpRunning && isRunning) {
      status['N02'] = 'standby';
      status['N03'] = 'standby';
      status['N05'] = 'standby';
    }

    // Heater status
    const heaterOn = state.heaters?.some(h => h.enabled && h.currentDuty > 0);
    status['N17'] = heaterOn ? 'running' : 'standby';

    return status;
  }, [state, isRunning]);

  // Actions
  const start = useCallback(() => {
    setIsRunning(true);
    simulationEngineV2.start?.();
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    simulationEngineV2.stop?.();
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setSimTime(0);
    totalsRef.current = { waterProduced: 0, oilRecovered: 0, solidsRemoved: 0, energyConsumed: 0 };
    setTotals(totalsRef.current);
    simulationEngineV2.reset?.();
    const newState = simulationEngineV2.getState();
    setState(newState);
    setKpis(simulationEngineV2.calculateKPIs());
  }, []);

  const step = useCallback((dt: number) => {
    const newState = simulationEngineV2.step(dt);
    setState(newState);
    setSimTime(prev => prev + dt);
    setKpis(simulationEngineV2.calculateKPIs());
  }, []);

  const value: SimulationContextValue = {
    isRunning,
    simSpeed,
    simTime,
    state,
    kpis,
    flowRates,
    tankLevels,
    equipmentStatus,
    totals,
    start,
    stop,
    reset,
    setSpeed: setSimSpeed,
    step,
  };

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}

export default SimulationContext;
