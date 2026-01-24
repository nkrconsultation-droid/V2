/**
 * CENTRIFUGE PROCESS CONTROL - TYPE DEFINITIONS
 * ==============================================
 * TypeScript interfaces for the centrifuge simulation
 * Provides type safety and IntelliSense support for debugging
 */

// ═══════════════════════════════════════════════════════════════════════════
// EQUIPMENT TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface EquipmentConfig {
  heaterCapacity: number;      // kW
  heaterEfficiency: number;    // %
  heaterMaxTemp: number;       // °C
  heaterTimeConstant: number;  // seconds
  centrifugeCapacity: number;  // m³/h
  maxRPM: number;
  minRPM: number;
  maxFlow: number;             // m³/h
  bowlDiameter: number;        // mm
  bowlLength: number;          // mm
  motorEfficiency: number;     // %
  vfdEfficiency: number;       // %
  bearingCondition: number;    // % (100 = new)
}

export interface FeedProperties {
  // Phase fractions (must sum to 1.0)
  waterFraction: number;
  oilFraction: number;
  solidsFraction: number;
  // Densities (kg/m³)
  waterDensity: number;
  oilDensity: number;
  solidsDensity: number;
  // Particle sizes (microns)
  oilDropletD10: number;
  oilDropletD50: number;
  oilDropletD90: number;
  solidsD10: number;
  solidsD50: number;
  solidsD90: number;
  // Rheology
  oilViscosity: number;        // mPa·s
  viscosityTempCoeff: number;
  yieldStress: number;         // Pa
  flowBehaviorIndex: number;
  // Emulsion
  emulsionStability: number;   // 0-1
  interfacialTension: number;  // mN/m
  // Chemical dosing
  demulsifierDose: number;     // ppm
  demulsifierEff: number;      // 0-1
  flocculantDose: number;      // ppm
  flocculantEff: number;       // 0-1
  acidDose: number;            // ppm
  // Water quality
  salinity: number;            // mg/L
  dissolvedGas: number;        // %
  // Settling parameters
  maxPackingFraction: number;
  hinderedSettlingExp: number;
  // Shape factors
  oilDropletSphericity: number;
  solidsSphericity: number;
}

export interface Disturbances {
  compVar: number;             // Composition variance
  tempVar: number;             // Temperature variance
  flowVar: number;             // Flow variance
  ambientTemp: number;         // °C
  slugEnabled: boolean;
  slugMag: number;
  slugDur: number;             // seconds
  slugRemain: number;          // seconds remaining
  pumpCavitation: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// TANK TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FeedTank {
  id: string;
  level: number;               // %
  water: number;               // %
  oil: number;                 // %
  sediment: number;            // %
  temp: number;                // °C
  status: 'ready' | 'settling' | 'empty' | 'filling';
}

export interface OilTank {
  id: string;
  level: number;               // %
  temp: number;                // °C
  status: 'receiving' | 'ready' | 'empty' | 'transferring';
}

