/**
 * KARRATHA WTP SIMULATOR - COMPREHENSIVE TYPE DEFINITIONS
 * Based on Block Flow Diagrams KA-00X (Sheets 1-3)
 * Document: CWY LSG KARRATHA - P&ID Rev A
 * 
 * Engineering-grade type definitions for professional process simulation
 */

// =============================================================================
// PHYSICAL PROPERTY TYPES
// =============================================================================

export interface FluidProperties {
  density: number;              // kg/m³
  viscosity: number;            // Pa·s (dynamic)
  specificHeat: number;         // J/kg·K
  thermalConductivity: number;  // W/m·K
  surfaceTension: number;       // N/m
  vaporPressure: number;        // Pa
}

export interface DropletDistribution {
  d10: number;    // 10th percentile diameter (m)
  d50: number;    // Median diameter (m) - Sauter mean
  d90: number;    // 90th percentile diameter (m)
  span: number;   // (d90-d10)/d50 - distribution width
  count: number;  // Droplets per unit volume
}

export interface Emulsion {
  type: 'oil_in_water' | 'water_in_oil' | 'multiple';
  continuousPhase: 'water' | 'oil';
  dispersedPhaseFraction: number;  // 0-1
  dropletDistribution: DropletDistribution;
  stability: number;               // 0-1 (1 = very stable emulsion)
  demulsifierRequired: number;     // mg/L to break
}

// =============================================================================
// STREAM COMPOSITION - DETAILED
// =============================================================================

export interface OilCharacteristics {
  apiGravity: number;           // °API
  density15C: number;           // kg/m³ at 15°C
  viscosity40C: number;         // cSt at 40°C
  viscosity100C: number;        // cSt at 100°C
  viscosityIndex: number;       // VI
  pourPoint: number;            // °C
  flashPoint: number;           // °C
  waterContent: number;         // % (BS&W)
  ashContent: number;           // %
  sulphurContent: number;       // %
  acidNumber: number;           // mg KOH/g (TAN)
  baseNumber: number;           // mg KOH/g (TBN)
}

export interface WaterCharacteristics {
  pH: number;
  conductivity: number;         // μS/cm
  tds: number;                  // mg/L Total Dissolved Solids
  tss: number;                  // mg/L Total Suspended Solids
  cod: number;                  // mg/L Chemical Oxygen Demand
  bod: number;                  // mg/L Biochemical Oxygen Demand
  oilAndGrease: number;         // mg/L
  tph: number;                  // mg/L Total Petroleum Hydrocarbons
  chlorides: number;            // mg/L
  sulphates: number;            // mg/L
  ammonia: number;              // mg/L as N
  phosphate: number;            // mg/L as P
  temperature: number;          // °C
}

export interface SolidsCharacteristics {
  particleDensity: number;      // kg/m³
  bulkDensity: number;          // kg/m³
  d50: number;                  // Median particle size (μm)
  moistureContent: number;      // %
  organicContent: number;       // %
  oilContent: number;           // %
  heavyMetals: {
    lead: number;               // mg/kg
    zinc: number;
    copper: number;
    chromium: number;
    nickel: number;
  };
}

export interface StreamComposition {
  // Mass fractions (must sum to 1)
  waterFraction: number;
  oilFraction: number;
  solidsFraction: number;
  
  // Detailed characteristics
  waterProps: WaterCharacteristics;
  oilProps: OilCharacteristics;
  solidsProps: SolidsCharacteristics;
  
  // Emulsion state
  emulsion: Emulsion | null;
}

// =============================================================================
// PROCESS STREAM
// =============================================================================

export interface ProcessStream {
  id: string;
  name: string;
  
  // Flow conditions
  volumetricFlow: number;       // m³/hr
  massFlow: number;             // kg/hr
  temperature: number;          // °C
  pressure: number;             // kPa(g)
  
  // Composition
  composition: StreamComposition;
  
  // Calculated properties
  mixtureDensity: number;       // kg/m³
  mixtureViscosity: number;     // Pa·s
  reynoldsNumber: number;       // In connected pipe
  velocity: number;             // m/s in connected pipe
}

// =============================================================================
// TANK CONFIGURATION - ENHANCED
// =============================================================================

export type TankType = 'vertical' | 'horizontal';
export type TankService = 
  | 'mixed_infeed_buffer'
  | 'water_processing' 
  | 'oil_storage'
  | 'sludge_holding'
  | 'treatment_feed'
  | 'treated_water'
  | 'export';

