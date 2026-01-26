/**
 * BATCH PROCESSING PHASES
 * =======================
 * ISA-88 compliant batch phase definitions for the Delta-Canter 20-843A
 */

export interface BatchPhaseConfig {
  name: string;
  icon: string;
  water: number;      // % water in feed
  oil: number;        // % oil in feed
  sediment: number;   // % sediment in feed
  volume: number;     // m³ to process
  temp: number;       // °C target temperature
  flow: number;       // m³/h feed rate
  rpm: number;        // bowl speed
}

export const BATCH_PHASES: BatchPhaseConfig[] = [
  {
    name: 'Mixed Sludge',
    icon: '🌊',
    water: 65,
    oil: 15,
    sediment: 20,
    volume: 5.5,
    temp: 58,
    flow: 8,
    rpm: 4000
  },
  {
    name: 'Emulsion Layer',
    icon: '🧴',
    water: 50,
    oil: 45,
    sediment: 5,
    volume: 8.25,
    temp: 65,
    flow: 10,
    rpm: 3800
  },
  {
    name: 'Water-Rich',
    icon: '💧',
    water: 85,
    oil: 12,
    sediment: 3,
    volume: 22.0,
    temp: 62,
    flow: 14,
    rpm: 3200
  },
  {
    name: 'Oil-Rich',
    icon: '🛢️',
    water: 30,
    oil: 65,
    sediment: 5,
    volume: 11.0,
    temp: 68,
    flow: 12,
    rpm: 3500
  },
  {
    name: 'Final Rinse',
    icon: '✨',
    water: 95,
    oil: 4,
    sediment: 1,
    volume: 5.5,
    temp: 55,
    flow: 10,
    rpm: 3000
  },
];

export const getTotalBatchVolume = () =>
  BATCH_PHASES.reduce((sum, phase) => sum + phase.volume, 0);

export const getEstimatedBatchTime = (avgFlow: number = 10) =>
  (getTotalBatchVolume() / avgFlow) * 60; // minutes