export interface EvaporationPond {
  capacity: number;            // m³
  volume: number;              // m³
  level: number;               // %
  surfaceArea: number;         // m²
  depth: number;               // m
  pH: number;
  turbidity: number;           // NTU
  oilInWater: number;          // ppm
  tds: number;                 // mg/L
  temperature: number;         // °C
  evaporationRate: number;     // mm/day
  dailyEvaporation: number;    // m³/day
  totalEvaporated: number;     // m³
  inflow: number;              // m³/h
  totalInflow: number;         // m³
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTROL LOOP TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ControlLoop {
  tag: string;
  desc: string;
  unit: string;
  pv: number;                  // Process variable
  sp: number;                  // Setpoint
  op: number;                  // Output (0-100%)
  mode: 'AUTO' | 'MANUAL' | 'CASCADE';
  kp: number;                  // Proportional gain
  ki: number;                  // Integral gain
  kd: number;                  // Derivative gain
  int: number;                 // Integral accumulator
  lastErr: number;             // Last error (for derivative)
}

export interface ControlLoops {
  TIC: ControlLoop;            // Temperature
  FIC: ControlLoop;            // Flow
  SIC: ControlLoop;            // Speed
}

// ═══════════════════════════════════════════════════════════════════════════
// CHEMICAL DOSING TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type DosingMode = 'MANUAL' | 'RATIO' | 'FEEDBACK' | 'CASCADE' | 'ADAPTIVE';

export interface ChemicalDosing {
  enabled: boolean;
  mode: DosingMode;
  sp: number;                  // Setpoint
  pv: number;                  // Process variable
  ratio: number;
  op: number;                  // Output %
  pumpRate: number;            // L/h
  inventory: number;           // L
  totalUsed: number;           // L
  kp: number;
  ki: number;
  kd: number;
  int: number;
  lastErr: number;
  effectiveness: number;       // 0-1
  [key: string]: unknown;      // Additional properties per chemical
}

export interface ChemicalDosingState {
  demulsifier: ChemicalDosing;
  flocculant: ChemicalDosing;
  coagulant: ChemicalDosing;
  acid: ChemicalDosing;
  caustic: ChemicalDosing;
  scaleInhibitor: ChemicalDosing;
  antifoam: ChemicalDosing;
}

export interface ChemicalState {
  zetaPotential: number;       // mV
  flocDiameter: number;        // microns
  emulsionBreaking: number;    // 0-1
  foamHeight: number;          // m
  scalingRisk: number;         // 0-1
  mixingEfficiency: number;    // 0-1
  residenceTime: number;       // seconds
  reactionProgress: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════════
// POLISHING FILTER TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type FilterStatus = 'FILTERING' | 'BACKWASH' | 'STANDBY' | 'OFFLINE';

export interface PolishingFilter {
  enabled: boolean;
  status: FilterStatus;
  inletFlow: number;           // m³/h
  outletFlow: number;          // m³/h
  inletPressure: number;       // bar
  outletPressure: number;      // bar
  differentialPressure: number; // bar
  inletTurbidity: number;      // NTU
  outletTurbidity: number;     // NTU
  inletOiW: number;            // ppm
  outletOiW: number;           // ppm
  turbidityRemoval: number;    // %
  oilRemoval: number;          // %
  inletTRH: number;            // mg/L
  outletTRH: number;           // mg/L
  inletCOD: number;            // mg/L
  outletCOD: number;           // mg/L
  trhRemoval: number;          // %
  codRemoval: number;          // %
  bedLoading: number;          // kg
  bedCapacity: number;         // kg
  bedSaturation: number;       // %
  mediaCondition: number;      // %
  lastBackwash: number;        // simTime
  backwashCount: number;
  backwashRemaining: number;   // seconds
  autoBackwash: boolean;
  backwashTriggerDP: number;   // bar
  totalFiltered: number;       // m³
  totalBackwashWater: number;  // m³
  totalSolidsRemoved: number;  // kg
  totalOilRemoved: number;     // kg
  runHours: number;
  filterCycles: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESS STATE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ProcessState {
  feedTemp: number;            // °C
  heaterTemp: number;          // °C
  bowlTemp: number;            // °C
  feedFlow: number;            // m³/h
  waterOut: number;            // m³/h
  oilOut: number;              // m³/h
  solidsOut: number;           // m³/h
  bowlSpeed: number;           // RPM
  diffSpeed: number;           // RPM
  vibration: number;           // mm/s
  oilEff: number;              // %
  solidsEff: number;           // %
  waterQuality: number;        // ppm OiW
  heaterPower: number;         // kW
  motorPower: number;          // kW
  totalPower: number;          // kW
  gForce: number;              // g
  pH: number;
  turbidity: number;           // NTU
  oilMoisture: number;         // % water in oil
  sludgeMoisture: number;      // % water in sludge
}

// ═══════════════════════════════════════════════════════════════════════════
// ALARM TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type AlarmPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type AlarmState = 'UNACK_ACTIVE' | 'ACK_ACTIVE' | 'UNACK_RTN' | 'SHELVED' | 'NORMAL';

export interface ProcessAlarm {
  id: string;
  tag: string;
  description: string;
  priority: AlarmPriority;
  state: AlarmState;
  timestamp: Date;
  value?: number;
  limit?: number;
  unit?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOTALS AND COSTS
// ═══════════════════════════════════════════════════════════════════════════

export interface ProcessTotals {
  feed: number;                // m³
  water: number;               // m³
  oil: number;                 // m³
  solids: number;              // m³
  energy: number;              // kWh
  runTime: number;             // seconds
}

export interface CostParameters {
  elec: number;                // $/kWh
  sludgeDisposal: number;      // $/m³
  waterTreatment: number;      // $/m³
  oilValue: number;            // $/m³
  laborRate: number;           // $/hour
}

export interface ProcessTargets {
  oilEff: number;              // %
  solidsEff: number;           // %
  waterQuality: number;        // ppm
  minFlow: number;             // m³/h
  maxEnergy: number;           // kWh/m³
  maxVib: number;              // mm/s
  pH: { min: number; max: number };
  turbidity: number;           // NTU
}

export interface DischargeLimits {
  oilInWater: number;          // ppm
  tph: number;                 // ppm
  trh: number;                 // mg/L
  cod: number;                 // mg/L
  turbidity: number;           // NTU
  pH: { min: number; max: number };
  tss: number;                 // mg/L
  temperature: number;         // °C
  enabled: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// BATCH PROCESSING TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface BatchPhase {
  name: string;
  icon: string;
  water: number;               // %
  oil: number;                 // %
  sediment: number;            // %
  volume: number;              // m³
  temp: number;                // °C
  flow: number;                // m³/h
  rpm: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// TREND DATA TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TrendDataPoint {
  time: number;                // simTime in seconds
  [key: string]: number;       // Dynamic process values
}

export interface KPIHistoryPoint {
  time: number;
  oilEff: number;
  solidsEff: number;
  waterQuality: number;
  throughput: number;
  energy: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMULATION STATE (Combined)
// ═══════════════════════════════════════════════════════════════════════════

export interface SimulationState {
  isRunning: boolean;
  simSpeed: number;
  simTime: number;
  equipment: EquipmentConfig;
  feedProps: FeedProperties;
  disturbances: Disturbances;
  tankFarm: FeedTank[];
  oilTanks: OilTank[];
  pond: EvaporationPond;
  loops: ControlLoops;
  chemDosing: ChemicalDosingState;
  chemState: ChemicalState;
  polishingFilter: PolishingFilter;
  proc: ProcessState;
  alarms: ProcessAlarm[];
  totals: ProcessTotals;
  costs: CostParameters;
  targets: ProcessTargets;
  dischargeLimits: DischargeLimits;
  isBatchMode: boolean;
  batchPhase: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEBUG UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export interface DebugInfo {
  fps: number;
  lastUpdateTime: number;
  stateSize: number;
  activeAlarms: number;
  memoryUsage?: number;
}

/**
 * Debug logging levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Debug log entry
 */
export interface DebugLogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}