export type FillMethod = 'top_fill' | 'bottom_fill' | 'side_entry';
export type DrawOffPoint = 'top' | 'middle' | 'bottom' | 'multiple';

export interface TankNozzle {
  id: string;
  position: DrawOffPoint;
  elevation: number;            // m from tank bottom
  size: number;                 // DN (mm)
  flangeRating: string;         // e.g., "PN16", "Class 150"
  service: 'inlet' | 'outlet' | 'vent' | 'drain' | 'sample' | 'instrument';
}

export interface TankHeatingSystem {
  type: 'electric_immersion' | 'steam_coil' | 'external_exchanger' | 'none';
  dutyRating: number;           // kW
  currentDuty: number;          // kW
  setpoint: number;             // °C
  deadband: number;             // °C
  maxTemp: number;              // °C (high limit)
  enabled: boolean;
  surfaceArea?: number;         // m² (for coils)
  steamPressure?: number;       // kPa(g) (for steam)
}

export interface TankAgitator {
  type: 'propeller' | 'turbine' | 'anchor' | 'none';
  power: number;                // kW
  speed: number;                // RPM
  diameter: number;             // m
  numberOfBlades: number;
  running: boolean;
  tipSpeed: number;             // m/s (calculated)
  reynoldsNumber: number;       // Impeller Re (calculated)
  powerNumber: number;          // Np (empirical)
}

export interface TankLevelInstrumentation {
  primaryType: 'radar' | 'ultrasonic' | 'displacer' | 'dp_cell' | 'capacitance';
  backupType: 'sight_glass' | 'float_switch' | 'none';
  range: { min: number; max: number };  // %
  accuracy: number;             // % of span
  currentReading: number;       // %
  
  // Alarm setpoints (per AS 1940)
  LALL: number;                 // Low-Low (pump protect)
  LAL: number;                  // Low alarm
  LAH: number;                  // High alarm
  LAHH: number;                 // High-High (overfill trip)
  
  // Independent overfill protection
  independentHHEnabled: boolean;
  independentHHSetpoint: number;
}

export interface TankPhaseInterface {
  oilWaterInterface: number;    // m from bottom
  waterSludgeInterface: number; // m from bottom
  emulsionBandThickness: number; // m
  oilLayerThickness: number;    // m
  waterLayerThickness: number;  // m
  sludgeLayerThickness: number; // m
}

export interface SettlingDynamics {
  stokesVelocity: number;       // m/s (for design droplet)
  hinderedSettlingFactor: number; // Richardson-Zaki correction
  effectiveSettlingVelocity: number; // m/s
  coalescenceRate: number;      // droplets/m³/s
  residenceTime: number;        // hours
  separationEfficiency: number; // 0-1
}

export interface TankConfiguration {
  id: string;
  name: string;
  type: TankType;
  service: TankService;
  
  // Geometry
  capacity: number;             // m³
  diameter: number;             // m
  height: number;               // m (vertical) or length (horizontal)
  wallThickness: number;        // mm
  material: string;             // e.g., "Carbon Steel", "SS316"
  
  // Nozzles
  nozzles: TankNozzle[];
  fillMethod: FillMethod;
  primaryDrawOff: DrawOffPoint;
  
  // Current state
  currentLevel: number;         // %
  currentVolume: number;        // m³
  temperature: number;          // °C
  pressure: number;             // kPa(g)
  
  // Contents
  composition: StreamComposition;
  phaseInterface: TankPhaseInterface;
  settlingDynamics: SettlingDynamics;
  
  // Instrumentation
  levelInstrumentation: TankLevelInstrumentation;
  temperatureInstrumentation: {
    type: 'rtd' | 'thermocouple';
    currentReading: number;
    alarmHigh: number;
    alarmLow: number;
  };
  
  // Equipment
  heating: TankHeatingSystem;
  agitator: TankAgitator;
  
  // Insulation
  insulated: boolean;
  insulationType?: string;
  insulationThickness?: number; // mm
  heatLoss?: number;            // kW
}

// =============================================================================
// PUMP CONFIGURATION - ENHANCED
// =============================================================================

export type PumpType = 
  | 'centrifugal_end_suction'
  | 'centrifugal_vertical'
  | 'positive_displacement_gear'
  | 'positive_displacement_lobe'
  | 'progressive_cavity'
  | 'diaphragm'
  | 'peristaltic';

