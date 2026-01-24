/**
 * KARRATHA WTP SIMULATOR - TYPE DEFINITIONS
 * 
 * Comprehensive type definitions for the water treatment plant simulation
 * aligned with User Requirements Register and SOW specifications.
 */

// =============================================================================
// TANK TYPES & CONFIGURATIONS
// =============================================================================

export type TankType = 'vertical' | 'horizontal';
export type TankService = 'oil_storage' | 'water_processing' | 'sludge_holding' | 'feed_buffer' | 'export';
export type StreamType = 'oil_dominant' | 'water_dominant' | 'sludge_bearing' | 'mixed';

export interface TankConfiguration {
  id: string;
  name: string;
  type: TankType;
  service: TankService;
  capacity: number;           // m³
  diameter: number;           // m
  height: number;             // m (for vertical) or length (for horizontal)
  currentLevel: number;       // % (0-100)
  currentVolume: number;      // m³
  temperature: number;        // °C
  composition: {
    water: number;            // fraction (0-1)
    oil: number;              // fraction (0-1)
    solids: number;           // fraction (0-1)
  };
  highHighLevel: number;      // % - overfill trip setpoint (AS 1940)
  highLevel: number;          // % - alarm setpoint
  lowLevel: number;           // % - alarm setpoint
  lowLowLevel: number;        // % - pump protection setpoint
  hasHeating: boolean;
  heatingSetpoint?: number;   // °C
  hasAgitator: boolean;
  agitatorSpeed?: number;     // RPM
}

// =============================================================================
// PUMP TYPES & CONFIGURATIONS
// =============================================================================

export type PumpType = 'centrifugal' | 'positive_displacement' | 'progressive_cavity';
export type PumpStatus = 'running' | 'stopped' | 'fault' | 'maintenance';

export interface PumpConfiguration {
  id: string;
  name: string;
  type: PumpType;
  maxFlow: number;            // m³/hr
  maxHead: number;            // m
  currentFlow: number;        // m³/hr
  currentHead: number;        // m
  status: PumpStatus;
  vfdEquipped: boolean;
  currentSpeed: number;       // % (0-100)
  powerConsumption: number;   // kW
  efficiency: number;         // % (0-100)
  source: string;             // Tank or equipment ID
  destination: string;        // Tank or equipment ID
}

// =============================================================================
// PROCESS EQUIPMENT
// =============================================================================

export interface APISeparator {
  id: string;
  name: string;
  length: number;             // m
  width: number;              // m
  depth: number;              // m
  designFlow: number;         // m³/hr
  currentFlow: number;        // m³/hr
  oilSkimRate: number;        // m³/hr
  sludgeDrawRate: number;     // m³/hr
  inletOilConcentration: number;  // ppm
  outletOilConcentration: number; // ppm
  temperature: number;        // °C
}

export interface Heater {
  id: string;
  name: string;
  type: 'electric' | 'steam' | 'thermal_fluid';
  dutyRating: number;         // kW
  currentDuty: number;        // kW
  inletTemp: number;          // °C
  outletTemp: number;         // °C
  setpoint: number;           // °C
  enabled: boolean;
}

export interface Filter {
  id: string;
  name: string;
  type: 'coarse_screen' | 'basket' | 'auto_backwash' | 'gac';
  meshSize: number;           // microns
  designFlow: number;         // m³/hr
  currentFlow: number;        // m³/hr
  differentialPressure: number; // kPa
  cleanDP: number;            // kPa
  dirtyDP: number;            // kPa (trigger for cleaning)
  status: 'operating' | 'backwashing' | 'offline';
}

export interface ChemicalDosing {
  id: string;
  name: string;
  chemicalType: 'demulsifier' | 'flocculant' | 'acid' | 'caustic';
  concentration: number;      // % active
  doseRate: number;           // mg/L or L/hr
  tankLevel: number;          // %
  pumpRunning: boolean;
}

// =============================================================================
// INSTRUMENTATION
// =============================================================================

export interface Instrument {
  id: string;
  tag: string;
  description: string;
  type: 'level' | 'flow' | 'pressure' | 'temperature' | 'pH' | 'conductivity' | 'turbidity' | 'oil_in_water';
  range: { min: number; max: number };
  unit: string;
  currentValue: number;
  alarmHigh?: number;
  alarmLow?: number;
  tripHigh?: number;
  tripLow?: number;
  status: 'normal' | 'alarm' | 'trip' | 'fault';
}

// =============================================================================
// TRANSFER & ROUTING
// =============================================================================

export interface TransferRoute {
  id: string;
  name: string;
  source: string;             // Equipment ID
  destination: string;        // Equipment ID
  pumpId: string;
  valveIds: string[];
  permitted: boolean;         // Based on UR-OPS-007, UR-OPS-008
  interlocked: boolean;
  flowRate: number;           // m³/hr (when active)
  active: boolean;
}

export type ValveState = 'open' | 'closed' | 'throttled' | 'failed_open' | 'failed_closed';

export interface Valve {
  id: string;
  tag: string;
  type: 'isolation' | 'control' | 'check' | 'relief';
  state: ValveState;
  position: number;           // % (0-100, for control valves)
  interlocked: boolean;
  failPosition: 'open' | 'closed';
}

// =============================================================================
// ALARMS & INTERLOCKS
// =============================================================================

export type AlarmPriority = 'critical' | 'high' | 'medium' | 'low';
export type AlarmState = 'active_unack' | 'active_ack' | 'cleared_unack' | 'normal';

