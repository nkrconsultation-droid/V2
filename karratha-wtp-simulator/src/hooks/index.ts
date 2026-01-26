/**
 * CUSTOM HOOKS
 * =============
 * Optimized React hooks for the centrifuge simulator
 */

export {
  useSmoothedValues,
  useTrendData,
  useAlarms,
  useSimulationLoop,
  useDebugPanel,
} from './useSimulation';

export {
  usePhaseTracking,
  getPhaseAverage,
  calculateOverallTotals,
  calculateWeightedQuality,
} from './usePhaseTracking';

export type {
  PhaseDataRecord,
  PhaseQualityStats,
  ProcessDataSnapshot,
  CostRates,
} from './usePhaseTracking';