export type SealType = 'single_mechanical' | 'double_mechanical' | 'packed' | 'sealless_mag_drive';

export interface PumpCurve {
  flowPoints: number[];         // m³/hr
  headPoints: number[];         // m
  efficiencyPoints: number[];   // %
  npshRequiredPoints: number[]; // m
  powerPoints: number[];        // kW
}

export interface PumpOperatingPoint {
  flow: number;                 // m³/hr
  head: number;                 // m
  efficiency: number;           // %
  power: number;                // kW (shaft)
  npshRequired: number;         // m
  npshAvailable: number;        // m
  npshMargin: number;           // m
}

export interface PumpConfiguration {
  id: string;
  name: string;
  type: PumpType;
  
  // Design parameters
  designFlow: number;           // m³/hr
  designHead: number;           // m
  designEfficiency: number;     // %
  ratedPower: number;           // kW (motor)
  
  // Speed control
  vfdEquipped: boolean;
  minSpeed: number;             // % (if VFD)
  maxSpeed: number;             // %
  currentSpeed: number;         // %
  synchronousSpeed: number;     // RPM
  
  // Performance curves
  performanceCurve: PumpCurve;
  currentOperatingPoint: PumpOperatingPoint;
  
  // Physical details
  impellerDiameter: number;     // mm
  numberOfStages: number;
  sealType: SealType;
  sealFlushRequired: boolean;
  
  // Current state
  status: 'running' | 'stopped' | 'tripped' | 'maintenance' | 'standby';
  runHours: number;
  startCount: number;
  lastStartTime: Date | null;
  
  // Motor data
  motorPower: number;           // kW
  motorEfficiency: number;      // %
  motorCurrent: number;         // A
  motorVoltage: number;         // V
  motorPowerFactor: number;
  
  // Vibration monitoring
  vibrationDE: number;          // mm/s RMS (drive end)
  vibrationNDE: number;         // mm/s RMS (non-drive end)
  bearingTempDE: number;        // °C
  bearingTempNDE: number;       // °C
  
  // Connections
  suctionSource: string;
  dischargeDestination: string;
  suctionPressure: number;      // kPa(g)
  dischargePressure: number;    // kPa(g)
}

// =============================================================================
// API SEPARATOR - DETAILED
// =============================================================================

export interface APISeparatorZone {
  name: string;
  length: number;               // m
  function: 'inlet' | 'separation' | 'oil_collection' | 'outlet';
}

export interface APISeparatorConfiguration {
  id: string;
  name: string;
  
  // Geometry (per API 421)
  length: number;               // m
  width: number;                // m
  depth: number;                // m
  surfaceArea: number;          // m² (calculated)
  volume: number;               // m³ (calculated)
  zones: APISeparatorZone[];
  
  // Design basis
  designFlow: number;           // m³/hr (75 per BFD)
  designDropletSize: number;    // μm (typically 150)
  designOilDensity: number;     // kg/m³
  designTemperature: number;    // °C
  designRemovalEfficiency: number; // %
  
  // Calculated design parameters
  horizontalVelocity: number;   // m/s
  verticalRiseVelocity: number; // m/s (Stokes)
  hydraulicLoading: number;     // m³/m²/hr
  retentionTime: number;        // minutes
  
  // Current operating conditions
  currentFlow: number;          // m³/hr
  currentTemperature: number;   // °C
  
  // Inlet conditions
  inletOilConcentration: number;    // mg/L or ppm
  inletSolidsConcentration: number; // mg/L
  inletEmulsionStability: number;   // 0-1
  
  // Outlet conditions (calculated)
  effluentOilConcentration: number; // mg/L
  effluentSolidsConcentration: number; // mg/L
  oilRemovalEfficiency: number;     // %
  solidsRemovalEfficiency: number;  // %
  
  // Skimming system
  oilSkimmerType: 'weir' | 'drum' | 'belt' | 'tube';
  oilSkimRate: number;          // m³/hr
  skimmedOilQuality: number;    // % oil (rest is water)
  
  // Sludge system
  sludgeDrawRate: number;       // m³/hr
  sludgeConcentration: number;  // % solids
  
  // Level control
  oilPadLevel: number;          // mm
  waterLevel: number;           // mm
  sludgeBlanketLevel: number;   // mm
}

// =============================================================================
// TREATMENT PACKAGE (CENTRIFUGE/TRICANTER)
// =============================================================================

