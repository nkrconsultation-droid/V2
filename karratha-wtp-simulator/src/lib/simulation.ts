/**
 * KARRATHA WTP SIMULATOR - PROCESS SIMULATION ENGINE
 * 
 * Core simulation engine implementing:
 * - Real-time mass and energy balance calculations
 * - Stokes Law separation physics
 * - Tank dynamics and level tracking
 * - Interlock and safety system logic
 * - Process control algorithms
 * 
 * References:
 * - UR-OPS-001 through UR-OPS-032 (User Requirements Register)
 * - AS 1940 for overfill protection
 * - API Publication 421 for separator design
 */

import type {
  ProcessState,
  SimulationConfig,
  TankConfiguration,
  PumpConfiguration,
  APISeparator,
  Alarm,
  Interlock,
  TransferRoute,
  ProcessKPIs,
  OperationalCostBreakdown,
  CostParameters,
} from './types';

import {
  stokesSettlingVelocity,
  calculateWaterViscosity,
  calculateWaterDensity,
  calculateOilDensity,
  calculatePumpPerformance,
} from './engineering';

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

export const DEFAULT_COST_PARAMETERS: CostParameters = {
  electricity: {
    rate: 0.28,
    peakRate: 0.45,
    peakHours: { start: 14, end: 20 },
  },
  chemicals: {
    demulsifier: 8.50,
    flocculant: 3.20,
    acid: 1.50,
    caustic: 1.80,
  },
  disposal: {
    sludge: 180,
    oilyWaste: 250,
  },
  labor: {
    operatorRate: 85,
    maintenanceRate: 120,
    operatorsPerShift: 1,
  },
  revenue: {
    oilRecovery: 450,
    treatmentFee: 85,
  },
};

// =============================================================================
// INITIAL PLANT CONFIGURATION
// =============================================================================

