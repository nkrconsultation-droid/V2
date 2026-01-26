/**
 * PHASE TRACKING HOOK
 * ===================
 * Tracks detailed metrics for each operational phase during batch processing.
 * Used for generating Phase Cost & Three-Fraction Quality Reports.
 */

import { useState, useRef, useCallback } from 'react';
import { BATCH_PHASES, BatchPhaseConfig } from '../lib/constants';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface PhaseQualityStats {
  sum: number;
  count: number;
  min: number;
  max: number;
}

export interface PhaseDataRecord {
  phaseIndex: number;
  phaseName: string;
  startTime: number;
  endTime: number | null;
  totals: {
    feed: number;
    water: number;
    oil: number;
    solids: number;
    energy: number;
    duration: number;
  };
  quality: {
    oilEfficiency: PhaseQualityStats;
    solidsEfficiency: PhaseQualityStats;
    waterQuality: PhaseQualityStats;
    pH: PhaseQualityStats;
    turbidity: PhaseQualityStats;
  };
  costs: {
    energy: number;
    chemicals: number;
    disposal: number;
    water: number;
    labor: number;
    filter: number;
  };
  fractions: {
    water: {
      purity: PhaseQualityStats;
      oilContent: PhaseQualityStats;
      tss: PhaseQualityStats;
    };
    oil: {
      waterContent: PhaseQualityStats;
      solidsContent: PhaseQualityStats;
      recovery: PhaseQualityStats;
    };
    solids: {
      moisture: PhaseQualityStats;
      oilContent: PhaseQualityStats;
      recovery: PhaseQualityStats;
    };
  };
  massBalance: {
    totalIn: number;
    totalOut: number;
    closurePct: PhaseQualityStats;
  };
  dataQuality: {
    samplesCollected: number;
    anomalies: string[];
    confidenceLevel: string;
  };
}

interface CurrentPhaseData {
  phaseIndex: number;
  startTime: number;
  totals: { feed: number; water: number; oil: number; solids: number; energy: number };
  qualitySamples: { oilEff: number[]; solidsEff: number[]; wq: number[]; pH: number[]; turb: number[] };
  fractionSamples: {
    waterPurity: number[]; waterOil: number[]; waterTSS: number[];
    oilWater: number[]; oilSolids: number[]; oilRecovery: number[];
    solidsMoisture: number[]; solidsOil: number[]; solidsRecovery: number[];
  };
  costs: { energy: number; chemicals: number; disposal: number; water: number; labor: number; filter: number };
  massIn: number;
  massOut: number;
  closureSamples: number[];
  anomalies: string[];
}

export interface ProcessDataSnapshot {
  feedFlow: number;
  waterOut: number;
  oilOut: number;
  solidsOut: number;
  totalPower: number;
  oilEff: number;
  solidsEff: number;
  waterQuality: number;
  pH: number;
  turbidity: number;
  vibration: number;
  oilMoisture?: number;
  oilSolids?: number;
  cakeMoisture?: number;
  cakeOil?: number;
}

export interface CostRates {
  elec: number;
  waterTreatment: number;
  sludgeDisposal: number;
  laborRate: number;
}

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════