export type CentrifugeType = 'two_phase' | 'three_phase_tricanter';

export interface CentrifugeConfiguration {
  id: string;
  name: string;
  type: CentrifugeType;
  
  // Design parameters
  bowlDiameter: number;         // mm
  bowlLength: number;           // mm
  maxSpeed: number;             // RPM
  maxGForce: number;            // G's
  designFeedRate: number;       // m³/hr (5-15 per BFD)
  
  // Operating parameters
  currentSpeed: number;         // RPM
  currentGForce: number;        // G's
  currentFeedRate: number;      // m³/hr
  differentialSpeed: number;    // RPM (scroll vs bowl)
  pondDepth: number;            // mm
  
  // Feed conditions
  feedTemperature: number;      // °C (target 65°C per BFD)
  feedOilContent: number;       // %
  feedWaterContent: number;     // %
  feedSolidsContent: number;    // %
  
  // Separation efficiency
  oilRecoveryEfficiency: number;    // %
  waterClarityEfficiency: number;   // %
  solidsRemovalEfficiency: number;  // %
  
  // Discharge streams (per BFD Sheet 2)
  waterOutFlow: number;         // m³/hr (>15 m³/hr per BFD)
  waterOutOilContent: number;   // mg/L
  oilOutFlow: number;           // m³/hr (>15 m³/hr per BFD)
  oilOutWaterContent: number;   // % (BS&W)
  sludgeOutFlow: number;        // m³/hr (<7 m³/hr per BFD - Mono Pump)
  sludgeOutSolidsContent: number; // %
  
  // Power and utilities
  mainDrivePower: number;       // kW
  backDrivePower: number;       // kW
  flushWaterRate: number;       // L/hr
  
  // Status
  status: 'running' | 'stopped' | 'cleaning' | 'fault';
  runHours: number;
  vibration: number;            // mm/s
  bearingTemperature: number;   // °C
}

// =============================================================================
// FILTERS
// =============================================================================

export type FilterType = 
  | 'coarse_screen'
  | 'basket_strainer'
  | 'auto_backwash'
  | 'gac_adsorption'
  | 'bag_filter'
  | 'cartridge';

export interface FilterConfiguration {
  id: string;
  name: string;
  type: FilterType;
  
  // Design
  meshSize: number;             // μm (<20mm coarse, <500μ fines per BFD)
  designFlow: number;           // m³/hr
  designDP: number;             // kPa (clean)
  maxDP: number;                // kPa (trigger backwash/change)
  
  // Current state
  currentFlow: number;          // m³/hr
  currentDP: number;            // kPa
  status: 'operating' | 'backwashing' | 'standby' | 'blocked' | 'bypass';
  
  // For GAC filters
  gacVolume?: number;           // m³
  gacType?: string;
  bedDepth?: number;            // m
  ebct?: number;                // minutes (Empty Bed Contact Time)
  throughput?: number;          // m³ since last change
  breakthroughPercent?: number; // %
  
  // Backwash system (auto self-cleaning)
  backwashFrequency?: number;   // hours or DP triggered
  backwashDuration?: number;    // minutes
  backwashWaterRate?: number;   // m³/hr
  lastBackwash?: Date;
}

// =============================================================================
// CHEMICAL DOSING - ENHANCED
// =============================================================================

export type ChemicalType = 
  | 'demulsifier'
  | 'flocculant'
  | 'coagulant'
  | 'acid'
  | 'caustic'
  | 'biocide'
  | 'scale_inhibitor'
  | 'antifoam';

export interface ChemicalProperties {
  name: string;
  type: ChemicalType;
  concentration: number;        // % active
  density: number;              // kg/L
  viscosity: number;            // cP
  ph: number;
  hazardClass: string;
  storageTemp: { min: number; max: number };
  shelfLife: number;            // months
}

export interface ChemicalDosingSystem {
  id: string;
  name: string;
  chemical: ChemicalProperties;
  
  // Storage
  tankCapacity: number;         // L
  tankLevel: number;            // %
  tankTemperature: number;      // °C
  daysOnSite: number;           // Days of inventory
  
  // Dosing pump
  pumpType: 'diaphragm' | 'peristaltic' | 'plunger';
  maxDoseRate: number;          // L/hr
  currentDoseRate: number;      // L/hr
  strokeLength: number;         // %
  strokeFrequency: number;      // strokes/min
  pumpRunning: boolean;
  