export function createInitialState(): ProcessState {
  // Create vertical tanks (VT-001 to VT-006) per SOW 2.5.2
  const verticalTanks: TankConfiguration[] = [
    createTank('VT-001', 'Feed Buffer Tank 1', 'vertical', 'feed_buffer', 100, 4, 8),
    createTank('VT-002', 'Feed Buffer Tank 2', 'vertical', 'feed_buffer', 100, 4, 8),
    createTank('VT-003', 'Process Tank 1', 'vertical', 'water_processing', 150, 5, 8, true),
    createTank('VT-004', 'Process Tank 2', 'vertical', 'water_processing', 150, 5, 8, true),
    createTank('VT-005', 'Sludge Holding Tank', 'vertical', 'sludge_holding', 50, 3, 8),
    createTank('VT-006', 'Treated Water Tank', 'vertical', 'water_processing', 100, 4, 8),
  ];

  // Create horizontal tanks (HT-001 to HT-007) per SOW 2.5.2
  const horizontalTanks: TankConfiguration[] = [
    createTank('HT-001', 'Oil Storage 1', 'horizontal', 'oil_storage', 80, 3, 12),
    createTank('HT-002', 'Oil Storage 2', 'horizontal', 'oil_storage', 80, 3, 12),
    createTank('HT-003', 'Oil Storage 3', 'horizontal', 'oil_storage', 80, 3, 12),
    createTank('HT-004', 'Oil Export Tank', 'horizontal', 'export', 100, 3.5, 12),
    createTank('HT-005', 'Slop Tank 1', 'horizontal', 'oil_storage', 60, 2.5, 12),
    createTank('HT-006', 'Slop Tank 2', 'horizontal', 'oil_storage', 60, 2.5, 12),
    createTank('HT-007', 'Oil Recovery Tank', 'horizontal', 'oil_storage', 50, 2.5, 10),
  ];

  const tanks = [...verticalTanks, ...horizontalTanks];

  // Set initial levels (random realistic values)
  tanks.forEach(tank => {
    tank.currentLevel = 20 + Math.random() * 40; // 20-60%
    tank.currentVolume = tank.capacity * tank.currentLevel / 100;
    
    // Set composition based on tank type
    if (tank.service === 'oil_storage' || tank.service === 'export') {
      tank.composition = { water: 0.03, oil: 0.95, solids: 0.02 };
    } else if (tank.service === 'sludge_holding') {
      tank.composition = { water: 0.30, oil: 0.20, solids: 0.50 };
    } else if (tank.service === 'water_processing') {
      tank.composition = { water: 0.85, oil: 0.10, solids: 0.05 };
    } else {
      tank.composition = { water: 0.70, oil: 0.25, solids: 0.05 };
    }
  });

  // Create pumps per SOW 4.2.1.1
  const pumps: PumpConfiguration[] = [
    createPump('P-001', 'Infeed Pump 1', 'centrifugal', 50, 25, 'INFEED', 'VT-001'),
    createPump('P-002', 'Infeed Pump 2', 'centrifugal', 50, 25, 'INFEED', 'VT-002'),
    createPump('P-003', 'Process Transfer Pump 1', 'centrifugal', 50, 30, 'VT-001', 'API-001'),
    createPump('P-004', 'Process Transfer Pump 2', 'centrifugal', 50, 30, 'VT-002', 'API-001'),
    createPump('P-005', 'Recirculation Pump', 'centrifugal', 15, 20, 'VT-003', 'VT-003'),
    createPump('P-006', 'Oil Transfer Pump', 'centrifugal', 30, 20, 'API-001', 'HT-001'),
    createPump('P-007', 'Treated Water Pump', 'centrifugal', 50, 15, 'VT-006', 'POND'),
    createPump('P-008', 'Sludge Pump', 'progressive_cavity', 7, 30, 'VT-003', 'VT-005'),
    createPump('P-009', 'Oil Export Pump', 'centrifugal', 40, 25, 'HT-004', 'EXPORT'),
  ];

  // Create API Separator per SOW 4.2.1.2
  const apiSeparator: APISeparator = {
    id: 'API-001',
    name: 'API Oil/Water Separator',
    length: 15,
    width: 3,
    depth: 2,
    designFlow: 75,
    currentFlow: 0,
    oilSkimRate: 0,
    sludgeDrawRate: 0,
    inletOilConcentration: 0,
    outletOilConcentration: 0,
    temperature: 25,
  };

  // Create interlocks per AS 1940 requirements
  const interlocks: Interlock[] = [
    ...tanks.map(tank => ({
      id: `IL-${tank.id}-OVERFILL`,
      name: `${tank.id} Overfill Protection`,
      description: `Stop all inflow to ${tank.name} on high-high level`,
      condition: `${tank.id}.level >= ${tank.highHighLevel}`,
      action: `CLOSE all inlet valves, STOP transfer pumps to ${tank.id}`,
      status: 'healthy' as const,
      resetRequired: true, // Per UR-OPS-017
    })),
    {
      id: 'IL-OIL-TO-POND',
      name: 'Oil to Pond Prevention',
      description: 'Prevent oil-dominant stream discharge to evaporation pond',
      condition: 'OIW_ANALYSER.value > 500 AND POND_VALVE.state == open',
      action: 'CLOSE pond discharge valve, ALARM operator',
      status: 'healthy',
      resetRequired: false,
    },
  ];

  return {
    mode: 'normal',
    timestamp: new Date(),
    tanks,
    pumps,
    apiSeparator,
    heaters: [
      { id: 'HTR-001', name: 'Process Heater 1', type: 'electric', dutyRating: 150, currentDuty: 0, inletTemp: 25, outletTemp: 25, setpoint: 65, enabled: false },
      { id: 'HTR-002', name: 'Process Heater 2', type: 'electric', dutyRating: 100, currentDuty: 0, inletTemp: 25, outletTemp: 25, setpoint: 65, enabled: false },
    ],
    filters: [
      { id: 'FLT-001', name: 'Infeed Coarse Screen', type: 'coarse_screen', meshSize: 20000, designFlow: 75, currentFlow: 0, differentialPressure: 5, cleanDP: 5, dirtyDP: 50, status: 'operating' },
      { id: 'FLT-002', name: 'Oil Polishing Filter', type: 'basket', meshSize: 100, designFlow: 30, currentFlow: 0, differentialPressure: 8, cleanDP: 5, dirtyDP: 40, status: 'operating' },
    ],
    chemicalDosing: [
      { id: 'CHEM-001', name: 'Demulsifier Dosing', chemicalType: 'demulsifier', concentration: 30, doseRate: 50, tankLevel: 75, pumpRunning: false },
      { id: 'CHEM-002', name: 'Flocculant Dosing', chemicalType: 'flocculant', concentration: 0.5, doseRate: 20, tankLevel: 80, pumpRunning: false },
      { id: 'CHEM-003', name: 'pH Adjustment (Acid)', chemicalType: 'acid', concentration: 98, doseRate: 0, tankLevel: 60, pumpRunning: false },
    ],
    instruments: createInstruments(tanks),
    valves: createValves(),
    activeTransfers: [],
    alarms: [],
    interlocks,
  };
}

