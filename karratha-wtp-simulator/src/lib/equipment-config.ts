/**
 * DELTA-CANTER 20-843A EQUIPMENT CONFIGURATION
 * =============================================
 * Based on SACOR Australia Technical Proposal (SAC-PRO-A26-003)
 * Three-Phase Tricanter Centrifuge Specifications
 *
 * Manufacturer: SACOR Australia Pty Ltd
 * Model: Delta-Canter 20-843A
 * Application: Oily-water treatment, three-phase separation
 */

import type { EquipmentConfig, DischargeLimits, ProcessTargets, CostParameters } from './process-types';

// ═══════════════════════════════════════════════════════════════════════════════
// DELTA-CANTER 20-843A SPECIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const DELTA_CANTER_20_843A = {
  // Equipment identification
  manufacturer: 'SACOR Australia Pty Ltd',
  model: 'Delta-Canter 20-843A',
  type: 'Three-Phase Tricanter Centrifuge',
  serialNumber: 'DC-20843A-2026-001',

  // Bowl geometry
  bowl: {
    diameter: 520,           // mm
    length: 1800,            // mm
    ldRatio: 4.0,            // Length to Diameter ratio
    material: 'Duplex Stainless Steel 2205',
    coneAngle: 8.5,          // degrees (typical for oil separation)
  },

  // Operating parameters
  operation: {
    maxGForce: 3000,         // G
    bowlSpeedMin: 2200,      // RPM
    bowlSpeedMax: 3600,      // RPM
    bowlSpeedNominal: 3200,  // RPM (typical operating)
    diffSpeedMin: 2,         // RPM
    diffSpeedMax: 45,        // RPM
    diffSpeedNominal: 15,    // RPM (typical operating)
  },

  // Throughput capacity
  capacity: {
    designThroughput: 15,    // m³/h nominal
    operatingMin: 10,        // m³/h
    operatingMax: 30,        // m³/h
    peakCapacity: 30,        // m³/h (short campaigns)
  },

  // Motor specifications
  motors: {
    mainMotorPower: 45,      // kW
    backDriveMotorPower: 11, // kW
    totalInstalledPower: 75, // kW (within 250A site limit)
    motorEfficiency: 0.94,   // 94% typical IE3
    vfdEfficiency: 0.97,     // 97% typical VFD
  },

  // Electrical requirements
  electrical: {
    voltage: 415,            // V AC
    phases: 3,
    frequency: 50,           // Hz
    fullLoadCurrent: 120,    // A FLC
  },

  // Discharge systems
  discharge: {
    oil: 'Adjustable paring disc / gravity overflow',
    water: 'Adjustable weir plates',
    solids: 'Continuous scroll to discharge conveyor',
  },

  // Materials of construction
  materials: {
    bowl: 'Duplex Stainless Steel 2205',
    scroll: 'AISI 316L SS with tungsten carbide tiles on flights',
    feedZone: 'Tungsten carbide wear protection',
    casing: 'AISI 316 SS',
    gearbox: 'Cycloidal or planetary, oil-lubricated',
    baseFrame: 'Carbon steel, hot-dip galvanised + polyurethane topcoat',
    fasteners: 'A4-80 stainless steel',
    paringDisc: 'AISI 316L SS',
    weirPlates: 'Duplex 2205 SS',
    dischargeHousing: 'AISI 316 SS with PTFE seals',
  },

  // Utilities
  utilities: {
    washWaterPressure: 500,  // kPa
    washWaterFlow: 2,        // L/min (intermittent)
    cipConnection: true,     // CIP tie-in point provided
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE GUARANTEES (Per SACOR Proposal)
// ═══════════════════════════════════════════════════════════════════════════════

export const PERFORMANCE_GUARANTEES = {
  // Separation efficiency
  oilRecoveryEfficiency: 95,        // ≥95% of recoverable oil
  solidsRecoveryEfficiency: 95,     // ≥95% (inferred from 2-phase spec)

  // Product quality
  centrateTPH: 500,                 // ≤500 mg/L TPH in water phase
  cakeDryness: 80,                  // ≥80% dry solids (≤20% residual moisture)

  // Process accuracy
  massBalanceAccuracy: 3,           // ≤3% variance (feed vs outlets)

  // Mechanical performance
  mechanicalAvailability: 90,       // ≥90% over 12 months
  vibrationLimit: 4.5,              // ≤4.5 mm/s RMS (ISO 10816-3 Zone B)
  noiseLevel: 85,                   // ≤85 dB(A) at 1m
  dynamicBalance: 'ISO 1940 G2.5',  // Dynamic balance standard
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// INSTRUMENTATION & CONTROL
// ═══════════════════════════════════════════════════════════════════════════════

export const INSTRUMENTATION = {
  // Flow measurement
  flowMeter: {
    type: 'Coriolis mass flow meter',
    size: '3 inch',
    brand: 'Endress+Hauser Promass (or equivalent)',
    outputs: ['4-20mA', 'Modbus TCP'],
    accuracy: 0.1,           // ±0.1% typical Coriolis
  },

  // Temperature monitoring
  bearingTemperature: {
    type: 'RTD (PT100)',
    locations: ['Main bearing DE', 'Main bearing NDE', 'Gearbox'],
    alarmHigh: 80,           // °C
    alarmHighHigh: 90,       // °C
    tripPoint: 95,           // °C
  },

  // Speed monitoring
  speedSensors: {
    bowlSpeed: true,
    differentialSpeed: true,
    type: 'Inductive proximity',
  },

  // Vibration monitoring
  vibration: {
    type: 'Triaxial accelerometer',
    locations: ['Main bearings', 'Gearbox'],
    alarmLevel: 4.5,         // mm/s RMS
    tripLevel: 7.1,          // mm/s RMS (Zone C/D boundary)
    standard: 'ISO 10816-3',
  },

  // Control system
  controlPanel: {
    protection: 'IP65',
    hmi: '7" colour touchscreen',
    plc: 'Siemens S7 compatible',
    communication: ['Hardwired I/O', 'Modbus TCP'],
    vfds: ['Bowl motor', 'Scroll motor', 'Feed pump', 'Conveyor'],
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// ALARM LIMITS (Based on guarantees and ISO standards)
// ═══════════════════════════════════════════════════════════════════════════════

export const ALARM_LIMITS = {
  // Vibration (ISO 10816-3 for Class II machines)
  vibration: {
    good: 1.8,               // Zone A upper limit (mm/s RMS)
    acceptable: 4.5,         // Zone B upper limit (mm/s RMS)
    warning: 7.1,            // Zone C upper limit (mm/s RMS)
    danger: 11.2,            // Zone D (mm/s RMS)
  },

  // Temperature limits
  bearingTemp: {
    normal: 60,              // °C typical operating
    high: 80,                // °C alarm
    highHigh: 90,            // °C pre-trip
    trip: 95,                // °C shutdown
  },

  oilTemp: {
    low: 30,                 // °C (too cold for separation)
    normal: 60,              // °C optimal
    high: 85,                // °C alarm
    trip: 95,                // °C shutdown
  },

  // Speed limits
  bowlSpeed: {
    low: 2000,               // RPM (too slow)
    lowLow: 1800,            // RPM (trip)
    high: 3700,              // RPM (alarm)
    highHigh: 3800,          // RPM (trip)
  },

  diffSpeed: {
    low: 1,                  // RPM (solids transport issue)
    high: 50,                // RPM (excessive wear)
  },

  // Flow limits
  feedFlow: {
    low: 8,                  // m³/h (starvation)
    lowLow: 5,               // m³/h (trip)
    high: 32,                // m³/h (overload)
    highHigh: 35,            // m³/h (trip)
  },

  // Quality limits
  waterQuality: {
    target: 300,             // ppm OiW (excellent)
    acceptable: 500,         // ppm OiW (guarantee)
    alarm: 750,              // ppm OiW (warning)
    trip: 1000,              // ppm OiW (unacceptable)
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// EQUIPMENT CONFIG FOR SIMULATOR
// ═══════════════════════════════════════════════════════════════════════════════

export const DELTA_CANTER_EQUIPMENT_CONFIG: EquipmentConfig = {
  // Heater (pre-heating system for viscosity reduction)
  heaterCapacity: 150,              // kW (sized for 15 m³/h at ΔT=20°C)
  heaterEfficiency: 0.92,           // 92%
  heaterMaxTemp: 95,                // °C
  heaterTimeConstant: 180,          // seconds (3 min response)

  // Centrifuge capacity
  centrifugeCapacity: 15,           // m³/h design
  maxRPM: 3600,                     // from spec
  minRPM: 2200,                     // from spec
  maxFlow: 30,                      // m³/h peak

  // Bowl geometry
  bowlDiameter: 520,                // mm
  bowlLength: 1800,                 // mm

  // Efficiency factors
  motorEfficiency: 0.94,            // 94% IE3 motor
  vfdEfficiency: 0.97,              // 97% VFD
  bearingCondition: 100,            // % (new equipment)
};

// ═══════════════════════════════════════════════════════════════════════════════
// DISCHARGE LIMITS (Environmental compliance)
// ═══════════════════════════════════════════════════════════════════════════════

export const DELTA_CANTER_DISCHARGE_LIMITS: DischargeLimits = {
  oilInWater: 500,                  // ppm (per guarantee)
  tph: 500,                         // ppm Total Petroleum Hydrocarbons
  trh: 15,                          // mg/L Total Recoverable Hydrocarbons
  cod: 250,                         // mg/L Chemical Oxygen Demand
  turbidity: 50,                    // NTU
  pH: { min: 6.0, max: 9.0 },       // pH range
  tss: 50,                          // mg/L Total Suspended Solids
  temperature: 40,                  // °C max discharge temp
  enabled: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROCESS TARGETS
// ═══════════════════════════════════════════════════════════════════════════════

export const DELTA_CANTER_TARGETS: ProcessTargets = {
  oilEff: 95,                       // % (per guarantee)
  solidsEff: 95,                    // %
  waterQuality: 500,                // ppm OiW (per guarantee)
  minFlow: 10,                      // m³/h minimum operating
  maxEnergy: 5,                     // kWh/m³ target
  maxVib: 4.5,                      // mm/s (ISO 10816-3 Zone B)
  pH: { min: 6.5, max: 8.5 },       // optimal range
  turbidity: 30,                    // NTU target
};

// ═══════════════════════════════════════════════════════════════════════════════
// COST PARAMETERS (Australian market rates)
// ═══════════════════════════════════════════════════════════════════════════════

export const OPERATING_COSTS: CostParameters = {
  elec: 0.28,                       // $/kWh (WA commercial rate)
  sludgeDisposal: 180,              // $/m³ (hazardous waste)
  waterTreatment: 2.50,             // $/m³ (further treatment)
  oilValue: 450,                    // $/m³ (recovered oil value)
  laborRate: 85,                    // $/hour (operator rate)
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAINTENANCE SCHEDULE (Per SACOR 12-month plan)
// ═══════════════════════════════════════════════════════════════════════════════

export const MAINTENANCE_SCHEDULE = {
  // Quarterly preventive maintenance
  quarterly: {
    interval: 2160,                 // hours (90 days)
    tasks: [
      'Vibration analysis and trending',
      'Oil sampling and analysis',
      'Visual inspection of wear components',
      'Lubrication check and top-up',
      'Belt/coupling alignment check',
      'Sensor calibration verification',
    ],
  },

  // Annual overhaul
  annual: {
    interval: 8760,                 // hours (365 days)
    tasks: [
      'Full mechanical inspection',
      'Bearing condition assessment',
      'Scroll flight wear measurement',
      'Gearbox oil change',
      'Seal replacement',
      'Full dynamic balance verification',
    ],
  },

  // Consumables
  consumables: {
    gearboxOil: { type: 'Synthetic EP 320', interval: 8760 },
    bearingGrease: { type: 'Kluber Isoflex NBU 15', interval: 2160 },
    seals: { type: 'PTFE/Viton', interval: 8760 },
  },

  // Spare parts (2-year kit included)
  sparePartsKit: [
    'Main bearing set (2x)',
    'Scroll bearing set (2x)',
    'Mechanical seal set (2x)',
    'V-belt set (1x)',
    'Feed tube assembly (1x)',
    'Wear tile set (1x)',
    'Sensor set (temperature, vibration)',
  ],
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// G-FORCE CALCULATION HELPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate G-force from bowl speed and diameter
 * G = (ω² × r) / g = (π × N / 30)² × (D/2000) / 9.81
 *
 * @param rpm Bowl speed in RPM
 * @param diameter Bowl diameter in mm
 * @returns G-force
 */
export function calculateGForce(rpm: number, diameter: number = DELTA_CANTER_20_843A.bowl.diameter): number {
  const omega = (Math.PI * rpm) / 30;          // rad/s
  const radius = diameter / 2000;               // m
  const gForce = (omega * omega * radius) / 9.81;
  return Math.round(gForce);
}

/**
 * Calculate required RPM for target G-force
 * @param gForce Target G-force
 * @param diameter Bowl diameter in mm
 * @returns Required RPM
 */
export function calculateRPMForGForce(gForce: number, diameter: number = DELTA_CANTER_20_843A.bowl.diameter): number {
  const radius = diameter / 2000;               // m
  const omega = Math.sqrt((gForce * 9.81) / radius);
  const rpm = (omega * 30) / Math.PI;
  return Math.round(rpm);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIGMA FACTOR CALCULATION (Separation capacity)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate Sigma factor (equivalent settling area)
 * Σ = (π × L × ω² × (r₂³ - r₁³)) / (3 × g)
 *
 * This represents the equivalent gravity settling area in m²
 *
 * @param rpm Bowl speed
 * @returns Sigma factor in m²
 */
export function calculateSigmaFactor(rpm: number): number {
  const L = DELTA_CANTER_20_843A.bowl.length / 1000;           // m
  const r2 = DELTA_CANTER_20_843A.bowl.diameter / 2000;        // m (bowl radius)
  const r1 = r2 * 0.4;                                          // m (pond radius, ~40% of bowl)
  const omega = (Math.PI * rpm) / 30;                           // rad/s

  const sigma = (Math.PI * L * omega * omega * (Math.pow(r2, 3) - Math.pow(r1, 3))) / (3 * 9.81);
  return Math.round(sigma);
}

// ═══════════════════════════════════════════════════════════════════════════════
// POWER CONSUMPTION MODEL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Estimate power consumption based on operating conditions
 * @param rpm Bowl speed
 * @param feedFlow Feed flow rate (m³/h)
 * @param feedDensity Feed density (kg/m³)
 * @returns Estimated power in kW
 */
export function estimatePowerConsumption(
  rpm: number,
  feedFlow: number,
  feedDensity: number = 1020
): { mainMotor: number; backDrive: number; total: number } {
  const { motors } = DELTA_CANTER_20_843A;

  // Main motor power scales with speed³ and load
  const speedRatio = rpm / DELTA_CANTER_20_843A.operation.bowlSpeedNominal;
  const loadRatio = feedFlow / DELTA_CANTER_20_843A.capacity.designThroughput;
  const densityFactor = feedDensity / 1000;

  // Base load + speed-dependent + flow-dependent
  const mainMotor = motors.mainMotorPower * (
    0.3 +                                    // No-load power (~30%)
    0.5 * Math.pow(speedRatio, 3) +          // Speed-dependent (friction)
    0.2 * loadRatio * densityFactor          // Load-dependent
  );

  // Back-drive power depends on scroll torque (solids transport)
  const backDrive = motors.backDriveMotorPower * (
    0.2 +                                    // No-load
    0.8 * loadRatio                          // Load-dependent
  );

  const total = mainMotor + backDrive;

  return {
    mainMotor: Math.round(mainMotor * 10) / 10,
    backDrive: Math.round(backDrive * 10) / 10,
    total: Math.round(total * 10) / 10,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  specs: DELTA_CANTER_20_843A,
  guarantees: PERFORMANCE_GUARANTEES,
  instrumentation: INSTRUMENTATION,
  alarmLimits: ALARM_LIMITS,
  equipmentConfig: DELTA_CANTER_EQUIPMENT_CONFIG,
  dischargeLimits: DELTA_CANTER_DISCHARGE_LIMITS,
  targets: DELTA_CANTER_TARGETS,
  costs: OPERATING_COSTS,
  maintenance: MAINTENANCE_SCHEDULE,
  calculateGForce,
  calculateRPMForGForce,
  calculateSigmaFactor,
  estimatePowerConsumption,
};