  // Injection
  injectionPoint: string;       // Equipment ID
  quillType: 'simple' | 'multi_port' | 'static_mixer';
  mixingEnergy: number;         // W/m³
  
  // Control
  controlMode: 'manual' | 'flow_paced' | 'feedback' | 'feedforward';
  setpoint: number;             // mg/L or pH
  currentDose: number;          // mg/L (calculated)
  
  // Cost tracking
  unitCost: number;             // $/L
  dailyConsumption: number;     // L
  dailyCost: number;            // $
}

// =============================================================================
// HEAT EXCHANGER / HEATER
// =============================================================================

export interface HeaterConfiguration {
  id: string;
  name: string;
  type: 'electric_inline' | 'electric_immersion' | 'shell_tube' | 'plate';
  
  // Design
  dutyRating: number;           // kW
  designFlow: number;           // m³/hr
  designTempRise: number;       // °C
  maxOutletTemp: number;        // °C (85°C per SOW)
  
  // Current operation
  enabled: boolean;
  currentDuty: number;          // kW
  inletTemperature: number;     // °C
  outletTemperature: number;    // °C
  setpoint: number;             // °C (65°C target per BFD)
  
  // Control
  controlMode: 'on_off' | 'modulating';
  controlOutput: number;        // % (for modulating)
  
  // Protection
  highTempTrip: number;         // °C
  lowFlowTrip: number;          // m³/hr
  tripped: boolean;
}

// =============================================================================
// MANIFOLD AND ROUTING
// =============================================================================

export interface ManifoldConfiguration {
  id: string;
  name: string;
  
  // Physical
  headerSize: number;           // DN (mm)
  material: string;
  numberOfPorts: number;
  
  // Connected equipment
  inletPorts: { id: string; source: string; valveId: string }[];
  outletPorts: { id: string; destination: string; valveId: string }[];
  
  // Current state
  activeInlets: string[];
  activeOutlets: string[];
  totalFlow: number;            // m³/hr
}

export interface RoutePermission {
  routeId: string;
  source: string;
  destination: string;
  permitted: boolean;
  reason?: string;              // Why prohibited (e.g., "UR-OPS-008: Oil to pond")
  interlockId?: string;
}

// =============================================================================
// EVAPORATION PONDS
// =============================================================================

export interface EvaporationPond {
  id: string;
  name: string;                 // "EVAPORATION PONDS 1, 2, 3, & 4" per BFD
  
  // Geometry
  surfaceArea: number;          // m²
  depth: number;                // m
  capacity: number;             // m³
  currentVolume: number;        // m³
  freeboard: number;            // m
  
  // Water balance
  inflowRate: number;           // m³/hr
  evaporationRate: number;      // mm/day
  netAccumulation: number;      // m³/day
  
  // Quality
  tphConcentration: number;     // mg/L
  tdsConcentration: number;     // mg/L
  pH: number;
  
  // Monitoring (per licence)
  flowTotalizer: number;        // m³ total discharged
  lastSampleDate: Date;
}

// =============================================================================
// SLUDGE HANDLING
// =============================================================================

export interface SludgeHandlingSystem {
  // Sludge tank (per BFD Sheet 1)
  tank: TankConfiguration;
  
  // Transfer to treatment package (per BFD Sheet 3)
  monoPump: PumpConfiguration;  // <7 m³/hr per BFD
  makeupWater: {
    enabled: boolean;
    flowRate: number;           // m³/hr
    dilutionRatio: number;
  };
  
  // From treatment package to fixation (per BFD Sheet 2)
  conveyorType: 'screw' | 'belt' | 'skip';
  conveyorCapacity: number;     // m³/hr
  fixationPadCapacity: number;  // m³
  fixationPadLevel: number;     // %
}

// =============================================================================
// OIL EXPORT / UNLOADING SYSTEM
// =============================================================================

export interface OilExportSystem {
  // Per BFD Sheet 1 & 3
  unloadingPump: PumpConfiguration;  // Low Shear 50 m³/hr
  apiUnloadingTerminal: {
    id: string;
    connectionSize: number;     // DN
    loadingArms: number;
    meterType: string;
    currentFlow: number;        // m³/hr
    batchTotal: number;         // m³
  };
  usedLubOilOut: {
    enabled: boolean;
    flowRate: number;           // m³/hr
  };
}

// =============================================================================
// MBR SYSTEM (FUTURE)
// =============================================================================