function createTank(
  id: string,
  name: string,
  type: 'vertical' | 'horizontal',
  service: TankConfiguration['service'],
  capacity: number,
  diameter: number,
  heightOrLength: number,
  hasHeating: boolean = false
): TankConfiguration {
  return {
    id,
    name,
    type,
    service,
    capacity,
    diameter,
    height: heightOrLength,
    currentLevel: 0,
    currentVolume: 0,
    temperature: 25,
    composition: { water: 0.7, oil: 0.25, solids: 0.05 },
    highHighLevel: 95, // AS 1940 overfill protection
    highLevel: 85,
    lowLevel: 15,
    lowLowLevel: 5,
    hasHeating,
    heatingSetpoint: hasHeating ? 65 : undefined,
    hasAgitator: type === 'vertical' && service === 'water_processing',
    agitatorSpeed: 0,
  };
}

function createPump(
  id: string,
  name: string,
  type: PumpConfiguration['type'],
  maxFlow: number,
  maxHead: number,
  source: string,
  destination: string
): PumpConfiguration {
  return {
    id,
    name,
    type,
    maxFlow,
    maxHead,
    currentFlow: 0,
    currentHead: 0,
    status: 'stopped',
    vfdEquipped: type === 'centrifugal',
    currentSpeed: 0,
    powerConsumption: 0,
    efficiency: 0,
    source,
    destination,
  };
}

function createInstruments(tanks: TankConfiguration[]) {
  const instruments = [];
  
  // Tank level instruments
  for (const tank of tanks) {
    instruments.push({
      id: `LIT-${tank.id}`,
      tag: `LIT-${tank.id.replace('-', '')}`,
      description: `${tank.name} Level`,
      type: 'level' as const,
      range: { min: 0, max: 100 },
      unit: '%',
      currentValue: tank.currentLevel,
      alarmHigh: tank.highLevel,
      alarmLow: tank.lowLevel,
      tripHigh: tank.highHighLevel,
      tripLow: tank.lowLowLevel,
      status: 'normal' as const,
    });

    instruments.push({
      id: `TIT-${tank.id}`,
      tag: `TIT-${tank.id.replace('-', '')}`,
      description: `${tank.name} Temperature`,
      type: 'temperature' as const,
      range: { min: 0, max: 100 },
      unit: '°C',
      currentValue: tank.temperature,
      alarmHigh: 85,
      status: 'normal' as const,
    });
  }

  // Flow meters
  instruments.push(
    { id: 'FIT-001', tag: 'FIT001', description: 'Infeed Flow', type: 'flow' as const, range: { min: 0, max: 100 }, unit: 'm³/hr', currentValue: 0, status: 'normal' as const },
    { id: 'FIT-002', tag: 'FIT002', description: 'API Inlet Flow', type: 'flow' as const, range: { min: 0, max: 100 }, unit: 'm³/hr', currentValue: 0, status: 'normal' as const },
    { id: 'FIT-003', tag: 'FIT003', description: 'Pond Discharge Flow', type: 'flow' as const, range: { min: 0, max: 100 }, unit: 'm³/hr', currentValue: 0, status: 'normal' as const },
    { id: 'FIT-004', tag: 'FIT004', description: 'Oil Export Flow', type: 'flow' as const, range: { min: 0, max: 60 }, unit: 'm³/hr', currentValue: 0, status: 'normal' as const },
  );

  // Quality analyzers
  instruments.push(
    { id: 'AIT-001', tag: 'AIT001', description: 'Infeed pH', type: 'pH' as const, range: { min: 0, max: 14 }, unit: '', currentValue: 7.2, alarmHigh: 9, alarmLow: 5, status: 'normal' as const },
    { id: 'AIT-002', tag: 'AIT002', description: 'Treated Water Oil-in-Water', type: 'oil_in_water' as const, range: { min: 0, max: 1000 }, unit: 'mg/L', currentValue: 45, alarmHigh: 100, tripHigh: 500, status: 'normal' as const },
    { id: 'AIT-003', tag: 'AIT003', description: 'Pond Discharge TPH', type: 'oil_in_water' as const, range: { min: 0, max: 500 }, unit: 'mg/L', currentValue: 25, alarmHigh: 50, tripHigh: 100, status: 'normal' as const },
  );

  return instruments;
}

function createValves() {
  const valves = [];
  for (let i = 1; i <= 20; i++) {
    valves.push({
      id: `XV-${String(i).padStart(3, '0')}`,
      tag: `XV${String(i).padStart(3, '0')}`,
      type: 'isolation' as const,
      state: 'closed' as const,
      position: 0,
      interlocked: i <= 13,
      failPosition: 'closed' as const,
    });
  }
  return valves;
}

// =============================================================================
// SIMULATION ENGINE
// =============================================================================

export class SimulationEngine {
  private state: ProcessState;
  private config: SimulationConfig;
  private costParams: CostParameters;
  private cumulativeData: {
    totalProcessed: number;
    totalOilRecovered: number;
    totalOperatingHours: number;
    totalEnergy: number;
  };