export function usePhaseTracking(batchPhases: BatchPhaseConfig[] = BATCH_PHASES) {
  const [phaseData, setPhaseData] = useState<PhaseDataRecord[]>([]);
  const currentPhaseDataRef = useRef<CurrentPhaseData | null>(null);

  // Helper to calculate statistics from an array
  const calcStats = (arr: number[]): PhaseQualityStats => {
    if (arr.length === 0) return { sum: 0, count: 0, min: 0, max: 0 };
    return {
      sum: arr.reduce((a, b) => a + b, 0),
      count: arr.length,
      min: Math.min(...arr),
      max: Math.max(...arr),
    };
  };

  // Initialize phase data when batch mode starts
  const initializePhaseData = useCallback(() => {
    setPhaseData([]);
    currentPhaseDataRef.current = null;
  }, []);

  // Finalize phase data and store
  // Minimum phase duration of 60 seconds to avoid capturing brief transitional phases
  const MIN_PHASE_DURATION_SECONDS = 60;

  const finalizePhaseData = useCallback((endTime: number) => {
    if (!currentPhaseDataRef.current) return;

    const ref = currentPhaseDataRef.current;
    const duration = endTime - ref.startTime;

    // Skip recording phases that lasted less than 60 seconds - these are transitional artifacts
    if (duration < MIN_PHASE_DURATION_SECONDS) {
      currentPhaseDataRef.current = null;
      return;
    }

    const phaseRecord: PhaseDataRecord = {
      phaseIndex: ref.phaseIndex,
      phaseName: batchPhases[ref.phaseIndex]?.name || `Phase ${ref.phaseIndex + 1}`,
      startTime: ref.startTime,
      endTime: endTime,
      totals: {
        ...ref.totals,
        duration: duration,
      },
      quality: {
        oilEfficiency: calcStats(ref.qualitySamples.oilEff),
        solidsEfficiency: calcStats(ref.qualitySamples.solidsEff),
        waterQuality: calcStats(ref.qualitySamples.wq),
        pH: calcStats(ref.qualitySamples.pH),
        turbidity: calcStats(ref.qualitySamples.turb),
      },
      costs: ref.costs,
      fractions: {
        water: {
          purity: calcStats(ref.fractionSamples.waterPurity),
          oilContent: calcStats(ref.fractionSamples.waterOil),
          tss: calcStats(ref.fractionSamples.waterTSS),
        },
        oil: {
          waterContent: calcStats(ref.fractionSamples.oilWater),
          solidsContent: calcStats(ref.fractionSamples.oilSolids),
          recovery: calcStats(ref.fractionSamples.oilRecovery),
        },
        solids: {
          moisture: calcStats(ref.fractionSamples.solidsMoisture),
          oilContent: calcStats(ref.fractionSamples.solidsOil),
          recovery: calcStats(ref.fractionSamples.solidsRecovery),
        },
      },
      massBalance: {
        totalIn: ref.massIn,
        totalOut: ref.massOut,
        closurePct: calcStats(ref.closureSamples),
      },
      dataQuality: {
        samplesCollected: ref.qualitySamples.oilEff.length,
        anomalies: [...new Set(ref.anomalies)].slice(0, 10),
        confidenceLevel: ref.qualitySamples.oilEff.length > 60 ? 'High' :
                        ref.qualitySamples.oilEff.length > 30 ? 'Medium' : 'Low',
      },
    };

    setPhaseData(prev => [...prev, phaseRecord]);
    currentPhaseDataRef.current = null;
  }, [batchPhases]);

  // Start tracking a new phase
  const startPhaseTracking = useCallback((phaseIndex: number, simTime: number) => {
    // Guard: Don't start if we're already tracking this exact phase
    if (currentPhaseDataRef.current?.phaseIndex === phaseIndex) {
      return;
    }

    // Finalize previous phase if exists
    if (currentPhaseDataRef.current !== null) {
      finalizePhaseData(simTime);
    }

    // Initialize new phase tracking
    currentPhaseDataRef.current = {
      phaseIndex,
      startTime: simTime,
      totals: { feed: 0, water: 0, oil: 0, solids: 0, energy: 0 },
      qualitySamples: { oilEff: [], solidsEff: [], wq: [], pH: [], turb: [] },
      fractionSamples: {
        waterPurity: [], waterOil: [], waterTSS: [],
        oilWater: [], oilSolids: [], oilRecovery: [],
        solidsMoisture: [], solidsOil: [], solidsRecovery: [],
      },
      costs: { energy: 0, chemicals: 0, disposal: 0, water: 0, labor: 0, filter: 0 },
      massIn: 0,
      massOut: 0,
      closureSamples: [],
      anomalies: [],
    };
  }, [finalizePhaseData]);

  // Update phase data with current process values
  const updatePhaseData = useCallback((
    proc: ProcessDataSnapshot,
    dt: number,
    costRates: CostRates
  ) => {
    if (!currentPhaseDataRef.current) return;

    const ref = currentPhaseDataRef.current;

    // Update volume totals
    ref.totals.feed += proc.feedFlow * dt / 3600;
    ref.totals.water += proc.waterOut * dt / 3600;
    ref.totals.oil += proc.oilOut * dt / 3600;
    ref.totals.solids += proc.solidsOut * dt / 3600;
    ref.totals.energy += proc.totalPower * dt / 3600;

    // Collect quality samples
    ref.qualitySamples.oilEff.push(proc.oilEff);
    ref.qualitySamples.solidsEff.push(proc.solidsEff);
    ref.qualitySamples.wq.push(proc.waterQuality);
    ref.qualitySamples.pH.push(proc.pH);
    ref.qualitySamples.turb.push(proc.turbidity);

    // Three-fraction quality samples
    ref.fractionSamples.waterPurity.push(100 - (proc.waterQuality / 10000) * 100);
    ref.fractionSamples.waterOil.push(proc.waterQuality);
    ref.fractionSamples.waterTSS.push(proc.turbidity * 1.2);

    ref.fractionSamples.oilWater.push(proc.oilMoisture || 3);
    ref.fractionSamples.oilSolids.push(proc.oilSolids || 0.5);
    ref.fractionSamples.oilRecovery.push(proc.oilEff);

    ref.fractionSamples.solidsMoisture.push(proc.cakeMoisture || 18);
    ref.fractionSamples.solidsOil.push(proc.cakeOil || 2);
    ref.fractionSamples.solidsRecovery.push(proc.solidsEff);

    // Update costs
    ref.costs.energy += proc.totalPower * dt / 3600 * costRates.elec;
    ref.costs.water += proc.waterOut * dt / 3600 * costRates.waterTreatment;
    ref.costs.disposal += proc.solidsOut * dt / 3600 * costRates.sludgeDisposal;
    ref.costs.labor += (dt / 3600) * costRates.laborRate;

    // Mass balance
    ref.massIn += proc.feedFlow * dt / 3600;
    const totalOut = (proc.waterOut + proc.oilOut + proc.solidsOut) * dt / 3600;
    ref.massOut += totalOut;
    const closure = ref.massIn > 0 ? (ref.massOut / ref.massIn) * 100 : 100;
    ref.closureSamples.push(closure);

    // Check for anomalies
    if (proc.oilEff < 70) ref.anomalies.push(`Low oil efficiency: ${proc.oilEff.toFixed(1)}%`);
    if (proc.vibration > 6) ref.anomalies.push(`High vibration: ${proc.vibration.toFixed(1)} mm/s`);
    if (closure < 95 || closure > 105) ref.anomalies.push(`Mass balance deviation: ${closure.toFixed(1)}%`);
  }, []);

  // Get current tracking phase index
  const getCurrentPhaseIndex = useCallback(() => {
    return currentPhaseDataRef.current?.phaseIndex ?? null;
  }, []);

  // Clear all phase data
  const clearPhaseData = useCallback(() => {
    setPhaseData([]);
    currentPhaseDataRef.current = null;
  }, []);

  return {
    phaseData,
    currentPhaseDataRef,
    initializePhaseData,
    startPhaseTracking,
    updatePhaseData,
    finalizePhaseData,
    getCurrentPhaseIndex,
    clearPhaseData,
  };
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export const getPhaseAverage = (stats: PhaseQualityStats): number =>
  stats.count > 0 ? stats.sum / stats.count : 0;

export const calculateOverallTotals = (phaseData: PhaseDataRecord[]) => {
  return phaseData.reduce((acc, p) => ({
    feed: acc.feed + p.totals.feed,
    water: acc.water + p.totals.water,
    oil: acc.oil + p.totals.oil,
    solids: acc.solids + p.totals.solids,
    energy: acc.energy + p.totals.energy,
    duration: acc.duration + p.totals.duration,
    costs: {
      energy: acc.costs.energy + p.costs.energy,
      chemicals: acc.costs.chemicals + p.costs.chemicals,
      disposal: acc.costs.disposal + p.costs.disposal,
      water: acc.costs.water + p.costs.water,
      labor: acc.costs.labor + p.costs.labor,
      filter: acc.costs.filter + p.costs.filter,
    }
  }), {
    feed: 0, water: 0, oil: 0, solids: 0, energy: 0, duration: 0,
    costs: { energy: 0, chemicals: 0, disposal: 0, water: 0, labor: 0, filter: 0 }
  });
};

export const calculateWeightedQuality = (phaseData: PhaseDataRecord[]) => {
  const weighted = phaseData.reduce((acc, p) => {
    const weight = p.totals.feed;
    return {
      oilEff: acc.oilEff + getPhaseAverage(p.quality.oilEfficiency) * weight,
      solidsEff: acc.solidsEff + getPhaseAverage(p.quality.solidsEfficiency) * weight,
      wq: acc.wq + getPhaseAverage(p.quality.waterQuality) * weight,
      totalWeight: acc.totalWeight + weight,
    };
  }, { oilEff: 0, solidsEff: 0, wq: 0, totalWeight: 0 });

  return {
    avgOilEff: weighted.totalWeight > 0 ? weighted.oilEff / weighted.totalWeight : 0,
    avgSolidsEff: weighted.totalWeight > 0 ? weighted.solidsEff / weighted.totalWeight : 0,
    avgWQ: weighted.totalWeight > 0 ? weighted.wq / weighted.totalWeight : 0,
  };
};