export interface MBRSystemFuture {
  id: string;
  name: string;
  status: 'not_installed' | 'tie_in_ready';
  
  // Tie-in points defined
  inletTieIn: { location: string; size: number; elevation: number };
  outletTieIn: { location: string; size: number; elevation: number };
  
  // Design envelope (for future)
  designFlow: number;           // m³/hr
  designCODRemoval: number;     // %
  designBODRemoval: number;     // %
}

// =============================================================================
// INSTRUMENTATION - COMPREHENSIVE
// =============================================================================

export type InstrumentType = 
  | 'flow_magnetic'
  | 'flow_ultrasonic'
  | 'flow_coriolis'
  | 'flow_vortex'
  | 'level_radar'
  | 'level_ultrasonic'
  | 'level_dp'
  | 'level_displacer'
  | 'pressure_gauge'
  | 'pressure_transmitter'
  | 'temperature_rtd'
  | 'temperature_thermocouple'
  | 'pH_probe'
  | 'conductivity_probe'
  | 'turbidity_probe'
  | 'oil_in_water_analyzer'
  | 'density_meter';

export interface InstrumentConfiguration {
  id: string;
  tag: string;                  // ISA tag (e.g., FIT-001)
  description: string;
  type: InstrumentType;
  
  // Range and accuracy
  range: { min: number; max: number };
  unit: string;
  accuracy: number;             // % of span
  repeatability: number;        // % of span
  
  // Current reading
  currentValue: number;
  rawValue: number;             // Before scaling
  quality: 'good' | 'uncertain' | 'bad';
  lastUpdate: Date;
  
  // Alarms
  alarmLowLow?: number;
  alarmLow?: number;
  alarmHigh?: number;
  alarmHighHigh?: number;
  alarmDeadband: number;
  currentAlarmState: 'normal' | 'low' | 'high' | 'lowlow' | 'highhigh';
  
  // Calibration
  lastCalibration: Date;
  nextCalibration: Date;
  calibrationDue: boolean;
}

// =============================================================================
// INTERLOCKS AND PERMISSIVES
// =============================================================================

export interface InterlockCondition {
  tag: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number | boolean | string;
  description: string;
}

export interface InterlockConfiguration {
  id: string;
  name: string;
  description: string;
  
  // Logic
  conditions: InterlockCondition[];
  logicOperator: 'AND' | 'OR';
  
  // Actions
  tripAction: string;           // What happens on trip
  affectedEquipment: string[];
  
  // Status
  status: 'healthy' | 'tripped' | 'bypassed' | 'fault';
  bypassAuthorized: boolean;
  bypassExpiry?: Date;
  
  // Reset
  resetType: 'auto' | 'manual'; // Per UR-OPS-017: manual reset required
  resetRequired: boolean;
  lastTripped?: Date;
  tripCount: number;
  
  // Reference
  urReference?: string;         // e.g., "UR-OPS-015"
  standardReference?: string;   // e.g., "AS 1940 Cl. 5.4.2"
}

// =============================================================================
// PROCESS STATE
// =============================================================================

export interface ProcessState {
  timestamp: Date;
  simulationTime: number;       // seconds since start
  
  // Equipment
  tanks: TankConfiguration[];
  pumps: PumpConfiguration[];
  apiSeparator: APISeparatorConfiguration;
  centrifuge: CentrifugeConfiguration;
  filters: FilterConfiguration[];
  heaters: HeaterConfiguration[];
  chemicalDosing: ChemicalDosingSystem[];
  manifolds: ManifoldConfiguration[];
  evaporationPonds: EvaporationPond[];
  
  // Systems
  sludgeHandling: SludgeHandlingSystem;
  oilExport: OilExportSystem;
  mbrFuture: MBRSystemFuture;
  
  // Instrumentation
  instruments: InstrumentConfiguration[];
  
  // Control
  interlocks: InterlockConfiguration[];
  routePermissions: RoutePermission[];
  activeTransfers: TransferOperation[];
  
  // Alarms
  activeAlarms: Alarm[];
  alarmHistory: Alarm[];
  
  // Operating mode
  operatingMode: 'startup' | 'normal' | 'upset' | 'shutdown' | 'maintenance';
}

// =============================================================================
// OPERATIONS
// =============================================================================

export interface TransferOperation {
  id: string;
  routeId: string;
  name: string;
  source: string;
  destination: string;
  