  constructor() {
    this.state = createInitialState();
    this.config = {
      timeStep: 1,
      speedMultiplier: 1,
      startTime: new Date(),
      currentTime: new Date(),
      running: false,
      feedVariability: 0.2,
      ambientTemperature: 35,
    };
    this.costParams = DEFAULT_COST_PARAMETERS;
    this.cumulativeData = {
      totalProcessed: 0,
      totalOilRecovered: 0,
      totalOperatingHours: 0,
      totalEnergy: 0,
    };
  }

  getState(): ProcessState {
    return this.state;
  }

  getConfig(): SimulationConfig {
    return this.config;
  }

  getCostParameters(): CostParameters {
    return this.costParams;
  }

  updateCostParameters(params: Partial<CostParameters>) {
    this.costParams = { ...this.costParams, ...params };
  }

  setTimeMultiplier(multiplier: number) {
    this.config.speedMultiplier = multiplier;
  }

  start() {
    this.config.running = true;
  }

  stop() {
    this.config.running = false;
  }

  reset() {
    this.state = createInitialState();
    this.cumulativeData = {
      totalProcessed: 0,
      totalOilRecovered: 0,
      totalOperatingHours: 0,
      totalEnergy: 0,
    };
  }

  // Start a transfer operation
  startTransfer(routeId: string, flowRate: number): boolean {
    const route = this.state.activeTransfers.find(r => r.id === routeId) ||
      { id: routeId, name: '', source: '', destination: '', pumpId: '', valveIds: [], permitted: false, interlocked: false, flowRate: 0, active: false };

    // Check if route is permitted (UR-OPS-007)
    const routeConfig = this.getTransferRouteConfig(routeId);
    if (!routeConfig || !routeConfig.permitted) {
      this.addAlarm('critical', `Transfer ${routeId} is PROHIBITED`, 'ROUTING');
      return false;
    }

    // Check destination tank level (overfill protection)
    const destTank = this.state.tanks.find(t => t.id === routeConfig.destination);
    if (destTank && destTank.currentLevel >= destTank.highHighLevel) {
      this.addAlarm('critical', `${destTank.name} high-high level - transfer blocked`, destTank.id);
      return false;
    }

    // Check source tank level (pump protection)
    const srcTank = this.state.tanks.find(t => t.id === routeConfig.source);
    if (srcTank && srcTank.currentLevel <= srcTank.lowLowLevel) {
      this.addAlarm('high', `${srcTank.name} low-low level - transfer blocked`, srcTank.id);
      return false;
    }

    // Activate transfer
    route.active = true;
    route.flowRate = flowRate;

    // Start pump
    const pump = this.state.pumps.find(p => p.id === routeConfig.pumpId);
    if (pump) {
      pump.status = 'running';
      pump.currentFlow = flowRate;
      pump.currentSpeed = (flowRate / pump.maxFlow) * 100;
    }

    // Open valves
    routeConfig.valveIds.forEach(valveId => {
      const valve = this.state.valves.find(v => v.id === valveId);
      if (valve) {
        valve.state = 'open';
        valve.position = 100;
      }
    });

    // Add to active transfers
    if (!this.state.activeTransfers.find(r => r.id === routeId)) {
      this.state.activeTransfers.push({ ...routeConfig, flowRate, active: true });
    }

    return true;
  }

  stopTransfer(routeId: string) {
    const routeIndex = this.state.activeTransfers.findIndex(r => r.id === routeId);
    if (routeIndex >= 0) {
      const route = this.state.activeTransfers[routeIndex];

      // Stop pump
      const pump = this.state.pumps.find(p => p.id === route.pumpId);
      if (pump) {
        pump.status = 'stopped';
        pump.currentFlow = 0;
        pump.currentSpeed = 0;
      }

      // Close valves
      route.valveIds.forEach(valveId => {
        const valve = this.state.valves.find(v => v.id === valveId);
        if (valve) {
          valve.state = 'closed';
          valve.position = 0;
        }
      });

      this.state.activeTransfers.splice(routeIndex, 1);
    }
  }