export interface Alarm {
  id: string;
  tag: string;
  description: string;
  priority: AlarmPriority;
  state: AlarmState;
  timestamp: Date;
  value?: number;
  setpoint?: number;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface Interlock {
  id: string;
  name: string;
  description: string;
  condition: string;          // Logic expression
  action: string;             // What happens when triggered
  status: 'healthy' | 'tripped' | 'bypassed';
  resetRequired: boolean;     // Per UR-OPS-017
  lastTripped?: Date;
}

// =============================================================================
// PROCESS STATE & SIMULATION
// =============================================================================

export type OperatingMode = 'normal' | 'startup' | 'shutdown' | 'upset' | 'maintenance';

export interface ProcessState {
  mode: OperatingMode;
  timestamp: Date;
  tanks: TankConfiguration[];
  pumps: PumpConfiguration[];
  apiSeparator: APISeparator;
  heaters: Heater[];
  filters: Filter[];
  chemicalDosing: ChemicalDosing[];
  instruments: Instrument[];
  valves: Valve[];
  activeTransfers: TransferRoute[];
  alarms: Alarm[];
  interlocks: Interlock[];
}

export interface SimulationConfig {
  timeStep: number;           // seconds
  speedMultiplier: number;    // 1x, 2x, 5x, 10x real-time
  startTime: Date;
  currentTime: Date;
  running: boolean;
  feedVariability: number;    // 0-1 (how much feed composition varies)
  ambientTemperature: number; // °C
}

// =============================================================================
// OPERATIONAL DATA & KPIs
// =============================================================================

export interface DailyOperations {
  date: Date;
  totalInfeed: number;        // kL
  totalTreatedWater: number;  // kL (to ponds)
  totalOilRecovered: number;  // kL
  totalSludge: number;        // m³
  operatingHours: number;
  averageFlowRate: number;    // m³/hr
  peakFlowRate: number;       // m³/hr
  treatmentEfficiency: number; // %
  complianceStatus: boolean;
}

export interface ProcessKPIs {
  instantaneous: {
    throughput: number;       // m³/hr
    oilRemovalEfficiency: number; // %
    waterQuality: number;     // mg/L oil in water
    specificEnergy: number;   // kWh/m³
  };
  daily: {
    totalProcessed: number;   // m³
    oilRecovered: number;     // m³
    treatedWaterDischarge: number; // m³
    sludgeGenerated: number;  // m³
    electricityConsumed: number; // kWh
    chemicalsUsed: number;    // kg
  };
  cumulative: {
    totalProcessed: number;   // m³
    totalOilRecovered: number; // m³
    totalOperatingHours: number;
    averageEfficiency: number; // %
  };
}

// =============================================================================
// COST TRACKING
// =============================================================================

export interface CostParameters {
  electricity: {
    rate: number;             // $/kWh
    peakRate: number;         // $/kWh
    peakHours: { start: number; end: number };
  };
  chemicals: {
    demulsifier: number;      // $/L
    flocculant: number;       // $/kg
    acid: number;             // $/L
    caustic: number;          // $/L
  };
  disposal: {
    sludge: number;           // $/m³
    oilyWaste: number;        // $/m³
  };
  labor: {
    operatorRate: number;     // $/hr
    maintenanceRate: number;  // $/hr
    operatorsPerShift: number;
  };
  revenue: {
    oilRecovery: number;      // $/m³ (recovered oil value)
    treatmentFee: number;     // $/m³ (waste acceptance fee)
  };
}

export interface OperationalCostBreakdown {
  period: 'hourly' | 'daily' | 'monthly';
  electricity: number;
  chemicals: {
    demulsifier: number;
    flocculant: number;
    acid: number;
    caustic: number;
    total: number;
  };
  disposal: number;
  labor: number;
  maintenance: number;
  totalCost: number;
  revenue: {
    oilSales: number;
    treatmentFees: number;
    total: number;
  };
  netCost: number;
  costPerCubicMeter: number;
}

// =============================================================================
// USER INTERFACE STATE
// =============================================================================

export type ViewMode = 'overview' | 'process' | 'tanks' | 'routing' | 'alarms' | 'trends' | 'costs' | 'settings';

export interface UIState {
  currentView: ViewMode;
  selectedEquipment: string | null;
  showAlarmBanner: boolean;
  trendVariables: string[];
  trendTimeRange: number;     // hours
  darkMode: boolean;
}

// =============================================================================
// HISTORICAL DATA
// =============================================================================

export interface TrendDataPoint {
  timestamp: Date;
  values: Record<string, number>;
}

export interface HistoricalData {
  processVariables: TrendDataPoint[];
  alarmHistory: Alarm[];
  transferHistory: {
    route: TransferRoute;
    startTime: Date;
    endTime: Date;
    volumeTransferred: number;
  }[];
  dailyOperations: DailyOperations[];
}

// =============================================================================
// COMPLIANCE & REPORTING
// =============================================================================

export interface LicenceRequirement {
  id: string;
  description: string;
  parameter: string;
  limit: number;
  unit: string;
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly';
  currentValue: number;
  status: 'compliant' | 'warning' | 'non_compliant';
}

export interface ComplianceReport {
  period: { start: Date; end: Date };
  requirements: LicenceRequirement[];
  exceedances: {
    requirement: LicenceRequirement;
    timestamp: Date;
    value: number;
    duration: number;         // minutes
  }[];
  overallStatus: 'compliant' | 'minor_exceedance' | 'major_exceedance';
}