  // Flow
  pumpId: string;
  targetFlow: number;           // m³/hr
  actualFlow: number;           // m³/hr
  
  // Valves
  valveIds: string[];
  valveStates: Record<string, 'open' | 'closed'>;
  
  // Status
  status: 'pending' | 'active' | 'paused' | 'completed' | 'aborted';
  startTime: Date;
  endTime?: Date;
  volumeTransferred: number;    // m³
  
  // Permissives
  permissivesMet: boolean;
  blockingConditions: string[];
}

export interface Alarm {
  id: string;
  timestamp: Date;
  tag: string;
  description: string;
  priority: 'emergency' | 'critical' | 'high' | 'medium' | 'low';
  state: 'active_unack' | 'active_ack' | 'cleared_unack' | 'normal';
  value?: number;
  limit?: number;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  clearedAt?: Date;
}

// =============================================================================
// KPIs AND REPORTING
// =============================================================================

export interface ProcessKPIs {
  instantaneous: {
    infeedRate: number;                 // m³/hr
    apiThroughput: number;              // m³/hr
    centrifugeFeedRate: number;         // m³/hr
    pondDischargeRate: number;          // m³/hr
    oilRecoveryRate: number;            // m³/hr
    sludgeGenerationRate: number;       // m³/hr
    
    apiRemovalEfficiency: number;       // %
    centrifugeOilRecovery: number;      // %
    overallOilRecovery: number;         // %
    
    treatedWaterQuality: number;        // mg/L OiW
    recoveredOilQuality: number;        // % BS&W
    
    totalPowerConsumption: number;      // kW
    specificEnergy: number;             // kWh/m³
    
    chemicalConsumptionRate: number;    // L/hr total
  };
  
  daily: {
    totalInfeed: number;                // m³
    totalPondDischarge: number;         // m³
    totalOilRecovered: number;          // m³
    totalSludgeGenerated: number;       // m³
    
    averageEfficiency: number;          // %
    uptime: number;                     // %
    
    electricityConsumed: number;        // kWh
    chemicalsConsumed: {
      demulsifier: number;              // L
      flocculant: number;               // kg
      acid: number;                     // L
      caustic: number;                  // L
    };
  };
  
  cumulative: {
    totalProcessed: number;             // m³
    totalOilRecovered: number;          // m³
    totalOperatingHours: number;
    totalStartups: number;
    meanTimeBetweenFailures: number;    // hours
  };
}

export interface CostAnalysis {
  period: 'hourly' | 'daily' | 'monthly' | 'annual';
  
  operatingCosts: {
    electricity: {
      consumption: number;              // kWh
      rate: number;                     // $/kWh
      cost: number;                     // $
    };
    chemicals: {
      demulsifier: { volume: number; rate: number; cost: number };
      flocculant: { mass: number; rate: number; cost: number };
      acid: { volume: number; rate: number; cost: number };
      caustic: { volume: number; rate: number; cost: number };
      total: number;
    };
    sludgeDisposal: {
      volume: number;                   // m³
      rate: number;                     // $/m³
      cost: number;
    };
    labor: {
      hours: number;
      rate: number;                     // $/hr
      cost: number;
    };
    maintenance: {
      scheduled: number;
      unscheduled: number;
      total: number;
    };
    totalOperating: number;
  };
  
  revenue: {
    wasteAcceptance: {
      volume: number;                   // m³
      rate: number;                     // $/m³
      total: number;
    };
    oilRecovery: {
      volume: number;                   // m³
      rate: number;                     // $/m³
      total: number;
    };
    totalRevenue: number;
  };
  
  netPosition: number;
  costPerCubicMeter: number;            // $/m³
  marginPerCubicMeter: number;          // $/m³
}

// =============================================================================
// SIMULATION CONFIGURATION
// =============================================================================

export interface SimulationConfig {
  timeStep: number;             // seconds
  speedMultiplier: number;      // 1x, 2x, 5x, 10x
  startTime: Date;
  currentTime: Date;
  running: boolean;
  
  // Environmental conditions
  ambientTemperature: number;   // °C (Karratha ~35°C)
  humidity: number;             // %
  windSpeed: number;            // m/s (for evaporation)
  
  // Feed variability
  feedCompositionVariability: number;  // 0-1
  feedFlowVariability: number;         // 0-1
  
  // Random events
  enableRandomUpsets: boolean;
  upsetFrequency: number;       // per day
}