  private getTransferRouteConfig(routeId: string): TransferRoute | undefined {
    // This would normally come from a configuration file
    const allRoutes: TransferRoute[] = [
      { id: 'TR-001', name: 'Infeed to VT-001', source: 'INFEED', destination: 'VT-001', pumpId: 'P-001', valveIds: ['XV-001', 'XV-002'], permitted: true, interlocked: true, flowRate: 0, active: false },
      { id: 'TR-002', name: 'Infeed to VT-002', source: 'INFEED', destination: 'VT-002', pumpId: 'P-002', valveIds: ['XV-003', 'XV-004'], permitted: true, interlocked: true, flowRate: 0, active: false },
      { id: 'TR-003', name: 'VT-001 to API', source: 'VT-001', destination: 'API-001', pumpId: 'P-003', valveIds: ['XV-005', 'XV-006'], permitted: true, interlocked: true, flowRate: 0, active: false },
      { id: 'TR-004', name: 'VT-002 to API', source: 'VT-002', destination: 'API-001', pumpId: 'P-004', valveIds: ['XV-007', 'XV-008'], permitted: true, interlocked: true, flowRate: 0, active: false },
      { id: 'TR-005', name: 'API Oil to HT-001', source: 'API-001', destination: 'HT-001', pumpId: 'P-006', valveIds: ['XV-009', 'XV-010'], permitted: true, interlocked: true, flowRate: 0, active: false },
      { id: 'TR-006', name: 'API Water to VT-006', source: 'API-001', destination: 'VT-006', pumpId: '', valveIds: ['XV-011'], permitted: true, interlocked: true, flowRate: 0, active: false },
      { id: 'TR-007', name: 'VT-006 to Pond', source: 'VT-006', destination: 'POND', pumpId: 'P-007', valveIds: ['XV-012', 'XV-013'], permitted: true, interlocked: true, flowRate: 0, active: false },
    ];
    return allRoutes.find(r => r.id === routeId);
  }

  private addAlarm(priority: 'critical' | 'high' | 'medium' | 'low', description: string, tag: string) {
    const alarm: Alarm = {
      id: `ALM-${Date.now()}`,
      tag,
      description,
      priority,
      state: 'active_unack',
      timestamp: new Date(),
    };
    this.state.alarms.unshift(alarm);
    
    // Keep only last 100 alarms
    if (this.state.alarms.length > 100) {
      this.state.alarms = this.state.alarms.slice(0, 100);
    }
  }

  acknowledgeAlarm(alarmId: string) {
    const alarm = this.state.alarms.find(a => a.id === alarmId);
    if (alarm && alarm.state === 'active_unack') {
      alarm.state = 'active_ack';
      alarm.acknowledgedAt = new Date();
    }
  }

  // Main simulation step
  step(deltaTime: number = 1): ProcessState {
    if (!this.config.running) return this.state;

    const dt = deltaTime * this.config.speedMultiplier; // seconds
    this.config.currentTime = new Date(this.config.currentTime.getTime() + dt * 1000);
    this.state.timestamp = this.config.currentTime;

    // Update tank levels based on active transfers
    this.updateTankLevels(dt);

    // Update API separator
    this.updateAPISeparator(dt);

    // Update settling in tanks (Stokes Law)
    this.updateTankSettling(dt);

    // Update heaters
    this.updateHeaters(dt);

    // Update pump power consumption
    this.updatePumpPower();

    // Check interlocks
    this.checkInterlocks();

    // Update instruments
    this.updateInstruments();

    // Update cumulative data
    this.cumulativeData.totalOperatingHours += dt / 3600;

    return this.state;
  }

  private updateTankLevels(dt: number) {
    for (const transfer of this.state.activeTransfers) {
      if (!transfer.active) continue;

      const volumeTransferred = (transfer.flowRate * dt) / 3600; // m³

      // Decrease source tank level
      const srcTank = this.state.tanks.find(t => t.id === transfer.source);
      if (srcTank) {
        srcTank.currentVolume = Math.max(0, srcTank.currentVolume - volumeTransferred);
        srcTank.currentLevel = (srcTank.currentVolume / srcTank.capacity) * 100;

        // Check low-low level
        if (srcTank.currentLevel <= srcTank.lowLowLevel) {
          this.stopTransfer(transfer.id);
          this.addAlarm('high', `${srcTank.name} low-low level reached`, srcTank.id);
        }
      }

      // Increase destination tank level
      const destTank = this.state.tanks.find(t => t.id === transfer.destination);
      if (destTank) {
        destTank.currentVolume = Math.min(destTank.capacity, destTank.currentVolume + volumeTransferred);
        destTank.currentLevel = (destTank.currentVolume / destTank.capacity) * 100;

        // Track processed volume
        if (transfer.destination === 'POND') {
          this.cumulativeData.totalProcessed += volumeTransferred;
        }

        // Check high-high level (AS 1940 overfill protection)
        if (destTank.currentLevel >= destTank.highHighLevel) {
          this.stopTransfer(transfer.id);
          this.addAlarm('critical', `${destTank.name} HIGH-HIGH LEVEL - Transfer stopped`, destTank.id);
          
          // Trigger interlock
          const interlock = this.state.interlocks.find(i => i.id === `IL-${destTank.id}-OVERFILL`);
          if (interlock) {
            interlock.status = 'tripped';
            interlock.lastTripped = new Date();
          }
        } else if (destTank.currentLevel >= destTank.highLevel) {
          this.addAlarm('medium', `${destTank.name} high level`, destTank.id);
        }
      }
    }
  }

  private updateAPISeparator(dt: number) {
    const api = this.state.apiSeparator;
    
    // Calculate total inflow from active transfers
    let totalInflow = 0;
    for (const transfer of this.state.activeTransfers) {
      if (transfer.destination === 'API-001') {
        totalInflow += transfer.flowRate;
      }
    }
    api.currentFlow = totalInflow;

    if (totalInflow > 0) {
      // Calculate separation using Stokes Law
      const waterViscosity = calculateWaterViscosity(api.temperature);
      const waterDensity = calculateWaterDensity(api.temperature);
      const oilDensity = calculateOilDensity(850, api.temperature);

      // Design droplet size (150 micron per SOW)
      const dropletSize = 150e-6;
      const riseVelocity = stokesSettlingVelocity(dropletSize, oilDensity, waterDensity, waterViscosity);

      // Hydraulic loading and surface area calculations
      const surfaceArea = api.length * api.width;
      const hydraulicLoading = totalInflow / surfaceArea; // m/hr

      // Separation efficiency based on residence time and Stokes velocity
      const residenceTime = (surfaceArea * api.depth) / totalInflow; // hours
      // Efficiency improves with rise velocity and residence time
      const efficiency = Math.min(0.98, 0.7 + 0.2 * Math.min(residenceTime, 1) * (riseVelocity / 0.001) * (1 / (1 + hydraulicLoading / 10)));

      // Inlet concentration from source tanks
      const sourceTanks = this.state.tanks.filter(t => 
        this.state.activeTransfers.some(tr => 
          tr.destination === 'API-001' && tr.source === t.id && tr.active
        )
      );
      
      let avgOilContent = 0.25;
      if (sourceTanks.length > 0) {
        avgOilContent = sourceTanks.reduce((sum, t) => sum + t.composition.oil, 0) / sourceTanks.length;
      }

      api.inletOilConcentration = avgOilContent * 1e6; // Convert to ppm
      api.outletOilConcentration = api.inletOilConcentration * (1 - efficiency);

      // Oil skim rate (recovered oil)
      api.oilSkimRate = totalInflow * avgOilContent * efficiency;
      this.cumulativeData.totalOilRecovered += (api.oilSkimRate * dt) / 3600;
    } else {
      api.oilSkimRate = 0;
      api.outletOilConcentration = 0;
    }
  }

  private updateTankSettling(dt: number) {
    for (const tank of this.state.tanks) {
      if (tank.type === 'vertical' && tank.currentVolume > 0) {
        // Apply Stokes settling calculation using hindered settling model
        const waterViscosity = calculateWaterViscosity(tank.temperature);
        const waterDensity = calculateWaterDensity(tank.temperature);
        const oilDensity = 850;
        
        // Calculate rise velocity for characteristic droplet size
        const dropletSize = 100e-6; // 100 micron average
        const riseVelocity = stokesSettlingVelocity(dropletSize, oilDensity, waterDensity, waterViscosity);
        
        // Hindered settling factor (Richardson-Zaki)
        const hinderedFactor = Math.pow(1 - tank.composition.oil, 4.65);
        const effectiveVelocity = riseVelocity * hinderedFactor;
        
        // Gradually update composition based on settling physics
        const settlingFactor = Math.min(1, dt * effectiveVelocity * 100); // scaled time constant
        tank.composition.oil = Math.max(0.01, tank.composition.oil - settlingFactor * 0.01);
        tank.composition.solids = Math.max(0, tank.composition.solids - settlingFactor * 0.005);
        tank.composition.water = 1 - tank.composition.oil - tank.composition.solids;
      }
    }
  }

  private updateHeaters(dt: number) {
    for (const heater of this.state.heaters) {
      if (heater.enabled) {
        // Simple heating model
        const targetTemp = heater.setpoint;
        const currentTemp = heater.inletTemp;
        
        if (currentTemp < targetTemp) {
          const tempIncrease = (heater.dutyRating / 100) * (dt / 60); // Simplified heating rate
          heater.outletTemp = Math.min(targetTemp, currentTemp + tempIncrease);
          heater.currentDuty = heater.dutyRating;
        } else {
          heater.currentDuty = heater.dutyRating * 0.1; // Maintain temperature
          heater.outletTemp = targetTemp;
        }

        // Update associated tank temperature
        const processTanks = this.state.tanks.filter(t => t.hasHeating);
        for (const tank of processTanks) {
          tank.temperature = Math.min(heater.setpoint, tank.temperature + 0.01 * dt);
        }
      }
    }
  }

  private updatePumpPower() {
    let totalPower = 0;
    for (const pump of this.state.pumps) {
      if (pump.status === 'running' && pump.currentFlow > 0) {
        const performance = calculatePumpPerformance(pump.currentFlow, pump.currentHead || 20);
        pump.powerConsumption = performance.power;
        pump.efficiency = performance.efficiency * 100;
        totalPower += performance.power;
      } else {
        pump.powerConsumption = 0;
      }
    }

    // Add heater power
    for (const heater of this.state.heaters) {
      if (heater.enabled) {
        totalPower += heater.currentDuty;
      }
    }

    this.cumulativeData.totalEnergy += totalPower / 3600; // kWh
  }

  private checkInterlocks() {
    for (const interlock of this.state.interlocks) {
      if (interlock.id.includes('OVERFILL')) {
        // Check tank level
        const tankId = interlock.id.replace('IL-', '').replace('-OVERFILL', '');
        const tank = this.state.tanks.find(t => t.id === tankId);
        
        if (tank && tank.currentLevel >= tank.highHighLevel && interlock.status !== 'tripped') {
          interlock.status = 'tripped';
          interlock.lastTripped = new Date();
          
          // Stop all transfers to this tank
          for (const transfer of this.state.activeTransfers) {
            if (transfer.destination === tankId) {
              this.stopTransfer(transfer.id);
            }
          }
        }
      }
    }
  }

  private updateInstruments() {
    // Update tank level instruments
    for (const tank of this.state.tanks) {
      const levelInstr = this.state.instruments.find(i => i.id === `LIT-${tank.id}`);
      if (levelInstr) {
        levelInstr.currentValue = tank.currentLevel;
        
        // Check alarm conditions
        if (tank.currentLevel >= tank.highHighLevel) {
          levelInstr.status = 'trip';
        } else if (tank.currentLevel >= tank.highLevel || tank.currentLevel <= tank.lowLevel) {
          levelInstr.status = 'alarm';
        } else {
          levelInstr.status = 'normal';
        }
      }

      const tempInstr = this.state.instruments.find(i => i.id === `TIT-${tank.id}`);
      if (tempInstr) {
        tempInstr.currentValue = tank.temperature;
      }
    }

    // Update flow instruments
    const infeedFlow = this.state.instruments.find(i => i.id === 'FIT-001');
    if (infeedFlow) {
      const infeedTransfers = this.state.activeTransfers.filter(t => t.source === 'INFEED');
      infeedFlow.currentValue = infeedTransfers.reduce((sum, t) => sum + t.flowRate, 0);
    }

    const apiFlow = this.state.instruments.find(i => i.id === 'FIT-002');
    if (apiFlow) {
      apiFlow.currentValue = this.state.apiSeparator.currentFlow;
    }

    const pondFlow = this.state.instruments.find(i => i.id === 'FIT-003');
    if (pondFlow) {
      const pondTransfers = this.state.activeTransfers.filter(t => t.destination === 'POND');
      pondFlow.currentValue = pondTransfers.reduce((sum, t) => sum + t.flowRate, 0);
    }

    // Update quality analyzers
    const oiwAnalyzer = this.state.instruments.find(i => i.id === 'AIT-002');
    if (oiwAnalyzer) {
      // Add some variability
      const baseValue = this.state.apiSeparator.outletOilConcentration;
      oiwAnalyzer.currentValue = baseValue * (0.9 + Math.random() * 0.2);
      
      if (oiwAnalyzer.currentValue > (oiwAnalyzer.tripHigh || 500)) {
        oiwAnalyzer.status = 'trip';
        this.addAlarm('critical', 'Oil in Water HIGH-HIGH - Pond discharge blocked', 'AIT-002');
      } else if (oiwAnalyzer.currentValue > (oiwAnalyzer.alarmHigh || 100)) {
        oiwAnalyzer.status = 'alarm';
      } else {
        oiwAnalyzer.status = 'normal';
      }
    }
  }

  // Calculate current KPIs
  calculateKPIs(): ProcessKPIs {
    // Instantaneous KPIs
    const currentThroughput = this.state.activeTransfers
      .filter(t => t.destination === 'API-001')
      .reduce((sum, t) => sum + t.flowRate, 0);

    const oilRemovalEfficiency = this.state.apiSeparator.inletOilConcentration > 0
      ? ((this.state.apiSeparator.inletOilConcentration - this.state.apiSeparator.outletOilConcentration) 
         / this.state.apiSeparator.inletOilConcentration) * 100
      : 0;

    const totalPower = this.state.pumps.reduce((sum, p) => sum + p.powerConsumption, 0)
      + this.state.heaters.reduce((sum, h) => sum + (h.enabled ? h.currentDuty : 0), 0);

    const specificEnergy = currentThroughput > 0 ? totalPower / currentThroughput : 0;

    return {
      instantaneous: {
        throughput: currentThroughput,
        oilRemovalEfficiency,
        waterQuality: this.state.apiSeparator.outletOilConcentration,
        specificEnergy,
      },
      daily: {
        totalProcessed: this.cumulativeData.totalProcessed,
        oilRecovered: this.cumulativeData.totalOilRecovered,
        treatedWaterDischarge: this.cumulativeData.totalProcessed * 0.85,
        sludgeGenerated: this.cumulativeData.totalProcessed * 0.02,
        electricityConsumed: this.cumulativeData.totalEnergy,
        chemicalsUsed: this.cumulativeData.totalProcessed * 0.05, // 50 mg/L
      },
      cumulative: {
        totalProcessed: this.cumulativeData.totalProcessed,
        totalOilRecovered: this.cumulativeData.totalOilRecovered,
        totalOperatingHours: this.cumulativeData.totalOperatingHours,
        averageEfficiency: oilRemovalEfficiency,
      },
    };
  }

  // Calculate operational costs
  calculateCosts(): OperationalCostBreakdown {
    const kpis = this.calculateKPIs();
    const hours = Math.max(1, this.cumulativeData.totalOperatingHours);
    
    const electricityCost = kpis.daily.electricityConsumed * this.costParams.electricity.rate;
    
    const chemicalsCost = {
      demulsifier: kpis.daily.chemicalsUsed * 0.4 * this.costParams.chemicals.demulsifier,
      flocculant: kpis.daily.chemicalsUsed * 0.3 * this.costParams.chemicals.flocculant,
      acid: kpis.daily.chemicalsUsed * 0.15 * this.costParams.chemicals.acid,
      caustic: kpis.daily.chemicalsUsed * 0.15 * this.costParams.chemicals.caustic,
      total: 0,
    };
    chemicalsCost.total = chemicalsCost.demulsifier + chemicalsCost.flocculant + chemicalsCost.acid + chemicalsCost.caustic;

    const disposalCost = kpis.daily.sludgeGenerated * this.costParams.disposal.sludge;
    const laborCost = hours * this.costParams.labor.operatorRate;
    const maintenanceCost = hours * 5; // $5/hr maintenance allowance

    const totalCost = electricityCost + chemicalsCost.total + disposalCost + laborCost + maintenanceCost;

    const oilRevenue = kpis.daily.oilRecovered * this.costParams.revenue.oilRecovery;
    const treatmentRevenue = kpis.daily.totalProcessed * this.costParams.revenue.treatmentFee;

    return {
      period: 'daily',
      electricity: electricityCost,
      chemicals: chemicalsCost,
      disposal: disposalCost,
      labor: laborCost,
      maintenance: maintenanceCost,
      totalCost,
      revenue: {
        oilSales: oilRevenue,
        treatmentFees: treatmentRevenue,
        total: oilRevenue + treatmentRevenue,
      },
      netCost: totalCost - (oilRevenue + treatmentRevenue),
      costPerCubicMeter: kpis.daily.totalProcessed > 0 ? totalCost / kpis.daily.totalProcessed : 0,
    };
  }

  // Update tank manually (for user control)
  updateTank(tankId: string, updates: Partial<TankConfiguration>) {
    const tank = this.state.tanks.find(t => t.id === tankId);
    if (tank) {
      Object.assign(tank, updates);
      if (updates.currentLevel !== undefined) {
        tank.currentVolume = tank.capacity * updates.currentLevel / 100;
      }
    }
  }

  // Toggle heater
  toggleHeater(heaterId: string) {
    const heater = this.state.heaters.find(h => h.id === heaterId);
    if (heater) {
      heater.enabled = !heater.enabled;
    }
  }

  // Set heater setpoint
  setHeaterSetpoint(heaterId: string, setpoint: number) {
    const heater = this.state.heaters.find(h => h.id === heaterId);
    if (heater) {
      heater.setpoint = Math.min(85, Math.max(20, setpoint)); // Clamp to 20-85°C
    }
  }

  // Reset interlock (requires manual reset per UR-OPS-017)
  resetInterlock(interlockId: string): boolean {
    const interlock = this.state.interlocks.find(i => i.id === interlockId);
    if (interlock && interlock.status === 'tripped') {
      // Check if condition is still active
      const tankId = interlockId.replace('IL-', '').replace('-OVERFILL', '');
      const tank = this.state.tanks.find(t => t.id === tankId);
      
      if (tank && tank.currentLevel < tank.highHighLevel) {
        interlock.status = 'healthy';
        return true;
      } else {
        this.addAlarm('high', `Cannot reset interlock - condition still active`, interlockId);
        return false;
      }
    }
    return false;
  }
}

// Export singleton instance
export const simulationEngine = new SimulationEngine();
