// @ts-nocheck
/* eslint-disable */
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CENTRIFUGE PROCESS CONTROL - Version 15 (Delta-Canter 20-843A)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * EQUIPMENT: SACOR Delta-Canter 20-843A Three-Phase Tricanter
 * - Bowl: 520mm diameter × 1800mm length (L:D 4.0:1)
 * - Speed: 2200-3600 RPM (max 3000 G)
 * - Capacity: 15 m³/h design, 10-30 m³/h operating range
 * - Motors: 45kW main + 11kW back-drive (56kW total)
 * - Guarantees: ≥95% oil recovery, ≤500 mg/L TPH, ≤20% cake moisture
 *
 * SIMULATION FEATURES:
 * - Stokes Law separation physics with Richardson-Zaki correlation
 * - Chemical dosing system (7 chemicals with Langmuir/Smoluchowski models)
 * - SPDD1600 Waterco polishing filter simulation
 * - Tank farm management (6 feed + 6 oil tanks + 8ML pond)
 * - Batch processing with 6 ISA-88 compliant phases
 * - PID control loops (TIC, FIC, SIC)
 * - Automatic Quality Control (AQC) system
 * - License compliance monitoring (TRH, COD, pH, OiW, turbidity)
 *
 * INDUSTRY STANDARDS:
 * - ISA-101: HMI Design (display hierarchy L1-L4)
 * - ISA-18.2: Alarm Management (priority-based, state machine)
 * - ISA-88: Batch Control (states, modes, phases)
 * - ISO 10816-3: Vibration limits (Zone A/B/C/D)
 * - High Performance HMI: Gray backgrounds, color for abnormal only
 *
 * DEBUGGING:
 * - Press Ctrl+Shift+D to toggle debug panel
 * - Debug logs available in browser console
 * - State snapshots captured every 5 seconds
 * - Performance monitoring for slow operations
 *
 * @version 15.0.0
 * @equipment SACOR Delta-Canter 20-843A
 * @reference SAC-PRO-A26-003 (SACOR Technical Proposal)
 * @author Karratha WTP Team
 * @license MIT
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';

// Extracted modules
import { usePhaseTracking, ProcessDataSnapshot } from '../hooks/usePhaseTracking';
import { FEEDSTOCK_TYPES, TRANSPORT_DESTINATIONS, DEFAULT_COSTS } from '../lib/constants';
import { BATCH_PHASES, getTotalBatchVolume } from '../lib/constants/batch-phases';
import { generatePhaseReportHTML } from '../lib/reports/phase-report';

const gaussianRandom = (mean, stdDev) => {
  if (stdDev === 0) return mean;
  const u1 = Math.random(), u2 = Math.random();
  return mean + Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * stdDev;
};
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const formatTime = (s) => `${Math.floor(s/3600)}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;

// Currency formatter - normalizes large values for easy reading
const formatCurrency = (value: number, decimals: number = 2): string => {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1000000) {
    return `${sign}$${(absValue / 1000000).toFixed(decimals)}M`;
  } else if (absValue >= 1000) {
    return `${sign}$${(absValue / 1000).toFixed(decimals)}K`;
  } else {
    return `${sign}$${absValue.toFixed(decimals)}`;
  }
};

const calcStats = (data, key) => {
  const vals = data.map(d => d[key]).filter(v => !isNaN(v));
  if (!vals.length) return { mean: 0, stdDev: 0, min: 0, max: 0 };
  const mean = vals.reduce((a,b) => a+b, 0) / vals.length;
  const stdDev = Math.sqrt(vals.reduce((a,b) => a + (b-mean)**2, 0) / vals.length);
  return { mean, stdDev, min: Math.min(...vals), max: Math.max(...vals) };
};

// Tank volumes in m³ (SI unit for volume)
const TANK = { volume: 55 };  // 55 m³
const OIL_TANK = { volume: 55, high: 90, highHigh: 95 };  // 55 m³
const POND = { volume: 8000, high: 85, highHigh: 95 };  // 8000 m³ (8 ML)

// Configuration constants - extracted from magic numbers
const CONFIG = {
  // Alarm thresholds
  alarms: {
    highTemp: 78,
    highVibration: 7,
    lowOilEfficiency: 80,
    delaySeconds: 3,
    marginPercent: 0.05,
  },
  // Simulation parameters
  simulation: {
    smoothWindowMs: 8000,      // Rolling average window for UI smoothing (8 seconds)
    smoothUpdateIntervalMs: 250, // How often to update smoothed values (slower = less flicker)
    logIntervalSec: 1,         // Data logging interval
    maxTrendPoints: 300,       // Max points in trend data
    maxEvents: 50,             // Max events in log
  },
  // Process limits
  process: {
    minPH: 6.5,
    maxPH: 8.5,
    maxTurbidity: 100,
    maxWaterQuality: 50,       // ppm OiW
  },
  // Default costs ($/unit)
  defaultCosts: {
    electricity: 0.34,         // per kWh
    sludgeDisposal: 85,        // per m³
    waterTreatment: 2.5,       // per m³
    oilValue: 340,             // per m³
    laborRate: 45,             // per hour
  },
  // Default targets
  defaultTargets: {
    oilEfficiency: 90,         // %
    solidsEfficiency: 95,      // %
    waterQuality: 50,          // ppm
    minFlow: 10,               // m³/h
    maxEnergy: 15,             // kWh/m³
    maxVibration: 5,           // mm/s
  },
  // Feed property limits for UI controls
  feedLimits: {
    // Densities (kg/m³)
    waterDensity: { min: 990, max: 1100, step: 1 },
    oilDensity: { min: 700, max: 1000, step: 5 },
    solidsDensity: { min: 1500, max: 4000, step: 50 },
    // Particle sizes (microns)
    dropletSize: { min: 1, max: 500, step: 1 },
    solidsSize: { min: 1, max: 1000, step: 5 },
    // Viscosity
    oilViscosity: { min: 1, max: 10000, step: 1 },
    viscosityTempCoeff: { min: 0.01, max: 0.05, step: 0.001 },
    // Rheology
    yieldStress: { min: 0, max: 100, step: 1 },
    flowBehaviorIndex: { min: 0.3, max: 1.5, step: 0.05 },
    // Emulsion
    emulsionStability: { min: 0, max: 1, step: 0.05 },
    interfacialTension: { min: 1, max: 50, step: 0.5 },
    // Chemical dosing (ppm)
    demulsifierDose: { min: 0, max: 500, step: 5 },
    flocculantDose: { min: 0, max: 200, step: 5 },
    acidDose: { min: -100, max: 100, step: 5 },
    // Water quality
    salinity: { min: 0, max: 200000, step: 1000 },
    dissolvedGas: { min: 0, max: 20, step: 0.5 },
    // Hindered settling
    maxPackingFraction: { min: 0.5, max: 0.74, step: 0.01 },
    hinderedSettlingExp: { min: 2.5, max: 6, step: 0.1 },
    // Shape factors
    sphericity: { min: 0.4, max: 1.0, step: 0.05 },
  },
  // Feed presets for quick configuration
  feedPresets: {
    lightCrude: {
      name: 'Light Crude Emulsion',
      oilViscosity: 15, oilDensity: 850, emulsionStability: 0.2,
      oilDropletD50: 40, interfacialTension: 30,
    },
    heavyCrude: {
      name: 'Heavy Crude Emulsion',
      oilViscosity: 500, oilDensity: 950, emulsionStability: 0.6,
      oilDropletD50: 15, interfacialTension: 15,
    },
    producedWater: {
      name: 'Produced Water (High Salinity)',
      waterFraction: 0.92, oilFraction: 0.05, solidsFraction: 0.03,
      salinity: 80000, oilDropletD50: 20, emulsionStability: 0.4,
    },
    slopOil: {
      name: 'Slop Oil Tank Bottom',
      waterFraction: 0.60, oilFraction: 0.30, solidsFraction: 0.10,
      oilViscosity: 200, emulsionStability: 0.7, solidsD50: 50,
    },
    refineryWaste: {
      name: 'Refinery Oily Water',
      waterFraction: 0.85, oilFraction: 0.12, solidsFraction: 0.03,
      oilViscosity: 30, emulsionStability: 0.3, oilDropletD50: 30,
    },
  },
  // ═══════════════════════════════════════════════════════════════
  // CHEMICAL DOSING SYSTEM CONFIGURATION
  // ═══════════════════════════════════════════════════════════════
  chemicals: {
    // Demulsifier - breaks oil-water emulsions
    demulsifier: {
      name: 'Demulsifier',
      tag: 'CHEM-001',
      unit: 'ppm',
      minDose: 0, maxDose: 500, defaultDose: 50,
      pumpCapacity: 100,        // L/h max pump rate
      concentration: 100,       // % active ingredient
      density: 980,             // kg/m³
      costPerLiter: 4.50,       // $/L
      optimalRange: { min: 20, max: 150 },
      // Langmuir isotherm parameters for surface coverage
      langmuirK: 0.05,          // Adsorption constant (1/ppm)
      langmuirQmax: 0.95,       // Max surface coverage (0-1)
      // Temperature sensitivity (Arrhenius)
      activationEnergy: 25000,  // J/mol
      tempOptimal: 65,          // °C
    },
    // Flocculant - aggregates fine particles
    flocculant: {
      name: 'Polymer Flocculant',
      tag: 'CHEM-002',
      unit: 'ppm',
      minDose: 0, maxDose: 200, defaultDose: 0,
      pumpCapacity: 50,
      concentration: 0.5,       // % (very dilute polymer solution)
      density: 1010,
      costPerLiter: 8.00,
      optimalRange: { min: 5, max: 50 },
      // Smoluchowski flocculation kinetics
      collisionEfficiency: 0.3, // Fraction of collisions that stick
      bridgingFactor: 2.5,      // Size increase multiplier
      overdoseThreshold: 100,   // ppm where restabilization occurs
    },
    // Coagulant - charge neutralization for colloids
    coagulant: {
      name: 'Ferric Chloride',
      tag: 'CHEM-003',
      unit: 'ppm',
      minDose: 0, maxDose: 300, defaultDose: 0,
      pumpCapacity: 80,
      concentration: 40,        // % FeCl3
      density: 1420,
      costPerLiter: 0.85,
      optimalRange: { min: 10, max: 100 },
      // Schulze-Hardy rule - critical coagulation concentration
      zetaPotentialTarget: 0,   // mV (isoelectric point)
      chargeValence: 3,         // Fe³⁺
      pHEffect: -0.3,           // pH reduction per 100 ppm
    },
    // pH Adjuster (Acid)
    acid: {
      name: 'Sulfuric Acid',
      tag: 'CHEM-004',
      unit: 'mL/m³',
      minDose: 0, maxDose: 500, defaultDose: 0,
      pumpCapacity: 30,
      concentration: 98,        // % H2SO4
      density: 1840,
      costPerLiter: 0.35,
      // Henderson-Hasselbalch parameters
      pKa: -3,                  // Strong acid
      equivalentWeight: 49,     // g/eq
      bufferCapacity: 0.02,     // mol/L/pH for typical oily water
    },
    // pH Adjuster (Caustic)
    caustic: {
      name: 'Caustic Soda',
      tag: 'CHEM-005',
      unit: 'mL/m³',
      minDose: 0, maxDose: 500, defaultDose: 0,
      pumpCapacity: 30,
      concentration: 50,        // % NaOH
      density: 1530,
      costPerLiter: 0.45,
      pKb: -0.2,
      equivalentWeight: 40,
      bufferCapacity: 0.02,
    },
    // Scale Inhibitor - prevents fouling
    scaleInhibitor: {
      name: 'Phosphonate Scale Inhibitor',
      tag: 'CHEM-006',
      unit: 'ppm',
      minDose: 0, maxDose: 50, defaultDose: 5,
      pumpCapacity: 20,
      concentration: 30,
      density: 1150,
      costPerLiter: 12.00,
      optimalRange: { min: 2, max: 20 },
      // Threshold inhibition parameters
      inhibitionEfficiency: 0.95, // At optimal dose
      saturationIndex: 2.5,       // LSI threshold for scaling
    },
    // Antifoam
    antifoam: {
      name: 'Silicone Antifoam',
      tag: 'CHEM-007',
      unit: 'ppm',
      minDose: 0, maxDose: 100, defaultDose: 10,
      pumpCapacity: 15,
      concentration: 100,
      density: 970,
      costPerLiter: 6.50,
      optimalRange: { min: 5, max: 30 },
      foamBreakTime: 5,         // seconds
      persistenceFactor: 0.85,  // Effectiveness over time
    },
  },
  // Control modes for chemical dosing
  dosingModes: {
    MANUAL: 'Manual - Fixed rate',
    RATIO: 'Ratio - Proportional to flow',
    FEEDBACK: 'Feedback - PID on process variable',
    CASCADE: 'Cascade - Multi-variable optimization',
    ADAPTIVE: 'Adaptive - AI-optimized dosing',
  },
  // ═══════════════════════════════════════════════════════════════
  // SPDD1600 POLISHING FILTER SPECIFICATIONS (Waterco Fibreglass)
  // ═══════════════════════════════════════════════════════════════
  polishingFilter: {
    model: 'SPDD1600',
    manufacturer: 'Waterco',
    type: 'Micron SPDD Nozzle Plate Deep Bed Filter',
    // Physical specifications
    portSize: 100,              // mm
    bedDepth: 1200,             // mm (filter bed depth)
    innerDiameter: 1600,        // mm
    filterArea: 2.01,           // m²
    // Dimensions (mm)
    dimensions: {
      B: 1644, C: 2285, K: 200, V: 1950, H: 1800,
      L: 218, X: 2200, Z: 2130, J: 1202, S: 1529, T: 829,
    },
    // Flow rates (m³/h) at different velocities
    flowRates: {
      standard: 60.3,           // 30 m³/m²/h
      medium: 72.4,             // 35 m³/m²/h
      high: 80.4,               // 40 m³/m²/h
      max: 100.5,               // 50 m³/m²/h
    },
    // Backwash flow rates (m³/h)
    backwashRates: {
      min: 80.4,                // 40 m³/m²/h
      max: 100.5,               // 50 m³/m²/h
    },
    // Media specifications
    media: {
      volume: 2.366,            // m³
      sandWeight: 3455,         // kg (16/30 grade)
      glassPearlsWeight: 3820,  // kg (0.6-0.8mm)
    },
    // Shipping
    shipping: {
      weight: 387,              // kg
      volume: 6.87,             // m³
    },
    // Operating parameters
    operating: {
      pressureRange: { min: 2.5, max: 10 }, // bar
      maxDifferentialPressure: 1.5,          // bar (triggers backwash)
      turbidityRemoval: 0.85,                // 85% typical removal
      oilRemoval: 0.70,                      // 70% oil-in-water removal
      nominalMicron: 20,                     // micron rating
      backwashDuration: 300,                 // seconds (5 minutes)
      backwashWaterSaving: 0.25,             // 25% less backwash water vs conventional
      serviceLifeYears: 15,                  // typical lifespan
    },
    // Cost parameters
    costs: {
      mediaReplacementInterval: 5,           // years
      sandCostPerKg: 0.15,                   // $/kg
      glassPearlsCostPerKg: 0.85,            // $/kg
      backwashWaterCost: 2.5,                // $/m³
      electricityCost: 0.34,                 // $/kWh
      pumpPower: 7.5,                        // kW for backwash pump
    },
  },
};

// Clickable text input component that allows direct keyboard entry
const NumInput = ({ value, onChange, className = '', min, max, step = 1 }) => {
  const [localVal, setLocalVal] = useState(String(value));
  const inputRef = useRef(null);
  
  useEffect(() => { setLocalVal(String(value)); }, [value]);
  
  const handleFocus = (e) => { e.target.select(); };
  const handleChange = (e) => { setLocalVal(e.target.value); };
  const handleBlur = () => {
    let num = parseFloat(localVal);
    if (isNaN(num)) num = value;
    if (min !== undefined) num = Math.max(min, num);
    if (max !== undefined) num = Math.min(max, num);
    setLocalVal(String(num));
    onChange(num);
  };
  const handleKeyDown = (e) => { if (e.key === 'Enter') { e.target.blur(); } };
  
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={localVal}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`bg-slate-700 border border-slate-600 rounded px-2 py-1 text-center focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 ${className}`}
    />
  );
};

interface CentrifugeProcessControlProps {
  initialTab?: string;
}

export default function CentrifugeProcessControl({ initialTab = 'feed' }: CentrifugeProcessControlProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [simSpeed, setSimSpeed] = useState(10);
  const [simTime, setSimTime] = useState(0);
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync activeTab when initialTab changes (user navigates from home with different tile)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // ═══════════════════════════════════════════════════════════════
  //                   EQUIPMENT & FEED PROPERTIES
  // ═══════════════════════════════════════════════════════════════
  // Delta-Canter 20-843A Three-Phase Tricanter (SACOR Australia)
  const [equipment, setEquipment] = useState({
    heaterCapacity: 150, heaterEfficiency: 92, heaterMaxTemp: 95, heaterTimeConstant: 180,
    centrifugeCapacity: 56, maxRPM: 3600, minRPM: 2200, maxFlow: 30,
    bowlDiameter: 520, bowlLength: 1800, motorEfficiency: 94, vfdEfficiency: 97,
    bearingCondition: 100,
  });

  const [feedProps, setFeedProps] = useState({
    // Phase Fractions (must sum to 1.0)
    waterFraction: 0.75, oilFraction: 0.20, solidsFraction: 0.05,

    // Density Properties (kg/m³)
    waterDensity: 1000,      // Pure water baseline
    oilDensity: 890,         // Crude oil typically 800-950
    solidsDensity: 2650,     // Sand/sedite typically 2500-2800

    // Particle/Droplet Size Distribution (microns)
    oilDropletD10: 10,       // 10th percentile diameter
    oilDropletD50: 25,       // Median diameter (Sauter mean)
    oilDropletD90: 60,       // 90th percentile diameter
    solidsD10: 20,           // Fine particles
    solidsD50: 80,           // Median solids size
    solidsD90: 200,          // Coarse particles

    // Rheological Properties
    oilViscosity: 50,        // mPa·s at 25°C (light crude 5-50, heavy 100-10000)
    viscosityTempCoeff: 0.025, // Arrhenius coefficient (higher = more temp sensitive)
    yieldStress: 0,          // Pa (0 for Newtonian, >0 for Bingham plastic)
    flowBehaviorIndex: 1.0,  // n (1.0=Newtonian, <1=shear-thinning, >1=shear-thickening)

    // Emulsion Properties
    emulsionStability: 0.3,  // 0-1 (0=unstable/easy to break, 1=very stable)
    interfacialTension: 25,  // mN/m (lower = harder to coalesce)

    // Chemical Dosing (mg/L or ppm)
    demulsifierDose: 50,     // Typical 20-200 ppm
    demulsifierEff: 0.7,     // Effectiveness factor 0-1
    flocculantDose: 0,       // Polymer flocculant for solids
    flocculantEff: 0.8,      // Effectiveness factor
    acidDose: 0,             // For pH adjustment (negative for base)

    // Water Quality Parameters
    salinity: 35000,         // mg/L TDS (seawater ~35000, freshwater <1000)
    dissolvedGas: 5,         // % by volume (affects cavitation)

    // Hindered Settling Parameters
    maxPackingFraction: 0.64, // Random close packing ~0.64
    hinderedSettlingExp: 4.65, // Richardson-Zaki exponent (typically 4.65 for spheres)

    // Particle Shape Factors
    oilDropletSphericity: 1.0,  // 1.0 for perfect spheres
    solidsSphericity: 0.8,      // Irregular particles <1
  });

  const [disturbances, setDisturbances] = useState({
    compVar: 0.10, tempVar: 0.05, flowVar: 0.03, ambientTemp: 25,
    slugEnabled: false, slugMag: 2.0, slugDur: 60, slugRemain: 0,
    pumpCavitation: false,
  });

  // ═══════════════════════════════════════════════════════════════
  //                   TANKS
  // ═══════════════════════════════════════════════════════════════
  const [tankFarm, setTankFarm] = useState([
    { id: 'VT-001', level: 85, water: 75, oil: 20, sediment: 5, temp: 28, status: 'ready' },
    { id: 'VT-002', level: 62, water: 70, oil: 25, sediment: 5, temp: 30, status: 'ready' },
    { id: 'VT-003', level: 45, water: 80, oil: 15, sediment: 5, temp: 25, status: 'settling' },
    { id: 'VT-004', level: 95, water: 65, oil: 30, sediment: 5, temp: 32, status: 'ready' },
    { id: 'VT-005', level: 30, water: 85, oil: 12, sediment: 3, temp: 26, status: 'ready' },
    { id: 'VT-006', level: 78, water: 72, oil: 22, sediment: 6, temp: 29, status: 'ready' },
  ]);
  const [selectedTank, setSelectedTank] = useState(null);

  const [oilTanks, setOilTanks] = useState([
    { id: 'HT-001', level: 15, temp: 45, status: 'receiving' },
    { id: 'HT-002', level: 45, temp: 42, status: 'ready' },
    { id: 'HT-003', level: 0, temp: 25, status: 'empty' },
    { id: 'HT-004', level: 78, temp: 40, status: 'ready' },
    { id: 'HT-005', level: 0, temp: 25, status: 'empty' },
    { id: 'HT-006', level: 30, temp: 38, status: 'ready' },
  ]);
  const [selectedOilTank, setSelectedOilTank] = useState('HT-001');
  const [oilInterlock, setOilInterlock] = useState({ active: false, reason: '' });
  // 8ML (8,000 m³) Evaporation Pond
  const [pond, setPond] = useState({
    capacity: 8000,           // m³ (8 megalitres)
    volume: 2000,             // m³ current volume
    level: 25,                // % of capacity
    surfaceArea: 4000,        // m² (approx 100m x 40m)
    depth: 2.0,               // m average depth
    pH: 7.2,
    turbidity: 45,            // NTU
    oilInWater: 15,           // ppm
    tds: 5000,                // mg/L total dissolved solids
    temperature: 25,          // °C
    evaporationRate: 8,       // mm/day (typical for arid climate)
    dailyEvaporation: 0,      // m³/day calculated
    totalEvaporated: 0,       // m³ cumulative
    inflow: 0,                // m³/h current inflow rate
    totalInflow: 0,           // m³ cumulative inflow
  });

  // ═══════════════════════════════════════════════════════════════
  //                   BATCH MODE
  // ═══════════════════════════════════════════════════════════════
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchPhase, setBatchPhase] = useState(0);
  const batchPhaseRef = useRef(0); // Ref for use inside animation loop to avoid stale closures
  const pendingPhaseRef = useRef<{ phase: number; detectedAt: number } | null>(null); // 10-second debounce for phase transitions
  const [tankVolume, setTankVolume] = useState(55);

  // Batch phases imported from constants
  const batchPhases = BATCH_PHASES;

  // ═══════════════════════════════════════════════════════════════
  //                   CONTROL LOOPS (Simplified 3-loop)
  // Delta-Canter 20-843A Control Loops (nominal operating points)
  const [loops, setLoops] = useState({
    TIC: { tag: 'TIC-001', desc: 'Heater Outlet Temp', unit: '°C', pv: 65, sp: 65, op: 50, mode: 'AUTO', kp: 2.0, ki: 0.1, kd: 0.5, int: 0, lastErr: 0 },
    FIC: { tag: 'FIC-001', desc: 'Feed Flow Rate', unit: 'm³/h', pv: 15, sp: 15, op: 50, mode: 'AUTO', kp: 1.5, ki: 0.2, kd: 0.1, int: 0, lastErr: 0 },
    SIC: { tag: 'SIC-001', desc: 'Bowl Speed', unit: 'RPM', pv: 3200, sp: 3200, op: 72, mode: 'AUTO', kp: 0.5, ki: 0.05, kd: 0.02, int: 0, lastErr: 0 },
  });

  // ═══════════════════════════════════════════════════════════════
  //                   CHEMICAL DOSING SYSTEM
  // ═══════════════════════════════════════════════════════════════
  const [chemDosing, setChemDosing] = useState({
    // Demulsifier - oil-water emulsion breaker
    demulsifier: {
      enabled: true,
      mode: 'RATIO',           // MANUAL, RATIO, FEEDBACK, CASCADE, ADAPTIVE
      sp: 50,                  // Setpoint (ppm or ratio depending on mode)
      pv: 50,                  // Actual dose rate (ppm)
      ratio: 50,               // ppm per unit of oil fraction
      op: 50,                  // Pump output (%)
      pumpRate: 0,             // Actual pump rate (L/h)
      inventory: 1000,         // Tank level (L)
      totalUsed: 0,            // Session total (L)
      kp: 0.5, ki: 0.1, kd: 0.05, int: 0, lastErr: 0,
      // Effectiveness tracking
      effectiveness: 0.7,      // Current effectiveness (0-1)
      surfaceCoverage: 0,      // Langmuir surface coverage (0-1)
    },
    // Flocculant - polymer for solids aggregation
    flocculant: {
      enabled: false,
      mode: 'RATIO',
      sp: 0,
      pv: 0,
      ratio: 20,               // ppm per % solids
      op: 0,
      pumpRate: 0,
      inventory: 500,
      totalUsed: 0,
      kp: 0.3, ki: 0.05, kd: 0.02, int: 0, lastErr: 0,
      effectiveness: 0.8,
      flocSize: 1.0,           // Floc size multiplier
    },
    // Coagulant - charge neutralization
    coagulant: {
      enabled: false,
      mode: 'FEEDBACK',
      sp: 0,
      pv: 0,
      ratio: 30,
      op: 0,
      pumpRate: 0,
      inventory: 2000,
      totalUsed: 0,
      kp: 0.4, ki: 0.08, kd: 0.03, int: 0, lastErr: 0,
      effectiveness: 0.75,
      zetaPotential: -25,      // mV (target is ~0 for coagulation)
    },
    // Acid for pH control
    acid: {
      enabled: false,
      mode: 'FEEDBACK',
      sp: 7.0,                 // pH setpoint
      pv: 0,                   // Dose rate (mL/m³)
      op: 0,
      pumpRate: 0,
      inventory: 500,
      totalUsed: 0,
      kp: 2.0, ki: 0.5, kd: 0.1, int: 0, lastErr: 0,
    },
    // Caustic for pH control
    caustic: {
      enabled: false,
      mode: 'FEEDBACK',
      sp: 7.0,                 // pH setpoint (same as acid - system chooses)
      pv: 0,
      op: 0,
      pumpRate: 0,
      inventory: 500,
      totalUsed: 0,
      kp: 2.0, ki: 0.5, kd: 0.1, int: 0, lastErr: 0,
    },
    // Scale inhibitor
    scaleInhibitor: {
      enabled: true,
      mode: 'RATIO',
      sp: 5,
      pv: 5,
      ratio: 5,                // Fixed ppm regardless of conditions
      op: 25,
      pumpRate: 0,
      inventory: 200,
      totalUsed: 0,
      kp: 0.2, ki: 0.05, kd: 0.01, int: 0, lastErr: 0,
      effectiveness: 0.95,
      scalingIndex: 0,         // Langelier Saturation Index
    },
    // Antifoam
    antifoam: {
      enabled: true,
      mode: 'MANUAL',
      sp: 10,
      pv: 10,
      op: 30,
      pumpRate: 0,
      inventory: 100,
      totalUsed: 0,
      kp: 0.3, ki: 0.1, kd: 0.02, int: 0, lastErr: 0,
      effectiveness: 0.85,
      foamLevel: 0.1,          // 0-1 foam intensity
    },
  });

  // Chemical dosing process state (real-time effects)
  const [chemState, setChemState] = useState({
    zetaPotential: -25,        // mV - colloidal stability indicator
    flocDiameter: 80,          // microns - effective floc size
    emulsionBreaking: 0.3,     // 0-1 - degree of emulsion destabilization
    foamHeight: 0.1,           // m - foam layer height
    scalingRisk: 0.2,          // 0-1 - probability of scale formation
    mixingEfficiency: 0.85,    // 0-1 - chemical mixing quality
    residenceTime: 30,         // seconds - chemical contact time
    reactionProgress: {},      // Reaction completion by chemical
  });

  // Chemical costs tracking
  const [chemCosts, setChemCosts] = useState({
    demulsifier: 0,
    flocculant: 0,
    coagulant: 0,
    acid: 0,
    caustic: 0,
    scaleInhibitor: 0,
    antifoam: 0,
    total: 0,
  });

  // ═══════════════════════════════════════════════════════════════
  //              SPDD1600 POLISHING FILTER STATE
  // ═══════════════════════════════════════════════════════════════
  const [polishingFilter, setPolishingFilter] = useState({
    enabled: true,
    status: 'FILTERING',        // FILTERING, BACKWASH, STANDBY, OFFLINE
    // Operating state
    inletFlow: 0,               // m³/h (from centrifuge water output)
    outletFlow: 0,              // m³/h (to pond)
    inletPressure: 3.0,         // bar
    outletPressure: 2.8,        // bar
    differentialPressure: 0.2,  // bar (ΔP across bed)
    // Water quality
    inletTurbidity: 45,         // NTU (from centrifuge)
    outletTurbidity: 7,         // NTU (after filtration)
    inletOiW: 50,               // ppm oil-in-water inlet
    outletOiW: 15,              // ppm oil-in-water outlet
    turbidityRemoval: 85,       // % removal efficiency
    oilRemoval: 70,             // % OiW removal efficiency
    // TRH and COD (license compliance parameters)
    inletTRH: 65,               // mg/L - Total Recoverable Hydrocarbons (OiW + dissolved HC)
    outletTRH: 18,              // mg/L - TRH after GAC adsorption of dissolved fraction
    inletCOD: 450,              // mg/L - Chemical Oxygen Demand inlet
    outletCOD: 180,             // mg/L - COD after treatment (COD = 3.5×OiW + organics)
    trhRemoval: 72,             // % TRH removal (GAC adsorbs dissolved hydrocarbons)
    codRemoval: 60,             // % COD removal efficiency
    // Filter bed state
    bedLoading: 0,              // kg solids captured
    bedCapacity: 50,            // kg max capacity before backwash
    bedSaturation: 0,           // % of capacity used
    mediaCondition: 100,        // % (degrades over time)
    // Backwash
    lastBackwash: 0,            // simTime of last backwash
    backwashCount: 0,           // Total backwashes this session
    backwashRemaining: 0,       // seconds remaining if in backwash
    autoBackwash: true,         // Auto backwash when ΔP > threshold
    backwashTriggerDP: 1.0,     // bar - differential pressure trigger
    // Totals
    totalFiltered: 0,           // m³ total water filtered
    totalBackwashWater: 0,      // m³ total backwash water used
    totalSolidsRemoved: 0,      // kg solids removed
    totalOilRemoved: 0,         // kg oil removed
    // Runtime
    runHours: 0,                // Total operating hours
    filterCycles: 0,            // Number of filter cycles
  });

  // Polishing filter costs
  const [filterCosts, setFilterCosts] = useState({
    backwashWater: 0,
    electricity: 0,
    total: 0,
  });

  // ═══════════════════════════════════════════════════════════════
  //                   PROCESS STATE
  // ═══════════════════════════════════════════════════════════════
  const [proc, setProc] = useState({
    feedTemp: 28, heaterTemp: 65, bowlTemp: 63,
    feedFlow: 12, waterOut: 9, oilOut: 2.4, solidsOut: 0.6,
    bowlSpeed: 3500, diffSpeed: 25,
    vibration: 3.4, oilEff: 92, solidsEff: 96, waterQuality: 50,
    heaterPower: 60, motorPower: 75, totalPower: 135, gForce: 2500,
    pH: 7.2, turbidity: 45,
    // Product quality - moisture content
    oilMoisture: 5,      // % v/v water in oil product (target <10%)
    sludgeMoisture: 25,  // % v/v water in sludge/CF cake (target <40%)
  });

  const [alarms, setAlarms] = useState([]);
  const [pendingAlarms, setPendingAlarms] = useState([]);
  const pendingRef = useRef({});

  const [totals, setTotals] = useState({ feed: 0, water: 0, oil: 0, solids: 0, energy: 0, runTime: 0 });

  // ═══════════════════════════════════════════════════════════════
  //    PHASE DATA TRACKING (using extracted hook)
  // ═══════════════════════════════════════════════════════════════
  const {
    phaseData,
    currentPhaseDataRef,
    initializePhaseData,
    startPhaseTracking,
    updatePhaseData: updatePhaseDataHook,
    finalizePhaseData,
    clearPhaseData,
  } = usePhaseTracking(batchPhases);

  // Wrapper for updatePhaseData to match existing call signature
  const updatePhaseData = useCallback((proc: any, dt: number, currentCosts: any, _chemCosts: any, _filterCosts: any) => {
    const procSnapshot: ProcessDataSnapshot = {
      feedFlow: proc.feedFlow,
      waterOut: proc.waterOut,
      oilOut: proc.oilOut,
      solidsOut: proc.solidsOut,
      totalPower: proc.totalPower,
      oilEff: proc.oilEff,
      solidsEff: proc.solidsEff,
      waterQuality: proc.waterQuality,
      pH: proc.pH,
      turbidity: proc.turbidity,
      vibration: proc.vibration,
      oilMoisture: proc.oilMoisture,
      oilSolids: proc.oilSolids,
      cakeMoisture: proc.cakeMoisture,
      cakeOil: proc.cakeOil,
    };
    updatePhaseDataHook(procSnapshot, dt, {
      elec: currentCosts.elec,
      waterTreatment: currentCosts.waterTreatment,
      sludgeDisposal: currentCosts.sludgeDisposal,
      laborRate: currentCosts.laborRate,
    });
  }, [updatePhaseDataHook]);

  // ═══════════════════════════════════════════════════════════════
  //    FEEDSTOCK TYPES & OIL VALUE MATRIX (imported from constants)
  // ═══════════════════════════════════════════════════════════════
  // Using imported FEEDSTOCK_TYPES and TRANSPORT_DESTINATIONS from lib/constants
  const feedstockTypes = FEEDSTOCK_TYPES;
  const transportDestinations = TRANSPORT_DESTINATIONS;

  const [selectedFeedstock, setSelectedFeedstock] = useState<keyof typeof FEEDSTOCK_TYPES>('refinerySlop');
  const [selectedDestination, setSelectedDestination] = useState<keyof typeof TRANSPORT_DESTINATIONS>('kalgoorlie');

  // Australian market rates (WA commercial) - using imported defaults
  const [costs, setCosts] = useState({ ...DEFAULT_COSTS });

  // Update costs and capital model when feedstock or destination changes
  useEffect(() => {
    const feedstock = FEEDSTOCK_TYPES[selectedFeedstock];
    const destination = TRANSPORT_DESTINATIONS[selectedDestination];
    setCosts(prev => ({
      ...prev,
      oilValue: feedstock.oilValue,
      oilTransport: destination.cost,
    }));
    // Update capital model feed composition to match feedstock type
    setCapitalModel(prev => ({
      ...prev,
      feedOilContent: feedstock.oilContent,
      feedSolidsContent: feedstock.solidsContent,
    }));
  }, [selectedFeedstock, selectedDestination]);

  // ═══════════════════════════════════════════════════════════════
  //    CAPITAL MODEL & INVESTMENT ANALYSIS
  // ═══════════════════════════════════════════════════════════════
  const [capitalModel, setCapitalModel] = useState({
    // Total capital investment (slider range: $0 - $10,000,000)
    totalInvestment: 587750,  // SACOR Scenario 2 base price

    // Capital breakdown percentages
    breakdown: {
      equipment: 65,          // % - Centrifuge, motors, gearbox
      installation: 15,       // % - Mechanical & electrical installation
      engineering: 8,         // % - Design, P&ID, commissioning
      instrumentation: 5,     // % - Sensors, PLC, HMI
      contingency: 7,         // % - Project contingency
    },

    // Operating assumptions
    operatingHours: 6000,     // hours/year (24/7 = 8760, 16h/day = 5840)
    operatingDays: 250,       // days/year
    inflationRate: 3.0,       // % per year
    discountRate: 10.0,       // % WACC for NPV
    projectLife: 15,          // years

    // Feed assumptions (annual) - defaults from selected feedstock type
    annualFeedVolume: 90000,  // m³/year (15 m³/h × 6000 hours)
    feedOilContent: 8,        // % oil in feed (default: Refinery Slop)
    feedSolidsContent: 3,     // % solids in feed (default: Refinery Slop)

    // Maintenance & overhead
    maintenanceCost: 28500,   // $/year (SACOR annual maintenance contract)
    insurancePct: 1.5,        // % of capital per year
    overheadPct: 5,           // % of operating costs

    // Revenue multipliers
    oilPriceEscalation: 2.0,  // % per year above inflation
    carbonCredits: 0,         // $/tonne CO2 avoided

    // Optional items (from SACOR proposal)
    extendedWarrantyY2: false,
    extendedWarrantyY3: false,
    remoteMonitoring: false,
    additionalTraining: 0,
  });

  // Delta-Canter 20-843A Performance Guarantees (SACOR)
  const [targets, setTargets] = useState({ oilEff: 95, solidsEff: 95, waterQuality: 500, minFlow: 10, maxEnergy: 5, maxVib: 4.5, pH: { min: 6.5, max: 8.5 }, turbidity: 30 });

  // ═══════════════════════════════════════════════════════════════
  //    WATER DISCHARGE - License compliance (regulatory/environmental)
  // ═══════════════════════════════════════════════════════════════
  // These limits ONLY apply to the water discharge stream (to evaporation pond)
  // NOT to oil product or sludge/CF cake outputs
  // Delta-Canter 20-843A Discharge Limits (per SACOR guarantee & license)
  const [dischargeLimits, setDischargeLimits] = useState({
    oilInWater: 500,       // ppm - max OiW allowed in centrate (SACOR guarantee ≤500 mg/L TPH)
    tph: 500,              // ppm - Total Petroleum Hydrocarbons (per guarantee)
    trh: 15,               // mg/L - Total Recoverable Hydrocarbons (environmental license)
    cod: 250,              // mg/L - Chemical Oxygen Demand (environmental license)
    turbidity: 50,         // NTU - max turbidity allowed (correlates with TSS)
    pH: { min: 6.0, max: 9.0 },  // pH range for discharge (aquatic life protection)
    tss: 50,               // mg/L - total suspended solids
    temperature: 40,       // °C - max discharge temperature (per equipment spec)
    enabled: true,         // Enable/disable limit checking
  });

  // ═══════════════════════════════════════════════════════════════
  //    PRODUCT QUALITY LIMITS - Oil and Sludge/CF Cake
  // ═══════════════════════════════════════════════════════════════
  // Product quality specs (per SACOR guarantee: ≤20% residual moisture in cake)
  const [productLimits, setProductLimits] = useState({
    oilMoisture: 5,        // % v/v - max water content in recovered oil (<5% for quality oil)
    sludgeMoisture: 20,    // % v/v - max water content in sludge/CF cake (SACOR guarantee ≤20%)
    enabled: true,
  });

  // ═══════════════════════════════════════════════════════════════
  //           AUTOMATIC QUALITY CONTROL (AQC) SYSTEM
  // ═══════════════════════════════════════════════════════════════
  const [aqc, setAqc] = useState({
    enabled: false,
    mode: 'ADVISORY',        // MONITOR (alerts only), ADVISORY (suggestions), AUTO (automatic corrections)

    // Quality targets (tighter than limits for safety margin - Delta-Canter specs)
    targets: {
      oiw: { enabled: true, target: 300, warningPct: 70, criticalPct: 90 },     // ppm (target < 500 guarantee)
      trh: { enabled: true, target: 10, warningPct: 70, criticalPct: 90 },      // mg/L (target < 15 license)
      cod: { enabled: true, target: 180, warningPct: 70, criticalPct: 90 },     // mg/L (target < 250 license)
      turbidity: { enabled: true, target: 30, warningPct: 70, criticalPct: 90 }, // NTU (target < 50 limit)
      pH: { enabled: true, targetMin: 6.5, targetMax: 8.5 },
    },

    // Control actions configuration
    actions: {
      reduceFlow: { enabled: true, maxReductionPct: 30, stepPct: 5, cooldownSec: 30 },
      increaseTemp: { enabled: true, maxIncrease: 10, stepSize: 2, cooldownSec: 60 },
      increaseSpeed: { enabled: true, maxIncrease: 500, stepSize: 100, cooldownSec: 45 },
      adjustDemulsifier: { enabled: true, maxIncreasePct: 50, stepPct: 10, cooldownSec: 120 },
      adjustFlocculant: { enabled: true, maxIncreasePct: 50, stepPct: 10, cooldownSec: 120 },
    },

    // Runtime state
    status: 'OK',            // OK, WARNING, CORRECTING, ALARM
    qualityScore: 100,       // 0-100 overall quality score
    activeCorrections: [],   // Currently active correction actions
    lastActionTime: 0,       // Simulation time of last action
    cooldowns: {},           // Cooldown timers for each action type

    // History for display
    actionHistory: [],       // Recent actions taken [{time, action, reason, result}]
    qualityHistory: [],      // Quality score trend
  });

  // ═══════════════════════════════════════════════════════════════
  //         FEED CHARACTERIZATION SETPOINT CALCULATOR
  // ═══════════════════════════════════════════════════════════════
  // Calculates optimal setpoints based on feed properties using
  // Stokes Law separation theory (mirrors Python companion tool)
  const [setpointCalc, setSetpointCalc] = useState({
    calculated: false,
    temperature: 65,
    flowRate: 12,
    bowlSpeed: 3500,
    demulsifierDose: 50,
    // Individual toggles for each setpoint
    applyTemp: true,
    applyFlow: true,
    applySpeed: true,
    applyDemul: true,
    // Predicted performance
    predictedOilEfficiency: 0,
    predictedSolidsEfficiency: 0,
    predictedWaterQuality: 0,
    predictedGForce: 0,
    // Assessment
    confidence: 'Medium',
    notes: [],
  });

  // Debounce ref for setpoint application (10 second delay)
  const setpointDebounceRef = useRef(null);
  const lastSetpointApplyTime = useRef(0);
  const SETPOINT_DEBOUNCE_MS = 10000; // 10 seconds

  const [trendData, setTrendData] = useState([]);
  const [kpiHistory, setKpiHistory] = useState([]);
  const [reportEvents, setReportEvents] = useState([]);
  const [shiftInfo, setShiftInfo] = useState({ operator: '', shift: 'Day', date: new Date().toISOString().split('T')[0] });

  const frameRef = useRef(null);
  const lastUpdate = useRef(Date.now());
  const simRef = useRef({ time: 0, vol: 55, phase: 0 });
  const lastLog = useRef(0);
  const selTankRef = useRef(null);
  const procRef = useRef(null); // Ref to track current process state for use in animation frame
  
  // Smoothing buffer for UI values (8 second real-time rolling average)
  const valueHistory = useRef({
    feedFlow: [], heaterTemp: [], bowlTemp: [], bowlSpeed: [],
    oilEff: [], solidsEff: [], waterQuality: [], vibration: [],
    heaterPower: [], motorPower: [], totalPower: [], gForce: [],
    oilOut: [], waterOut: [], solidsOut: [], pH: [], turbidity: [],
    // Product moisture values
    oilMoisture: [], sludgeMoisture: [],
    // Polishing filter values
    filterOutletOiW: [], filterOutletTurbidity: [], filterOutletTRH: [], filterOutletCOD: [],
    filterInletFlow: [], filterOutletFlow: [], filterDP: [], filterBedSaturation: []
  });
  const [smoothedProc, setSmoothedProc] = useState({
    feedFlow: 12, heaterTemp: 65, bowlTemp: 63, bowlSpeed: 3500,
    oilEff: 92, solidsEff: 96, waterQuality: 50, vibration: 3.4,
    heaterPower: 60, motorPower: 75, totalPower: 135, gForce: 2500,
    oilOut: 2.4, waterOut: 9, solidsOut: 0.6, pH: 7.2, turbidity: 45,
    // Product moisture values
    oilMoisture: 5, sludgeMoisture: 25,
    // Polishing filter smoothed values
    filterOutletOiW: 15, filterOutletTurbidity: 7, filterOutletTRH: 18, filterOutletCOD: 180,
    filterInletFlow: 9, filterOutletFlow: 9, filterDP: 0.2, filterBedSaturation: 0
  });
  const SMOOTH_WINDOW_MS = CONFIG.simulation.smoothWindowMs;
  const lastSmoothUpdate = useRef(Date.now());
  
  const updateSmoothedValues = useCallback((newProc) => {
    const now = Date.now();
    const cutoff = now - SMOOTH_WINDOW_MS;
    
    // Add new values with real timestamp
    Object.keys(valueHistory.current).forEach(key => {
      if (newProc[key] !== undefined) {
        valueHistory.current[key].push({ time: now, value: newProc[key] });
        // Remove values older than 5 real seconds
        valueHistory.current[key] = valueHistory.current[key].filter(v => v.time > cutoff);
      }
    });
    
    // Only update smoothed state periodically to reduce renders
    if (now - lastSmoothUpdate.current > CONFIG.simulation.smoothUpdateIntervalMs) {
      lastSmoothUpdate.current = now;
      
      // Calculate averages
      const smoothed = {};
      Object.keys(valueHistory.current).forEach(key => {
        const history = valueHistory.current[key];
        if (history.length > 0) {
          smoothed[key] = history.reduce((sum, v) => sum + v.value, 0) / history.length;
        } else {
          smoothed[key] = newProc[key] || 0;
        }
      });
      
      setSmoothedProc(smoothed);
    }
  }, []);

  useEffect(() => { selTankRef.current = selectedTank; }, [selectedTank]);
  useEffect(() => { procRef.current = proc; }, [proc]);

  const addEvent = useCallback((type, desc) => {
    setReportEvents(p => [...p, { time: new Date().toLocaleTimeString(), simTime: Math.floor(simRef.current.time), type, desc }].slice(-CONFIG.simulation.maxEvents));
  }, []);

  const calcPID = useCallback((loop, pv, dt) => {
    if (loop.mode !== 'AUTO') return { op: loop.op, int: loop.int, lastErr: loop.lastErr };
    const err = loop.sp - pv;
    if (Math.abs(err) < 0.5) return { op: loop.op, int: loop.int, lastErr: err };
    let newInt = clamp(loop.int + err * dt, -50/Math.max(loop.ki, 0.01), 50/Math.max(loop.ki, 0.01));
    let op = clamp(50 + loop.kp * err + loop.ki * newInt + loop.kd * (err - loop.lastErr) / Math.max(dt, 0.01), 0, 100);
    return { op, int: newInt, lastErr: err };
  }, []);

  const calcEfficiency = useCallback((state, waterFrac, oilFrac) => {
    // ════════════════════════════════════════════════════════════════════
    // ADVANCED STOKES LAW SEPARATION MODEL WITH SCIENTIFIC PARAMETERS
    // ════════════════════════════════════════════════════════════════════

    // 1. CONTINUOUS PHASE VISCOSITY (Arrhenius temperature dependence)
    // μ = μ_ref × exp(E_a/R × (1/T - 1/T_ref))
    const refTemp = 25; // Reference temperature °C
    const viscRef = feedProps.oilViscosity * 0.001; // Convert mPa·s to Pa·s
    const visc = viscRef * Math.exp(feedProps.viscosityTempCoeff * (refTemp - state.bowlTemp) * 10);

    // Effective viscosity for non-Newtonian fluids (power law)
    // For shear-thinning fluids (n < 1), apparent viscosity decreases with shear
    const shearRate = state.bowlSpeed * 2 * Math.PI / 60; // rad/s
    const effectiveVisc = feedProps.flowBehaviorIndex !== 1.0
      ? visc * Math.pow(shearRate / 100, feedProps.flowBehaviorIndex - 1)
      : visc;

    // 2. CENTRIFUGAL ACCELERATION
    const r = equipment.bowlDiameter / 2000; // Convert mm to m
    const w = state.bowlSpeed * 2 * Math.PI / 60; // rad/s
    const g = w * w * r; // Centrifugal acceleration (m/s²)
    const gForce = g / 9.81;

    // 3. DENSITY DIFFERENCE (affected by salinity for water phase)
    // Higher salinity increases water density
    const waterDensityAdjusted = feedProps.waterDensity + feedProps.salinity * 0.0007;
    const oilWaterDensityDiff = Math.abs(waterDensityAdjusted - feedProps.oilDensity);
    const solidsWaterDensityDiff = feedProps.solidsDensity - waterDensityAdjusted;

    // 4. STOKES SETTLING VELOCITY with particle size distribution
    // Using D50 as representative but accounting for distribution spread
    // V_s = (d² × Δρ × g × φ) / (18 × μ)  where φ is sphericity correction

    // Oil droplet settling (Stokes Law with sphericity)
    const oilD50m = feedProps.oilDropletD50 * 1e-6; // Convert microns to m
    const oilSettleBase = (oilD50m ** 2 * oilWaterDensityDiff * g * feedProps.oilDropletSphericity) / (18 * effectiveVisc);

    // Particle size distribution effect (D90/D10 ratio indicates spread)
    const oilPSD_spread = feedProps.oilDropletD90 / Math.max(feedProps.oilDropletD10, 1);
    const oilPSD_factor = 1 - 0.1 * Math.log10(Math.max(oilPSD_spread, 1)); // Wider spread = lower efficiency

    // Solids settling (typically faster due to higher density difference)
    const solidsD50m = feedProps.solidsD50 * 1e-6;
    const solidsSettleBase = (solidsD50m ** 2 * solidsWaterDensityDiff * g * feedProps.solidsSphericity) / (18 * effectiveVisc);

    const solidsPSD_spread = feedProps.solidsD90 / Math.max(feedProps.solidsD10, 1);
    const solidsPSD_factor = 1 - 0.1 * Math.log10(Math.max(solidsPSD_spread, 1));

    // 5. HINDERED SETTLING (Richardson-Zaki correlation)
    // At higher concentrations, particles/droplets interfere with each other
    // V_h = V_s × (1 - φ)^n  where n ≈ 4.65 for spheres
    const totalSolidsFraction = feedProps.solidsFraction + feedProps.oilFraction * 0.1; // Oil acts as pseudo-solid
    const hinderedFactor = Math.pow(
      Math.max(0.01, 1 - totalSolidsFraction / feedProps.maxPackingFraction),
      feedProps.hinderedSettlingExp
    );

    const oilSettle = oilSettleBase * oilPSD_factor * hinderedFactor;
    const solidsSettle = solidsSettleBase * solidsPSD_factor * hinderedFactor;

    // 6. RESIDENCE TIME & SEPARATION DISTANCE
    const vol = Math.PI * r * r * (equipment.bowlLength / 1000); // Bowl volume (m³)
    const resTime = vol / Math.max(state.feedFlow / 3600, 0.001); // seconds
    const dist = r * 0.3; // Effective radial separation distance

    // 7. BASE EFFICIENCY (Sigma theory - logistic curve)
    // Efficiency approaches 100% as settling velocity × residence time >> distance
    let oilEff = 100 / (1 + Math.exp(-2.5 * (oilSettle * resTime / dist - 1)));
    let solidsEff = 100 / (1 + Math.exp(-2.5 * (solidsSettle * resTime / dist - 1)));

    // 8. EMULSION BREAKING FACTOR (Enhanced with real-time chemical dosing)
    // Uses chemState.emulsionBreaking when dosing system is active
    // Emulsion stability opposes separation; demulsifier helps break it
    const demulsifierEffect = chemState.emulsionBreaking > 0
      ? chemState.emulsionBreaking  // Use real-time emulsion breaking from dosing system
      : feedProps.demulsifierDose > 0
        ? feedProps.demulsifierEff * Math.min(1, feedProps.demulsifierDose / 100)
        : 0;
    const interfacialFactor = feedProps.interfacialTension / 25; // Normalized to typical value
    const emulFac = 1 - feedProps.emulsionStability * 0.3 * (1 - demulsifierEffect) * (1 / interfacialFactor);

    // 9. FLOCCULANT EFFECT ON SOLIDS (Enhanced with real-time chemical dosing)
    // Uses chemState.flocDiameter to calculate effective size increase
    const flocSizeRatio = chemState.flocDiameter / Math.max(feedProps.solidsD50, 1);
    const flocculantEffect = flocSizeRatio > 1
      ? Math.min(0.3, (flocSizeRatio - 1) * 0.15)  // Use floc size ratio from dosing
      : feedProps.flocculantDose > 0
        ? feedProps.flocculantEff * Math.min(1, feedProps.flocculantDose / 50) * 0.2
        : 0;
    const flocFac = 1 + flocculantEffect;

    // 9b. COAGULANT EFFECT (Zeta potential optimization)
    // When zeta potential is near zero, particles aggregate better
    const zetaOptimization = Math.abs(chemState.zetaPotential) < 25
      ? 1 + (1 - Math.abs(chemState.zetaPotential) / 25) * 0.15
      : 1;

    // 10. TEMPERATURE FACTOR (higher temp = lower viscosity = better separation)
    const tempFac = 1 + (state.bowlTemp - 60) * 0.008;

    // 11. FLOW RATE FACTOR (higher flow = less residence time)
    const flowFac = Math.max(0.6, 1 - (state.feedFlow - 10) * 0.04);

    // 12. YIELD STRESS EFFECT (for non-Newtonian fluids)
    // If yield stress > shear stress, fluid won't flow properly
    const yieldStressFactor = feedProps.yieldStress > 0
      ? Math.max(0.5, 1 - feedProps.yieldStress / 50)
      : 1;

    // 13. DISSOLVED GAS EFFECT
    // Gas can cause flotation interference and cavitation
    const gasFactor = 1 - feedProps.dissolvedGas * 0.02;

    // FINAL EFFICIENCY CALCULATIONS (includes chemical dosing effects)
    oilEff = clamp(
      oilEff * flowFac * emulFac * tempFac * yieldStressFactor * gasFactor * zetaOptimization +
      gaussianRandom(0, 1 * disturbances.compVar * 10),
      0, 99.5
    );

    solidsEff = clamp(
      solidsEff * flowFac * flocFac * tempFac * yieldStressFactor * zetaOptimization +
      gaussianRandom(0, 0.5),
      0, 99.9
    );

    // WATER QUALITY (Oil in Water - ppm) - Corrected mass balance calculation
    // OiW should be the oil CONCENTRATION in the water OUTPUT stream, not feed fraction
    // Oil carryover = oil that didn't get separated (goes to water stream)
    // Water output = feed - recovered oil - recovered solids
    const solidsFrac = 1 - waterFrac - oilFrac; // Calculate solids fraction
    const feedFlow = state.feedFlow || 12; // m³/h

    const oilCarryover = feedFlow * oilFrac * (1 - oilEff / 100); // m³/h of oil going to water
    const solidsCarryover = feedFlow * solidsFrac * (1 - solidsEff / 100); // m³/h of solids going to water
    const oilRecovered = feedFlow * oilFrac * (oilEff / 100);
    const solidsRecovered = feedFlow * solidsFrac * (solidsEff / 100);
    const waterOutputFlow = feedFlow - oilRecovered - solidsRecovered; // m³/h water output (includes carryover)

    // OiW in ppm = (oil volume / water volume) × 10^6 × (oil_density/water_density)
    // Since densities are similar (890/1000 ≈ 0.89), we approximate as volume ppm
    const wq = waterOutputFlow > 0
      ? (oilCarryover / waterOutputFlow) * 1e6 * (feedProps.oilDensity / feedProps.waterDensity)
      : 0;

    // pH CALCULATION
    // Affected by: acid/base dosing, oil content, salinity, temperature
    const acidEffect = feedProps.acidDose * 0.02; // Positive = more acidic
    const salinityPH = -feedProps.salinity * 0.000005; // High salinity slightly acidic
    const basePH = 7.0 + (1 - oilFrac * 10) * 0.3 - (state.bowlTemp - 60) * 0.01 + acidEffect + salinityPH;
    const pH = clamp(basePH + gaussianRandom(0, 0.15 * disturbances.compVar * 5), 4.0, 10.0);

    // TURBIDITY (NTU) - Corrected to use solids concentration in water output
    // Turbidity correlates with suspended solids concentration
    // Typical: 1 NTU ≈ 1-2 mg/L TSS for fine particles
    const finesFactor = feedProps.solidsD10 < 10 ? 1.5 : 1.0; // Fine particles harder to remove

    // Solids concentration in water output (mg/L)
    // solidsCarryover (m³/h) × solids_density (kg/m³) / waterOutputFlow (m³/h) × 10^6 (mg/kg)
    const solidsConcentration = waterOutputFlow > 0
      ? (solidsCarryover * feedProps.solidsDensity / waterOutputFlow) * 1000 // mg/L
      : 0;

    // Turbidity relationship: NTU ≈ TSS(mg/L) × factor (depends on particle size)
    // Fine particles (< 10 μm) scatter more light per unit mass
    const turbidityFactor = 0.5 * finesFactor; // NTU per mg/L TSS
    const baseTurbidity = 5 + solidsConcentration * turbidityFactor + wq * 0.002; // Oil also adds turbidity
    const turbidity = clamp(baseTurbidity + gaussianRandom(0, 5 * disturbances.compVar * 5), 5, 500);

    // ═══════════════════════════════════════════════════════════════
    // PRODUCT QUALITY - Moisture Content in Oil and Sludge
    // ═══════════════════════════════════════════════════════════════

    // OIL MOISTURE (% v/v water in recovered oil)
    // Water carryover to oil phase depends on:
    // - Separation efficiency (higher G-force = better separation)
    // - Emulsion breaking effectiveness
    // - Temperature (higher temp = lower viscosity = better separation)
    // - Interface clarity (demulsifier effectiveness)
    // Typical range: 2-15% v/v, target <10%
    const baseOilMoisture = 8; // % baseline moisture
    const gForceEffect = Math.max(0.3, 1 - (gForce - 2000) / 5000); // Higher G = lower moisture
    const tempEffect = Math.max(0.5, 1 - (state.bowlTemp - 50) / 50); // Higher temp = lower moisture
    const demulsifierMoistureEffect = chemState.emulsionBreaking > 0 ? Math.max(0.4, 1 - chemState.emulsionBreaking * 0.6) : 1;
    const oilMoisture = clamp(
      baseOilMoisture * gForceEffect * tempEffect * demulsifierMoistureEffect + gaussianRandom(0, 1),
      1, 25
    );

    // SLUDGE/CF CAKE MOISTURE (% v/v water in solids cake)
    // Water content in centrifuge cake depends on:
    // - G-force (higher = better dewatering)
    // - Solids compaction (differential speed)
    // - Flocculant effectiveness (better flocs = better dewatering)
    // - Particle size distribution (fines hold more water)
    // Typical range: 20-50% v/v, target <40%
    const baseSludgeMoisture = 35; // % baseline moisture
    const gForceSludgeEffect = Math.max(0.6, 1 - (gForce - 2000) / 8000); // Higher G = better dewatering
    const flocEffect = chemState.flocDiameter > 1 ? Math.max(0.7, 1 - (chemState.flocDiameter - 1) * 0.15) : 1;
    const finesEffect = feedProps.solidsD10 < 20 ? 1.2 : 1.0; // Fine particles retain more water
    const sludgeMoisture = clamp(
      baseSludgeMoisture * gForceSludgeEffect * flocEffect * finesEffect + gaussianRandom(0, 2),
      15, 60
    );

    return { oilEff, solidsEff, wq, gForce, pH, turbidity, oilMoisture, sludgeMoisture, effectiveVisc: effectiveVisc * 1000 }; // Return visc in mPa·s
  }, [equipment, feedProps, disturbances, chemState]);

  // FEED CHARACTERIZATION - Calculate Optimal Setpoints (Stokes Law)
  const calculateRecommendedSetpoints = useCallback(() => {
    const notes = [];
    const { oilViscosity, emulsionStability, oilDropletD50, solidsD50, waterDensity, oilDensity, solidsDensity, salinity, viscosityTempCoeff, oilFraction, interfacialTension } = feedProps;
    const { maxTemp, minRPM, maxRPM, maxFlow, bowlDiameter, bowlLength } = equipment;

    // Temperature: based on viscosity and emulsion stability
    let tempSP = oilViscosity > 200 ? Math.min(75, maxTemp) : oilViscosity > 100 ? Math.min(70, maxTemp) : oilViscosity > 50 ? 65 : 60;
    if (oilViscosity > 200) notes.push(`High viscosity (${oilViscosity} mPa·s) - max temp`);
    if (emulsionStability > 0.5) { tempSP = Math.min(tempSP + 5, maxTemp); notes.push(`Stable emulsion - increasing temp`); }

    // Effective viscosity at operating temperature (Arrhenius)
    const effectiveViscPaS = (oilViscosity * 0.001) * Math.exp(viscosityTempCoeff * (25 - tempSP) * 10);

    // Density differences
    const waterDensityAdj = waterDensity + salinity * 0.0007;
    const oilWaterDeltaRho = Math.abs(waterDensityAdj - oilDensity);
    const solidsWaterDeltaRho = solidsDensity - waterDensityAdj;
    if (oilWaterDeltaRho < 50) notes.push(`Low density diff (${oilWaterDeltaRho.toFixed(0)} kg/m³) - difficult separation`);

    // G-force target based on droplet size
    let targetG = oilDropletD50 < 15 ? 3500 : oilDropletD50 < 30 ? 2800 : oilDropletD50 < 50 ? 2200 : 1800;
    if (oilDropletD50 < 15) notes.push(`Small droplets (${oilDropletD50} μm) - high G needed`);
    if (emulsionStability > 0.6) { targetG = Math.min(targetG + 500, 4000); notes.push('High G for stable emulsion'); }

    // RPM from target G-force
    const r = bowlDiameter / 2000;
    let rpmSP = clamp(Math.sqrt(targetG * 9.81 / r) * 60 / (2 * Math.PI), minRPM, maxRPM);
    const actualG = Math.pow(rpmSP * 2 * Math.PI / 60, 2) * r / 9.81;
    const g = actualG * 9.81;

    // Stokes settling velocities
    const oilSettling = ((oilDropletD50 * 1e-6) ** 2 * oilWaterDeltaRho * g) / (18 * effectiveViscPaS);
    const solidsSettling = ((solidsD50 * 1e-6) ** 2 * solidsWaterDeltaRho * g) / (18 * effectiveViscPaS);

    // Flow rate from required residence time (target 90% efficiency)
    const separationDistance = r * 0.3;
    const bowlVolume = Math.PI * r * r * (bowlLength / 1000);
    const requiredResidence = Math.max(
      (1.88 * separationDistance) / Math.max(oilSettling, 1e-10),
      (1.88 * separationDistance) / Math.max(solidsSettling, 1e-10)
    );
    const optimalFlow = (bowlVolume / requiredResidence) * 3600;
    const flowSP = clamp(optimalFlow, 5, maxFlow);
    if (flowSP < optimalFlow * 0.9) notes.push(`Flow limited by equipment (optimal: ${optimalFlow.toFixed(1)} m³/h)`);

    // Demulsifier dose based on emulsion stability
    let demulsifierDose = emulsionStability < 0.2 ? 20 : emulsionStability < 0.4 ? 50 : emulsionStability < 0.6 ? 100 : emulsionStability < 0.8 ? 150 : 200;
    if (emulsionStability >= 0.8) notes.push('Very stable emulsion - max demulsifier');
    if (interfacialTension < 15) { demulsifierDose = Math.round(demulsifierDose * 1.3); notes.push('Low IFT - increased demulsifier'); }

    // Performance prediction (Sigma theory with logistic efficiency)
    const actualResidence = bowlVolume / (flowSP / 3600);
    const logistic = (dist) => 100 / (1 + Math.exp(-2.5 * (dist / separationDistance - 1)));
    let oilEfficiency = logistic(oilSettling * actualResidence) * (1 - emulsionStability * 0.2 * (1 - demulsifierDose / 250));
    let solidsEfficiency = logistic(solidsSettling * actualResidence);
    const tempFactor = 1 + (tempSP - 50) * 0.005;
    oilEfficiency = Math.min(99, oilEfficiency * tempFactor);
    solidsEfficiency = Math.min(99.5, solidsEfficiency * tempFactor);
    const predictedOiW = (oilFraction * 1e6) * (1 - oilEfficiency / 100);

    // Confidence assessment
    let score = 100;
    if (oilWaterDeltaRho < 50) score -= 30; else if (oilWaterDeltaRho < 80) score -= 15;
    if (emulsionStability > 0.7) score -= 20;
    if (oilViscosity > 500) score -= 15;
    if (oilDropletD50 < 10) score -= 20;
    const confidence = score >= 70 ? 'High' : score >= 50 ? 'Medium' : 'Low';
    if (confidence === 'Low') notes.push('Difficult feed - pilot testing recommended');

    // Update state (preserve toggle states)
    setSetpointCalc(p => ({
      ...p, calculated: true,
      temperature: Math.round(tempSP * 10) / 10,
      flowRate: Math.round(flowSP * 10) / 10,
      bowlSpeed: Math.round(rpmSP),
      demulsifierDose,
      predictedOilEfficiency: Math.round(oilEfficiency * 10) / 10,
      predictedSolidsEfficiency: Math.round(solidsEfficiency * 10) / 10,
      predictedWaterQuality: Math.round(predictedOiW),
      predictedGForce: Math.round(actualG),
      confidence, notes,
    }));
  }, [feedProps, equipment]);

  // Apply calculated setpoints to control loops (with debounce and individual toggles)
  const applyRecommendedSetpoints = useCallback((immediate = false) => {
    if (!setpointCalc.calculated) return;

    const now = Date.now();
    const timeSinceLastApply = now - lastSetpointApplyTime.current;

    // Clear any pending debounced apply
    if (setpointDebounceRef.current) {
      clearTimeout(setpointDebounceRef.current);
      setpointDebounceRef.current = null;
    }

    // If not immediate and within debounce window, schedule for later
    if (!immediate && timeSinceLastApply < SETPOINT_DEBOUNCE_MS) {
      const remainingDelay = SETPOINT_DEBOUNCE_MS - timeSinceLastApply;
      setpointDebounceRef.current = setTimeout(() => {
        applyRecommendedSetpoints(true);
      }, remainingDelay);
      return;
    }

    // Apply only toggled setpoints
    setLoops(p => ({
      ...p,
      ...(setpointCalc.applyTemp && { TIC: { ...p.TIC, sp: setpointCalc.temperature } }),
      ...(setpointCalc.applyFlow && { FIC: { ...p.FIC, sp: setpointCalc.flowRate } }),
      ...(setpointCalc.applySpeed && { SIC: { ...p.SIC, sp: setpointCalc.bowlSpeed } }),
    }));

    // Apply demulsifier dose if toggled
    if (setpointCalc.applyDemul) {
      setChemDosing(p => ({
        ...p,
        demulsifier: { ...p.demulsifier, sp: setpointCalc.demulsifierDose },
      }));
    }

    lastSetpointApplyTime.current = now;
  }, [setpointCalc]);

  // ═══════════════════════════════════════════════════════════════════════
  // CHEMICAL DOSING CALCULATIONS - Scientific Models
  // ═══════════════════════════════════════════════════════════════════════
  const calcChemicalDosing = useCallback((dt, feedFlow, waterFrac, oilFrac, solidsFrac, temp, currentPH) => {
    const flowM3h = feedFlow;
    const flowLh = flowM3h * 1000; // L/h
    const R = 8.314; // Gas constant J/(mol·K)
    const tempK = temp + 273.15;

    const newDosing = { ...chemDosing };
    const newChemState = { ...chemState };
    const newChemCosts = { ...chemCosts };

    // ════════════════════════════════════════════════════════════════
    // 1. DEMULSIFIER DOSING - Langmuir Adsorption Model
    // ════════════════════════════════════════════════════════════════
    if (newDosing.demulsifier.enabled && flowM3h > 0) {
      const cfg = CONFIG.chemicals.demulsifier;
      let targetDose = newDosing.demulsifier.sp;

      // Mode-dependent setpoint calculation
      if (newDosing.demulsifier.mode === 'RATIO') {
        // Dose proportional to oil content (more oil = more emulsion = more demulsifier)
        targetDose = newDosing.demulsifier.ratio * oilFrac * 100;
      } else if (newDosing.demulsifier.mode === 'FEEDBACK') {
        // PID control based on emulsion breaking efficiency
        const err = newDosing.demulsifier.sp - newChemState.emulsionBreaking * 100;
        const pid = calcPID(newDosing.demulsifier, newChemState.emulsionBreaking * 100, dt);
        targetDose = clamp(pid.op * cfg.maxDose / 100, cfg.minDose, cfg.maxDose);
        newDosing.demulsifier.int = pid.int;
        newDosing.demulsifier.lastErr = pid.lastErr;
      } else if (newDosing.demulsifier.mode === 'ADAPTIVE') {
        // Adaptive dosing based on feed properties and temperature
        const emulsionFactor = feedProps.emulsionStability;
        const viscFactor = Math.min(2, feedProps.oilViscosity / 50);
        const tempFactor = Math.exp(cfg.activationEnergy / R * (1 / (cfg.tempOptimal + 273.15) - 1 / tempK));
        targetDose = cfg.optimalRange.min + (cfg.optimalRange.max - cfg.optimalRange.min) * emulsionFactor * viscFactor * tempFactor;
      }

      targetDose = clamp(targetDose, cfg.minDose, cfg.maxDose);

      // Langmuir isotherm: θ = KC / (1 + KC) where θ is surface coverage
      const K = cfg.langmuirK * Math.exp(-cfg.activationEnergy / R * (1 / tempK - 1 / (cfg.tempOptimal + 273.15)));
      const surfaceCoverage = (K * targetDose) / (1 + K * targetDose);
      newDosing.demulsifier.surfaceCoverage = surfaceCoverage;

      // Effectiveness = surface coverage × max effectiveness
      const effectiveness = surfaceCoverage * cfg.langmuirQmax;
      newDosing.demulsifier.effectiveness = effectiveness;

      // Calculate pump rate needed (L/h)
      // ppm = (dose_rate_L/h × concentration × 1000) / (flow_L/h)
      // dose_rate = (ppm × flow_L/h) / (concentration × 1000)
      const pumpRate = (targetDose * flowLh) / (cfg.concentration * 10000);
      const actualPumpRate = clamp(pumpRate, 0, cfg.pumpCapacity);
      const actualDose = (actualPumpRate * cfg.concentration * 10000) / flowLh;

      newDosing.demulsifier.pv = actualDose;
      newDosing.demulsifier.pumpRate = actualPumpRate;
      newDosing.demulsifier.op = (actualPumpRate / cfg.pumpCapacity) * 100;

      // Update inventory and costs
      const usedLiters = actualPumpRate * dt / 3600;
      newDosing.demulsifier.inventory = Math.max(0, newDosing.demulsifier.inventory - usedLiters);
      newDosing.demulsifier.totalUsed += usedLiters;
      newChemCosts.demulsifier += usedLiters * cfg.costPerLiter;

      // Update emulsion breaking state
      newChemState.emulsionBreaking = clamp(
        effectiveness * (1 - feedProps.emulsionStability * 0.5) +
        (temp - 40) * 0.005 + // Temperature helps
        gaussianRandom(0, 0.02),
        0, 1
      );
    }

    // ════════════════════════════════════════════════════════════════
    // 2. FLOCCULANT DOSING - Smoluchowski Kinetics
    // ════════════════════════════════════════════════════════════════
    if (newDosing.flocculant.enabled && flowM3h > 0 && solidsFrac > 0.001) {
      const cfg = CONFIG.chemicals.flocculant;
      let targetDose = newDosing.flocculant.sp;

      if (newDosing.flocculant.mode === 'RATIO') {
        // Dose proportional to solids content
        targetDose = newDosing.flocculant.ratio * solidsFrac * 100;
      } else if (newDosing.flocculant.mode === 'FEEDBACK') {
        // PID based on turbidity
        const err = newDosing.flocculant.sp - newChemState.flocDiameter / feedProps.solidsD50;
        const pid = calcPID(newDosing.flocculant, newChemState.flocDiameter / feedProps.solidsD50, dt);
        targetDose = clamp(pid.op * cfg.maxDose / 100, cfg.minDose, cfg.maxDose);
        newDosing.flocculant.int = pid.int;
        newDosing.flocculant.lastErr = pid.lastErr;
      }

      targetDose = clamp(targetDose, cfg.minDose, cfg.maxDose);

      // Smoluchowski flocculation: rate ∝ collision efficiency × concentration²
      // Bridging factor increases effective particle size
      const collisionRate = cfg.collisionEfficiency * (solidsFrac * 100) ** 1.5;

      // Check for overdose (restabilization occurs)
      const overdoseFactor = targetDose > cfg.overdoseThreshold
        ? Math.max(0.3, 1 - (targetDose - cfg.overdoseThreshold) / cfg.overdoseThreshold)
        : 1;

      const flocSizeMultiplier = 1 + cfg.bridgingFactor * Math.min(1, targetDose / cfg.optimalRange.max) * overdoseFactor;
      newDosing.flocculant.flocSize = flocSizeMultiplier;
      newChemState.flocDiameter = feedProps.solidsD50 * flocSizeMultiplier;

      // Calculate pump rate
      const pumpRate = (targetDose * flowLh) / (cfg.concentration * 10000);
      const actualPumpRate = clamp(pumpRate, 0, cfg.pumpCapacity);
      const actualDose = flowLh > 0 ? (actualPumpRate * cfg.concentration * 10000) / flowLh : 0;

      newDosing.flocculant.pv = actualDose;
      newDosing.flocculant.pumpRate = actualPumpRate;
      newDosing.flocculant.op = (actualPumpRate / cfg.pumpCapacity) * 100;
      newDosing.flocculant.effectiveness = cfg.collisionEfficiency * overdoseFactor;

      const usedLiters = actualPumpRate * dt / 3600;
      newDosing.flocculant.inventory = Math.max(0, newDosing.flocculant.inventory - usedLiters);
      newDosing.flocculant.totalUsed += usedLiters;
      newChemCosts.flocculant += usedLiters * cfg.costPerLiter;
    }

    // ════════════════════════════════════════════════════════════════
    // 3. COAGULANT DOSING - Schulze-Hardy Rule / Zeta Potential
    // ════════════════════════════════════════════════════════════════
    if (newDosing.coagulant.enabled && flowM3h > 0) {
      const cfg = CONFIG.chemicals.coagulant;
      let targetDose = newDosing.coagulant.sp;

      if (newDosing.coagulant.mode === 'RATIO') {
        targetDose = newDosing.coagulant.ratio * (oilFrac + solidsFrac) * 100;
      } else if (newDosing.coagulant.mode === 'FEEDBACK') {
        // PID control targeting zeta potential = 0
        const err = 0 - newChemState.zetaPotential; // Target is 0 mV
        const pid = calcPID({ ...newDosing.coagulant, sp: 0 }, newChemState.zetaPotential, dt);
        targetDose = clamp(Math.abs(err) * 2, cfg.minDose, cfg.maxDose);
        newDosing.coagulant.int = pid.int;
        newDosing.coagulant.lastErr = pid.lastErr;
      }

      targetDose = clamp(targetDose, cfg.minDose, cfg.maxDose);

      // Schulze-Hardy: Critical coagulation concentration ∝ 1/z⁶
      // Fe³⁺ (z=3) is much more effective than Ca²⁺ (z=2)
      const chargeNeutralization = targetDose / (cfg.optimalRange.max * Math.pow(cfg.chargeValence, -2));

      // Zeta potential moves toward zero with dosing
      const baseZeta = -25 - feedProps.salinity * 0.0001; // Higher salinity = more negative
      newChemState.zetaPotential = baseZeta * (1 - Math.min(1, chargeNeutralization));
      newDosing.coagulant.zetaPotential = newChemState.zetaPotential;

      // Effectiveness peaks when zeta ≈ 0
      newDosing.coagulant.effectiveness = 1 - Math.abs(newChemState.zetaPotential) / 25;

      const pumpRate = (targetDose * flowLh) / (cfg.concentration * 10000);
      const actualPumpRate = clamp(pumpRate, 0, cfg.pumpCapacity);
      const actualDose = flowLh > 0 ? (actualPumpRate * cfg.concentration * 10000) / flowLh : 0;

      newDosing.coagulant.pv = actualDose;
      newDosing.coagulant.pumpRate = actualPumpRate;
      newDosing.coagulant.op = (actualPumpRate / cfg.pumpCapacity) * 100;

      const usedLiters = actualPumpRate * dt / 3600;
      newDosing.coagulant.inventory = Math.max(0, newDosing.coagulant.inventory - usedLiters);
      newDosing.coagulant.totalUsed += usedLiters;
      newChemCosts.coagulant += usedLiters * cfg.costPerLiter;
    }

    // ════════════════════════════════════════════════════════════════
    // 4. pH CONTROL - Henderson-Hasselbalch / Buffer Chemistry
    // ════════════════════════════════════════════════════════════════
    const pHSetpoint = newDosing.acid.sp; // Both acid and caustic use same setpoint
    const pHError = pHSetpoint - currentPH;

    if (newDosing.acid.enabled && pHError < -0.1 && flowM3h > 0) {
      // pH too high, need acid
      const cfg = CONFIG.chemicals.acid;

      // Henderson-Hasselbalch: pH = pKa + log([A-]/[HA])
      // Required acid to shift pH: mol/L = buffer_capacity × ΔpH
      const requiredMolPerL = cfg.bufferCapacity * Math.abs(pHError);
      const requiredGPerL = requiredMolPerL * cfg.equivalentWeight;
      const requiredMLPerM3 = (requiredGPerL * 1000) / (cfg.density * cfg.concentration / 100);

      const targetDose = clamp(requiredMLPerM3, cfg.minDose, cfg.maxDose);
      const pumpRate = (targetDose * flowM3h) / 1000; // L/h
      const actualPumpRate = clamp(pumpRate, 0, cfg.pumpCapacity);

      newDosing.acid.pv = (actualPumpRate * 1000) / flowM3h;
      newDosing.acid.pumpRate = actualPumpRate;
      newDosing.acid.op = (actualPumpRate / cfg.pumpCapacity) * 100;

      const usedLiters = actualPumpRate * dt / 3600;
      newDosing.acid.inventory = Math.max(0, newDosing.acid.inventory - usedLiters);
      newDosing.acid.totalUsed += usedLiters;
      newChemCosts.acid += usedLiters * cfg.costPerLiter;
    } else {
      newDosing.acid.pv = 0;
      newDosing.acid.pumpRate = 0;
      newDosing.acid.op = 0;
    }

    if (newDosing.caustic.enabled && pHError > 0.1 && flowM3h > 0) {
      // pH too low, need caustic
      const cfg = CONFIG.chemicals.caustic;

      const requiredMolPerL = cfg.bufferCapacity * Math.abs(pHError);
      const requiredGPerL = requiredMolPerL * cfg.equivalentWeight;
      const requiredMLPerM3 = (requiredGPerL * 1000) / (cfg.density * cfg.concentration / 100);

      const targetDose = clamp(requiredMLPerM3, cfg.minDose, cfg.maxDose);
      const pumpRate = (targetDose * flowM3h) / 1000;
      const actualPumpRate = clamp(pumpRate, 0, cfg.pumpCapacity);

      newDosing.caustic.pv = (actualPumpRate * 1000) / flowM3h;
      newDosing.caustic.pumpRate = actualPumpRate;
      newDosing.caustic.op = (actualPumpRate / cfg.pumpCapacity) * 100;

      const usedLiters = actualPumpRate * dt / 3600;
      newDosing.caustic.inventory = Math.max(0, newDosing.caustic.inventory - usedLiters);
      newDosing.caustic.totalUsed += usedLiters;
      newChemCosts.caustic += usedLiters * cfg.costPerLiter;
    } else {
      newDosing.caustic.pv = 0;
      newDosing.caustic.pumpRate = 0;
      newDosing.caustic.op = 0;
    }

    // ════════════════════════════════════════════════════════════════
    // 5. SCALE INHIBITOR - Threshold Inhibition
    // ════════════════════════════════════════════════════════════════
    if (newDosing.scaleInhibitor.enabled && flowM3h > 0) {
      const cfg = CONFIG.chemicals.scaleInhibitor;
      let targetDose = newDosing.scaleInhibitor.ratio; // Usually fixed dose

      // Langelier Saturation Index (simplified)
      // LSI = pH - pHs where pHs = f(TDS, temp, Ca, alkalinity)
      const pHs = 7.5 - Math.log10(feedProps.salinity / 1000 + 1) + (temp - 25) * 0.01;
      const LSI = currentPH - pHs;
      newDosing.scaleInhibitor.scalingIndex = LSI;
      newChemState.scalingRisk = clamp(LSI / cfg.saturationIndex, 0, 1);

      // Increase dose if scaling risk is high
      if (newDosing.scaleInhibitor.mode === 'ADAPTIVE') {
        targetDose = cfg.optimalRange.min + (cfg.optimalRange.max - cfg.optimalRange.min) * newChemState.scalingRisk;
      }

      targetDose = clamp(targetDose, cfg.minDose, cfg.maxDose);

      const pumpRate = (targetDose * flowLh) / (cfg.concentration * 10000);
      const actualPumpRate = clamp(pumpRate, 0, cfg.pumpCapacity);
      const actualDose = flowLh > 0 ? (actualPumpRate * cfg.concentration * 10000) / flowLh : 0;

      newDosing.scaleInhibitor.pv = actualDose;
      newDosing.scaleInhibitor.pumpRate = actualPumpRate;
      newDosing.scaleInhibitor.op = (actualPumpRate / cfg.pumpCapacity) * 100;
      newDosing.scaleInhibitor.effectiveness = targetDose >= cfg.optimalRange.min ? cfg.inhibitionEfficiency : targetDose / cfg.optimalRange.min;

      const usedLiters = actualPumpRate * dt / 3600;
      newDosing.scaleInhibitor.inventory = Math.max(0, newDosing.scaleInhibitor.inventory - usedLiters);
      newDosing.scaleInhibitor.totalUsed += usedLiters;
      newChemCosts.scaleInhibitor += usedLiters * cfg.costPerLiter;
    }

    // ════════════════════════════════════════════════════════════════
    // 6. ANTIFOAM DOSING
    // ════════════════════════════════════════════════════════════════
    if (newDosing.antifoam.enabled && flowM3h > 0) {
      const cfg = CONFIG.chemicals.antifoam;
      let targetDose = newDosing.antifoam.sp;

      // Foam generation based on agitation, surfactants (oil), and gas
      const foamGeneration = (feedProps.dissolvedGas / 10) * oilFrac * 5 + 0.1;

      // Foam breaking with persistence decay
      const foamBreaking = targetDose > 0 ? Math.min(1, targetDose / cfg.optimalRange.max) * cfg.persistenceFactor : 0;
      newChemState.foamHeight = clamp(
        newChemState.foamHeight + (foamGeneration - foamBreaking) * dt * 0.01,
        0, 1
      );
      newDosing.antifoam.foamLevel = newChemState.foamHeight;

      // Adaptive mode increases dose when foam is high
      if (newDosing.antifoam.mode === 'FEEDBACK') {
        const err = 0.1 - newChemState.foamHeight; // Target low foam
        targetDose = clamp(cfg.optimalRange.min - err * 100, cfg.minDose, cfg.maxDose);
      }

      targetDose = clamp(targetDose, cfg.minDose, cfg.maxDose);

      const pumpRate = (targetDose * flowLh) / (cfg.concentration * 10000);
      const actualPumpRate = clamp(pumpRate, 0, cfg.pumpCapacity);
      const actualDose = flowLh > 0 ? (actualPumpRate * cfg.concentration * 10000) / flowLh : 0;

      newDosing.antifoam.pv = actualDose;
      newDosing.antifoam.pumpRate = actualPumpRate;
      newDosing.antifoam.op = (actualPumpRate / cfg.pumpCapacity) * 100;
      newDosing.antifoam.effectiveness = foamBreaking;

      const usedLiters = actualPumpRate * dt / 3600;
      newDosing.antifoam.inventory = Math.max(0, newDosing.antifoam.inventory - usedLiters);
      newDosing.antifoam.totalUsed += usedLiters;
      newChemCosts.antifoam += usedLiters * cfg.costPerLiter;
    }

    // Calculate total chemical costs
    newChemCosts.total = Object.keys(newChemCosts).reduce((sum, key) =>
      key !== 'total' ? sum + newChemCosts[key] : sum, 0
    );

    // Calculate mixing efficiency based on flow and residence time
    newChemState.residenceTime = flowM3h > 0 ? (Math.PI * (equipment.bowlDiameter / 2000) ** 2 * (equipment.bowlLength / 1000)) / (flowM3h / 3600) : 30;
    newChemState.mixingEfficiency = clamp(0.7 + newChemState.residenceTime * 0.005 - flowM3h * 0.01, 0.5, 0.98);

    return { dosing: newDosing, chemState: newChemState, chemCosts: newChemCosts };
  }, [chemDosing, chemState, chemCosts, equipment, feedProps, calcPID]);

  // ═══════════════════════════════════════════════════════════════════════
  // SPDD1600 POLISHING FILTER CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════════
  const calcPolishingFilter = useCallback((dt, waterOutFlow, turbidityIn, oilInWaterIn, simTime) => {
    const cfg = CONFIG.polishingFilter;
    const newFilter = { ...polishingFilter };
    const newCosts = { ...filterCosts };

    if (!newFilter.enabled || newFilter.status === 'OFFLINE') {
      newFilter.outletFlow = 0;
      newFilter.outletTurbidity = turbidityIn;
      newFilter.outletOiW = oilInWaterIn;
      // No treatment - TRH and COD pass through at inlet levels
      const dissolvedHC = oilInWaterIn * 0.30;
      const passThroughTRH = oilInWaterIn + dissolvedHC;
      const passThroughCOD = (oilInWaterIn * 3.5) + 75; // oil×3.5 + background organics
      newFilter.outletTRH = passThroughTRH;
      newFilter.outletCOD = passThroughCOD;
      return { filter: newFilter, costs: newCosts, toPond: { flow: waterOutFlow, turbidity: turbidityIn, oiw: oilInWaterIn, trh: passThroughTRH, cod: passThroughCOD } };
    }

    // ════════════════════════════════════════════════════════════════
    // BACKWASH MODE
    // ════════════════════════════════════════════════════════════════
    if (newFilter.status === 'BACKWASH') {
      newFilter.backwashRemaining -= dt;

      // Backwash water consumption
      const backwashFlow = cfg.backwashRates.min; // m³/h
      const backwashWaterUsed = (backwashFlow / 3600) * dt; // m³
      newFilter.totalBackwashWater += backwashWaterUsed;

      // Electricity cost for backwash pump
      const energyUsed = (cfg.costs.pumpPower / 3600) * dt; // kWh
      newCosts.electricity += energyUsed * cfg.costs.electricityCost;
      newCosts.backwashWater += backwashWaterUsed * cfg.costs.backwashWaterCost;

      // During backwash, no filtration - water bypasses to pond
      newFilter.outletFlow = 0;
      newFilter.outletTurbidity = turbidityIn;
      newFilter.outletOiW = oilInWaterIn;
      // No treatment during backwash - calculate bypass TRH/COD
      const bypassDissolvedHC = oilInWaterIn * 0.30;
      newFilter.outletTRH = oilInWaterIn + bypassDissolvedHC;
      newFilter.outletCOD = (oilInWaterIn * 3.5) + 75;

      if (newFilter.backwashRemaining <= 0) {
        // Backwash complete - reset bed
        newFilter.status = 'FILTERING';
        newFilter.bedLoading = newFilter.bedLoading * 0.05; // 95% solids removed
        newFilter.bedSaturation = (newFilter.bedLoading / newFilter.bedCapacity) * 100;
        newFilter.differentialPressure = 0.2; // Reset ΔP
        newFilter.filterCycles += 1;
        newFilter.lastBackwash = simTime;
      }

      newCosts.total = newCosts.backwashWater + newCosts.electricity;
      return { filter: newFilter, costs: newCosts, toPond: { flow: waterOutFlow, turbidity: turbidityIn, oiw: oilInWaterIn, trh: newFilter.outletTRH, cod: newFilter.outletCOD } };
    }

    // ════════════════════════════════════════════════════════════════
    // FILTERING MODE - Deep Bed Filtration Model
    // ════════════════════════════════════════════════════════════════
    newFilter.inletFlow = waterOutFlow;
    newFilter.inletTurbidity = turbidityIn;
    newFilter.inletOiW = oilInWaterIn;

    // Check if flow exceeds filter capacity
    const maxFlow = cfg.flowRates.max;
    const actualFlow = Math.min(waterOutFlow, maxFlow);
    const bypassFlow = waterOutFlow > maxFlow ? waterOutFlow - maxFlow : 0;

    // Filtration efficiency - decreases as bed loads up (Iwasaki model)
    // λ = λ₀ × (1 - σ/σ_max)^n where σ is specific deposit
    const loadingFactor = 1 - Math.pow(newFilter.bedSaturation / 100, 0.7);
    const mediaFactor = newFilter.mediaCondition / 100;

    // Flow velocity affects efficiency (higher flow = lower efficiency)
    const velocityFactor = actualFlow > 0
      ? Math.max(0.7, 1 - (actualFlow / maxFlow) * 0.3)
      : 1;

    // Turbidity removal - based on bed depth and particle capture
    const baseTurbidityRemoval = cfg.operating.turbidityRemoval;
    newFilter.turbidityRemoval = baseTurbidityRemoval * loadingFactor * mediaFactor * velocityFactor * 100;

    // Oil-in-water removal - coalescence and adsorption
    const baseOilRemoval = cfg.operating.oilRemoval;
    newFilter.oilRemoval = baseOilRemoval * loadingFactor * mediaFactor * velocityFactor * 100;

    // Calculate outlet quality
    const filteredTurbidity = turbidityIn * (1 - newFilter.turbidityRemoval / 100);
    const filteredOiW = oilInWaterIn * (1 - newFilter.oilRemoval / 100);

    // Mix filtered flow with bypass flow (if any)
    if (bypassFlow > 0 && waterOutFlow > 0) {
      const filteredFraction = actualFlow / waterOutFlow;
      const bypassFraction = bypassFlow / waterOutFlow;
      newFilter.outletTurbidity = filteredTurbidity * filteredFraction + turbidityIn * bypassFraction;
      newFilter.outletOiW = filteredOiW * filteredFraction + oilInWaterIn * bypassFraction;
    } else {
      newFilter.outletTurbidity = filteredTurbidity;
      newFilter.outletOiW = filteredOiW;
    }

    newFilter.outletFlow = waterOutFlow;

    // Bed loading accumulation
    // Solids captured = inlet concentration × flow × removal efficiency
    const turbidityToSolids = 0.001; // kg solids per NTU per m³ (approximation)
    const solidsRemoved = (turbidityIn - newFilter.outletTurbidity) * turbidityToSolids * (actualFlow / 3600) * dt;
    const oilRemoved = (oilInWaterIn - newFilter.outletOiW) * 1e-6 * 900 * (actualFlow / 3600) * dt; // kg (900 kg/m³ oil density)

    newFilter.bedLoading += solidsRemoved + oilRemoved * 0.5; // Oil partially retained
    newFilter.bedSaturation = (newFilter.bedLoading / newFilter.bedCapacity) * 100;
    newFilter.totalSolidsRemoved += solidsRemoved;
    newFilter.totalOilRemoved += oilRemoved;

    // Differential pressure increases with bed loading (Carman-Kozeny equation simplified)
    // ΔP ∝ (1 + k × σ) where σ is bed loading
    const baseDP = 0.2; // bar clean bed
    newFilter.differentialPressure = baseDP * (1 + (newFilter.bedSaturation / 100) * 6);

    // Pressure readings
    newFilter.outletPressure = newFilter.inletPressure - newFilter.differentialPressure;

    // Totals
    newFilter.totalFiltered += (actualFlow / 3600) * dt;
    newFilter.runHours += dt / 3600;

    // ════════════════════════════════════════════════════════════════
    // TRH (Total Recoverable Hydrocarbons) - Scientific Model
    // TRH = dispersed oil (OiW) + dissolved hydrocarbons
    // Dissolved fraction typically 20-40% of total in produced water
    // GAC adsorbs dissolved hydrocarbons via activated carbon porosity
    // ════════════════════════════════════════════════════════════════
    const dissolvedHCFraction = 0.30; // 30% of hydrocarbons are dissolved (typical oilfield)
    const inletDissolvedHC = oilInWaterIn * dissolvedHCFraction;
    newFilter.inletTRH = oilInWaterIn + inletDissolvedHC; // TRH = OiW + dissolved

    // GAC adsorption of dissolved hydrocarbons (Freundlich isotherm simplified)
    // Removal efficiency depends on: contact time, GAC condition, loading
    const gacAdsorptionEff = 0.85 * loadingFactor * mediaFactor; // 85% base removal
    const outletDissolvedHC = inletDissolvedHC * (1 - gacAdsorptionEff);
    newFilter.outletTRH = newFilter.outletOiW + outletDissolvedHC;
    newFilter.trhRemoval = oilInWaterIn > 0
      ? ((newFilter.inletTRH - newFilter.outletTRH) / newFilter.inletTRH) * 100
      : 0;

    // ════════════════════════════════════════════════════════════════
    // COD (Chemical Oxygen Demand) - Stoichiometric Model
    // COD measures O₂ required to oxidize all organic matter
    // Hydrocarbon stoichiometry: CₙH₂ₙ₊₂ + (3n+1)/2 O₂ → nCO₂ + (n+1)H₂O
    // For petroleum: COD ≈ 3.5 g O₂ per g hydrocarbon (empirical)
    // Additional COD from: chemical additives, dissolved organics, bacteria
    // ════════════════════════════════════════════════════════════════
    const codPerGramOil = 3.5;           // g O₂/g oil (stoichiometric for alkanes)
    const backgroundCOD = 50;            // mg/L from dissolved organics, bacteria
    const chemicalCOD = 25;              // mg/L from treatment chemicals

    // Inlet COD = oil contribution + dissolved organics + chemicals
    newFilter.inletCOD = (oilInWaterIn * codPerGramOil) + backgroundCOD + chemicalCOD;

    // GAC removes some dissolved organics (not just hydrocarbons)
    // COD removal efficiency lower than TRH (some organics not adsorbable)
    const codRemovalEff = 0.55 * loadingFactor * mediaFactor; // 55% base removal
    const residualOrganics = (backgroundCOD + chemicalCOD) * (1 - codRemovalEff * 0.7);
    newFilter.outletCOD = (newFilter.outletOiW * codPerGramOil) + residualOrganics;
    newFilter.codRemoval = newFilter.inletCOD > 0
      ? ((newFilter.inletCOD - newFilter.outletCOD) / newFilter.inletCOD) * 100
      : 0;

    // Auto-backwash trigger
    if (newFilter.autoBackwash && newFilter.differentialPressure >= newFilter.backwashTriggerDP) {
      newFilter.status = 'BACKWASH';
      newFilter.backwashRemaining = cfg.operating.backwashDuration;
      newFilter.backwashCount += 1;
    }

    // Media degradation (very slow - over years of operation)
    newFilter.mediaCondition = Math.max(50, 100 - newFilter.runHours * 0.001);

    newCosts.total = newCosts.backwashWater + newCosts.electricity;

    return {
      filter: newFilter,
      costs: newCosts,
      toPond: {
        flow: newFilter.outletFlow,
        turbidity: newFilter.outletTurbidity,
        oiw: newFilter.outletOiW,
        trh: newFilter.outletTRH,      // Total Recoverable Hydrocarbons (license parameter)
        cod: newFilter.outletCOD,      // Chemical Oxygen Demand (license parameter)
      }
    };
  }, [polishingFilter, filterCosts]);

  // ═══════════════════════════════════════════════════════════════
  //           AQC - AUTOMATIC QUALITY CONTROL LOGIC
  // ═══════════════════════════════════════════════════════════════
  const calcAQC = useCallback((currentQuality, simTime, dt) => {
    if (!aqc.enabled) return { status: 'DISABLED', actions: [], qualityScore: 100 };

    const { targets, actions: actionConfig, cooldowns, lastActionTime, mode } = aqc;
    const newCooldowns = { ...cooldowns };

    // Decrement cooldowns
    Object.keys(newCooldowns).forEach(k => {
      if (newCooldowns[k] > 0) newCooldowns[k] = Math.max(0, newCooldowns[k] - dt);
    });

    // Calculate quality scores for each parameter (100 = at target, 0 = at limit)
    const scores = {};
    const deviations = {};

    if (targets.oiw.enabled) {
      const limit = dischargeLimits.oilInWater;
      const target = targets.oiw.target;
      const value = currentQuality.oiw;
      const pctOfLimit = (value / limit) * 100;
      scores.oiw = Math.max(0, 100 - pctOfLimit);
      deviations.oiw = { value, target, limit, pctOfLimit, status: pctOfLimit >= targets.oiw.criticalPct ? 'CRITICAL' : pctOfLimit >= targets.oiw.warningPct ? 'WARNING' : 'OK' };
    }

    if (targets.trh.enabled) {
      const limit = dischargeLimits.trh;
      const target = targets.trh.target;
      const value = currentQuality.trh;
      const pctOfLimit = (value / limit) * 100;
      scores.trh = Math.max(0, 100 - pctOfLimit);
      deviations.trh = { value, target, limit, pctOfLimit, status: pctOfLimit >= targets.trh.criticalPct ? 'CRITICAL' : pctOfLimit >= targets.trh.warningPct ? 'WARNING' : 'OK' };
    }

    if (targets.cod.enabled) {
      const limit = dischargeLimits.cod;
      const target = targets.cod.target;
      const value = currentQuality.cod;
      const pctOfLimit = (value / limit) * 100;
      scores.cod = Math.max(0, 100 - pctOfLimit);
      deviations.cod = { value, target, limit, pctOfLimit, status: pctOfLimit >= targets.cod.criticalPct ? 'CRITICAL' : pctOfLimit >= targets.cod.warningPct ? 'WARNING' : 'OK' };
    }

    if (targets.turbidity.enabled) {
      const limit = dischargeLimits.turbidity;
      const target = targets.turbidity.target;
      const value = currentQuality.turbidity;
      const pctOfLimit = (value / limit) * 100;
      scores.turbidity = Math.max(0, 100 - pctOfLimit);
      deviations.turbidity = { value, target, limit, pctOfLimit, status: pctOfLimit >= targets.turbidity.criticalPct ? 'CRITICAL' : pctOfLimit >= targets.turbidity.warningPct ? 'WARNING' : 'OK' };
    }

    if (targets.pH.enabled) {
      const { min, max } = dischargeLimits.pH;
      const { targetMin, targetMax } = targets.pH;
      const value = currentQuality.pH;
      const midTarget = (targetMin + targetMax) / 2;
      const deviation = Math.abs(value - midTarget);
      const maxDeviation = Math.max(midTarget - min, max - midTarget);
      const pctOfLimit = (deviation / maxDeviation) * 100;
      scores.pH = Math.max(0, 100 - pctOfLimit);
      deviations.pH = {
        value, targetMin, targetMax,
        status: value < min || value > max ? 'CRITICAL' : value < targetMin || value > targetMax ? 'WARNING' : 'OK'
      };
    }

    // Calculate overall quality score (weighted average)
    const scoreValues = Object.values(scores);
    const qualityScore = scoreValues.length > 0 ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length : 100;

    // Determine overall status
    const statuses = Object.values(deviations).map(d => d.status);
    let status = 'OK';
    if (statuses.includes('CRITICAL')) status = 'ALARM';
    else if (statuses.includes('WARNING')) status = 'WARNING';

    // Determine corrective actions needed (only in AUTO or ADVISORY mode)
    const recommendedActions = [];
    const criticalParams = Object.entries(deviations).filter(([_, d]) => d.status === 'CRITICAL');
    const warningParams = Object.entries(deviations).filter(([_, d]) => d.status === 'WARNING');

    // Priority-based action selection for oil/hydrocarbon issues
    const oilIssue = ['oiw', 'trh', 'cod'].some(p => deviations[p]?.status === 'CRITICAL' || deviations[p]?.status === 'WARNING');
    const turbidityIssue = deviations.turbidity?.status === 'CRITICAL' || deviations.turbidity?.status === 'WARNING';

    if (oilIssue) {
      // For oil-related issues: increase temp, increase speed, reduce flow, increase demulsifier
      if (actionConfig.increaseTemp.enabled && newCooldowns.increaseTemp <= 0) {
        const currentSP = loops.TIC.sp;
        const maxSP = currentSP + actionConfig.increaseTemp.maxIncrease;
        if (currentSP < Math.min(equipment.heaterMaxTemp - 5, maxSP)) {
          recommendedActions.push({
            type: 'increaseTemp',
            action: `Increase heater SP by ${actionConfig.increaseTemp.stepSize}°C`,
            reason: 'High oil/hydrocarbon in discharge',
            newValue: Math.min(currentSP + actionConfig.increaseTemp.stepSize, equipment.heaterMaxTemp - 5),
            priority: criticalParams.length > 0 ? 1 : 2,
          });
        }
      }

      if (actionConfig.increaseSpeed.enabled && newCooldowns.increaseSpeed <= 0) {
        const currentSP = loops.SIC.sp;
        const maxSP = currentSP + actionConfig.increaseSpeed.maxIncrease;
        if (currentSP < Math.min(equipment.maxRPM - 200, maxSP)) {
          recommendedActions.push({
            type: 'increaseSpeed',
            action: `Increase bowl speed SP by ${actionConfig.increaseSpeed.stepSize} RPM`,
            reason: 'Improve separation G-force',
            newValue: Math.min(currentSP + actionConfig.increaseSpeed.stepSize, equipment.maxRPM - 200),
            priority: criticalParams.length > 0 ? 2 : 3,
          });
        }
      }

      if (actionConfig.reduceFlow.enabled && newCooldowns.reduceFlow <= 0) {
        const currentSP = loops.FIC.sp;
        const minSP = currentSP * (1 - actionConfig.reduceFlow.maxReductionPct / 100);
        const step = currentSP * (actionConfig.reduceFlow.stepPct / 100);
        if (currentSP > Math.max(2, minSP)) {
          recommendedActions.push({
            type: 'reduceFlow',
            action: `Reduce feed flow SP by ${step.toFixed(1)} m³/h`,
            reason: 'Increase residence time',
            newValue: Math.max(currentSP - step, 2),
            priority: criticalParams.length > 0 ? 3 : 4,
          });
        }
      }

      if (actionConfig.adjustDemulsifier.enabled && newCooldowns.adjustDemulsifier <= 0 && chemDosing.demulsifier.enabled) {
        const currentSP = chemDosing.demulsifier.sp;
        const maxSP = currentSP * (1 + actionConfig.adjustDemulsifier.maxIncreasePct / 100);
        const step = currentSP * (actionConfig.adjustDemulsifier.stepPct / 100);
        if (currentSP < maxSP) {
          recommendedActions.push({
            type: 'adjustDemulsifier',
            action: `Increase demulsifier dose by ${step.toFixed(0)} ppm`,
            reason: 'Improve emulsion breaking',
            newValue: currentSP + step,
            priority: 4,
          });
        }
      }
    }

    if (turbidityIssue) {
      // For turbidity issues: increase flocculant, increase speed
      if (actionConfig.adjustFlocculant.enabled && newCooldowns.adjustFlocculant <= 0) {
        const currentSP = chemDosing.flocculant.sp || 10;
        const maxSP = currentSP * (1 + actionConfig.adjustFlocculant.maxIncreasePct / 100);
        const step = Math.max(5, currentSP * (actionConfig.adjustFlocculant.stepPct / 100));
        recommendedActions.push({
          type: 'adjustFlocculant',
          action: `${chemDosing.flocculant.enabled ? 'Increase' : 'Enable'} flocculant dose${chemDosing.flocculant.enabled ? ` by ${step.toFixed(0)} ppm` : ' at 20 ppm'}`,
          reason: 'Reduce turbidity via solids aggregation',
          newValue: chemDosing.flocculant.enabled ? currentSP + step : 20,
          enableFlocculant: !chemDosing.flocculant.enabled,
          priority: 3,
        });
      }
    }

    // Sort by priority
    recommendedActions.sort((a, b) => a.priority - b.priority);

    return {
      status,
      qualityScore,
      scores,
      deviations,
      recommendedActions,
      newCooldowns,
      mode,
    };
  }, [aqc, dischargeLimits, loops, equipment, chemDosing]);

  // Apply AQC corrections (called from simulation loop when mode is AUTO)
  const applyAQCCorrection = useCallback((action, simTime) => {
    const newAction = {
      time: simTime,
      type: action.type,
      action: action.action,
      reason: action.reason,
    };

    switch (action.type) {
      case 'increaseTemp':
        setLoops(p => ({ ...p, TIC: { ...p.TIC, sp: action.newValue } }));
        break;
      case 'increaseSpeed':
        setLoops(p => ({ ...p, SIC: { ...p.SIC, sp: action.newValue } }));
        break;
      case 'reduceFlow':
        setLoops(p => ({ ...p, FIC: { ...p.FIC, sp: action.newValue } }));
        break;
      case 'adjustDemulsifier':
        setChemDosing(p => ({ ...p, demulsifier: { ...p.demulsifier, sp: action.newValue } }));
        break;
      case 'adjustFlocculant':
        if (action.enableFlocculant) {
          setChemDosing(p => ({ ...p, flocculant: { ...p.flocculant, enabled: true, sp: action.newValue } }));
        } else {
          setChemDosing(p => ({ ...p, flocculant: { ...p.flocculant, sp: action.newValue } }));
        }
        break;
      default:
        break;
    }

    // Set cooldown for this action type
    const cooldownTime = aqc.actions[action.type]?.cooldownSec || 60;
    setAqc(p => ({
      ...p,
      cooldowns: { ...p.cooldowns, [action.type]: cooldownTime },
      lastActionTime: simTime,
      actionHistory: [newAction, ...p.actionHistory.slice(0, 19)], // Keep last 20
    }));

    addEvent('AQC', action.action);
  }, [aqc.actions, addEvent]);

  // Manual backwash trigger
  const triggerBackwash = useCallback(() => {
    if (polishingFilter.status === 'FILTERING') {
      setPolishingFilter(p => ({
        ...p,
        status: 'BACKWASH',
        backwashRemaining: CONFIG.polishingFilter.operating.backwashDuration,
        backwashCount: p.backwashCount + 1,
      }));
    }
  }, [polishingFilter.status]);

  const selectTank = useCallback((id) => {
    if (isRunning) return;
    setTankFarm(p => p.map(t => ({ ...t, status: t.id === id ? 'selected' : (t.status === 'selected' ? 'ready' : t.status) })));
    setSelectedTank(id);
  }, [isRunning]);

  const startBatch = useCallback(() => {
    if (!selectedTank) return;
    const tank = tankFarm.find(t => t.id === selectedTank);
    if (!tank || tank.status === 'empty') return;
    const recv = oilTanks.find(t => t.id === selectedOilTank);
    if (recv && recv.level >= OIL_TANK.highHigh) { setOilInterlock({ active: true, reason: `${selectedOilTank} full` }); return; }
    setTankFarm(p => p.map(t => t.id === selectedTank ? { ...t, status: 'processing' } : t));
    setFeedProps(p => ({ ...p, waterFraction: tank.water / 100, oilFraction: tank.oil / 100, solidsFraction: tank.sediment / 100 }));
    const vol = (tank.level / 100) * TANK.volume;
    simRef.current = { time: 0, vol, phase: 0 };
    batchPhaseRef.current = 0; // Initialize ref for animation loop
    pendingPhaseRef.current = null; // Clear any pending phase transition
    setIsBatchMode(true); setBatchPhase(0); setTankVolume(vol); setSimTime(0);
    // Initialize phase data tracking for report
    initializePhaseData();
    startPhaseTracking(0, 0);
    addEvent('START', `Batch from ${selectedTank} - ${(vol * 1000).toFixed(0)} L`);
    setIsRunning(true);
  }, [selectedTank, tankFarm, selectedOilTank, oilTanks, addEvent, initializePhaseData, startPhaseTracking]);

  const refillTanks = useCallback((lvl = 85) => { setTankFarm(p => p.map(t => ({ ...t, level: t.status === 'processing' ? t.level : lvl, status: t.status === 'processing' ? 'processing' : 'ready' }))); addEvent('REFILL', `Tanks to ${lvl}%`); }, [addEvent]);
  const shipOil = useCallback(() => { const totalM3 = oilTanks.reduce((s, t) => s + (t.level / 100) * OIL_TANK.volume, 0); setOilTanks(p => p.map(t => ({ ...t, level: 0, status: 'empty' }))); setOilInterlock({ active: false, reason: '' }); addEvent('SHIP', `${totalM3.toFixed(1)} m³ oil`); }, [oilTanks, addEvent]);

  const dailyReset = useCallback(() => {
    setIsRunning(false); setSimTime(0); simRef.current = { time: 0, vol: 55, phase: 0 };
    setTrendData([]); setKpiHistory([]); setAlarms([]); setPendingAlarms([]); pendingRef.current = {};
    setIsBatchMode(false); setBatchPhase(0); setTankVolume(55);
    setTotals({ feed: 0, water: 0, oil: 0, solids: 0, energy: 0, runTime: 0 });
    // Clear phase tracking data
    setPhaseData([]); currentPhaseDataRef.current = null;
    setPond(p => ({ ...p, level: 25, volume: 2000, pH: 7.2, turbidity: 45, oilInWater: 15, inflow: 0, totalInflow: 0, totalEvaporated: 0 }));
    setReportEvents([{ time: new Date().toLocaleTimeString(), simTime: 0, type: 'RESET', desc: 'Session reset' }]);
    setTankFarm(p => p.map(t => t.status === 'processing' ? { ...t, status: 'ready' } : t));
    setSelectedTank(null); lastLog.current = 0;
    // Clear smoothing history
    Object.keys(valueHistory.current).forEach(k => { valueHistory.current[k] = []; });
    lastSmoothUpdate.current = Date.now();

    // Reset chemical dosing system
    setChemDosing(prev => {
      const reset = {};
      Object.keys(prev).forEach(chem => {
        reset[chem] = {
          ...prev[chem],
          pv: chem === 'demulsifier' ? 50 : chem === 'scaleInhibitor' ? 5 : chem === 'antifoam' ? 10 : 0,
          op: chem === 'demulsifier' ? 50 : chem === 'scaleInhibitor' ? 25 : chem === 'antifoam' ? 30 : 0,
          pumpRate: 0,
          totalUsed: 0,
          int: 0, lastErr: 0,
          effectiveness: prev[chem].effectiveness || 0.7,
          surfaceCoverage: 0, flocSize: 1.0, zetaPotential: -25, foamLevel: 0.1, scalingIndex: 0,
        };
      });
      return reset;
    });
    setChemState({
      zetaPotential: -25, flocDiameter: 80, emulsionBreaking: 0.3,
      foamHeight: 0.1, scalingRisk: 0.2, mixingEfficiency: 0.85,
      residenceTime: 30, reactionProgress: {},
    });
    setChemCosts({ demulsifier: 0, flocculant: 0, coagulant: 0, acid: 0, caustic: 0, scaleInhibitor: 0, antifoam: 0, total: 0 });

    // Reset polishing filter
    setPolishingFilter(prev => ({
      ...prev,
      status: 'FILTERING', inletFlow: 0, outletFlow: 0,
      inletPressure: 3.0, outletPressure: 2.8, differentialPressure: 0.2,
      inletTurbidity: 45, outletTurbidity: 7, inletOiW: 50, outletOiW: 15,
      turbidityRemoval: 85, oilRemoval: 70,
      bedLoading: 0, bedSaturation: 0, mediaCondition: 100,
      lastBackwash: 0, backwashCount: 0, backwashRemaining: 0,
      totalFiltered: 0, totalBackwashWater: 0, totalSolidsRemoved: 0, totalOilRemoved: 0,
      runHours: 0, filterCycles: 0,
    }));
    setFilterCosts({ backwashWater: 0, electricity: 0, total: 0 });
  }, []);

  // ═══════════════════════════════════════════════════════════════
  //                   MAIN SIMULATION LOOP
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isRunning) return;
    const tick = () => {
      const now = Date.now();
      const dt = ((now - lastUpdate.current) / 1000) * simSpeed;
      lastUpdate.current = now;
      
      simRef.current.time += dt;
      setSimTime(simRef.current.time);

      let waterFrac = feedProps.waterFraction, oilFrac = feedProps.oilFraction, solidsFrac = feedProps.solidsFraction;
      if (isBatchMode && batchPhases[batchPhaseRef.current]) {
        const ph = batchPhases[batchPhaseRef.current];
        waterFrac = ph.water / 100; oilFrac = ph.oil / 100; solidsFrac = ph.sediment / 100;
        setLoops(p => ({ ...p, TIC: { ...p.TIC, sp: ph.temp }, FIC: { ...p.FIC, sp: ph.flow }, SIC: { ...p.SIC, sp: ph.rpm } }));
      }

      if (disturbances.slugEnabled && disturbances.slugRemain > 0) {
        oilFrac *= disturbances.slugMag; solidsFrac *= disturbances.slugMag;
        waterFrac = clamp(1 - oilFrac - solidsFrac, 0, 1);
        setDisturbances(p => ({ ...p, slugRemain: Math.max(0, p.slugRemain - dt) }));
      }

      // Calculate new process state
      setProc(p => {
        const s = { ...p };
        s.heaterTemp += (loops.TIC.sp - s.heaterTemp) * (1 - Math.exp(-dt / equipment.heaterTimeConstant));
        s.heaterTemp = clamp(s.heaterTemp + gaussianRandom(0, 0.3 * disturbances.tempVar * 10), disturbances.ambientTemp, equipment.heaterMaxTemp);
        s.bowlTemp += (s.heaterTemp - s.bowlTemp - 2) * dt * 0.1;
        s.bowlTemp = clamp(s.bowlTemp + gaussianRandom(0, 0.2), disturbances.ambientTemp, 90);
        
        let flowTarget = loops.FIC.sp;
        if (disturbances.pumpCavitation) flowTarget *= 0.7 + gaussianRandom(0, 0.1);
        s.feedFlow += (flowTarget - s.feedFlow) * dt * 0.5;
        s.feedFlow = clamp(s.feedFlow * (1 + gaussianRandom(0, disturbances.flowVar)), 0, equipment.maxFlow);
        
        const spdTarget = (loops.SIC.op / 100) * equipment.maxRPM;
        s.bowlSpeed += (spdTarget - s.bowlSpeed) * dt * 0.3;
        s.bowlSpeed = clamp(s.bowlSpeed + gaussianRandom(0, 5), equipment.minRPM, equipment.maxRPM);
        
        const eff = calcEfficiency(s, waterFrac, oilFrac);
        s.oilEff = eff.oilEff; s.solidsEff = eff.solidsEff; s.waterQuality = eff.wq; s.gForce = eff.gForce; s.pH = eff.pH; s.turbidity = eff.turbidity;
        s.oilMoisture = eff.oilMoisture; s.sludgeMoisture = eff.sludgeMoisture;
        
        s.oilOut = s.feedFlow * oilFrac * (s.oilEff / 100);
        s.solidsOut = s.feedFlow * solidsFrac * (s.solidsEff / 100);
        s.waterOut = s.feedFlow - s.oilOut - s.solidsOut;
        
        const baseVib = (1.5 + (s.bowlSpeed / 5000) * 2) * (2 - equipment.bearingCondition / 100);
        s.vibration = Math.sqrt((baseVib + gaussianRandom(0, 0.3)) ** 2 + ((baseVib * 0.9) + gaussianRandom(0, 0.3)) ** 2);
        
        const mass = s.feedFlow * 1000 / 3600;
        s.heaterPower = clamp((mass * 4.186 * (s.heaterTemp - s.feedTemp)) / (equipment.heaterEfficiency / 100), 0, equipment.heaterCapacity);
        s.motorPower = equipment.centrifugeCapacity * (0.3 + 0.7 * Math.pow(s.bowlSpeed / equipment.maxRPM, 3)) * (0.5 + 0.5 * s.feedFlow / equipment.maxFlow) / ((equipment.motorEfficiency / 100) * (equipment.vfdEfficiency / 100));
        s.totalPower = s.heaterPower + s.motorPower;
        
        // Update smoothed values for display
        updateSmoothedValues(s);

        // Store in ref for use in subsequent operations within same tick
        procRef.current = s;
        return s;
      });

      // Use procRef.current for operations that need the updated values
      const currentProc = procRef.current || proc;

      // Update control loops
      setLoops(p => {
        const l = { ...p };
        const pvMap = { TIC: currentProc.heaterTemp, FIC: currentProc.feedFlow, SIC: currentProc.bowlSpeed };
        Object.keys(l).forEach(k => {
          const r = calcPID(l[k], pvMap[k], dt);
          l[k] = { ...l[k], op: r.op, int: r.int, lastErr: r.lastErr, pv: pvMap[k] };
        });
        return l;
      });

      // Chemical dosing calculations
      const chemResult = calcChemicalDosing(
        dt,
        currentProc.feedFlow,
        waterFrac,
        oilFrac,
        solidsFrac,
        currentProc.bowlTemp,
        currentProc.pH
      );
      // Merge computed values while preserving user settings (sp, ratio, mode, enabled)
      setChemDosing(prev => {
        const merged = { ...prev };
        for (const chemKey of Object.keys(chemResult.dosing)) {
          if (merged[chemKey] && typeof merged[chemKey] === 'object') {
            // Preserve user-settable fields, update computed fields
            merged[chemKey] = {
              ...merged[chemKey],  // Keep user settings (sp, ratio, mode, enabled)
              pv: chemResult.dosing[chemKey].pv,
              op: chemResult.dosing[chemKey].op,
              pumpRate: chemResult.dosing[chemKey].pumpRate,
              inventory: chemResult.dosing[chemKey].inventory,
              totalUsed: chemResult.dosing[chemKey].totalUsed,
              effectiveness: chemResult.dosing[chemKey].effectiveness,
              surfaceCoverage: chemResult.dosing[chemKey].surfaceCoverage,
              flocSize: chemResult.dosing[chemKey].flocSize,
              zetaContribution: chemResult.dosing[chemKey].zetaContribution,
              scalingIndex: chemResult.dosing[chemKey].scalingIndex,
              foamSuppression: chemResult.dosing[chemKey].foamSuppression,
              int: chemResult.dosing[chemKey].int,
              lastErr: chemResult.dosing[chemKey].lastErr,
            };
          }
        }
        return merged;
      });
      setChemState(chemResult.chemState);
      setChemCosts(chemResult.chemCosts);

      // Oil tank accumulation (m³)
      const oilAddM3 = (currentProc.oilOut / 3600) * dt;  // m³/h → m³/s → m³
      setOilTanks(p => p.map(t => {
        if (t.id === selectedOilTank && t.level < 100) {
          const newLvl = Math.min(100, t.level + (oilAddM3 / OIL_TANK.volume) * 100);
          if (newLvl >= OIL_TANK.highHigh && t.level < OIL_TANK.highHigh) {
            setOilInterlock({ active: true, reason: `${t.id} HIGH-HIGH` });
            setIsRunning(false);
            addEvent('INTERLOCK', `${t.id} trip`);
          }
          return { ...t, level: newLvl, status: newLvl >= OIL_TANK.highHigh ? 'full' : 'receiving' };
        }
        return t;
      }));

      // Polishing filter processing (water from centrifuge passes through SPDD1600)
      const filterResult = calcPolishingFilter(
        dt,
        currentProc.waterOut,
        currentProc.turbidity,
        currentProc.waterQuality,
        simRef.current.time
      );
      setPolishingFilter(filterResult.filter);
      setFilterCosts(filterResult.costs);

      // Add polishing filter values to smoothing
      updateSmoothedValues({
        ...currentProc,
        filterOutletOiW: filterResult.filter.outletOiW,
        filterOutletTurbidity: filterResult.filter.outletTurbidity,
        filterOutletTRH: filterResult.filter.outletTRH,
        filterOutletCOD: filterResult.filter.outletCOD,
        filterInletFlow: filterResult.filter.inletFlow,
        filterOutletFlow: filterResult.filter.outletFlow,
        filterDP: filterResult.filter.differentialPressure,
        filterBedSaturation: filterResult.filter.bedSaturation,
      });

      // ═══════════════════════════════════════════════════════════════
      //           AQC - AUTOMATIC QUALITY CONTROL EXECUTION
      // ═══════════════════════════════════════════════════════════════
      const currentQuality = {
        oiw: filterResult.filter.outletOiW,
        trh: filterResult.filter.outletTRH,
        cod: filterResult.filter.outletCOD,
        turbidity: filterResult.filter.outletTurbidity,
        pH: currentProc.pH,
      };

      const aqcResult = calcAQC(currentQuality, simRef.current.time, dt);

      // Update AQC state
      setAqc(p => ({
        ...p,
        status: aqcResult.status,
        qualityScore: aqcResult.qualityScore,
        cooldowns: aqcResult.newCooldowns || p.cooldowns,
        activeCorrections: aqcResult.recommendedActions || [],
        qualityHistory: [
          { time: simRef.current.time, score: aqcResult.qualityScore, status: aqcResult.status },
          ...p.qualityHistory.slice(0, 59) // Keep last 60 entries
        ],
      }));

      // In AUTO mode, apply the highest priority correction if available
      if (aqc.enabled && aqc.mode === 'AUTO' && aqcResult.recommendedActions?.length > 0) {
        const topAction = aqcResult.recommendedActions[0];
        // Only apply if cooldown has expired (check newCooldowns which has decremented values)
        if (!aqcResult.newCooldowns?.[topAction.type] || aqcResult.newCooldowns[topAction.type] <= 0) {
          applyAQCCorrection(topAction, simRef.current.time);
        }
      }

      // Pond accumulation (filtered water from SPDD1600) - 8ML evaporation pond
      const waterToPond = filterResult.toPond;
      const waterAddM3 = (waterToPond.flow / 3600) * dt; // m³ added this tick
      const evapRateM3PerSec = (4000 * 8 / 1000) / 86400; // 4000m² × 8mm/day converted to m³/s
      const evaporatedM3 = evapRateM3PerSec * dt; // Evaporation this tick

      setPond(p => {
        const inflowM3 = waterAddM3;
        const newVol = Math.max(0, Math.min(p.capacity, p.volume + inflowM3 - evaporatedM3));
        const newLevel = (newVol / p.capacity) * 100;

        // Blend water quality (weighted average based on volume)
        const blendFactor = p.volume > 0 ? inflowM3 / (p.volume + inflowM3) : 1;
        const newOiW = p.volume > 0 ? p.oilInWater * (1 - blendFactor) + waterToPond.oiw * blendFactor : waterToPond.oiw;
        const newTurb = p.volume > 0 ? p.turbidity * (1 - blendFactor) + waterToPond.turbidity * blendFactor : waterToPond.turbidity;

        return {
          ...p,
          level: newLevel,
          volume: newVol,
          pH: currentProc.pH,
          turbidity: Math.max(5, newTurb * 0.95), // Settling improves turbidity
          oilInWater: Math.max(1, newOiW * 0.98), // Some oil separation in pond
          inflow: waterToPond.flow,
          totalInflow: p.totalInflow + inflowM3,
          totalEvaporated: p.totalEvaporated + evaporatedM3,
          dailyEvaporation: evapRateM3PerSec * 86400,
        };
      });

      // Batch mode tank depletion
      if (isBatchMode) {
        const volProc = (currentProc.feedFlow / 3600) * dt;
        simRef.current.vol -= volProc;
        setTankVolume(simRef.current.vol);
        if (selTankRef.current) {
          setTankFarm(p => p.map(t => t.id === selTankRef.current ? { ...t, level: Math.max(0, (simRef.current.vol / TANK.volume) * 100) } : t));
        }
        const totalVol = batchPhases.reduce((s, ph) => s + ph.volume, 0);
        const processed = totalVol - simRef.current.vol;
        let cum = 0;
        for (let i = 0; i < batchPhases.length; i++) {
          cum += batchPhases[i].volume;
          if (processed < cum) {
            // Use ref to check current phase (React state is async, can cause duplicate detections)
            const currentTrackingPhase = currentPhaseDataRef.current?.phaseIndex;
            if (i !== currentTrackingPhase) {
              // Phase transition detected - apply 10-second debounce rule
              const PHASE_DEBOUNCE_SECONDS = 10;

              if (pendingPhaseRef.current === null || pendingPhaseRef.current.phase !== i) {
                // New pending phase detected - start tracking when it was first seen
                pendingPhaseRef.current = { phase: i, detectedAt: simRef.current.time };
              } else if (simRef.current.time - pendingPhaseRef.current.detectedAt >= PHASE_DEBOUNCE_SECONDS) {
                // Phase has been stable for 10+ seconds - commit the transition
                startPhaseTracking(i, simRef.current.time);
                batchPhaseRef.current = i; // Update ref immediately for animation loop
                setBatchPhase(i); // Update state for UI
                addEvent('PHASE', batchPhases[i].name);
                pendingPhaseRef.current = null; // Clear pending after transition
              }
              // If < 10 seconds, keep waiting (do nothing, continue tracking current phase)
            } else {
              // Current phase matches detected phase - clear any pending transition
              pendingPhaseRef.current = null;
            }
            break;
          }
        }
        // Update phase data tracking (every tick in batch mode)
        updatePhaseData(currentProc, dt, costs, chemCosts, filterCosts);

        if (simRef.current.vol <= 0) {
          // Finalize last phase before completing batch
          finalizePhaseData(simRef.current.time);
          setIsBatchMode(false); setIsRunning(false);
          if (selTankRef.current) setTankFarm(p => p.map(t => t.id === selTankRef.current ? { ...t, status: 'empty', level: 0 } : t));
          setSelectedTank(null);
          addEvent('COMPLETE', `${(totalVol * 1000).toFixed(0)} L done`);
        }
      }

      // Totalizers
      setTotals(p => ({ feed: p.feed + currentProc.feedFlow * dt / 3600, water: p.water + currentProc.waterOut * dt / 3600, oil: p.oil + currentProc.oilOut * dt / 3600, solids: p.solids + currentProc.solidsOut * dt / 3600, energy: p.energy + currentProc.totalPower * dt / 3600, runTime: p.runTime + dt }));

      // Data logging at configured interval
      if (simRef.current.time - lastLog.current >= CONFIG.simulation.logIntervalSec) {
        lastLog.current = simRef.current.time;
        const t = Math.floor(simRef.current.time);
        const maxPoints = CONFIG.simulation.maxTrendPoints;
        setTrendData(p => [...p.slice(-maxPoints), { time: t, flow: currentProc.feedFlow, temp: currentProc.heaterTemp, speed: currentProc.bowlSpeed, oilEff: currentProc.oilEff, wq: currentProc.waterQuality, power: currentProc.totalPower, vib: currentProc.vibration, pH: currentProc.pH, turbidity: currentProc.turbidity }]);
        setKpiHistory(p => [...p.slice(-maxPoints), { time: t, oilEff: currentProc.oilEff, solidsEff: currentProc.solidsEff, wq: currentProc.waterQuality, specEnergy: currentProc.totalPower / Math.max(currentProc.feedFlow, 0.1), flow: currentProc.feedFlow, vib: currentProc.vibration, pH: currentProc.pH, turbidity: currentProc.turbidity }]);
      }

      // Alarms with configurable delay
      const { delaySeconds: DELAY, marginPercent: MARGIN, highTemp, highVibration, lowOilEfficiency } = CONFIG.alarms;
      const conds = [
        { type: 'HIGH_TEMP', cond: currentProc.heaterTemp > highTemp * (1 + MARGIN), val: currentProc.heaterTemp, sev: 'critical', lim: highTemp },
        { type: 'HIGH_VIB', cond: currentProc.vibration > highVibration * (1 + MARGIN), val: currentProc.vibration, sev: 'critical', lim: highVibration },
        { type: 'LOW_EFF', cond: currentProc.oilEff < lowOilEfficiency * (1 - MARGIN), val: currentProc.oilEff, sev: 'warning', lim: lowOilEfficiency },
      ];
      const curr = { ...pendingRef.current };
      const newAlarms = [];
      conds.forEach(a => { if (a.cond) { if (curr[a.type] === undefined) curr[a.type] = simRef.current.time; else if (simRef.current.time - curr[a.type] >= DELAY) newAlarms.push({ ...a }); } else delete curr[a.type]; });
      pendingRef.current = curr;
      setPendingAlarms(conds.filter(a => a.cond && curr[a.type] && simRef.current.time - curr[a.type] < DELAY).map(a => ({ type: a.type, val: a.val, remain: DELAY - (simRef.current.time - curr[a.type]) })));
      setAlarms(newAlarms);

      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [isRunning, simSpeed, feedProps, disturbances, equipment, loops, calcPID, calcEfficiency, isBatchMode, batchPhases, selectedOilTank, oilTanks, addEvent, updateSmoothedValues, startPhaseTracking, updatePhaseData, finalizePhaseData, costs, chemCosts, filterCosts]);

  const batchProgress = useMemo(() => { const total = batchPhases.reduce((s, p) => s + p.volume, 0); return { pct: Math.min(100, ((total - tankVolume) / total) * 100), remain: tankVolume }; }, [batchPhases, tankVolume]);
  const kpiStats = useMemo(() => ({ oilEff: calcStats(kpiHistory, 'oilEff'), solidsEff: calcStats(kpiHistory, 'solidsEff'), wq: calcStats(kpiHistory, 'wq'), flow: calcStats(kpiHistory, 'flow'), vib: calcStats(kpiHistory, 'vib'), pH: calcStats(kpiHistory, 'pH'), turbidity: calcStats(kpiHistory, 'turbidity') }), [kpiHistory]);

  // Computed values - centralized calculations to avoid redundancy
  const computed = useMemo(() => {
    const safeFeedFlow = Math.max(smoothedProc.feedFlow, 0.001);
    const safeOilOut = Math.max(smoothedProc.oilOut, 0.0001);

    // Mass balance
    const totalOut = smoothedProc.waterOut + smoothedProc.oilOut + smoothedProc.solidsOut;
    const massBalanceClosure = (totalOut / safeFeedFlow) * 100;

    // Specific energy
    const specificEnergy = smoothedProc.totalPower / Math.max(smoothedProc.feedFlow, 0.1);

    // Hourly financials (live rates)
    // Calculate hourly chemical cost rate from session totals
    const runTimeHours = Math.max(totals.runTime / 3600, 0.01);
    const chemicalCostPerHour = chemCosts.total / runTimeHours;
    const filterCostPerHour = filterCosts.total / runTimeHours;

    const hourly = {
      oilRevenue: smoothedProc.oilOut * costs.oilValue,
      energyCost: smoothedProc.totalPower * costs.elec,
      sludgeCost: smoothedProc.solidsOut * costs.sludgeDisposal,
      waterCost: smoothedProc.waterOut * costs.waterTreatment,
      laborCost: costs.laborRate,
      chemicalCost: chemicalCostPerHour,
      filterCost: filterCostPerHour,
    };
    hourly.totalCosts = hourly.energyCost + hourly.sludgeCost + hourly.waterCost + hourly.laborCost + hourly.chemicalCost + hourly.filterCost;
    hourly.netProfit = hourly.oilRevenue - hourly.totalCosts;
    hourly.margin = hourly.oilRevenue > 0 ? (hourly.netProfit / hourly.oilRevenue) * 100 : 0;
    hourly.isProfit = hourly.netProfit >= 0;
    hourly.perM3Feed = hourly.netProfit / safeFeedFlow;
    hourly.daily = hourly.netProfit * 24;

    // Session financials (cumulative totals)
    const session = {
      oilRevenue: totals.oil * costs.oilValue,
      energyCost: totals.energy * costs.elec,
      sludgeCost: totals.solids * costs.sludgeDisposal,
      waterCost: totals.water * costs.waterTreatment,
      laborCost: (totals.runTime / 3600) * costs.laborRate,
      chemicalCost: chemCosts.total,
      filterCost: filterCosts.total,
    };
    session.totalCosts = session.energyCost + session.sludgeCost + session.waterCost + session.laborCost + session.chemicalCost + session.filterCost;
    session.netProfit = session.oilRevenue - session.totalCosts;
    session.isProfit = session.netProfit >= 0;
    session.perM3Feed = totals.feed > 0 ? session.netProfit / totals.feed : 0;

    // Unit economics
    const unitEcon = {
      costPerM3Feed: hourly.totalCosts / safeFeedFlow,
      revenuePerM3Feed: hourly.oilRevenue / safeFeedFlow,
      sludgeCostPerLOil: hourly.sludgeCost / (safeOilOut * 1000),
    };

    // Cost structure breakdown
    const safeTotalCosts = Math.max(hourly.totalCosts, 0.01);
    const costBreakdown = {
      energy: { amount: hourly.energyCost, pct: (hourly.energyCost / safeTotalCosts) * 100 },
      sludge: { amount: hourly.sludgeCost, pct: (hourly.sludgeCost / safeTotalCosts) * 100 },
      water: { amount: hourly.waterCost, pct: (hourly.waterCost / safeTotalCosts) * 100 },
      labor: { amount: hourly.laborCost, pct: (hourly.laborCost / safeTotalCosts) * 100 },
      chemicals: { amount: hourly.chemicalCost, pct: (hourly.chemicalCost / safeTotalCosts) * 100 },
      filter: { amount: hourly.filterCost, pct: (hourly.filterCost / safeTotalCosts) * 100 },
      total: hourly.totalCosts,
    };

    // Flow percentages
    const flowPct = {
      water: (smoothedProc.waterOut / safeFeedFlow) * 100,
      oil: (smoothedProc.oilOut / safeFeedFlow) * 100,
      solids: (smoothedProc.solidsOut / safeFeedFlow) * 100,
      total: massBalanceClosure,
    };

    // Daily projections
    const dailyProjection = {
      feed: smoothedProc.feedFlow * 24,
      water: smoothedProc.waterOut * 24,
      oil: smoothedProc.oilOut * 24,
      solids: smoothedProc.solidsOut * 24,
    };

    // Equipment utilization
    const utilization = {
      heater: (smoothedProc.heaterPower / equipment.heaterCapacity) * 100,
      motor: (smoothedProc.motorPower / equipment.centrifugeCapacity) * 100,
      average: ((smoothedProc.heaterPower / equipment.heaterCapacity + smoothedProc.motorPower / equipment.centrifugeCapacity) / 2) * 100,
    };

    // Oil tank totals (m³)
    const oilTankTotals = {
      totalM3: oilTanks.reduce((s, t) => s + (t.level / 100) * OIL_TANK.volume, 0),
      totalValue: oilTanks.reduce((s, t) => s + (t.level / 100) * OIL_TANK.volume, 0) * costs.oilValue,
    };

    return {
      totalOut,
      massBalanceClosure,
      specificEnergy,
      hourly,
      session,
      unitEcon,
      costBreakdown,
      flowPct,
      dailyProjection,
      utilization,
      oilTankTotals,
    };
  }, [smoothedProc, costs, totals, equipment, oilTanks, chemCosts, filterCosts]);

  // ═══════════════════════════════════════════════════════════════
  //                   UI COMPONENTS - MODERN DESIGN SYSTEM
  // ═══════════════════════════════════════════════════════════════

  // Process Value Display - Clean minimal card
  const PV = ({ tag, val, unit, lo, hi, dec = 1 }) => {
    const isAlarm = val < lo || val > hi;
    return (
      <div className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-300 ${
        isAlarm
          ? 'bg-gradient-to-br from-red-500/20 to-red-600/10 ring-1 ring-red-500/50'
          : 'bg-white/5 hover:bg-white/10'
      }`}>
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{tag}</div>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-semibold ${isAlarm ? 'text-red-400' : 'text-white'}`}>
            {val?.toFixed(dec)}
          </span>
          <span className="text-sm text-gray-500">{unit}</span>
        </div>
        {isAlarm && (
          <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </div>
    );
  };

  // Modern Faceplate - Glass morphism control card
  const Faceplate = ({ loop, onUp, smoothedPV }) => {
    const displayPV = smoothedPV !== undefined ? smoothedPV : loop.pv;
    const deviation = Math.abs(displayPV - loop.sp);
    const deviationPct = loop.sp > 0 ? (deviation / loop.sp) * 100 : 0;
    const isDeviated = deviationPct > 10;
    const isAuto = loop.mode === 'AUTO';

    return (
      <div className={`relative rounded-3xl overflow-hidden transition-all duration-300 ${
        isDeviated ? 'ring-2 ring-amber-500/50' : ''
      }`}>
        {/* Gradient background */}
        <div className={`absolute inset-0 ${
          isAuto
            ? 'bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/5'
            : 'bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/5'
        }`} />

        <div className="relative backdrop-blur-xl bg-white/5 p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className={`text-sm font-bold tracking-wide ${isAuto ? 'text-emerald-400' : 'text-amber-400'}`}>
                {loop.tag}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{loop.desc}</div>
            </div>
            <button
              onClick={() => onUp({ mode: isAuto ? 'MAN' : 'AUTO' })}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                isAuto
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
              }`}
            >
              {loop.mode}
            </button>
          </div>

          {/* Big PV Display */}
          <div className="text-center mb-6">
            <div className="text-5xl font-light text-white tracking-tight">{displayPV?.toFixed(1)}</div>
            <div className="text-sm text-gray-500 mt-1">{loop.unit}</div>
          </div>

          {/* Setpoint */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Setpoint</span>
            <NumInput
              value={loop.sp}
              onChange={v => onUp({ sp: v })}
              className="w-20 text-lg font-medium text-center bg-white/10 border-0 rounded-xl text-emerald-400"
            />
            <span className="text-xs text-gray-500">{loop.unit}</span>
          </div>

          {/* Output Bar */}
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-500 uppercase tracking-wider">Output</span>
              <span className={`font-semibold ${isAuto ? 'text-emerald-400' : 'text-amber-400'}`}>{loop.op?.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  isAuto ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-amber-500 to-orange-400'
                }`}
                style={{ width: `${loop.op}%` }}
              />
            </div>
          </div>

          {/* Deviation indicator */}
          {isDeviated && (
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/20">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-xs text-amber-400">{deviationPct.toFixed(0)}%</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Modern KPI Card - Clean metrics display
  const KPI = ({ title, val, unit, target, icon, good }) => {
    const isGood = good ?? val >= target;
    return (
      <div className={`relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] ${
        isGood
          ? 'bg-gradient-to-br from-emerald-500/10 to-transparent'
          : 'bg-gradient-to-br from-red-500/10 to-transparent'
      }`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl opacity-80">{icon}</span>
          <span className="text-sm font-medium text-gray-400">{title}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-semibold ${isGood ? 'text-emerald-400' : 'text-red-400'}`}>
            {val?.toFixed(1)}
          </span>
          <span className="text-sm text-gray-500">{unit}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isGood ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-500">Target: {target} {unit}</span>
        </div>
      </div>
    );
  };

  // Modern Field Input - Clean form element
  const Field = ({ label, value, onChange, unit, min, max, step }) => (
    <div className="space-y-2">
      <label className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-300">{label}</span>
        {unit && <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">{unit}</span>}
      </label>
      <NumInput
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        className="w-full text-sm bg-white/5 border-0 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 transition-all"
      />
    </div>
  );

  // Section Card wrapper - Glass morphism container
  const Card = ({ children, className = '', title, subtitle, action }) => (
    <div className={`relative overflow-hidden rounded-3xl backdrop-blur-xl bg-white/5 border border-white/10 ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );

  // Stat display - Compact metric
  const Stat = ({ label, value, unit, trend, color = 'blue' }) => {
    const colors = {
      blue: 'text-blue-400',
      green: 'text-emerald-400',
      amber: 'text-amber-400',
      red: 'text-red-400',
      purple: 'text-purple-400',
      cyan: 'text-cyan-400',
    };
    return (
      <div className="text-center">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
        <div className={`text-2xl font-semibold ${colors[color]}`}>{value}</div>
        {unit && <div className="text-xs text-gray-500">{unit}</div>}
        {trend && <div className={`text-xs mt-1 ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%</div>}
      </div>
    );
  };

  // Tab configuration for cleaner rendering
  const tabs = [
    { id: 'feed', label: 'Feed Lab', icon: '◉' },
    { id: 'chemDosing', label: 'Chemicals', icon: '◎' },
    { id: 'centrifuge', label: 'Centrifuge', icon: '⟳' },
    { id: 'tankage', label: 'Tanks', icon: '▣' },
    { id: 'controls', label: 'Controls', icon: '◫' },
    { id: 'config', label: 'Config', icon: '⚙' },
    { id: 'batch', label: 'Batch', icon: '▤' },
    { id: 'trends', label: 'Trends', icon: '◠' },
    { id: 'kpi', label: 'KPI', icon: '◈' },
    { id: 'spc', label: 'SPC', icon: '∿' },
    { id: 'report', label: 'Report', icon: '▦' },
    { id: 'capital', label: 'Capital', icon: '◇' },
    { id: 'alarms', label: alarms.length ? `Alarms (${alarms.length})` : 'Alarms', icon: '◬' },
    { id: 'massBalance', label: 'Balance', icon: '⚖' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      {/* Ambient background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/10 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 backdrop-blur-xl bg-white/5 border-b border-white/10">
        <div className="max-w-[1600px] mx-auto px-6">
          {/* Top bar */}
          <div className="flex items-center justify-between h-16">
            {/* Logo & Status */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                  <span className="text-xl">⟳</span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-white">Centrifuge Control</h1>
                  <div className="text-xs text-gray-500">Delta-Canter 20-843A</div>
                </div>
              </div>

              {/* Status pill */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                isRunning
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-sm font-medium">{isRunning ? 'Running' : 'Stopped'}</span>
              </div>

              {/* Batch mode indicator */}
              {isBatchMode && (
                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-purple-500/20">
                  <span className="text-lg">{batchPhases[batchPhase]?.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-purple-300">{batchPhases[batchPhase]?.name}</div>
                    <div className="text-xs text-purple-400">Phase {batchPhase + 1}/{batchPhases.length} · {batchProgress.pct.toFixed(0)}%</div>
                  </div>
                </div>
              )}
              {!isBatchMode && isRunning && (
                <div className="px-4 py-2 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium">
                  Manual Mode
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              {/* Time display */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5">
                <span className="text-gray-500 text-sm">⏱</span>
                <span className="font-mono text-white text-sm">{formatTime(simTime)}</span>
              </div>

              {/* Speed selector */}
              <select
                value={simSpeed}
                onChange={e => setSimSpeed(+e.target.value)}
                className="px-4 py-2 rounded-xl bg-white/5 border-0 text-sm text-white focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
              >
                <option value={1}>1× Real</option>
                <option value={10}>10× Fast</option>
                <option value={60}>60× Faster</option>
                <option value={300}>5 min/s</option>
              </select>

              {/* Action buttons */}
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`px-6 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  isRunning
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'bg-emerald-500 text-white hover:bg-emerald-400'
                }`}
              >
                {isRunning ? '⏹ Stop' : '▶ Start'}
              </button>

              <button
                onClick={() => { if (window.confirm('Reset entire session? This will clear all data, trends, chemical usage, and filter statistics.')) dailyReset(); }}
                className="px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all text-sm"
                title="Reset all simulation data"
              >
                ↺ Reset
              </button>
            </div>
          </div>
          {/* Navigation tabs */}
          <div className="flex gap-1 overflow-x-auto py-3 scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                } ${tab.id === 'alarms' && alarms.length ? 'text-red-400' : ''}`}
              >
                <span className={`text-base ${activeTab === tab.id ? 'opacity-100' : 'opacity-50'}`}>{tab.icon}</span>
                <span>{tab.label}</span>
                {activeTab === tab.id && (
                  <div className="w-1 h-1 rounded-full bg-blue-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-[1600px] mx-auto px-6 py-8">
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/*                         FEED LAB TAB                            */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/*                         FEED LAB TAB                            */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'feed' && (
          <div className="space-y-8">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">Feed Characterization</h2>
                <p className="text-gray-500 mt-1">Configure feed properties and flow parameters</p>
              </div>
              <div className="flex gap-3">
                <select
                  onChange={(e) => {
                    const preset = CONFIG.feedPresets[e.target.value];
                    if (preset) setFeedProps(p => ({ ...p, ...preset }));
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white/5 border-0 text-sm text-gray-300 focus:ring-2 focus:ring-blue-500/50"
                  defaultValue=""
                >
                  <option value="" disabled>Load Preset...</option>
                  {Object.entries(CONFIG.feedPresets).map(([key, preset]) => (
                    <option key={key} value={key}>{preset.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setFeedProps({
                    waterFraction: 0.75, oilFraction: 0.20, solidsFraction: 0.05,
                    waterDensity: 1000, oilDensity: 890, solidsDensity: 2650,
                    oilDropletD10: 10, oilDropletD50: 25, oilDropletD90: 60,
                    solidsD10: 20, solidsD50: 80, solidsD90: 200,
                    oilViscosity: 50, viscosityTempCoeff: 0.025, yieldStress: 0, flowBehaviorIndex: 1.0,
                    emulsionStability: 0.3, interfacialTension: 25,
                    demulsifierDose: 50, demulsifierEff: 0.7, flocculantDose: 0, flocculantEff: 0.8, acidDose: 0,
                    salinity: 35000, dissolvedGas: 5,
                    maxPackingFraction: 0.64, hinderedSettlingExp: 4.65,
                    oilDropletSphericity: 1.0, solidsSphericity: 0.8,
                  })}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all text-sm"
                >
                  ↺ Reset Defaults
                </button>
              </div>
            </div>

            {/* Feed Flow Rate Control - Hero card */}
            <Card className="bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/5">
              <div className="flex items-center justify-between flex-wrap gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <span className="text-blue-400">◉</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Feed Flow Rate</h3>
                      <div className="text-sm text-gray-500">FIC-001 Setpoint Control</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Current</div>
                    <div className="text-3xl font-light text-blue-400">{smoothedProc.feedFlow.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">m³/h</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Setpoint</div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max={equipment.maxFlow}
                        step="0.5"
                        value={loops.FIC.sp}
                        onChange={(e) => setLoops(p => ({ ...p, FIC: { ...p.FIC, sp: parseFloat(e.target.value) } }))}
                        className="w-40 h-2 bg-white/10 rounded-full cursor-pointer accent-emerald-500"
                      />
                      <NumInput
                        value={loops.FIC.sp}
                        onChange={(v) => setLoops(p => ({ ...p, FIC: { ...p.FIC, sp: v } }))}
                        min={1}
                        max={equipment.maxFlow}
                        step={0.5}
                        className="w-20 text-xl text-center bg-white/10 border-0 rounded-xl text-emerald-400 font-medium"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Capacity</div>
                    <div className="text-xl font-medium text-gray-400">{equipment.maxFlow}</div>
                    <div className="text-xs text-gray-500">m³/h max</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Phase Composition */}
            <Card title="Phase Composition" subtitle="Must sum to 100%">
              <div className="grid md:grid-cols-3 gap-8">
                {/* Water */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-cyan-500" />
                      <span className="text-sm font-medium text-gray-300">Water</span>
                    </div>
                    <span className="text-lg font-semibold text-cyan-400">{(feedProps.waterFraction * 100).toFixed(1)}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="1"
                    value={feedProps.waterFraction * 100}
                    onChange={(e) => {
                      const newWater = parseFloat(e.target.value) / 100;
                      const remaining = 1 - newWater;
                      const oilRatio = feedProps.oilFraction / (feedProps.oilFraction + feedProps.solidsFraction || 0.01);
                      setFeedProps(p => ({
                        ...p,
                        waterFraction: newWater,
                        oilFraction: remaining * oilRatio,
                        solidsFraction: remaining * (1 - oilRatio)
                      }));
                    }}
                    className="w-full h-2 bg-white/10 rounded-full cursor-pointer accent-cyan-500"
                  />
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-300" style={{ width: `${feedProps.waterFraction * 100}%` }} />
                  </div>
                </div>

                {/* Oil */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-sm font-medium text-gray-300">Oil</span>
                    </div>
                    <span className="text-lg font-semibold text-amber-400">{(feedProps.oilFraction * 100).toFixed(1)}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="1"
                    value={feedProps.oilFraction * 100}
                    onChange={(e) => {
                      const newOil = parseFloat(e.target.value) / 100;
                      const maxOil = 1 - feedProps.solidsFraction;
                      const clampedOil = Math.min(newOil, maxOil);
                      setFeedProps(p => ({
                        ...p,
                        oilFraction: clampedOil,
                        waterFraction: 1 - clampedOil - p.solidsFraction
                      }));
                    }}
                    className="w-full h-2 bg-white/10 rounded-full cursor-pointer accent-amber-500"
                  />
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300" style={{ width: `${feedProps.oilFraction * 100}%` }} />
                  </div>
                </div>

                {/* Solids */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span className="text-sm font-medium text-gray-300">Solids</span>
                    </div>
                    <span className="text-lg font-semibold text-orange-400">{(feedProps.solidsFraction * 100).toFixed(1)}%</span>
                  </div>
                  <input type="range" min="0" max="30" step="0.5"
                    value={feedProps.solidsFraction * 100}
                    onChange={(e) => {
                      const newSolids = parseFloat(e.target.value) / 100;
                      const maxSolids = 1 - feedProps.oilFraction;
                      const clampedSolids = Math.min(newSolids, maxSolids);
                      setFeedProps(p => ({
                        ...p,
                        solidsFraction: clampedSolids,
                        waterFraction: 1 - p.oilFraction - clampedSolids
                      }));
                    }}
                    className="w-full h-2 bg-white/10 rounded-full cursor-pointer accent-orange-500"
                  />
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-300" style={{ width: `${feedProps.solidsFraction * 100}%` }} />
                  </div>
                </div>
              </div>
              {/* Total indicator */}
              <div className="mt-6 p-4 bg-white/5 rounded-2xl flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-cyan-500 rounded-full" />
                  <span className="text-sm text-gray-400">Water {(feedProps.waterFraction * 100).toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full" />
                  <span className="text-sm text-gray-400">Oil {(feedProps.oilFraction * 100).toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full" />
                  <span className="text-sm text-gray-400">Solids {(feedProps.solidsFraction * 100).toFixed(1)}%</span>
                </div>
                <div className={`px-4 py-1.5 rounded-xl ${Math.abs(feedProps.waterFraction + feedProps.oilFraction + feedProps.solidsFraction - 1) < 0.001 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'} text-sm font-medium`}>
                  Total: {((feedProps.waterFraction + feedProps.oilFraction + feedProps.solidsFraction) * 100).toFixed(1)}%
                </div>
              </div>
            </Card>

            {/* Density Properties */}
            <Card title="Density Properties" subtitle="kg/m³">
              <div className="grid md:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Water Density</span>
                    <span className="text-lg font-semibold text-cyan-400">{feedProps.waterDensity}</span>
                  </div>
                  <input type="range" min="990" max="1100" step="1"
                    value={feedProps.waterDensity}
                    onChange={(e) => setFeedProps(p => ({ ...p, waterDensity: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-white/10 rounded-full cursor-pointer accent-cyan-500"
                  />
                  <div className="text-xs text-gray-500">Affected by salinity</div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Oil Density</span>
                    <span className="text-lg font-semibold text-amber-400">{feedProps.oilDensity}</span>
                  </div>
                  <input type="range" min="700" max="1000" step="5"
                    value={feedProps.oilDensity}
                    onChange={(e) => setFeedProps(p => ({ ...p, oilDensity: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-white/10 rounded-full cursor-pointer accent-amber-500"
                  />
                  <div className="text-xs text-gray-500">Δρ = {Math.abs(feedProps.waterDensity - feedProps.oilDensity)} kg/m³ (oil-water)</div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Solids Density</span>
                    <span className="text-lg font-semibold text-orange-400">{feedProps.solidsDensity}</span>
                  </div>
                  <input type="range" min="1500" max="4000" step="50"
                    value={feedProps.solidsDensity}
                    onChange={(e) => setFeedProps(p => ({ ...p, solidsDensity: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-white/10 rounded-full cursor-pointer accent-orange-500"
                  />
                  <div className="text-xs text-gray-500">Δρ = {feedProps.solidsDensity - feedProps.waterDensity} kg/m³ (solids-water)</div>
                </div>
              </div>
            </Card>

            {/* Particle Size Distribution */}
            <Card title="Particle Size Distribution" subtitle="microns">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Oil Droplets */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <h4 className="text-sm font-medium text-amber-400">Oil Droplets</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">D10 (Fine)</label>
                      <NumInput value={feedProps.oilDropletD10} onChange={v => setFeedProps(p => ({ ...p, oilDropletD10: v }))} min={1} max={100} className="w-full bg-white/5 border-0 rounded-xl px-3 py-2 text-center text-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">D50 (Median)</label>
                      <NumInput value={feedProps.oilDropletD50} onChange={v => setFeedProps(p => ({ ...p, oilDropletD50: v }))} min={1} max={200} className="w-full bg-amber-500/10 border-0 rounded-xl px-3 py-2 text-center text-amber-400 font-medium" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">D90 (Coarse)</label>
                      <NumInput value={feedProps.oilDropletD90} onChange={v => setFeedProps(p => ({ ...p, oilDropletD90: v }))} min={1} max={500} className="w-full bg-white/5 border-0 rounded-xl px-3 py-2 text-center text-white" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 pt-2">
                    <span>Span = {((feedProps.oilDropletD90 - feedProps.oilDropletD10) / feedProps.oilDropletD50).toFixed(2)}</span>
                    <div className="flex items-center gap-2">
                      <span>Sphericity:</span>
                      <input type="range" min="0.4" max="1" step="0.05" value={feedProps.oilDropletSphericity}
                        onChange={(e) => setFeedProps(p => ({ ...p, oilDropletSphericity: parseFloat(e.target.value) }))}
                        className="w-16 h-1 bg-white/10 rounded-full cursor-pointer" />
                      <span className="text-white">{feedProps.oilDropletSphericity.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Solid Particles */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    <h4 className="text-sm font-medium text-orange-400">Solid Particles</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">D10 (Fine)</label>
                      <NumInput value={feedProps.solidsD10} onChange={v => setFeedProps(p => ({ ...p, solidsD10: v }))} min={1} max={200} className="w-full bg-white/5 border-0 rounded-xl px-3 py-2 text-center text-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">D50 (Median)</label>
                      <NumInput value={feedProps.solidsD50} onChange={v => setFeedProps(p => ({ ...p, solidsD50: v }))} min={1} max={500} className="w-full bg-orange-500/10 border-0 rounded-xl px-3 py-2 text-center text-orange-400 font-medium" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">D90 (Coarse)</label>
                      <NumInput value={feedProps.solidsD90} onChange={v => setFeedProps(p => ({ ...p, solidsD90: v }))} min={1} max={1000} className="w-full bg-white/5 border-0 rounded-xl px-3 py-2 text-center text-white" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 pt-2">
                    <span>Span = {((feedProps.solidsD90 - feedProps.solidsD10) / feedProps.solidsD50).toFixed(2)}</span>
                    <div className="flex items-center gap-2">
                      <span>Sphericity:</span>
                      <input type="range" min="0.4" max="1" step="0.05" value={feedProps.solidsSphericity}
                        onChange={(e) => setFeedProps(p => ({ ...p, solidsSphericity: parseFloat(e.target.value) }))}
                        className="w-16 h-1 bg-white/10 rounded-full cursor-pointer" />
                      <span className="text-white">{feedProps.solidsSphericity.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Rheological Properties */}
            <Card title="Rheological Properties" subtitle="Fluid behavior">
              <div className="grid md:grid-cols-4 gap-6">
                <div className="space-y-3">
                  <label className="text-sm text-gray-400">Oil Viscosity @ 25°C</label>
                  <NumInput value={feedProps.oilViscosity} onChange={v => setFeedProps(p => ({ ...p, oilViscosity: v }))} min={1} max={10000} className="w-full bg-white/5 border-0 rounded-xl px-4 py-3 text-center text-xl text-white" />
                  <div className="text-xs text-gray-500">Light: 5-50 · Medium: 50-200 · Heavy: 200+ mPa·s</div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm text-gray-400">Temp Coefficient</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="0.01" max="0.05" step="0.001"
                      value={feedProps.viscosityTempCoeff}
                      onChange={(e) => setFeedProps(p => ({ ...p, viscosityTempCoeff: parseFloat(e.target.value) }))}
                      className="flex-1 h-2 bg-white/10 rounded-full cursor-pointer"
                    />
                    <span className="w-14 text-right font-mono text-white">{feedProps.viscosityTempCoeff.toFixed(3)}</span>
                  </div>
                  <div className="text-xs text-gray-500">Higher = more temp sensitive</div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm text-gray-400">Yield Stress (Pa)</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="0" max="100" step="1"
                      value={feedProps.yieldStress}
                      onChange={(e) => setFeedProps(p => ({ ...p, yieldStress: parseFloat(e.target.value) }))}
                      className="flex-1 h-2 bg-white/10 rounded-full cursor-pointer"
                    />
                    <span className="w-14 text-right font-mono text-white">{feedProps.yieldStress}</span>
                  </div>
                  <div className="text-xs text-gray-500">0 = Newtonian fluid</div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm text-gray-400">Flow Behavior Index (n)</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="0.3" max="1.5" step="0.05"
                      value={feedProps.flowBehaviorIndex}
                      onChange={(e) => setFeedProps(p => ({ ...p, flowBehaviorIndex: parseFloat(e.target.value) }))}
                      className="flex-1 h-2 bg-white/10 rounded-full cursor-pointer"
                    />
                    <span className="w-14 text-right font-mono text-white">{feedProps.flowBehaviorIndex.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-500">&lt;1: shear-thin · 1: Newtonian · &gt;1: shear-thick</div>
                </div>
              </div>
            </Card>

            {/* Emulsion & Interfacial Properties */}
            <Card title="Emulsion & Interfacial Properties" subtitle="Separation difficulty">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-sm text-gray-400">Emulsion Stability</label>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-emerald-400">Easy</span>
                    <div className="flex-1 relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-emerald-500/30 via-amber-500/30 to-red-500/30">
                      <input type="range" min="0" max="1" step="0.05"
                        value={feedProps.emulsionStability}
                        onChange={(e) => setFeedProps(p => ({ ...p, emulsionStability: parseFloat(e.target.value) }))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="absolute top-0 left-0 h-full bg-white/80 rounded-full transition-all" style={{ width: `${feedProps.emulsionStability * 100}%` }} />
                    </div>
                    <span className="text-xs text-red-400">Stable</span>
                    <span className="w-12 text-right font-semibold text-white">{feedProps.emulsionStability.toFixed(2)}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-sm text-gray-400">Interfacial Tension (mN/m)</label>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-red-400">Low</span>
                    <input type="range" min="1" max="50" step="0.5"
                      value={feedProps.interfacialTension}
                      onChange={(e) => setFeedProps(p => ({ ...p, interfacialTension: parseFloat(e.target.value) }))}
                      className="flex-1 h-2 bg-white/10 rounded-full cursor-pointer"
                    />
                    <span className="text-xs text-emerald-400">High</span>
                    <span className="w-12 text-right font-semibold text-white">{feedProps.interfacialTension.toFixed(1)}</span>
                  </div>
                  <div className="text-xs text-gray-500">Low IFT = harder to coalesce droplets</div>
                </div>
              </div>
            </Card>

            {/* Chemical Dosing Link */}
            <div className="rounded-2xl p-5 bg-gradient-to-r from-teal-500/10 to-cyan-500/5 border border-teal-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/20 flex items-center justify-center">
                    <span className="text-xl">◎</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-teal-400">Chemical Treatment</h3>
                    <p className="text-sm text-gray-500">Configure dosing parameters in the Chemicals tab</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('chemDosing')}
                  className="px-5 py-2.5 bg-teal-500/20 hover:bg-teal-500/30 rounded-xl text-sm font-medium text-teal-400 transition-all"
                >
                  Open Chemicals →
                </button>
              </div>
            </div>

            {/* Water Quality & Advanced Parameters */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card title="Water Quality" subtitle="Environmental parameters">
                <div className="space-y-5">
                  <div className="space-y-3">
                    <label className="text-sm text-gray-400">Salinity / TDS (mg/L)</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min="0" max="200000" step="1000"
                        value={feedProps.salinity}
                        onChange={(e) => setFeedProps(p => ({ ...p, salinity: parseFloat(e.target.value) }))}
                        className="flex-1 h-2 bg-white/10 rounded-full cursor-pointer"
                      />
                      <NumInput value={feedProps.salinity} onChange={v => setFeedProps(p => ({ ...p, salinity: v }))} min={0} max={200000} className="w-24 bg-white/5 border-0 rounded-xl px-3 py-2 text-center text-white" />
                    </div>
                    <div className="text-xs text-gray-500">Freshwater &lt;1000 · Seawater ~35000 · Brine 50000+</div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm text-gray-400">Dissolved Gas (%)</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min="0" max="20" step="0.5"
                        value={feedProps.dissolvedGas}
                        onChange={(e) => setFeedProps(p => ({ ...p, dissolvedGas: parseFloat(e.target.value) }))}
                        className="flex-1 h-2 bg-white/10 rounded-full cursor-pointer"
                      />
                      <span className="w-14 text-right font-mono text-white">{feedProps.dissolvedGas.toFixed(1)}%</span>
                    </div>
                    <div className="text-xs text-gray-500">High gas content can cause cavitation</div>
                  </div>
                </div>
              </Card>

              <Card title="Advanced Settling" subtitle="Richardson-Zaki parameters">
                <div className="space-y-5">
                  <div className="space-y-3">
                    <label className="text-sm text-gray-400">Max Packing Fraction</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min="0.5" max="0.74" step="0.01"
                        value={feedProps.maxPackingFraction}
                        onChange={(e) => setFeedProps(p => ({ ...p, maxPackingFraction: parseFloat(e.target.value) }))}
                        className="flex-1 h-2 bg-white/10 rounded-full cursor-pointer"
                      />
                      <span className="w-14 text-right font-mono text-white">{feedProps.maxPackingFraction.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-gray-500">Random close packing ~0.64</div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm text-gray-400">Hindered Settling Exponent</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min="2.5" max="6" step="0.1"
                        value={feedProps.hinderedSettlingExp}
                        onChange={(e) => setFeedProps(p => ({ ...p, hinderedSettlingExp: parseFloat(e.target.value) }))}
                        className="flex-1 h-2 bg-white/10 rounded-full cursor-pointer"
                      />
                      <span className="w-14 text-right font-mono text-white">{feedProps.hinderedSettlingExp.toFixed(1)}</span>
                    </div>
                    <div className="text-xs text-gray-500">Spheres ~4.65, irregular particles higher</div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Feed Impact Summary */}
            <div className="rounded-2xl p-5 bg-gradient-to-r from-white/5 to-transparent border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Feed Impact on Separation</h3>
                <button
                  onClick={() => setActiveTab('centrifuge')}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View Live Operations →
                </button>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-xl bg-white/5">
                  <div className="text-xs text-gray-500 mb-1">Separation</div>
                  <div className={`text-lg font-semibold ${feedProps.emulsionStability < 0.3 ? 'text-emerald-400' : feedProps.emulsionStability < 0.6 ? 'text-amber-400' : 'text-red-400'}`}>
                    {feedProps.emulsionStability < 0.3 ? 'Easy' : feedProps.emulsionStability < 0.6 ? 'Moderate' : 'Difficult'}
                  </div>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/5">
                  <div className="text-xs text-gray-500 mb-1">Viscosity</div>
                  <div className={`text-lg font-semibold ${feedProps.oilViscosity < 30 ? 'text-emerald-400' : feedProps.oilViscosity < 100 ? 'text-amber-400' : 'text-red-400'}`}>
                    {feedProps.oilViscosity} mPa·s
                  </div>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/5">
                  <div className="text-xs text-gray-500 mb-1">Solids Load</div>
                  <div className={`text-lg font-semibold ${feedProps.solidsFraction < 0.03 ? 'text-emerald-400' : feedProps.solidsFraction < 0.08 ? 'text-amber-400' : 'text-red-400'}`}>
                    {(feedProps.solidsFraction * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/5">
                  <div className="text-xs text-gray-500 mb-1">Recovery</div>
                  <div className={`text-lg font-semibold ${smoothedProc.oilEff >= 90 ? 'text-emerald-400' : smoothedProc.oilEff >= 80 ? 'text-amber-400' : 'text-red-400'}`}>
                    {smoothedProc.oilEff.toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/*     SETPOINT CALCULATOR - Optimal Settings from Feed Properties */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-xl p-4 border border-purple-500/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🧮</span>
                  <div>
                    <h3 className="text-lg font-bold text-purple-300">Setpoint Calculator</h3>
                    <p className="text-xs text-slate-400">Calculate optimal setpoints based on Stokes Law separation theory</p>
                  </div>
                </div>
                <button
                  onClick={calculateRecommendedSetpoints}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  <span>Calculate Optimal Setpoints</span>
                </button>
              </div>

              {setpointCalc.calculated && (
                <div className="space-y-4">
                  {/* Recommended Setpoints with Toggle Controls */}
                  <div className="grid grid-cols-4 gap-3">
                    {/* Temperature */}
                    <div className={`rounded-lg p-3 border transition-all ${setpointCalc.applyTemp ? 'bg-slate-800/70 border-orange-500/50' : 'bg-slate-900/50 border-slate-700 opacity-60'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">Temperature</span>
                        <button
                          onClick={() => setSetpointCalc(p => ({ ...p, applyTemp: !p.applyTemp }))}
                          className={`w-10 h-5 rounded-full transition-colors ${setpointCalc.applyTemp ? 'bg-orange-500' : 'bg-slate-600'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${setpointCalc.applyTemp ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                      <div className={`text-2xl font-bold ${setpointCalc.applyTemp ? 'text-orange-400' : 'text-slate-500'}`}>{setpointCalc.temperature}°C</div>
                      <div className="text-xs text-slate-500">Current: {loops.TIC.sp}°C</div>
                    </div>
                    {/* Flow Rate */}
                    <div className={`rounded-lg p-3 border transition-all ${setpointCalc.applyFlow ? 'bg-slate-800/70 border-cyan-500/50' : 'bg-slate-900/50 border-slate-700 opacity-60'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">Flow Rate</span>
                        <button
                          onClick={() => setSetpointCalc(p => ({ ...p, applyFlow: !p.applyFlow }))}
                          className={`w-10 h-5 rounded-full transition-colors ${setpointCalc.applyFlow ? 'bg-cyan-500' : 'bg-slate-600'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${setpointCalc.applyFlow ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                      <div className={`text-2xl font-bold ${setpointCalc.applyFlow ? 'text-cyan-400' : 'text-slate-500'}`}>{setpointCalc.flowRate} m³/h</div>
                      <div className="text-xs text-slate-500">Current: {loops.FIC.sp} m³/h</div>
                    </div>
                    {/* Bowl Speed */}
                    <div className={`rounded-lg p-3 border transition-all ${setpointCalc.applySpeed ? 'bg-slate-800/70 border-green-500/50' : 'bg-slate-900/50 border-slate-700 opacity-60'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">Bowl Speed</span>
                        <button
                          onClick={() => setSetpointCalc(p => ({ ...p, applySpeed: !p.applySpeed }))}
                          className={`w-10 h-5 rounded-full transition-colors ${setpointCalc.applySpeed ? 'bg-green-500' : 'bg-slate-600'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${setpointCalc.applySpeed ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                      <div className={`text-2xl font-bold ${setpointCalc.applySpeed ? 'text-green-400' : 'text-slate-500'}`}>{setpointCalc.bowlSpeed} RPM</div>
                      <div className="text-xs text-slate-500">Current: {loops.SIC.sp} RPM</div>
                    </div>
                    {/* Demulsifier */}
                    <div className={`rounded-lg p-3 border transition-all ${setpointCalc.applyDemul ? 'bg-slate-800/70 border-pink-500/50' : 'bg-slate-900/50 border-slate-700 opacity-60'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">Demulsifier</span>
                        <button
                          onClick={() => setSetpointCalc(p => ({ ...p, applyDemul: !p.applyDemul }))}
                          className={`w-10 h-5 rounded-full transition-colors ${setpointCalc.applyDemul ? 'bg-pink-500' : 'bg-slate-600'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${setpointCalc.applyDemul ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                      <div className={`text-2xl font-bold ${setpointCalc.applyDemul ? 'text-pink-400' : 'text-slate-500'}`}>{setpointCalc.demulsifierDose} ppm</div>
                      <div className="text-xs text-slate-500">Current: {chemDosing.demulsifier.sp} ppm</div>
                    </div>
                  </div>

                  {/* Predicted Performance - Compact */}
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-6">
                        <div><span className="text-xs text-slate-500">Oil:</span> <span className={`font-bold ${setpointCalc.predictedOilEfficiency >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>{setpointCalc.predictedOilEfficiency}%</span></div>
                        <div><span className="text-xs text-slate-500">Solids:</span> <span className={`font-bold ${setpointCalc.predictedSolidsEfficiency >= 95 ? 'text-green-400' : 'text-yellow-400'}`}>{setpointCalc.predictedSolidsEfficiency}%</span></div>
                        <div><span className="text-xs text-slate-500">OiW:</span> <span className={`font-bold ${setpointCalc.predictedWaterQuality <= 15 ? 'text-green-400' : 'text-yellow-400'}`}>{setpointCalc.predictedWaterQuality} ppm</span></div>
                        <div><span className="text-xs text-slate-500">G:</span> <span className="font-bold text-blue-400">{setpointCalc.predictedGForce}</span></div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-bold ${setpointCalc.confidence === 'High' ? 'bg-green-900/50 text-green-400' : setpointCalc.confidence === 'Medium' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'}`}>
                        {setpointCalc.confidence} Confidence
                      </div>
                    </div>
                  </div>

                  {/* Notes - Collapsible */}
                  {setpointCalc.notes.length > 0 && (
                    <details className="bg-slate-800/30 rounded-lg">
                      <summary className="px-3 py-2 cursor-pointer text-xs text-slate-400 hover:text-slate-300">
                        {setpointCalc.notes.length} recommendation{setpointCalc.notes.length > 1 ? 's' : ''}
                      </summary>
                      <ul className="px-3 pb-2 space-y-1">
                        {setpointCalc.notes.map((note, i) => (
                          <li key={i} className="text-xs text-slate-300">• {note}</li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      {[setpointCalc.applyTemp, setpointCalc.applyFlow, setpointCalc.applySpeed, setpointCalc.applyDemul].filter(Boolean).length}/4 enabled
                      <span className="ml-2 text-slate-600">• 10s debounce</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSetpointCalc(p => ({ ...p, calculated: false }))}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => { applyRecommendedSetpoints(true); setActiveTab('centrifuge'); }}
                        disabled={![setpointCalc.applyTemp, setpointCalc.applyFlow, setpointCalc.applySpeed, setpointCalc.applyDemul].some(Boolean)}
                        className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 rounded font-semibold transition-colors"
                      >
                        Apply Selected →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!setpointCalc.calculated && (
                <div className="text-center py-4 text-slate-400 text-sm">
                  Adjust feed properties above, then click "Calculate Optimal Setpoints" to get recommendations based on Stokes Law separation theory.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/*                    CENTRIFUGE SEPARATION TAB                    */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'centrifuge' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">⚙️ Centrifuge Separation & GAC Polishing</h2>
              <div className="text-sm text-slate-400">
                Process: Feed → Centrifuge → GAC Filter → Evaporation Pond
              </div>
            </div>

            {/* WATER DISCHARGE Compliance Banner - License Conditions (using smoothed values) */}
            {/* Note: These limits ONLY apply to water discharge, NOT to oil or sludge products */}
            {dischargeLimits.enabled && (() => {
              const oiwVal = smoothedProc.filterOutletOiW || polishingFilter.outletOiW;
              const trhVal = smoothedProc.filterOutletTRH || polishingFilter.outletTRH;
              const codVal = smoothedProc.filterOutletCOD || polishingFilter.outletCOD;
              const turbVal = smoothedProc.filterOutletTurbidity || polishingFilter.outletTurbidity;
              const phVal = smoothedProc.pH || proc.pH;
              const oiwPass = oiwVal <= dischargeLimits.oilInWater;
              const trhPass = trhVal <= dischargeLimits.trh;      // License: <50 mg/L
              const codPass = codVal <= dischargeLimits.cod;      // License: <1000 mg/L
              const phPass = phVal >= dischargeLimits.pH.min && phVal <= dischargeLimits.pH.max;  // License: 6-9
              const turbPass = turbVal <= dischargeLimits.turbidity;
              const allPass = oiwPass && trhPass && codPass && phPass && turbPass;
              return (
                <div className={`rounded-xl p-4 border-2 ${allPass ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{allPass ? '✅' : '❌'}</span>
                      <div>
                        <div className={`font-bold text-lg ${allPass ? 'text-green-400' : 'text-red-400'}`}>
                          WATER DISCHARGE {allPass ? 'COMPLIANT' : 'NON-COMPLIANT'}
                        </div>
                        <div className="text-xs text-slate-400">Water quality after GAC filter → Evaporation Pond (License conditions)</div>
                      </div>
                    </div>
                    <div className="flex gap-2 text-sm flex-wrap">
                      <div className={`px-2 py-1 rounded-lg ${trhPass ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
                        <div className="text-xs text-slate-400">TRH</div>
                        <div className={`font-bold ${trhPass ? 'text-green-400' : 'text-red-400'}`}>{trhVal.toFixed(0)} mg/L</div>
                        <div className="text-xs text-slate-500">≤{dischargeLimits.trh}</div>
                      </div>
                      <div className={`px-2 py-1 rounded-lg ${codPass ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
                        <div className="text-xs text-slate-400">COD</div>
                        <div className={`font-bold ${codPass ? 'text-green-400' : 'text-red-400'}`}>{codVal.toFixed(0)} mg/L</div>
                        <div className="text-xs text-slate-500">≤{dischargeLimits.cod}</div>
                      </div>
                      <div className={`px-2 py-1 rounded-lg ${phPass ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
                        <div className="text-xs text-slate-400">pH</div>
                        <div className={`font-bold ${phPass ? 'text-green-400' : 'text-red-400'}`}>{phVal.toFixed(1)}</div>
                        <div className="text-xs text-slate-500">{dischargeLimits.pH.min}-{dischargeLimits.pH.max}</div>
                      </div>
                      <div className={`px-2 py-1 rounded-lg ${oiwPass ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
                        <div className="text-xs text-slate-400">OiW</div>
                        <div className={`font-bold ${oiwPass ? 'text-green-400' : 'text-red-400'}`}>{oiwVal.toFixed(0)} ppm</div>
                        <div className="text-xs text-slate-500">≤{dischargeLimits.oilInWater}</div>
                      </div>
                      <div className={`px-2 py-1 rounded-lg ${turbPass ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
                        <div className="text-xs text-slate-400">Turbidity</div>
                        <div className={`font-bold ${turbPass ? 'text-green-400' : 'text-red-400'}`}>{turbVal.toFixed(1)} NTU</div>
                        <div className="text-xs text-slate-500">≤{dischargeLimits.turbidity}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* PRODUCT QUALITY Banner - Oil Moisture and Sludge/CF Cake Moisture */}
            {productLimits.enabled && (() => {
              const oilMoistureVal = smoothedProc.oilMoisture || proc.oilMoisture;
              const sludgeMoistureVal = smoothedProc.sludgeMoisture || proc.sludgeMoisture;
              const oilPass = oilMoistureVal <= productLimits.oilMoisture;
              const sludgePass = sludgeMoistureVal <= productLimits.sludgeMoisture;
              const allPass = oilPass && sludgePass;
              return (
                <div className={`rounded-xl p-4 border-2 ${allPass ? 'bg-amber-900/20 border-amber-500' : 'bg-orange-900/20 border-orange-500'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{allPass ? '🛢️' : '⚠️'}</span>
                      <div>
                        <div className={`font-bold text-lg ${allPass ? 'text-amber-400' : 'text-orange-400'}`}>
                          PRODUCT QUALITY {allPass ? 'ON-SPEC' : 'OFF-SPEC'}
                        </div>
                        <div className="text-xs text-slate-400">Oil and Sludge/CF Cake moisture content</div>
                      </div>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div className={`px-4 py-2 rounded-lg ${oilPass ? 'bg-amber-900/50 border border-amber-500/50' : 'bg-orange-900/50 border border-orange-500/50'}`}>
                        <div className="text-xs text-slate-400">Oil Moisture</div>
                        <div className={`font-bold text-xl ${oilPass ? 'text-amber-400' : 'text-orange-400'}`}>{oilMoistureVal.toFixed(1)}%</div>
                        <div className="text-xs text-slate-500">Target: &lt;{productLimits.oilMoisture}% v/v</div>
                      </div>
                      <div className={`px-4 py-2 rounded-lg ${sludgePass ? 'bg-amber-900/50 border border-amber-500/50' : 'bg-orange-900/50 border border-orange-500/50'}`}>
                        <div className="text-xs text-slate-400">Sludge/CF Cake Moisture</div>
                        <div className={`font-bold text-xl ${sludgePass ? 'text-amber-400' : 'text-orange-400'}`}>{sludgeMoistureVal.toFixed(1)}%</div>
                        <div className="text-xs text-slate-500">Target: &lt;{productLimits.sludgeMoisture}% v/v</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Live PV Display Strip - Process Values */}
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
              <PV tag="Feed Flow" val={smoothedProc.feedFlow} unit="m³/h" lo={5} hi={14} />
              <PV tag="Heater" val={smoothedProc.heaterTemp} unit="°C" lo={50} hi={80} />
              <PV tag="Bowl Speed" val={smoothedProc.bowlSpeed} unit="RPM" lo={2000} hi={4800} dec={0} />
              <PV tag="G-Force" val={smoothedProc.gForce} unit="G" lo={1000} hi={4000} dec={0} />
              <PV tag="Oil Eff" val={smoothedProc.oilEff} unit="%" lo={85} hi={100} />
              <PV tag="Final OiW" val={polishingFilter.outletOiW} unit="ppm" lo={0} hi={dischargeLimits.oilInWater} />
              <PV tag="Vibration" val={smoothedProc.vibration} unit="mm/s" lo={0} hi={7} />
              <PV tag="Power" val={smoothedProc.totalPower} unit="kW" lo={0} hi={180} dec={0} />
            </div>

            {/* Batch Progress */}
            {isBatchMode && (
              <div className="bg-purple-900/30 rounded-xl p-4 border border-purple-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{batchPhases[batchPhase]?.icon}</span>
                    <div>
                      <div className="font-bold text-purple-300">{batchPhases[batchPhase]?.name}</div>
                      <div className="text-xs text-slate-400">Phase {batchPhase + 1} of {batchPhases.length}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-400">{batchProgress.pct.toFixed(1)}%</div>
                    <div className="text-xs text-slate-400">{(batchProgress.remain * 1000).toFixed(0)} L remaining</div>
                  </div>
                </div>
                <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all" style={{ width: `${batchProgress.pct}%` }} />
                </div>
              </div>
            )}

            {/* Control Faceplates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(loops).map(([k, l]) => {
                const smoothedPVMap = { TIC: smoothedProc.heaterTemp, FIC: smoothedProc.feedFlow, SIC: smoothedProc.bowlSpeed };
                return <Faceplate key={k} loop={l} smoothedPV={smoothedPVMap[k]} onUp={u => setLoops(p => ({ ...p, [k]: { ...p[k], ...u } }))} />;
              })}
            </div>

            {/* Summary Cards - Updated with post-filter values */}
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-green-400 mb-3">📊 Centrifuge</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Oil Recovery</span><span className={smoothedProc.oilEff > 90 ? 'text-green-400' : 'text-yellow-400'}>{smoothedProc.oilEff.toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Solids Removal</span><span className={smoothedProc.solidsEff > 95 ? 'text-green-400' : 'text-yellow-400'}>{smoothedProc.solidsEff.toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Pre-filter OiW</span><span className="text-slate-300">{smoothedProc.waterQuality.toFixed(0)} ppm</span></div>
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-teal-900/50">
                <h4 className="text-sm font-semibold text-teal-400 mb-3">🔵 GAC Filter</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Final OiW</span><span className={polishingFilter.outletOiW <= dischargeLimits.oilInWater ? 'text-green-400' : 'text-red-400'}>{polishingFilter.outletOiW.toFixed(0)} ppm</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Final Turbidity</span><span className={polishingFilter.outletTurbidity <= dischargeLimits.turbidity ? 'text-green-400' : 'text-red-400'}>{polishingFilter.outletTurbidity.toFixed(1)} NTU</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Bed Saturation</span><span className={polishingFilter.bedSaturation < 80 ? 'text-green-400' : 'text-yellow-400'}>{polishingFilter.bedSaturation.toFixed(0)}%</span></div>
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-amber-400 mb-3">⚡ Energy</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Total Power</span><span>{smoothedProc.totalPower.toFixed(1)} kW</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Specific Energy</span><span>{computed.specificEnergy.toFixed(1)} kWh/m³</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Cost Rate</span><span className="text-red-400">${computed.hourly.energyCost.toFixed(2)}/h</span></div>
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-cyan-400 mb-3">📈 Session Totals</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Feed Processed</span><span>{totals.feed.toFixed(2)} m³</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Oil Recovered</span><span className="text-amber-400">{(totals.oil * 1000).toFixed(1)} L</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Water Discharged</span><span className="text-cyan-400">{totals.water.toFixed(2)} m³</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Sludge Disposal</span><span className="text-orange-400">{(totals.solids * 1000).toFixed(1)} L</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Energy Used</span><span className="text-yellow-400">{totals.energy.toFixed(1)} kWh</span></div>
                  <div className="flex justify-between border-t border-slate-600 pt-2 mt-2"><span className="text-slate-400">Run Time</span><span>{formatTime(totals.runTime)}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-600">
                  <div className="text-xs text-slate-500 mb-1">Sludge Disposal Cost</div>
                  <div className="text-lg font-bold text-orange-400">${(totals.solids * costs.sludgeDisposal).toFixed(2)}</div>
                  <div className="text-xs text-slate-500">@ ${costs.sludgeDisposal}/m³</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/*                         CONFIG TAB                              */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">⚙️ Model Configuration</h2>
            
            {/* Preset Use Cases */}
            <div className="bg-slate-800 rounded-lg p-5 border border-purple-900/50">
              <h3 className="text-lg font-semibold text-purple-400 mb-4">📋 Preset Scenarios</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button onClick={() => {
                  setFeedProps(p => ({ ...p, waterFraction: 0.75, oilFraction: 0.20, solidsFraction: 0.05, emulsionStability: 0.3 }));
                  setDisturbances(p => ({ ...p, compVar: 0.05, tempVar: 0.03, flowVar: 0.02 }));
                }} className="p-3 bg-green-900/30 hover:bg-green-900/50 border border-green-600 rounded-lg transition-colors">
                  <div className="text-green-400 font-bold text-sm">✅ Normal Feed</div>
                  <div className="text-xs text-slate-400 mt-1">20% oil, low variability</div>
                </button>
                <button onClick={() => {
                  setFeedProps(p => ({ ...p, waterFraction: 0.45, oilFraction: 0.45, solidsFraction: 0.10, emulsionStability: 0.7, oilDropletD50: 15 }));
                  setDisturbances(p => ({ ...p, compVar: 0.15, tempVar: 0.08 }));
                }} className="p-3 bg-amber-900/30 hover:bg-amber-900/50 border border-amber-600 rounded-lg transition-colors">
                  <div className="text-amber-400 font-bold text-sm">🧴 Difficult Emulsion</div>
                  <div className="text-xs text-slate-400 mt-1">High oil, tight emulsion</div>
                </button>
                <button onClick={() => {
                  setFeedProps(p => ({ ...p, waterFraction: 0.65, oilFraction: 0.15, solidsFraction: 0.20, solidsD50: 120 }));
                  setDisturbances(p => ({ ...p, compVar: 0.20, flowVar: 0.05 }));
                }} className="p-3 bg-orange-900/30 hover:bg-orange-900/50 border border-orange-600 rounded-lg transition-colors">
                  <div className="text-orange-400 font-bold text-sm">🪨 High Solids</div>
                  <div className="text-xs text-slate-400 mt-1">20% solids, coarse</div>
                </button>
                <button onClick={() => {
                  setFeedProps(p => ({ ...p, waterFraction: 0.88, oilFraction: 0.10, solidsFraction: 0.02, oilDropletD50: 35 }));
                  setDisturbances(p => ({ ...p, compVar: 0.03, tempVar: 0.02, flowVar: 0.01 }));
                }} className="p-3 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-600 rounded-lg transition-colors">
                  <div className="text-blue-400 font-bold text-sm">💧 Water-Rich</div>
                  <div className="text-xs text-slate-400 mt-1">Low oil, easy separation</div>
                </button>
                <button onClick={() => {
                  setFeedProps(p => ({ ...p, waterFraction: 0.50, oilFraction: 0.35, solidsFraction: 0.15, emulsionStability: 0.5 }));
                  setDisturbances(p => ({ ...p, compVar: 0.25, tempVar: 0.10, flowVar: 0.08, pumpCavitation: false }));
                }} className="p-3 bg-red-900/30 hover:bg-red-900/50 border border-red-600 rounded-lg transition-colors">
                  <div className="text-red-400 font-bold text-sm">⚠️ Upset Conditions</div>
                  <div className="text-xs text-slate-400 mt-1">High variability</div>
                </button>
                <button onClick={() => {
                  setEquipment(p => ({ ...p, bearingCondition: 65 }));
                  setDisturbances(p => ({ ...p, compVar: 0.08, tempVar: 0.05 }));
                }} className="p-3 bg-yellow-900/30 hover:bg-yellow-900/50 border border-yellow-600 rounded-lg transition-colors">
                  <div className="text-yellow-400 font-bold text-sm">🔧 Worn Bearings</div>
                  <div className="text-xs text-slate-400 mt-1">65% condition, high vib</div>
                </button>
                <button onClick={() => {
                  setFeedProps(p => ({ ...p, waterFraction: 0.30, oilFraction: 0.65, solidsFraction: 0.05, oilDropletD50: 40 }));
                  setDisturbances(p => ({ ...p, compVar: 0.05 }));
                }} className="p-3 bg-cyan-900/30 hover:bg-cyan-900/50 border border-cyan-600 rounded-lg transition-colors">
                  <div className="text-cyan-400 font-bold text-sm">🛢️ Oil-Rich Slop</div>
                  <div className="text-xs text-slate-400 mt-1">65% oil content</div>
                </button>
                <button onClick={() => {
                  // Delta-Canter 20-843A defaults (SACOR)
                  setEquipment(p => ({ ...p, heaterCapacity: 150, centrifugeCapacity: 56, maxRPM: 3600, minRPM: 2200, maxFlow: 30, bowlDiameter: 520, bowlLength: 1800, bearingCondition: 100 }));
                  setFeedProps(p => ({ ...p, waterFraction: 0.75, oilFraction: 0.20, solidsFraction: 0.05, oilDensity: 890, solidsDensity: 2650, oilDropletD50: 25, solidsD50: 80, emulsionStability: 0.3, demulsifierEff: 0.7 }));
                  setDisturbances(p => ({ ...p, compVar: 0.10, tempVar: 0.05, flowVar: 0.03, pumpCavitation: false }));
                  setLoops(p => ({ ...p, FIC: { ...p.FIC, sp: 15 }, SIC: { ...p.SIC, sp: 3200 } }));
                }} className="p-3 bg-slate-700 hover:bg-slate-600 border border-slate-500 rounded-lg transition-colors">
                  <div className="text-slate-300 font-bold text-sm">🔄 Reset Defaults</div>
                  <div className="text-xs text-slate-400 mt-1">Delta-Canter 20-843A</div>
                </button>
              </div>
            </div>
            
            <p className="text-slate-400 text-sm">Click any input field and type directly to change values.</p>
            
            {/* Equipment */}
            <div className="bg-slate-800 rounded-lg p-5 border border-cyan-900/50">
              <h3 className="text-lg font-semibold text-cyan-400 mb-4">🔧 Equipment Specifications</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 border-b border-slate-700 pb-2">Heater</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Capacity" value={equipment.heaterCapacity} onChange={v => setEquipment(p => ({ ...p, heaterCapacity: v }))} unit="kW" />
                    <Field label="Efficiency" value={equipment.heaterEfficiency} onChange={v => setEquipment(p => ({ ...p, heaterEfficiency: v }))} unit="%" />
                    <Field label="Max Temp" value={equipment.heaterMaxTemp} onChange={v => setEquipment(p => ({ ...p, heaterMaxTemp: v }))} unit="°C" />
                    <Field label="Time Constant" value={equipment.heaterTimeConstant} onChange={v => setEquipment(p => ({ ...p, heaterTimeConstant: v }))} unit="s" />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 border-b border-slate-700 pb-2">Centrifuge</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Motor Capacity" value={equipment.centrifugeCapacity} onChange={v => setEquipment(p => ({ ...p, centrifugeCapacity: v }))} unit="kW" />
                    <Field label="Max RPM" value={equipment.maxRPM} onChange={v => setEquipment(p => ({ ...p, maxRPM: v }))} unit="RPM" />
                    <Field label="Bowl Diameter" value={equipment.bowlDiameter} onChange={v => setEquipment(p => ({ ...p, bowlDiameter: v }))} unit="mm" />
                    <Field label="Bowl Length" value={equipment.bowlLength} onChange={v => setEquipment(p => ({ ...p, bowlLength: v }))} unit="mm" />
                    <Field label="Motor Efficiency" value={equipment.motorEfficiency} onChange={v => setEquipment(p => ({ ...p, motorEfficiency: v }))} unit="%" />
                    <Field label="Bearing Condition" value={equipment.bearingCondition} onChange={v => setEquipment(p => ({ ...p, bearingCondition: v }))} unit="%" />
                  </div>
                </div>
              </div>
            </div>

            {/* Feed Properties */}
            <div className="bg-slate-800 rounded-lg p-5 border border-amber-900/50">
              <h3 className="text-lg font-semibold text-amber-400 mb-4">🛢️ Feed Properties</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 border-b border-slate-700 pb-2">Composition</h4>
                  <div className="space-y-3">
                    <Field label="Water Fraction" value={feedProps.waterFraction} onChange={v => setFeedProps(p => ({ ...p, waterFraction: v }))} min={0} max={1} />
                    <Field label="Oil Fraction" value={feedProps.oilFraction} onChange={v => setFeedProps(p => ({ ...p, oilFraction: v }))} min={0} max={1} />
                    <Field label="Solids Fraction" value={feedProps.solidsFraction} onChange={v => setFeedProps(p => ({ ...p, solidsFraction: v }))} min={0} max={0.2} />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 border-b border-slate-700 pb-2">Physical</h4>
                  <div className="space-y-3">
                    <Field label="Oil Density" value={feedProps.oilDensity} onChange={v => setFeedProps(p => ({ ...p, oilDensity: v }))} unit="kg/m³" />
                    <Field label="Solids Density" value={feedProps.solidsDensity} onChange={v => setFeedProps(p => ({ ...p, solidsDensity: v }))} unit="kg/m³" />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 border-b border-slate-700 pb-2">Particle Size</h4>
                  <div className="space-y-3">
                    <Field label="Oil Droplet D50" value={feedProps.oilDropletD50} onChange={v => setFeedProps(p => ({ ...p, oilDropletD50: v }))} unit="μm" />
                    <Field label="Solids D50" value={feedProps.solidsD50} onChange={v => setFeedProps(p => ({ ...p, solidsD50: v }))} unit="μm" />
                    <Field label="Emulsion Stability" value={feedProps.emulsionStability} onChange={v => setFeedProps(p => ({ ...p, emulsionStability: v }))} min={0} max={1} />
                  </div>
                </div>
              </div>
            </div>

            {/* Disturbances */}
            <div className="bg-slate-800 rounded-lg p-5 border border-orange-900/50">
              <h3 className="text-lg font-semibold text-orange-400 mb-4">⚠️ Process Disturbances</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 border-b border-slate-700 pb-2">Variability</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-400 flex justify-between mb-1">
                        <span>Composition Variability</span>
                        <span className="text-orange-400 font-bold">{(disturbances.compVar * 100).toFixed(0)}%</span>
                      </label>
                      <input type="range" min="0" max="0.3" step="0.01" value={disturbances.compVar} onChange={e => setDisturbances(p => ({ ...p, compVar: +e.target.value }))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 flex justify-between mb-1">
                        <span>Temperature Variability</span>
                        <span className="text-orange-400 font-bold">{(disturbances.tempVar * 100).toFixed(0)}%</span>
                      </label>
                      <input type="range" min="0" max="0.2" step="0.01" value={disturbances.tempVar} onChange={e => setDisturbances(p => ({ ...p, tempVar: +e.target.value }))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 flex justify-between mb-1">
                        <span>Flow Variability</span>
                        <span className="text-orange-400 font-bold">{(disturbances.flowVar * 100).toFixed(1)}%</span>
                      </label>
                      <input type="range" min="0" max="0.1" step="0.005" value={disturbances.flowVar} onChange={e => setDisturbances(p => ({ ...p, flowVar: +e.target.value }))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <Field label="Ambient Temp" value={disturbances.ambientTemp} onChange={v => setDisturbances(p => ({ ...p, ambientTemp: v }))} unit="°C" />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 border-b border-slate-700 pb-2">Step Disturbances</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setDisturbances(p => ({ ...p, slugEnabled: true, slugRemain: p.slugDur }))} 
                        disabled={disturbances.slugRemain > 0}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                      >
                        🌊 Inject Slug
                      </button>
                      {disturbances.slugRemain > 0 && (
                        <span className="text-orange-400 animate-pulse font-bold">Active: {disturbances.slugRemain.toFixed(0)}s</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Slug Magnitude" value={disturbances.slugMag} onChange={v => setDisturbances(p => ({ ...p, slugMag: v }))} min={1} max={5} />
                      <Field label="Slug Duration" value={disturbances.slugDur} onChange={v => setDisturbances(p => ({ ...p, slugDur: v }))} unit="s" />
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={disturbances.pumpCavitation} onChange={e => setDisturbances(p => ({ ...p, pumpCavitation: e.target.checked }))} className="w-5 h-5 rounded bg-slate-700 border-slate-600" />
                      <span className="text-sm">Pump Cavitation</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Feedstock & Revenue */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-lg p-5 border border-amber-900/50">
                <h3 className="text-lg font-semibold text-amber-400 mb-4">🛢️ Feedstock Type & Oil Revenue</h3>

                {/* Feedstock Selector */}
                <div className="mb-4">
                  <label className="block text-sm text-slate-400 mb-2">Feed Material</label>
                  <select
                    value={selectedFeedstock}
                    onChange={(e) => setSelectedFeedstock(e.target.value as keyof typeof feedstockTypes)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {Object.entries(feedstockTypes).map(([key, type]) => (
                      <option key={key} value={key}>{type.name} - ${type.oilValue}/m³</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">{feedstockTypes[selectedFeedstock].description}</p>
                </div>

                {/* Feedstock Characteristics */}
                <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-slate-700/50 rounded-lg">
                  <div>
                    <span className="text-xs text-slate-500">Typical Oil Content</span>
                    <div className={`font-mono font-bold ${feedstockTypes[selectedFeedstock].color}`}>
                      {feedstockTypes[selectedFeedstock].oilContent}%
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Typical Solids</span>
                    <div className="font-mono font-bold text-amber-400">
                      {feedstockTypes[selectedFeedstock].solidsContent}%
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Oil Value</span>
                    <div className="font-mono font-bold text-green-400">
                      ${feedstockTypes[selectedFeedstock].oilValue}/m³
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Per Liter</span>
                    <div className="font-mono font-bold text-green-400">
                      ${(feedstockTypes[selectedFeedstock].oilValue / 1000).toFixed(2)}/L
                    </div>
                  </div>
                </div>

                {/* Transport Destination */}
                <div className="mb-4">
                  <label className="block text-sm text-slate-400 mb-2">Transport Destination</label>
                  <select
                    value={selectedDestination}
                    onChange={(e) => setSelectedDestination(e.target.value as keyof typeof transportDestinations)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {Object.entries(transportDestinations).map(([key, dest]) => (
                      <option key={key} value={key}>{dest.name} - ${dest.cost}/m³ ({dest.distance})</option>
                    ))}
                  </select>
                </div>

                {/* Net Oil Value Summary */}
                <div className="p-3 bg-green-900/30 border border-green-700 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-300">Net Oil Value (after transport)</span>
                    <span className="text-xl font-bold text-green-400">
                      ${(costs.oilValue - costs.oilTransport).toLocaleString()}/m³
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    ${costs.oilValue}/m³ value − ${costs.oilTransport}/m³ transport = ${((costs.oilValue - costs.oilTransport) / 1000).toFixed(2)}/L net
                  </div>
                </div>
              </div>

              {/* Operating Costs */}
              <div className="bg-slate-800 rounded-lg p-5 border border-green-900/50">
                <h3 className="text-lg font-semibold text-green-400 mb-4">💰 Operating Costs</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Electricity" value={costs.elec} onChange={v => setCosts(p => ({ ...p, elec: v }))} unit="$/kWh" step={0.01} />
                  <Field label="Sludge Disposal" value={costs.sludgeDisposal} onChange={v => setCosts(p => ({ ...p, sludgeDisposal: v }))} unit="$/m³" />
                  <Field label="Water Treatment" value={costs.waterTreatment} onChange={v => setCosts(p => ({ ...p, waterTreatment: v }))} unit="$/m³" />
                  <Field label="Pond Disposal" value={costs.pondDisposal} onChange={v => setCosts(p => ({ ...p, pondDisposal: v }))} unit="$/m³" />
                  <Field label="Labor Rate" value={costs.laborRate} onChange={v => setCosts(p => ({ ...p, laborRate: v }))} unit="$/h" />
                </div>

                {/* Price Reference */}
                <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
                  <h4 className="text-xs font-semibold text-slate-400 mb-2">📊 Oil Price Reference (Brent ~$75/bbl)</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Light Sweet:</span>
                      <span className="text-green-400">$400-520/m³</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Heavy Sour:</span>
                      <span className="text-orange-400">$280-380/m³</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Slop Oil:</span>
                      <span className="text-purple-400">$350-450/m³</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tank Bottoms:</span>
                      <span className="text-amber-400">$200-300/m³</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-5 border border-blue-900/50">
                <h3 className="text-lg font-semibold text-blue-400 mb-4">🎯 KPI Targets</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Oil Efficiency" value={targets.oilEff} onChange={v => setTargets(p => ({ ...p, oilEff: v }))} unit="%" />
                  <Field label="Solids Efficiency" value={targets.solidsEff} onChange={v => setTargets(p => ({ ...p, solidsEff: v }))} unit="%" />
                  <Field label="Water Quality" value={targets.waterQuality} onChange={v => setTargets(p => ({ ...p, waterQuality: v }))} unit="ppm" />
                  <Field label="Max Vibration" value={targets.maxVib} onChange={v => setTargets(p => ({ ...p, maxVib: v }))} unit="mm/s" />
                </div>
              </div>
            </div>

            {/* Discharge Quality Limits */}
            <div className="bg-slate-800 rounded-lg p-5 border border-red-900/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-red-400">🚨 Discharge Quality Limits (Regulatory Compliance)</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dischargeLimits.enabled}
                    onChange={e => setDischargeLimits(p => ({ ...p, enabled: e.target.checked }))}
                    className="w-5 h-5 rounded bg-slate-700 border-slate-600"
                  />
                  <span className="text-sm text-slate-300">Enable Limit Checking</span>
                </label>
              </div>

              {/* Current Compliance Status */}
              {dischargeLimits.enabled && (
                <div className="mb-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                  <div className="text-xs text-slate-400 mb-2 font-semibold">CURRENT DISCHARGE STATUS (Post-GAC Filter)</div>
                  <div className="grid grid-cols-5 gap-3 text-center text-sm">
                    <div className={`p-2 rounded ${polishingFilter.outletOiW <= dischargeLimits.oilInWater ? 'bg-green-900/30 border border-green-500/50' : 'bg-red-900/30 border border-red-500/50'}`}>
                      <div className="text-xs text-slate-400">OiW</div>
                      <div className={`font-bold ${polishingFilter.outletOiW <= dischargeLimits.oilInWater ? 'text-green-400' : 'text-red-400'}`}>
                        {polishingFilter.outletOiW.toFixed(0)} / {dischargeLimits.oilInWater} ppm
                      </div>
                      <div className="text-xs">{polishingFilter.outletOiW <= dischargeLimits.oilInWater ? '✓ PASS' : '✗ FAIL'}</div>
                    </div>
                    <div className={`p-2 rounded ${(pond.oilInWater || polishingFilter.outletOiW) <= dischargeLimits.tph ? 'bg-green-900/30 border border-green-500/50' : 'bg-red-900/30 border border-red-500/50'}`}>
                      <div className="text-xs text-slate-400">Pond TPH</div>
                      <div className={`font-bold ${(pond.oilInWater || polishingFilter.outletOiW) <= dischargeLimits.tph ? 'text-green-400' : 'text-red-400'}`}>
                        {(pond.oilInWater || polishingFilter.outletOiW).toFixed(0)} / {dischargeLimits.tph} ppm
                      </div>
                      <div className="text-xs">{(pond.oilInWater || polishingFilter.outletOiW) <= dischargeLimits.tph ? '✓ PASS' : '✗ FAIL'}</div>
                    </div>
                    <div className={`p-2 rounded ${polishingFilter.outletTurbidity <= dischargeLimits.turbidity ? 'bg-green-900/30 border border-green-500/50' : 'bg-red-900/30 border border-red-500/50'}`}>
                      <div className="text-xs text-slate-400">Turbidity</div>
                      <div className={`font-bold ${polishingFilter.outletTurbidity <= dischargeLimits.turbidity ? 'text-green-400' : 'text-red-400'}`}>
                        {polishingFilter.outletTurbidity.toFixed(1)} / {dischargeLimits.turbidity} NTU
                      </div>
                      <div className="text-xs">{polishingFilter.outletTurbidity <= dischargeLimits.turbidity ? '✓ PASS' : '✗ FAIL'}</div>
                    </div>
                    <div className={`p-2 rounded ${(pond.pH >= dischargeLimits.pH.min && pond.pH <= dischargeLimits.pH.max) ? 'bg-green-900/30 border border-green-500/50' : 'bg-red-900/30 border border-red-500/50'}`}>
                      <div className="text-xs text-slate-400">pH</div>
                      <div className={`font-bold ${(pond.pH >= dischargeLimits.pH.min && pond.pH <= dischargeLimits.pH.max) ? 'text-green-400' : 'text-red-400'}`}>
                        {pond.pH.toFixed(1)} ({dischargeLimits.pH.min}-{dischargeLimits.pH.max})
                      </div>
                      <div className="text-xs">{(pond.pH >= dischargeLimits.pH.min && pond.pH <= dischargeLimits.pH.max) ? '✓ PASS' : '✗ FAIL'}</div>
                    </div>
                    <div className={`p-2 rounded ${smoothedProc.bowlTemp <= dischargeLimits.temperature ? 'bg-green-900/30 border border-green-500/50' : 'bg-yellow-900/30 border border-yellow-500/50'}`}>
                      <div className="text-xs text-slate-400">Temp</div>
                      <div className={`font-bold ${smoothedProc.bowlTemp <= dischargeLimits.temperature ? 'text-green-400' : 'text-yellow-400'}`}>
                        {smoothedProc.bowlTemp.toFixed(0)} / {dischargeLimits.temperature} °C
                      </div>
                      <div className="text-xs">{smoothedProc.bowlTemp <= dischargeLimits.temperature ? '✓ PASS' : '⚠ HIGH'}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-cyan-400 mb-3 border-b border-cyan-700 pb-2">📋 License Conditions</h4>
                  <div className="space-y-3">
                    <Field label="TRH Limit" value={dischargeLimits.trh} onChange={v => setDischargeLimits(p => ({ ...p, trh: v }))} unit="mg/L" min={10} max={100} />
                    <Field label="COD Limit" value={dischargeLimits.cod} onChange={v => setDischargeLimits(p => ({ ...p, cod: v }))} unit="mg/L" min={100} max={2000} />
                    <Field label="pH Min" value={dischargeLimits.pH.min} onChange={v => setDischargeLimits(p => ({ ...p, pH: { ...p.pH, min: v } }))} unit="" min={4} max={8} step={0.1} />
                    <Field label="pH Max" value={dischargeLimits.pH.max} onChange={v => setDischargeLimits(p => ({ ...p, pH: { ...p.pH, max: v } }))} unit="" min={7} max={12} step={0.1} />
                  </div>
                  <div className="mt-3 p-2 bg-cyan-900/20 rounded border border-cyan-700/50 text-xs text-cyan-300">
                    <div className="font-semibold mb-1">Your License:</div>
                    <div>• TRH: &lt;{dischargeLimits.trh} mg/L</div>
                    <div>• COD: &lt;{dischargeLimits.cod} mg/L</div>
                    <div>• pH: {dischargeLimits.pH.min}-{dischargeLimits.pH.max}</div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 border-b border-slate-700 pb-2">Operational Limits</h4>
                  <div className="space-y-3">
                    <Field label="Max Oil-in-Water" value={dischargeLimits.oilInWater} onChange={v => setDischargeLimits(p => ({ ...p, oilInWater: v }))} unit="ppm" min={1} max={100} />
                    <Field label="Pond TPH (internal)" value={dischargeLimits.tph} onChange={v => setDischargeLimits(p => ({ ...p, tph: v }))} unit="ppm" min={50} max={1000} />
                    <Field label="Max Turbidity" value={dischargeLimits.turbidity} onChange={v => setDischargeLimits(p => ({ ...p, turbidity: v }))} unit="NTU" min={1} max={200} />
                    <Field label="Max TSS" value={dischargeLimits.tss} onChange={v => setDischargeLimits(p => ({ ...p, tss: v }))} unit="mg/L" min={1} max={100} />
                    <Field label="Max Temperature" value={dischargeLimits.temperature} onChange={v => setDischargeLimits(p => ({ ...p, temperature: v }))} unit="°C" min={20} max={60} />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 border-b border-slate-700 pb-2">Scientific Basis</h4>
                  <div className="space-y-2 text-xs text-slate-400">
                    <div className="p-2 bg-slate-700/30 rounded">
                      <div className="font-semibold text-amber-400">TRH (Total Recoverable HC)</div>
                      <div>TRH = OiW + Dissolved HC (~30%)</div>
                      <div>GAC removes dissolved fraction</div>
                    </div>
                    <div className="p-2 bg-slate-700/30 rounded">
                      <div className="font-semibold text-purple-400">COD (Chemical Oxygen Demand)</div>
                      <div>COD ≈ 3.5 × Oil(mg/L) + organics</div>
                      <div>Stoichiometric O₂ for oxidation</div>
                    </div>
                    <div className="p-2 bg-slate-700/30 rounded">
                      <div className="font-semibold text-green-400">pH 6-9</div>
                      <div>Aquatic life protection range</div>
                      <div>Controlled via acid/caustic dosing</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/*                         CONTROLS TAB                            */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'controls' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">🎛️ Control System Overview</h2>
              <div className="flex gap-2 text-sm">
                {Object.entries(loops).every(([_, l]) => l.mode === 'AUTO')
                  ? <span className="px-3 py-1 bg-green-900/50 border border-green-500 rounded-lg text-green-400">All Loops AUTO</span>
                  : <span className="px-3 py-1 bg-amber-900/50 border border-amber-500 rounded-lg text-amber-400">Manual Override Active</span>}
              </div>
            </div>

            {/* Quick Status Strip */}
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(loops).map(([k, l]) => {
                const smoothedPVMap = { TIC: smoothedProc.heaterTemp, FIC: smoothedProc.feedFlow, SIC: smoothedProc.bowlSpeed };
                const units = { TIC: '°C', FIC: 'm³/h', SIC: 'RPM' };
                const pv = smoothedPVMap[k] || l.pv;
                const err = Math.abs(pv - l.sp);
                const errPct = l.sp > 0 ? (err / l.sp) * 100 : 0;
                const isTracking = errPct < 5;
                return (
                  <div key={k} className={`rounded-lg p-3 border ${isTracking ? 'bg-green-900/20 border-green-500/50' : 'bg-amber-900/20 border-amber-500/50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isTracking ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`}></span>
                        <span className="font-bold text-slate-300">{l.tag}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${l.mode === 'AUTO' ? 'bg-green-600' : 'bg-amber-600'}`}>{l.mode}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500">PV / SP</div>
                        <div className="font-mono">
                          <span className={isTracking ? 'text-green-400' : 'text-amber-400'}>{pv?.toFixed(1)}</span>
                          <span className="text-slate-500"> / </span>
                          <span className="text-slate-300">{l.sp?.toFixed(1)}</span>
                          <span className="text-xs text-slate-500 ml-1">{units[k]}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detailed Controller Cards */}
            <h3 className="text-lg font-semibold text-slate-400 border-b border-slate-700 pb-2">PID Controller Tuning</h3>
            <div className="grid md:grid-cols-3 gap-6">
              {Object.entries(loops).map(([k, l]) => {
                const smoothedPVMap = { TIC: smoothedProc.heaterTemp, FIC: smoothedProc.feedFlow, SIC: smoothedProc.bowlSpeed };
                const displayPV = smoothedPVMap[k] || l.pv;
                return (
                <div key={k} className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="font-bold text-cyan-400 text-lg">{l.tag}</h3>
                      <div className="text-sm text-slate-400">{l.desc}</div>
                    </div>
                    <div className="flex gap-2">
                      {['AUTO', 'MAN'].map(m => (
                        <button 
                          key={m} 
                          onClick={() => setLoops(p => ({ ...p, [k]: { ...p[k], mode: m } }))} 
                          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${l.mode === m ? (m === 'AUTO' ? 'bg-green-600' : 'bg-amber-600') : 'bg-slate-600 hover:bg-slate-500'}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* PV/SP/OP Display */}
                  <div className="grid grid-cols-4 gap-3 mb-4 text-center">
                    <div className="bg-slate-700/50 rounded-lg p-2">
                      <div className="text-xs text-slate-500 mb-1">PV</div>
                      <div className="text-2xl font-bold">{displayPV?.toFixed(1)}</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-2">
                      <div className="text-xs text-slate-500 mb-1">SP</div>
                      <NumInput value={l.sp} onChange={v => setLoops(p => ({ ...p, [k]: { ...p[k], sp: v } }))} className="w-full text-xl text-green-400 font-bold" />
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-2">
                      <div className="text-xs text-slate-500 mb-1">OP%</div>
                      <div className="text-2xl font-bold text-blue-400">{l.op?.toFixed(1)}</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-2">
                      <div className="text-xs text-slate-500 mb-1">ERR</div>
                      <div className={`text-2xl font-bold ${Math.abs(displayPV - l.sp) > 1 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {(displayPV - l.sp)?.toFixed(1)}
                      </div>
                    </div>
                  </div>
                  
                  {/* PID Gains */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-slate-500">Kp</label>
                      <NumInput value={l.kp} onChange={v => setLoops(p => ({ ...p, [k]: { ...p[k], kp: v } }))} className="w-full text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Ki</label>
                      <NumInput value={l.ki} onChange={v => setLoops(p => ({ ...p, [k]: { ...p[k], ki: v } }))} className="w-full text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Kd</label>
                      <NumInput value={l.kd} onChange={v => setLoops(p => ({ ...p, [k]: { ...p[k], kd: v } }))} className="w-full text-sm" />
                    </div>
                  </div>
                </div>
              );
              })}
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/*           AUTOMATIC QUALITY CONTROL (AQC) PANEL                */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-slate-400 border-b border-slate-700 pb-2 mb-4">🤖 Automatic Quality Control (AQC)</h3>

              {/* AQC Master Control */}
              <div className={`rounded-xl p-5 border-2 ${aqc.enabled ? (aqc.status === 'OK' ? 'bg-green-900/20 border-green-500' : aqc.status === 'WARNING' ? 'bg-amber-900/20 border-amber-500' : 'bg-red-900/20 border-red-500') : 'bg-slate-800 border-slate-600'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={aqc.enabled}
                        onChange={e => setAqc(p => ({ ...p, enabled: e.target.checked }))}
                        className="w-6 h-6 rounded bg-slate-700 border-slate-600 accent-green-500"
                      />
                      <span className="font-bold text-lg">AQC {aqc.enabled ? 'ENABLED' : 'DISABLED'}</span>
                    </label>
                    {aqc.enabled && (
                      <div className="flex gap-2">
                        {['MONITOR', 'ADVISORY', 'AUTO'].map(m => (
                          <button
                            key={m}
                            onClick={() => setAqc(p => ({ ...p, mode: m }))}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                              aqc.mode === m
                                ? m === 'AUTO' ? 'bg-green-600' : m === 'ADVISORY' ? 'bg-blue-600' : 'bg-slate-500'
                                : 'bg-slate-700 hover:bg-slate-600'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {aqc.enabled && (
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-xs text-slate-500">Quality Score</div>
                        <div className={`text-3xl font-bold ${aqc.qualityScore >= 70 ? 'text-green-400' : aqc.qualityScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                          {aqc.qualityScore.toFixed(0)}
                        </div>
                      </div>
                      <div className={`px-4 py-2 rounded-lg font-bold ${
                        aqc.status === 'OK' ? 'bg-green-600' :
                        aqc.status === 'WARNING' ? 'bg-amber-600' :
                        aqc.status === 'ALARM' ? 'bg-red-600 animate-pulse' : 'bg-slate-600'
                      }`}>
                        {aqc.status}
                      </div>
                    </div>
                  )}
                </div>

                {aqc.enabled && (
                  <>
                    {/* Quality Parameters Status */}
                    <div className="grid grid-cols-5 gap-3 mb-4">
                      {[
                        { key: 'oiw', label: 'OiW', unit: 'ppm', limit: dischargeLimits.oilInWater },
                        { key: 'trh', label: 'TRH', unit: 'mg/L', limit: dischargeLimits.trh },
                        { key: 'cod', label: 'COD', unit: 'mg/L', limit: dischargeLimits.cod },
                        { key: 'turbidity', label: 'Turbidity', unit: 'NTU', limit: dischargeLimits.turbidity },
                        { key: 'pH', label: 'pH', unit: '', limit: `${dischargeLimits.pH.min}-${dischargeLimits.pH.max}` },
                      ].map(param => {
                        const value = param.key === 'oiw' ? polishingFilter.outletOiW :
                                     param.key === 'trh' ? polishingFilter.outletTRH :
                                     param.key === 'cod' ? polishingFilter.outletCOD :
                                     param.key === 'turbidity' ? polishingFilter.outletTurbidity :
                                     proc.pH;
                        const target = aqc.targets[param.key];
                        const pctOfLimit = param.key === 'pH' ? 0 : (value / (param.key === 'oiw' ? dischargeLimits.oilInWater : param.key === 'trh' ? dischargeLimits.trh : param.key === 'cod' ? dischargeLimits.cod : dischargeLimits.turbidity)) * 100;
                        const status = param.key === 'pH'
                          ? (value < dischargeLimits.pH.min || value > dischargeLimits.pH.max ? 'CRITICAL' : value < target?.targetMin || value > target?.targetMax ? 'WARNING' : 'OK')
                          : (pctOfLimit >= target?.criticalPct ? 'CRITICAL' : pctOfLimit >= target?.warningPct ? 'WARNING' : 'OK');
                        return (
                          <div key={param.key} className={`rounded-lg p-3 border ${status === 'OK' ? 'bg-green-900/20 border-green-500/50' : status === 'WARNING' ? 'bg-amber-900/20 border-amber-500/50' : 'bg-red-900/20 border-red-500/50'}`}>
                            <div className="text-xs text-slate-400">{param.label}</div>
                            <div className={`text-xl font-bold ${status === 'OK' ? 'text-green-400' : status === 'WARNING' ? 'text-amber-400' : 'text-red-400'}`}>
                              {value.toFixed(param.key === 'pH' ? 1 : 0)} {param.unit}
                            </div>
                            <div className="text-xs text-slate-500">Limit: {param.limit}</div>
                            {param.key !== 'pH' && (
                              <div className="h-1.5 bg-slate-700 rounded mt-1">
                                <div
                                  className={`h-full rounded ${status === 'OK' ? 'bg-green-500' : status === 'WARNING' ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${Math.min(100, pctOfLimit)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Mode Description */}
                    <div className="text-sm text-slate-400 mb-4 p-3 bg-slate-800/50 rounded-lg">
                      {aqc.mode === 'MONITOR' && '📊 MONITOR: Quality parameters are tracked and displayed. No actions are taken or recommended.'}
                      {aqc.mode === 'ADVISORY' && '💡 ADVISORY: Recommended corrective actions are displayed below when quality degrades. Operator must apply manually.'}
                      {aqc.mode === 'AUTO' && '🤖 AUTO: System automatically adjusts process controls to maintain discharge quality within limits.'}
                    </div>

                    {/* Recommended/Active Corrections */}
                    {(aqc.mode === 'ADVISORY' || aqc.mode === 'AUTO') && aqc.activeCorrections.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-cyan-400 mb-2">
                          {aqc.mode === 'AUTO' ? '⚡ Active Corrections' : '💡 Recommended Actions'}
                        </h4>
                        <div className="space-y-2">
                          {aqc.activeCorrections.slice(0, 3).map((action, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                              <div>
                                <div className="font-medium text-slate-200">{action.action}</div>
                                <div className="text-xs text-slate-400">{action.reason}</div>
                              </div>
                              {aqc.mode === 'ADVISORY' && (
                                <button
                                  onClick={() => applyAQCCorrection(action, simTime)}
                                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium"
                                >
                                  Apply
                                </button>
                              )}
                              {aqc.mode === 'AUTO' && (
                                <span className="text-xs text-green-400">
                                  {aqc.cooldowns[action.type] > 0 ? `Cooldown: ${aqc.cooldowns[action.type]?.toFixed(0)}s` : 'Ready'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Action History */}
                    {aqc.actionHistory.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-400 mb-2">📜 Recent AQC Actions</h4>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {aqc.actionHistory.slice(0, 5).map((action, i) => (
                            <div key={i} className="flex items-center justify-between text-xs p-2 bg-slate-800/50 rounded">
                              <span className="text-slate-500">{formatTime(action.time)}</span>
                              <span className="text-slate-300">{action.action}</span>
                              <span className="text-slate-500">{action.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {!aqc.enabled && (
                  <div className="text-center text-slate-500 py-4">
                    <p>Enable AQC to automatically monitor and control discharge quality.</p>
                    <p className="text-xs mt-2">AQC adjusts feed flow, temperature, bowl speed, and chemical dosing to maintain compliance.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/*                    CHEMICAL DOSING TAB                          */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'chemDosing' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">💉 Chemical Dosing Control System</h2>
              <div className="flex gap-4 items-center">
                <div className="px-4 py-2 bg-slate-700 rounded-lg">
                  <span className="text-slate-400 text-sm">Total Chemical Cost:</span>
                  <span className="text-green-400 font-bold ml-2">${chemCosts.total.toFixed(2)}/session</span>
                </div>
                <div className="px-4 py-2 bg-slate-700 rounded-lg">
                  <span className="text-slate-400 text-sm">Mixing Efficiency:</span>
                  <span className={`font-bold ml-2 ${chemState.mixingEfficiency > 0.8 ? 'text-green-400' : chemState.mixingEfficiency > 0.6 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {(chemState.mixingEfficiency * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Process State Indicators */}
            <div className="grid md:grid-cols-5 gap-4">
              <div className="bg-slate-800 rounded-xl p-4 border border-purple-900/50">
                <div className="text-sm text-purple-400 mb-1">Zeta Potential</div>
                <div className="text-2xl font-bold">{chemState.zetaPotential.toFixed(1)} <span className="text-sm text-slate-400">mV</span></div>
                <div className="text-xs text-slate-500 mt-1">Target: 0 mV (isoelectric)</div>
                <div className="h-2 bg-slate-700 rounded mt-2">
                  <div
                    className={`h-full rounded ${Math.abs(chemState.zetaPotential) < 5 ? 'bg-green-500' : Math.abs(chemState.zetaPotential) < 15 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.max(5, 100 - Math.abs(chemState.zetaPotential) * 2)}%` }}
                  />
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-amber-900/50">
                <div className="text-sm text-amber-400 mb-1">Floc Diameter</div>
                <div className="text-2xl font-bold">{chemState.flocDiameter.toFixed(0)} <span className="text-sm text-slate-400">μm</span></div>
                <div className="text-xs text-slate-500 mt-1">Base: {feedProps.solidsD50} μm</div>
                <div className="h-2 bg-slate-700 rounded mt-2">
                  <div className="h-full bg-amber-500 rounded" style={{ width: `${Math.min(100, chemState.flocDiameter / 3)}%` }} />
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-cyan-900/50">
                <div className="text-sm text-cyan-400 mb-1">Emulsion Breaking</div>
                <div className="text-2xl font-bold">{(chemState.emulsionBreaking * 100).toFixed(1)} <span className="text-sm text-slate-400">%</span></div>
                <div className="text-xs text-slate-500 mt-1">Higher = better separation</div>
                <div className="h-2 bg-slate-700 rounded mt-2">
                  <div className={`h-full rounded ${chemState.emulsionBreaking > 0.7 ? 'bg-green-500' : chemState.emulsionBreaking > 0.4 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${chemState.emulsionBreaking * 100}%` }} />
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-orange-900/50">
                <div className="text-sm text-orange-400 mb-1">Foam Level</div>
                <div className="text-2xl font-bold">{(chemState.foamHeight * 100).toFixed(1)} <span className="text-sm text-slate-400">%</span></div>
                <div className="text-xs text-slate-500 mt-1">Target: {'<'}10%</div>
                <div className="h-2 bg-slate-700 rounded mt-2">
                  <div className={`h-full rounded ${chemState.foamHeight < 0.1 ? 'bg-green-500' : chemState.foamHeight < 0.3 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${chemState.foamHeight * 100}%` }} />
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-red-900/50">
                <div className="text-sm text-red-400 mb-1">Scaling Risk</div>
                <div className="text-2xl font-bold">{(chemState.scalingRisk * 100).toFixed(1)} <span className="text-sm text-slate-400">%</span></div>
                <div className="text-xs text-slate-500 mt-1">LSI: {chemDosing.scaleInhibitor.scalingIndex?.toFixed(2) || '0.00'}</div>
                <div className="h-2 bg-slate-700 rounded mt-2">
                  <div className={`h-full rounded ${chemState.scalingRisk < 0.3 ? 'bg-green-500' : chemState.scalingRisk < 0.6 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${chemState.scalingRisk * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Chemical Dosing Cards */}
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Demulsifier */}
              <div className={`bg-slate-800 rounded-xl p-5 border ${chemDosing.demulsifier.enabled ? 'border-cyan-500/50' : 'border-slate-700'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-900/50 flex items-center justify-center text-xl">🧪</div>
                    <div>
                      <h4 className="font-semibold text-cyan-400">{CONFIG.chemicals.demulsifier.name}</h4>
                      <div className="text-xs text-slate-500">{CONFIG.chemicals.demulsifier.tag}</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={chemDosing.demulsifier.enabled} onChange={(e) => setChemDosing(p => ({ ...p, demulsifier: { ...p.demulsifier, enabled: e.target.checked } }))} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Mode</div>
                    <select value={chemDosing.demulsifier.mode} onChange={(e) => setChemDosing(p => ({ ...p, demulsifier: { ...p.demulsifier, mode: e.target.value } }))} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm">
                      {Object.keys(CONFIG.dosingModes).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">
                      {chemDosing.demulsifier.mode === 'RATIO' ? 'Ratio (ppm/% oil)' : chemDosing.demulsifier.mode === 'MANUAL' ? 'Setpoint (ppm)' : 'Target (%)'}
                    </div>
                    <NumInput
                      value={chemDosing.demulsifier.mode === 'RATIO' ? chemDosing.demulsifier.ratio : chemDosing.demulsifier.sp}
                      onChange={(v) => setChemDosing(p => ({ ...p, demulsifier: { ...p.demulsifier, [p.demulsifier.mode === 'RATIO' ? 'ratio' : 'sp']: v } }))}
                      min={0} max={500} className="w-full text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Actual Dose:</span><span className="text-cyan-400 font-mono">{chemDosing.demulsifier.pv.toFixed(1)} ppm</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Pump Rate:</span><span className="font-mono">{chemDosing.demulsifier.pumpRate.toFixed(2)} L/h</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Pump Output:</span><span className="font-mono">{chemDosing.demulsifier.op.toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Surface Coverage:</span><span className="text-green-400 font-mono">{(chemDosing.demulsifier.surfaceCoverage * 100).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Inventory:</span><span className={`font-mono ${chemDosing.demulsifier.inventory < 100 ? 'text-red-400' : 'text-slate-300'}`}>{chemDosing.demulsifier.inventory.toFixed(0)} L</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Session Cost:</span><span className="text-green-400 font-mono">${chemCosts.demulsifier.toFixed(2)}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
                  Langmuir K: {CONFIG.chemicals.demulsifier.langmuirK} | Optimal: {CONFIG.chemicals.demulsifier.optimalRange.min}-{CONFIG.chemicals.demulsifier.optimalRange.max} ppm
                </div>
              </div>

              {/* Flocculant */}
              <div className={`bg-slate-800 rounded-xl p-5 border ${chemDosing.flocculant.enabled ? 'border-amber-500/50' : 'border-slate-700'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-900/50 flex items-center justify-center text-xl">🔗</div>
                    <div>
                      <h4 className="font-semibold text-amber-400">{CONFIG.chemicals.flocculant.name}</h4>
                      <div className="text-xs text-slate-500">{CONFIG.chemicals.flocculant.tag}</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={chemDosing.flocculant.enabled} onChange={(e) => setChemDosing(p => ({ ...p, flocculant: { ...p.flocculant, enabled: e.target.checked } }))} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Mode</div>
                    <select value={chemDosing.flocculant.mode} onChange={(e) => setChemDosing(p => ({ ...p, flocculant: { ...p.flocculant, mode: e.target.value } }))} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm">
                      {Object.keys(CONFIG.dosingModes).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">
                      {chemDosing.flocculant.mode === 'RATIO' ? 'Ratio (ppm/% solids)' : 'Setpoint (ppm)'}
                    </div>
                    <NumInput
                      value={chemDosing.flocculant.mode === 'RATIO' ? chemDosing.flocculant.ratio : chemDosing.flocculant.sp}
                      onChange={(v) => setChemDosing(p => ({ ...p, flocculant: { ...p.flocculant, [p.flocculant.mode === 'RATIO' ? 'ratio' : 'sp']: v } }))}
                      min={0} max={200} className="w-full text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Actual Dose:</span><span className="text-amber-400 font-mono">{chemDosing.flocculant.pv.toFixed(1)} ppm</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Pump Rate:</span><span className="font-mono">{chemDosing.flocculant.pumpRate.toFixed(2)} L/h</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Floc Size Mult:</span><span className="text-green-400 font-mono">{chemDosing.flocculant.flocSize.toFixed(2)}×</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Effectiveness:</span><span className="font-mono">{(chemDosing.flocculant.effectiveness * 100).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Inventory:</span><span className={`font-mono ${chemDosing.flocculant.inventory < 50 ? 'text-red-400' : 'text-slate-300'}`}>{chemDosing.flocculant.inventory.toFixed(0)} L</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Session Cost:</span><span className="text-green-400 font-mono">${chemCosts.flocculant.toFixed(2)}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
                  Bridging: {CONFIG.chemicals.flocculant.bridgingFactor}× | Overdose threshold: {CONFIG.chemicals.flocculant.overdoseThreshold} ppm
                </div>
              </div>

              {/* Coagulant */}
              <div className={`bg-slate-800 rounded-xl p-5 border ${chemDosing.coagulant.enabled ? 'border-purple-500/50' : 'border-slate-700'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-900/50 flex items-center justify-center text-xl">⚡</div>
                    <div>
                      <h4 className="font-semibold text-purple-400">{CONFIG.chemicals.coagulant.name}</h4>
                      <div className="text-xs text-slate-500">{CONFIG.chemicals.coagulant.tag}</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={chemDosing.coagulant.enabled} onChange={(e) => setChemDosing(p => ({ ...p, coagulant: { ...p.coagulant, enabled: e.target.checked } }))} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Mode</div>
                    <select value={chemDosing.coagulant.mode} onChange={(e) => setChemDosing(p => ({ ...p, coagulant: { ...p.coagulant, mode: e.target.value } }))} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm">
                      {Object.keys(CONFIG.dosingModes).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">
                      {chemDosing.coagulant.mode === 'RATIO' ? 'Ratio (ppm/%)' : chemDosing.coagulant.mode === 'FEEDBACK' ? 'Target ζ (mV)' : 'Setpoint (ppm)'}
                    </div>
                    <NumInput
                      value={chemDosing.coagulant.mode === 'RATIO' ? chemDosing.coagulant.ratio : chemDosing.coagulant.sp}
                      onChange={(v) => setChemDosing(p => ({ ...p, coagulant: { ...p.coagulant, [p.coagulant.mode === 'RATIO' ? 'ratio' : 'sp']: v } }))}
                      min={0} max={300} className="w-full text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Actual Dose:</span><span className="text-purple-400 font-mono">{chemDosing.coagulant.pv.toFixed(1)} ppm</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Zeta Potential:</span><span className={`font-mono ${Math.abs(chemDosing.coagulant.zetaPotential || 0) < 10 ? 'text-green-400' : 'text-yellow-400'}`}>{(chemDosing.coagulant.zetaPotential || -25).toFixed(1)} mV</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Effectiveness:</span><span className="font-mono">{(chemDosing.coagulant.effectiveness * 100).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Inventory:</span><span className={`font-mono ${chemDosing.coagulant.inventory < 200 ? 'text-red-400' : 'text-slate-300'}`}>{chemDosing.coagulant.inventory.toFixed(0)} L</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Session Cost:</span><span className="text-green-400 font-mono">${chemCosts.coagulant.toFixed(2)}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
                  Fe³⁺ valence: {CONFIG.chemicals.coagulant.chargeValence} | Schulze-Hardy Rule
                </div>
              </div>

              {/* pH Control (Acid) */}
              <div className={`bg-slate-800 rounded-xl p-5 border ${chemDosing.acid.enabled ? 'border-red-500/50' : 'border-slate-700'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-900/50 flex items-center justify-center text-xl">🔴</div>
                    <div>
                      <h4 className="font-semibold text-red-400">{CONFIG.chemicals.acid.name}</h4>
                      <div className="text-xs text-slate-500">{CONFIG.chemicals.acid.tag} - pH Control</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={chemDosing.acid.enabled} onChange={(e) => setChemDosing(p => ({ ...p, acid: { ...p.acid, enabled: e.target.checked } }))} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:ring-2 peer-focus:ring-red-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">pH Setpoint</div>
                    <NumInput value={chemDosing.acid.sp} onChange={(v) => setChemDosing(p => ({ ...p, acid: { ...p.acid, sp: v }, caustic: { ...p.caustic, sp: v } }))} min={4} max={10} step={0.1} className="w-full text-sm" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Current pH</div>
                    <div className={`text-xl font-bold ${smoothedProc.pH < 6.5 || smoothedProc.pH > 8.5 ? 'text-red-400' : 'text-green-400'}`}>{smoothedProc.pH.toFixed(2)}</div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Dose Rate:</span><span className="text-red-400 font-mono">{chemDosing.acid.pv.toFixed(1)} mL/m³</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Pump Rate:</span><span className="font-mono">{chemDosing.acid.pumpRate.toFixed(3)} L/h</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Inventory:</span><span className={`font-mono ${chemDosing.acid.inventory < 50 ? 'text-red-400' : 'text-slate-300'}`}>{chemDosing.acid.inventory.toFixed(0)} L</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Session Cost:</span><span className="text-green-400 font-mono">${chemCosts.acid.toFixed(2)}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
                  Henderson-Hasselbalch | Buffer: {CONFIG.chemicals.acid.bufferCapacity} mol/L/pH
                </div>
              </div>

              {/* pH Control (Caustic) */}
              <div className={`bg-slate-800 rounded-xl p-5 border ${chemDosing.caustic.enabled ? 'border-blue-500/50' : 'border-slate-700'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-900/50 flex items-center justify-center text-xl">🔵</div>
                    <div>
                      <h4 className="font-semibold text-blue-400">{CONFIG.chemicals.caustic.name}</h4>
                      <div className="text-xs text-slate-500">{CONFIG.chemicals.caustic.tag} - pH Control</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={chemDosing.caustic.enabled} onChange={(e) => setChemDosing(p => ({ ...p, caustic: { ...p.caustic, enabled: e.target.checked } }))} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">pH Setpoint</div>
                    <NumInput value={chemDosing.caustic.sp} onChange={(v) => setChemDosing(p => ({ ...p, acid: { ...p.acid, sp: v }, caustic: { ...p.caustic, sp: v } }))} min={4} max={10} step={0.1} className="w-full text-sm" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Current pH</div>
                    <div className={`text-xl font-bold ${smoothedProc.pH < 6.5 || smoothedProc.pH > 8.5 ? 'text-red-400' : 'text-green-400'}`}>{smoothedProc.pH.toFixed(2)}</div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Dose Rate:</span><span className="text-blue-400 font-mono">{chemDosing.caustic.pv.toFixed(1)} mL/m³</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Pump Rate:</span><span className="font-mono">{chemDosing.caustic.pumpRate.toFixed(3)} L/h</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Inventory:</span><span className={`font-mono ${chemDosing.caustic.inventory < 50 ? 'text-red-400' : 'text-slate-300'}`}>{chemDosing.caustic.inventory.toFixed(0)} L</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Session Cost:</span><span className="text-green-400 font-mono">${chemCosts.caustic.toFixed(2)}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
                  Henderson-Hasselbalch | Buffer: {CONFIG.chemicals.caustic.bufferCapacity} mol/L/pH
                </div>
              </div>

              {/* Scale Inhibitor */}
              <div className={`bg-slate-800 rounded-xl p-5 border ${chemDosing.scaleInhibitor.enabled ? 'border-green-500/50' : 'border-slate-700'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-900/50 flex items-center justify-center text-xl">🛡️</div>
                    <div>
                      <h4 className="font-semibold text-green-400">{CONFIG.chemicals.scaleInhibitor.name}</h4>
                      <div className="text-xs text-slate-500">{CONFIG.chemicals.scaleInhibitor.tag}</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={chemDosing.scaleInhibitor.enabled} onChange={(e) => setChemDosing(p => ({ ...p, scaleInhibitor: { ...p.scaleInhibitor, enabled: e.target.checked } }))} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Mode</div>
                    <select value={chemDosing.scaleInhibitor.mode} onChange={(e) => setChemDosing(p => ({ ...p, scaleInhibitor: { ...p.scaleInhibitor, mode: e.target.value } }))} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm">
                      <option value="RATIO">Fixed Dose</option>
                      <option value="ADAPTIVE">Adaptive (LSI)</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Dose (ppm)</div>
                    <NumInput value={chemDosing.scaleInhibitor.ratio} onChange={(v) => setChemDosing(p => ({ ...p, scaleInhibitor: { ...p.scaleInhibitor, ratio: v } }))} min={0} max={50} className="w-full text-sm" />
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Actual Dose:</span><span className="text-green-400 font-mono">{chemDosing.scaleInhibitor.pv.toFixed(1)} ppm</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">LSI:</span><span className={`font-mono ${(chemDosing.scaleInhibitor.scalingIndex || 0) > 1.5 ? 'text-red-400' : 'text-green-400'}`}>{(chemDosing.scaleInhibitor.scalingIndex || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Effectiveness:</span><span className="font-mono">{(chemDosing.scaleInhibitor.effectiveness * 100).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Inventory:</span><span className={`font-mono ${chemDosing.scaleInhibitor.inventory < 20 ? 'text-red-400' : 'text-slate-300'}`}>{chemDosing.scaleInhibitor.inventory.toFixed(0)} L</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Session Cost:</span><span className="text-green-400 font-mono">${chemCosts.scaleInhibitor.toFixed(2)}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
                  Threshold inhibition | LSI threshold: {CONFIG.chemicals.scaleInhibitor.saturationIndex}
                </div>
              </div>

              {/* Antifoam */}
              <div className={`bg-slate-800 rounded-xl p-5 border ${chemDosing.antifoam.enabled ? 'border-orange-500/50' : 'border-slate-700'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-900/50 flex items-center justify-center text-xl">🫧</div>
                    <div>
                      <h4 className="font-semibold text-orange-400">{CONFIG.chemicals.antifoam.name}</h4>
                      <div className="text-xs text-slate-500">{CONFIG.chemicals.antifoam.tag}</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={chemDosing.antifoam.enabled} onChange={(e) => setChemDosing(p => ({ ...p, antifoam: { ...p.antifoam, enabled: e.target.checked } }))} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Mode</div>
                    <select value={chemDosing.antifoam.mode} onChange={(e) => setChemDosing(p => ({ ...p, antifoam: { ...p.antifoam, mode: e.target.value } }))} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm">
                      <option value="MANUAL">Manual</option>
                      <option value="FEEDBACK">Feedback (foam level)</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Setpoint (ppm)</div>
                    <NumInput value={chemDosing.antifoam.sp} onChange={(v) => setChemDosing(p => ({ ...p, antifoam: { ...p.antifoam, sp: v } }))} min={0} max={100} className="w-full text-sm" />
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Actual Dose:</span><span className="text-orange-400 font-mono">{chemDosing.antifoam.pv.toFixed(1)} ppm</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Foam Level:</span><span className={`font-mono ${chemDosing.antifoam.foamLevel > 0.3 ? 'text-red-400' : 'text-green-400'}`}>{(chemDosing.antifoam.foamLevel * 100).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Effectiveness:</span><span className="font-mono">{(chemDosing.antifoam.effectiveness * 100).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Inventory:</span><span className={`font-mono ${chemDosing.antifoam.inventory < 10 ? 'text-red-400' : 'text-slate-300'}`}>{chemDosing.antifoam.inventory.toFixed(0)} L</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Session Cost:</span><span className="text-green-400 font-mono">${chemCosts.antifoam.toFixed(2)}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
                  Persistence: {CONFIG.chemicals.antifoam.persistenceFactor * 100}% | Break time: {CONFIG.chemicals.antifoam.foamBreakTime}s
                </div>
              </div>
            </div>

            {/* Scientific Principles Reference */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-slate-300 mb-4">📚 Scientific Principles Applied</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-slate-900/50 rounded-lg">
                  <div className="text-cyan-400 font-medium mb-1">Langmuir Adsorption</div>
                  <div className="text-slate-400 text-xs">θ = KC/(1+KC) - Surface coverage model for demulsifier effectiveness</div>
                </div>
                <div className="p-3 bg-slate-900/50 rounded-lg">
                  <div className="text-amber-400 font-medium mb-1">Smoluchowski Kinetics</div>
                  <div className="text-slate-400 text-xs">Collision-based flocculation rate proportional to concentration²</div>
                </div>
                <div className="p-3 bg-slate-900/50 rounded-lg">
                  <div className="text-purple-400 font-medium mb-1">Schulze-Hardy Rule</div>
                  <div className="text-slate-400 text-xs">CCC ∝ z⁻⁶ - Charge neutralization by multivalent ions</div>
                </div>
                <div className="p-3 bg-slate-900/50 rounded-lg">
                  <div className="text-red-400 font-medium mb-1">Henderson-Hasselbalch</div>
                  <div className="text-slate-400 text-xs">pH = pKa + log([A⁻]/[HA]) - Buffer chemistry for pH control</div>
                </div>
                <div className="p-3 bg-slate-900/50 rounded-lg">
                  <div className="text-green-400 font-medium mb-1">Langelier Saturation Index</div>
                  <div className="text-slate-400 text-xs">LSI = pH - pHs - Scale formation prediction</div>
                </div>
                <div className="p-3 bg-slate-900/50 rounded-lg">
                  <div className="text-orange-400 font-medium mb-1">Arrhenius Kinetics</div>
                  <div className="text-slate-400 text-xs">k = A·exp(-Ea/RT) - Temperature dependence of reactions</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SPDD1600 Filter integrated into Centrifuge page */}

        {/* ORPHANED FILTER TAB REMOVED - START */}
        {false && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold">🔵 SPDD1600 Polishing Filter</h2>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  polishingFilter.status === 'FILTERING' ? 'bg-green-900/50 text-green-400 border border-green-500' :
                  polishingFilter.status === 'BACKWASH' ? 'bg-orange-900/50 text-orange-400 border border-orange-500 animate-pulse' :
                  polishingFilter.status === 'STANDBY' ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-500' :
                  'bg-slate-700 text-slate-400'
                }`}>
                  {polishingFilter.status === 'BACKWASH' ? `⏳ BACKWASH (${Math.ceil(polishingFilter.backwashRemaining)}s)` : polishingFilter.status}
                </div>
              </div>
              <div className="flex gap-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={polishingFilter.enabled} onChange={(e) => setPolishingFilter(p => ({ ...p, enabled: e.target.checked, status: e.target.checked ? 'FILTERING' : 'OFFLINE' }))} className="w-4 h-4 accent-cyan-500" />
                  <span className="text-sm">Enabled</span>
                </label>
                <button onClick={triggerBackwash} disabled={polishingFilter.status !== 'FILTERING'} className={`px-4 py-2 rounded-lg text-sm font-medium ${polishingFilter.status === 'FILTERING' ? 'bg-orange-600 hover:bg-orange-500' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                  ⏳ Manual Backwash
                </button>
              </div>
            </div>

            {/* Equipment Specifications */}
            <div className="bg-slate-800 rounded-xl p-6 border border-blue-900/50">
              <h3 className="text-lg font-semibold text-blue-400 mb-4">📋 Waterco SPDD1600 Specifications</h3>
              <div className="grid md:grid-cols-4 gap-6">
                <div>
                  <div className="text-xs text-slate-400 mb-2">Physical</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-400">Model:</span><span className="font-mono">{CONFIG.polishingFilter.model}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Inner Diameter:</span><span className="font-mono">{CONFIG.polishingFilter.innerDiameter} mm</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Bed Depth:</span><span className="font-mono">{CONFIG.polishingFilter.bedDepth} mm</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Filter Area:</span><span className="font-mono">{CONFIG.polishingFilter.filterArea} m²</span></div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-2">Flow Rates (m³/h)</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-400">Standard (30 m/h):</span><span className="font-mono">{CONFIG.polishingFilter.flowRates.standard}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Medium (35 m/h):</span><span className="font-mono">{CONFIG.polishingFilter.flowRates.medium}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">High (40 m/h):</span><span className="font-mono">{CONFIG.polishingFilter.flowRates.high}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Max (50 m/h):</span><span className="text-cyan-400 font-mono">{CONFIG.polishingFilter.flowRates.max}</span></div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-2">Media</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-400">Volume:</span><span className="font-mono">{CONFIG.polishingFilter.media.volume} L</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Sand (16/30):</span><span className="font-mono">{CONFIG.polishingFilter.media.sandWeight} kg</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Glass Pearls:</span><span className="font-mono">{CONFIG.polishingFilter.media.glassPearlsWeight} kg</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Micron Rating:</span><span className="font-mono">{CONFIG.polishingFilter.operating.nominalMicron} μm</span></div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-2">Operating</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-400">Pressure:</span><span className="font-mono">{CONFIG.polishingFilter.operating.pressureRange.min}-{CONFIG.polishingFilter.operating.pressureRange.max} bar</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Max ΔP:</span><span className="font-mono">{CONFIG.polishingFilter.operating.maxDifferentialPressure} bar</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Backwash:</span><span className="font-mono">{CONFIG.polishingFilter.operating.backwashDuration}s</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Water Saving:</span><span className="text-green-400 font-mono">{CONFIG.polishingFilter.operating.backwashWaterSaving * 100}%</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Real-time Operating Status */}
            <div className="grid md:grid-cols-5 gap-4">
              <div className="bg-slate-800 rounded-xl p-4 border border-cyan-900/50">
                <div className="text-sm text-cyan-400 mb-1">Inlet Flow</div>
                <div className="text-2xl font-bold">{polishingFilter.inletFlow.toFixed(1)} <span className="text-sm text-slate-400">m³/h</span></div>
                <div className="text-xs text-slate-500 mt-1">From centrifuge</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-green-900/50">
                <div className="text-sm text-green-400 mb-1">Outlet Flow</div>
                <div className="text-2xl font-bold">{polishingFilter.outletFlow.toFixed(1)} <span className="text-sm text-slate-400">m³/h</span></div>
                <div className="text-xs text-slate-500 mt-1">To pond</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-purple-900/50">
                <div className="text-sm text-purple-400 mb-1">Differential Pressure</div>
                <div className={`text-2xl font-bold ${polishingFilter.differentialPressure > polishingFilter.backwashTriggerDP * 0.8 ? 'text-orange-400' : ''}`}>
                  {polishingFilter.differentialPressure.toFixed(2)} <span className="text-sm text-slate-400">bar</span>
                </div>
                <div className="h-2 bg-slate-700 rounded mt-2">
                  <div className={`h-full rounded ${polishingFilter.differentialPressure > polishingFilter.backwashTriggerDP * 0.8 ? 'bg-orange-500' : 'bg-purple-500'}`} style={{ width: `${Math.min(100, (polishingFilter.differentialPressure / polishingFilter.backwashTriggerDP) * 100)}%` }} />
                </div>
                <div className="text-xs text-slate-500 mt-1">Trigger: {polishingFilter.backwashTriggerDP} bar</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-amber-900/50">
                <div className="text-sm text-amber-400 mb-1">Bed Saturation</div>
                <div className="text-2xl font-bold">{polishingFilter.bedSaturation.toFixed(1)} <span className="text-sm text-slate-400">%</span></div>
                <div className="h-2 bg-slate-700 rounded mt-2">
                  <div className={`h-full rounded ${polishingFilter.bedSaturation > 80 ? 'bg-red-500' : polishingFilter.bedSaturation > 50 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${polishingFilter.bedSaturation}%` }} />
                </div>
                <div className="text-xs text-slate-500 mt-1">Loading: {polishingFilter.bedLoading.toFixed(2)} kg</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-600">
                <div className="text-sm text-slate-400 mb-1">Media Condition</div>
                <div className="text-2xl font-bold">{polishingFilter.mediaCondition.toFixed(0)} <span className="text-sm text-slate-400">%</span></div>
                <div className="h-2 bg-slate-700 rounded mt-2">
                  <div className={`h-full rounded ${polishingFilter.mediaCondition > 80 ? 'bg-green-500' : polishingFilter.mediaCondition > 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${polishingFilter.mediaCondition}%` }} />
                </div>
                <div className="text-xs text-slate-500 mt-1">Run hours: {polishingFilter.runHours.toFixed(1)}</div>
              </div>
            </div>

            {/* Water Quality Comparison */}
            <div className="bg-slate-800 rounded-xl p-6 border border-green-900/50">
              <h3 className="text-lg font-semibold text-green-400 mb-4">💧 Water Quality (Centrifuge → Filter → Pond)</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="text-sm text-slate-400 mb-3">Turbidity (NTU)</div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-slate-700 rounded-lg p-3 text-center">
                      <div className="text-xs text-slate-400">Inlet</div>
                      <div className="text-xl font-bold text-red-400">{polishingFilter.inletTurbidity.toFixed(1)}</div>
                    </div>
                    <div className="text-2xl text-green-400">→</div>
                    <div className="flex-1 bg-slate-700 rounded-lg p-3 text-center">
                      <div className="text-xs text-slate-400">Outlet</div>
                      <div className="text-xl font-bold text-green-400">{polishingFilter.outletTurbidity.toFixed(1)}</div>
                    </div>
                    <div className="flex-1 bg-green-900/30 rounded-lg p-3 text-center border border-green-500/30">
                      <div className="text-xs text-green-400">Removal</div>
                      <div className="text-xl font-bold text-green-400">{polishingFilter.turbidityRemoval.toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-3">Oil-in-Water (ppm)</div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-slate-700 rounded-lg p-3 text-center">
                      <div className="text-xs text-slate-400">Inlet</div>
                      <div className="text-xl font-bold text-amber-400">{polishingFilter.inletOiW.toFixed(1)}</div>
                    </div>
                    <div className="text-2xl text-green-400">→</div>
                    <div className="flex-1 bg-slate-700 rounded-lg p-3 text-center">
                      <div className="text-xs text-slate-400">Outlet</div>
                      <div className="text-xl font-bold text-green-400">{polishingFilter.outletOiW.toFixed(1)}</div>
                    </div>
                    <div className="flex-1 bg-green-900/30 rounded-lg p-3 text-center border border-green-500/30">
                      <div className="text-xs text-green-400">Removal</div>
                      <div className="text-xl font-bold text-green-400">{polishingFilter.oilRemoval.toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls and Settings */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-slate-300 mb-4">⚙️ Backwash Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Auto Backwash</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={polishingFilter.autoBackwash} onChange={(e) => setPolishingFilter(p => ({ ...p, autoBackwash: e.target.checked }))} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600" />
                    </label>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">ΔP Trigger (bar)</label>
                    <NumInput value={polishingFilter.backwashTriggerDP} onChange={(v) => setPolishingFilter(p => ({ ...p, backwashTriggerDP: v }))} min={0.5} max={1.5} step={0.1} className="w-full" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Inlet Pressure (bar)</label>
                    <NumInput value={polishingFilter.inletPressure} onChange={(v) => setPolishingFilter(p => ({ ...p, inletPressure: v }))} min={2} max={10} step={0.1} className="w-full" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Bed Capacity (kg)</label>
                    <NumInput value={polishingFilter.bedCapacity} onChange={(v) => setPolishingFilter(p => ({ ...p, bedCapacity: v }))} min={20} max={100} step={5} className="w-full" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-slate-300 mb-4">📊 Session Statistics</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Total Filtered:</span><span className="font-mono">{polishingFilter.totalFiltered.toFixed(2)} m³</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Backwash Count:</span><span className="font-mono">{polishingFilter.backwashCount}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Backwash Water Used:</span><span className="font-mono">{polishingFilter.totalBackwashWater.toFixed(2)} m³</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Solids Removed:</span><span className="font-mono">{polishingFilter.totalSolidsRemoved.toFixed(3)} kg</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Oil Removed:</span><span className="font-mono">{polishingFilter.totalOilRemoved.toFixed(3)} kg</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Filter Cycles:</span><span className="font-mono">{polishingFilter.filterCycles}</span></div>
                  <div className="border-t border-slate-700 pt-2 mt-2">
                    <div className="flex justify-between"><span className="text-slate-400">Backwash Water Cost:</span><span className="text-green-400 font-mono">${filterCosts.backwashWater.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Electricity Cost:</span><span className="text-green-400 font-mono">${filterCosts.electricity.toFixed(2)}</span></div>
                    <div className="flex justify-between font-semibold"><span className="text-slate-300">Total Cost:</span><span className="text-green-400 font-mono">${filterCosts.total.toFixed(2)}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scientific Principles */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-slate-300 mb-4">📚 Deep Bed Filtration Principles</h3>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-slate-900/50 rounded-lg">
                  <div className="text-cyan-400 font-medium mb-1">Iwasaki Model</div>
                  <div className="text-slate-400 text-xs">λ = λ₀(1 - σ/σmax)ⁿ - Filter coefficient decreases with bed loading</div>
                </div>
                <div className="p-3 bg-slate-900/50 rounded-lg">
                  <div className="text-purple-400 font-medium mb-1">Carman-Kozeny</div>
                  <div className="text-slate-400 text-xs">ΔP ∝ (1 + kσ) - Pressure drop increases with solids deposition</div>
                </div>
                <div className="p-3 bg-slate-900/50 rounded-lg">
                  <div className="text-green-400 font-medium mb-1">Nozzle Plate Design</div>
                  <div className="text-slate-400 text-xs">Uniform air/water backwash for 25% less water usage vs lateral systems</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/*                         TANKAGE TAB                             */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'tankage' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">🛢️ Tankage & Evaporation Pond</h2>

            {/* 8ML Evaporation Pond */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-teal-900/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-teal-400">🏊 Evaporation Pond (8 ML Capacity)</h3>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${pond.level < 80 ? 'bg-green-900/50 text-green-400' : pond.level < 95 ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'}`}>
                    {pond.level < 80 ? '✓ Normal' : pond.level < 95 ? '⚠ High Level' : '🚨 Critical'}
                  </span>
                </div>
              </div>

              {/* Pond Visual */}
              <div className="relative h-32 bg-gradient-to-b from-slate-900 to-slate-800 rounded-xl border-2 border-teal-700 overflow-hidden mb-4">
                {/* Water level */}
                <div className="absolute bottom-0 w-full transition-all duration-1000" style={{ height: `${pond.level}%` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-teal-800/80 to-cyan-600/60" />
                  {/* Surface ripples animation */}
                  <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
                </div>
                {/* Evaporation indicator */}
                <div className="absolute top-2 right-2 text-xs text-cyan-400 bg-slate-900/70 px-2 py-1 rounded">
                  ☀️ Evap: {pond.evaporationRate} mm/day
                </div>
                {/* Level markers */}
                <div className="absolute left-2 top-0 h-full flex flex-col justify-between py-2 text-xs text-slate-400">
                  <span>100%</span>
                  <span>50%</span>
                  <span>0%</span>
                </div>
                {/* Center display */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center bg-slate-900/60 rounded-lg px-4 py-2">
                    <div className="text-3xl font-bold text-white">{pond.volume.toFixed(0)} m³</div>
                    <div className="text-sm text-teal-400">{pond.level.toFixed(1)}% of 8,000 m³</div>
                  </div>
                </div>
              </div>

              {/* Pond Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-400">Volume</div>
                  <div className="text-lg font-bold text-teal-400">{pond.volume.toFixed(0)} m³</div>
                  <div className="text-xs text-slate-500">{(pond.volume / 1000).toFixed(2)} ML</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-400">Inflow Rate</div>
                  <div className="text-lg font-bold text-cyan-400">{pond.inflow.toFixed(2)} m³/h</div>
                  <div className="text-xs text-slate-500">From GAC filter</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-400">Daily Evap</div>
                  <div className="text-lg font-bold text-yellow-400">{(pond.surfaceArea * pond.evaporationRate / 1000).toFixed(1)} m³</div>
                  <div className="text-xs text-slate-500">{pond.evaporationRate} mm/day</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-400">OiW</div>
                  <div className={`text-lg font-bold ${pond.oilInWater <= dischargeLimits.oilInWater ? 'text-green-400' : 'text-red-400'}`}>{pond.oilInWater.toFixed(0)} ppm</div>
                  <div className="text-xs text-slate-500">Limit: {dischargeLimits.oilInWater} ppm</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-400">Turbidity</div>
                  <div className={`text-lg font-bold ${pond.turbidity <= dischargeLimits.turbidity ? 'text-green-400' : 'text-yellow-400'}`}>{pond.turbidity.toFixed(0)} NTU</div>
                  <div className="text-xs text-slate-500">Limit: {dischargeLimits.turbidity} NTU</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-400">pH</div>
                  <div className={`text-lg font-bold ${pond.pH >= dischargeLimits.pH.min && pond.pH <= dischargeLimits.pH.max ? 'text-green-400' : 'text-red-400'}`}>{pond.pH.toFixed(1)}</div>
                  <div className="text-xs text-slate-500">{dischargeLimits.pH.min}-{dischargeLimits.pH.max}</div>
                </div>
              </div>

              {/* Pond totals */}
              <div className="mt-4 grid grid-cols-3 gap-4 p-3 bg-slate-700/30 rounded-lg text-sm">
                <div className="text-center">
                  <div className="text-slate-400">Total Inflow</div>
                  <div className="font-bold text-cyan-400">{pond.totalInflow.toFixed(1)} m³</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400">Total Evaporated</div>
                  <div className="font-bold text-yellow-400">{pond.totalEvaporated.toFixed(1)} m³</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400">Days to Fill</div>
                  <div className="font-bold text-teal-400">
                    {pond.inflow > 0 ? (((pond.capacity - pond.volume) / (pond.inflow * 24 - pond.surfaceArea * pond.evaporationRate / 1000))).toFixed(0) : '∞'} days
                  </div>
                </div>
              </div>
            </div>

            {/* Feed Tanks */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-blue-900/50">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-blue-400">🛢️ Feed Tanks (55 m³ × 6)</h3>
                <div className="flex gap-2">
                  <button onClick={() => refillTanks(100)} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium transition-colors">Refill 100%</button>
                  <button onClick={() => refillTanks(85)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors">Refill 85%</button>
                  {selectedTank && !isRunning && <button onClick={startBatch} className="px-4 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-sm transition-colors">▶ Start {selectedTank}</button>}
                </div>
              </div>
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
                {tankFarm.map(t => (
                  <div key={t.id} onClick={() => selectTank(t.id)} className={`bg-slate-900/50 rounded-xl p-4 border-2 cursor-pointer transition-all hover:scale-105 ${t.status === 'processing' ? 'border-purple-500 animate-pulse' : t.status === 'selected' ? 'border-blue-500 ring-2 ring-blue-400' : t.status === 'settling' ? 'border-yellow-500' : t.status === 'empty' ? 'border-slate-600 opacity-50' : 'border-green-500'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-white">{t.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'processing' ? 'bg-purple-900/50 text-purple-400' : t.status === 'selected' ? 'bg-blue-900/50 text-blue-400' : t.status === 'empty' ? 'bg-slate-700 text-slate-500' : 'bg-green-900/50 text-green-400'}`}>{t.status}</span>
                    </div>
                    <div className="relative h-24 bg-slate-800 rounded border border-slate-600 overflow-hidden mb-2">
                      <div className="absolute bottom-0 w-full" style={{ height: `${t.level}%` }}>
                        <div className="absolute bottom-0 w-full bg-orange-800/70" style={{ height: `${t.sediment}%` }} />
                        <div className="absolute w-full bg-amber-600/70" style={{ bottom: `${t.sediment}%`, height: `${t.oil}%` }} />
                        <div className="absolute w-full bg-blue-600/50" style={{ bottom: `${t.sediment + t.oil}%`, height: `${t.water}%` }} />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-white drop-shadow-lg">{t.level.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">{((t.level / 100) * TANK.volume).toFixed(1)} m³</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-amber-900/50">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-amber-400">🛢️ Oil Storage (55 m³ × 6)</h3>
                <div className="flex items-center gap-4">
                  {oilInterlock.reason && <span className={`px-3 py-1 rounded-full text-sm font-medium ${oilInterlock.active ? 'bg-red-900/50 text-red-400 animate-pulse border border-red-500' : 'bg-yellow-900/50 text-yellow-400'}`}>⚠️ {oilInterlock.reason}</span>}
                  <span className="text-sm text-slate-400">Receiving: <span className="text-amber-400 font-bold">{selectedOilTank}</span></span>
                  <button onClick={shipOil} disabled={isRunning} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors">🚛 Ship All</button>
                </div>
              </div>
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
                {oilTanks.map(t => (
                  <div key={t.id} onClick={() => !isRunning && setSelectedOilTank(t.id)} className={`bg-slate-900/50 rounded-xl p-4 border-2 cursor-pointer hover:scale-105 transition-all ${t.level >= OIL_TANK.highHigh ? 'border-red-500 bg-red-900/30' : t.level >= OIL_TANK.high ? 'border-yellow-500' : t.id === selectedOilTank ? 'border-amber-500 ring-2 ring-amber-400' : 'border-slate-600'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-white">{t.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.id === selectedOilTank ? 'bg-amber-900/50 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>{t.id === selectedOilTank ? 'recv' : t.status}</span>
                    </div>
                    <div className="relative h-10 bg-slate-800 rounded-full border border-slate-600 overflow-hidden mb-2">
                      <div className="absolute left-0 h-full bg-amber-600/70 rounded-l-full transition-all" style={{ width: `${t.level}%` }} />
                      <div className="absolute h-full w-0.5 bg-yellow-400/50" style={{ left: `${OIL_TANK.high}%` }} />
                      <div className="absolute h-full w-0.5 bg-red-400/50" style={{ left: `${OIL_TANK.highHigh}%` }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-bold text-white drop-shadow-lg">{t.level.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">{((t.level / 100) * OIL_TANK.volume).toFixed(1)} m³</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-slate-700/30 rounded-lg text-sm flex justify-between">
                <span>Total Inventory: {computed.oilTankTotals.totalM3.toFixed(1)} m³</span>
                <span className="text-green-400 font-bold">${computed.oilTankTotals.totalValue.toFixed(0)}</span>
              </div>
            </div>
          </div>
        )}

        {/* REMAINING TABS - Condensed for space */}
        {activeTab === 'batch' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">📦 Batch Process Control</h2>
              {isBatchMode && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-green-400 font-bold">BATCH ACTIVE</span>
                  </div>
                  <div className="px-4 py-2 bg-purple-900/50 rounded-lg border border-purple-500">
                    <span className="text-purple-300">Phase {batchPhase + 1}/{batchPhases.length}</span>
                  </div>
                </div>
              )}
            </div>

            {/* SCADA Process Flow Diagram */}
            <div className="bg-slate-900 rounded-xl p-6 border-2 border-slate-600">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Process Flow Diagram</h3>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded" /> Running</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-500 rounded" /> Standby</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-600 rounded" /> Off</span>
                </div>
              </div>
              
              {/* Main Process Flow - Grid Layout */}
              <div className="grid grid-cols-12 gap-4 items-center">
                {/* Feed Tank - 2 cols */}
                <div className="col-span-2 flex flex-col items-center">
                  <div className={`w-24 h-32 border-2 rounded-b-xl relative ${isBatchMode ? 'border-green-500 bg-green-900/20' : 'border-slate-600 bg-slate-800'}`}>
                    <div className="absolute bottom-0 w-full bg-blue-600/50 rounded-b-xl transition-all" style={{ height: `${isBatchMode && selectedTank ? (tankFarm.find(t => t.id === selectedTank)?.level || 0) : 0}%` }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white font-bold text-lg drop-shadow">{isBatchMode && selectedTank ? `${(tankFarm.find(t => t.id === selectedTank)?.level || 0).toFixed(0)}%` : '--'}</span>
                    </div>
                  </div>
                  <div className="text-sm text-slate-300 mt-2 font-medium">{selectedTank || 'FEED TANK'}</div>
                  <div className={`text-xs font-bold ${isBatchMode ? 'text-green-400' : 'text-slate-500'}`}>{isBatchMode ? 'PROCESSING' : 'IDLE'}</div>
                </div>

                {/* Arrow 1 - 1 col */}
                <div className="col-span-1 flex items-center justify-center">
                  <div className={`h-1 w-full ${isBatchMode ? 'bg-cyan-500' : 'bg-slate-700'}`} />
                  <div className={`text-2xl ${isBatchMode ? 'text-cyan-400' : 'text-slate-600'}`}>▶</div>
                </div>

                {/* Heater - 2 cols */}
                <div className="col-span-2 flex flex-col items-center">
                  <div className={`w-20 h-24 border-2 rounded-xl relative flex items-center justify-center ${isRunning ? 'border-red-500 bg-red-900/30' : 'border-slate-600 bg-slate-800'}`}>
                    <div className="text-3xl">{isRunning ? '🔥' : '⬜'}</div>
                    <div className="absolute -bottom-3 bg-slate-900 px-2 rounded">
                      <span className={`text-lg font-bold ${isRunning ? 'text-red-400' : 'text-slate-500'}`}>{smoothedProc.heaterTemp.toFixed(0)}°C</span>
                    </div>
                  </div>
                  <div className="text-sm text-slate-300 mt-4 font-medium">HEATER</div>
                  <div className="text-xs text-amber-400">SP: {loops.TIC.sp}°C</div>
                </div>

                {/* Arrow 2 - 1 col */}
                <div className="col-span-1 flex items-center justify-center">
                  <div className={`h-1 w-full ${isBatchMode ? 'bg-cyan-500' : 'bg-slate-700'}`} />
                  <div className={`text-2xl ${isBatchMode ? 'text-cyan-400' : 'text-slate-600'}`}>▶</div>
                </div>

                {/* Centrifuge - 2 cols */}
                <div className="col-span-2 flex flex-col items-center">
                  <div className={`w-28 h-28 border-2 rounded-full relative flex items-center justify-center ${isRunning ? 'border-purple-500 bg-purple-900/30' : 'border-slate-600 bg-slate-800'}`}>
                    <div className={`text-4xl ${isRunning ? 'animate-spin' : ''}`} style={{ animationDuration: '2s' }}>⚙️</div>
                    <div className="absolute -bottom-3 bg-slate-900 px-2 rounded">
                      <span className={`text-lg font-bold ${isRunning ? 'text-purple-400' : 'text-slate-500'}`}>{smoothedProc.bowlSpeed.toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="text-sm text-slate-300 mt-4 font-medium">CENTRIFUGE</div>
                  <div className="text-xs text-green-400">SP: {loops.SIC.sp} RPM</div>
                </div>

                {/* Output Arrows - 1 col */}
                <div className="col-span-1 flex flex-col justify-center gap-6 py-4">
                  <div className="flex items-center">
                    <div className={`h-1 flex-1 ${isBatchMode ? 'bg-amber-500' : 'bg-slate-700'}`} />
                    <div className={`text-lg ${isBatchMode ? 'text-amber-400' : 'text-slate-600'}`}>▶</div>
                  </div>
                  <div className="flex items-center">
                    <div className={`h-1 flex-1 ${isBatchMode ? 'bg-cyan-500' : 'bg-slate-700'}`} />
                    <div className={`text-lg ${isBatchMode ? 'text-cyan-400' : 'text-slate-600'}`}>▶</div>
                  </div>
                  <div className="flex items-center">
                    <div className={`h-1 flex-1 ${isBatchMode ? 'bg-orange-500' : 'bg-slate-700'}`} />
                    <div className={`text-lg ${isBatchMode ? 'text-orange-400' : 'text-slate-600'}`}>▶</div>
                  </div>
                </div>

                {/* Output Destinations - 2 cols */}
                <div className="col-span-2 flex flex-col gap-3">
                  {/* Oil Tank */}
                  <div className={`flex items-center gap-3 p-2 rounded-lg border ${isBatchMode ? 'border-amber-500 bg-amber-900/20' : 'border-slate-700 bg-slate-800'}`}>
                    <div className="w-12 h-12 border-2 border-amber-500 rounded relative bg-slate-900">
                      <div className="absolute bottom-0 w-full bg-amber-500/60 rounded-b transition-all" style={{ height: `${oilTanks.find(t => t.id === selectedOilTank)?.level || 0}%` }} />
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{(oilTanks.find(t => t.id === selectedOilTank)?.level || 0).toFixed(0)}%</div>
                    </div>
                    <div>
                      <div className="text-amber-400 font-bold text-sm">🛢️ OIL TANK</div>
                      <div className="text-xs text-slate-400">{selectedOilTank}</div>
                    </div>
                  </div>
                  
                  {/* Pond */}
                  <div className={`flex items-center gap-3 p-2 rounded-lg border ${isBatchMode ? 'border-cyan-500 bg-cyan-900/20' : 'border-slate-700 bg-slate-800'}`}>
                    <div className="w-12 h-12 border-2 border-cyan-500 rounded relative bg-slate-900">
                      <div className="absolute bottom-0 w-full bg-cyan-500/50 rounded-b transition-all" style={{ height: `${pond.level}%` }} />
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{pond.level.toFixed(0)}%</div>
                    </div>
                    <div>
                      <div className="text-cyan-400 font-bold text-sm">🌊 POND</div>
                      <div className="text-xs text-slate-400">8 ML capacity</div>
                    </div>
                  </div>

                  {/* Sludge */}
                  <div className={`flex items-center gap-3 p-2 rounded-lg border ${isBatchMode ? 'border-orange-500 bg-orange-900/20' : 'border-slate-700 bg-slate-800'}`}>
                    <div className="w-12 h-12 border-2 border-orange-500 rounded flex items-center justify-center bg-slate-900">
                      <span className="text-xl">🗑️</span>
                    </div>
                    <div>
                      <div className="text-orange-400 font-bold text-sm">🪨 SLUDGE</div>
                      <div className="text-xs text-slate-400">Disposal</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pond Status Panel */}
            <div className="bg-slate-900 rounded-xl p-4 border-2 border-cyan-600/50">
              <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-3">🌊 Treated Water Pond (8 Million Litres / 8,000 m³)</h3>
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-2">
                  <div className="relative h-28 w-full bg-slate-800 rounded-lg border-2 border-cyan-700 overflow-hidden">
                    <div className="absolute bottom-0 w-full bg-gradient-to-t from-cyan-600/60 to-cyan-400/30 transition-all" style={{ height: `${pond.level}%` }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-white drop-shadow">{pond.level.toFixed(1)}%</div>
                        <div className="text-sm text-cyan-300">{(pond.volume / 1000000).toFixed(2)} ML / 8 ML</div>
                      </div>
                    </div>
                    {pond.level >= POND.high && (
                      <div className="absolute top-2 right-2 text-yellow-400 animate-pulse text-xl">⚠️</div>
                    )}
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">pH Level</div>
                  <div className={`text-2xl font-bold ${pond.pH >= 6.5 && pond.pH <= 8.5 ? 'text-green-400' : 'text-red-400'}`}>{pond.pH.toFixed(1)}</div>
                  <div className="text-xs text-slate-500">Target: 6.5-8.5</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">Turbidity</div>
                  <div className={`text-2xl font-bold ${pond.turbidity <= 100 ? 'text-green-400' : 'text-yellow-400'}`}>{pond.turbidity.toFixed(0)}</div>
                  <div className="text-xs text-slate-500">NTU (&lt;100)</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">Oil in Water</div>
                  <div className={`text-2xl font-bold ${smoothedProc.waterQuality <= 50 ? 'text-green-400' : 'text-red-400'}`}>{smoothedProc.waterQuality.toFixed(0)}</div>
                  <div className="text-xs text-slate-500">ppm (&lt;50)</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">Fill Rate</div>
                  <div className="text-2xl font-bold text-cyan-400">{(smoothedProc.waterOut * 1000).toFixed(0)}</div>
                  <div className="text-xs text-slate-500">L/h</div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button 
                  onClick={() => setPond(p => ({ ...p, level: 0, volume: 0 }))} 
                  className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg text-sm font-medium transition-colors"
                >
                  🚿 Discharge Pond
                </button>
              </div>
            </div>

            {/* Phase Sequence Display - SCADA Style */}
            <div className="bg-slate-900 rounded-xl p-4 border-2 border-slate-600">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Batch Sequence</h3>
              <div className="flex items-center gap-1">
                {batchPhases.map((p, i) => (
                  <div key={i} className="flex-1 relative">
                    <div className={`h-16 rounded border-2 flex flex-col items-center justify-center transition-all ${
                      i === batchPhase && isBatchMode 
                        ? 'border-green-500 bg-green-900/40 scale-105 z-10' 
                        : i < batchPhase && isBatchMode 
                          ? 'border-slate-500 bg-slate-700/50' 
                          : 'border-slate-700 bg-slate-800/50'
                    }`}>
                      <span className={`text-lg ${i === batchPhase && isBatchMode ? '' : 'grayscale opacity-50'}`}>{p.icon}</span>
                      <span className={`text-xs font-medium mt-1 ${i === batchPhase && isBatchMode ? 'text-green-400' : 'text-slate-500'}`}>
                        {p.name.split(' ')[0]}
                      </span>
                    </div>
                    {/* Status indicator */}
                    <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border ${
                      i === batchPhase && isBatchMode 
                        ? 'bg-green-500 border-green-400 animate-pulse' 
                        : i < batchPhase && isBatchMode 
                          ? 'bg-slate-500 border-slate-400' 
                          : 'bg-slate-700 border-slate-600'
                    }`} />
                    {/* Connector */}
                    {i < batchPhases.length - 1 && (
                      <div className={`absolute top-1/2 -right-1 w-2 h-0.5 ${i < batchPhase && isBatchMode ? 'bg-green-500' : 'bg-slate-700'}`} />
                    )}
                  </div>
                ))}
              </div>
              {/* Progress bar */}
              {isBatchMode && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Batch Progress</span>
                    <span>{batchProgress.pct.toFixed(1)}% • {(batchProgress.remain * 1000).toFixed(0)} L remaining</span>
                  </div>
                  <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all" style={{ width: `${batchProgress.pct}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Live Setpoints vs Actuals - SCADA Table */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-900 rounded-xl p-4 border-2 border-slate-600">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Current Phase Setpoints</h3>
                {isBatchMode && batchPhases[batchPhase] ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 border-b border-slate-700 pb-1">
                      <span>PARAMETER</span><span className="text-center">SETPOINT</span><span className="text-center">ACTUAL</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <span className="text-sm text-slate-400">Temperature</span>
                      <span className="text-center text-amber-400 font-mono">{batchPhases[batchPhase].temp}°C</span>
                      <span className={`text-center font-mono font-bold ${Math.abs(smoothedProc.heaterTemp - batchPhases[batchPhase].temp) < 3 ? 'text-green-400' : 'text-yellow-400'}`}>{smoothedProc.heaterTemp.toFixed(1)}°C</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <span className="text-sm text-slate-400">Flow Rate</span>
                      <span className="text-center text-amber-400 font-mono">{batchPhases[batchPhase].flow} m³/h</span>
                      <span className={`text-center font-mono font-bold ${Math.abs(smoothedProc.feedFlow - batchPhases[batchPhase].flow) < 1 ? 'text-green-400' : 'text-yellow-400'}`}>{smoothedProc.feedFlow.toFixed(1)} m³/h</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <span className="text-sm text-slate-400">Bowl Speed</span>
                      <span className="text-center text-amber-400 font-mono">{batchPhases[batchPhase].rpm} RPM</span>
                      <span className={`text-center font-mono font-bold ${Math.abs(smoothedProc.bowlSpeed - batchPhases[batchPhase].rpm) < 100 ? 'text-green-400' : 'text-yellow-400'}`}>{smoothedProc.bowlSpeed.toFixed(0)} RPM</span>
                    </div>
                    <div className="border-t border-slate-700 pt-2 mt-2">
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <span className="text-sm text-slate-400">Feed Comp</span>
                        <span className="text-center text-xs text-slate-500">W{batchPhases[batchPhase].water}/O{batchPhases[batchPhase].oil}/S{batchPhases[batchPhase].sediment}</span>
                        <span className="text-center text-xs text-cyan-400">Phase {batchPhase + 1}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">No batch active</div>
                )}
              </div>

              <div className="bg-slate-900 rounded-xl p-4 border-2 border-slate-600">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Performance</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Oil Recovery</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${smoothedProc.oilEff}%` }} />
                      </div>
                      <span className={`font-mono font-bold ${smoothedProc.oilEff >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>{smoothedProc.oilEff.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Solids Removal</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${smoothedProc.solidsEff}%` }} />
                      </div>
                      <span className={`font-mono font-bold ${smoothedProc.solidsEff >= 95 ? 'text-green-400' : 'text-yellow-400'}`}>{smoothedProc.solidsEff.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Water Quality</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.max(0, 100 - smoothedProc.waterQuality)}%` }} />
                      </div>
                      <span className={`font-mono font-bold ${smoothedProc.waterQuality <= 50 ? 'text-green-400' : 'text-red-400'}`}>{smoothedProc.waterQuality.toFixed(0)} ppm</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-700 pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Total Power</span>
                      <span className="font-mono font-bold text-yellow-400">{smoothedProc.totalPower.toFixed(0)} kW</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm text-slate-400">Vibration</span>
                      <span className={`font-mono font-bold ${smoothedProc.vibration <= 5 ? 'text-green-400' : smoothedProc.vibration <= 7 ? 'text-yellow-400' : 'text-red-400'}`}>{smoothedProc.vibration.toFixed(1)} mm/s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Batch Recipe Table */}
            <div className="bg-slate-900 rounded-xl p-4 border-2 border-slate-600 overflow-x-auto">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Batch Recipe</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left py-2 px-2 text-slate-500">PHASE</th>
                    <th className="text-center py-2 px-2 text-slate-500">VOL (m³)</th>
                    <th className="text-center py-2 px-2 text-slate-500">TEMP</th>
                    <th className="text-center py-2 px-2 text-slate-500">FLOW</th>
                    <th className="text-center py-2 px-2 text-slate-500">RPM</th>
                    <th className="text-center py-2 px-2 text-slate-500">WATER</th>
                    <th className="text-center py-2 px-2 text-slate-500">OIL</th>
                    <th className="text-center py-2 px-2 text-slate-500">SOLIDS</th>
                    <th className="text-center py-2 px-2 text-slate-500">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {batchPhases.map((p, i) => (
                    <tr key={i} className={`border-b border-slate-700/50 ${i === batchPhase && isBatchMode ? 'bg-green-900/20' : ''}`}>
                      <td className="py-2 px-2">
                        <span className="text-lg mr-2">{p.icon}</span>
                        <span className={i === batchPhase && isBatchMode ? 'text-green-400 font-bold' : 'text-slate-300'}>{p.name}</span>
                      </td>
                      <td className="text-center py-2 px-2 font-mono text-cyan-400">{p.volume}</td>
                      <td className="text-center py-2 px-2 font-mono text-red-400">{p.temp}°C</td>
                      <td className="text-center py-2 px-2 font-mono text-blue-400">{p.flow}</td>
                      <td className="text-center py-2 px-2 font-mono text-purple-400">{p.rpm}</td>
                      <td className="text-center py-2 px-2 font-mono text-blue-300">{p.water}%</td>
                      <td className="text-center py-2 px-2 font-mono text-amber-400">{p.oil}%</td>
                      <td className="text-center py-2 px-2 font-mono text-orange-400">{p.sediment}%</td>
                      <td className="text-center py-2 px-2">
                        {i === batchPhase && isBatchMode ? (
                          <span className="px-2 py-0.5 bg-green-900/50 text-green-400 rounded text-xs font-bold animate-pulse">RUNNING</span>
                        ) : i < batchPhase && isBatchMode ? (
                          <span className="px-2 py-0.5 bg-slate-700 text-slate-400 rounded text-xs">DONE</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-500 rounded text-xs">PENDING</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-slate-400">Total Batch Volume: <span className="text-cyan-400 font-bold">{batchPhases.reduce((s, p) => s + p.volume, 0).toFixed(1)} m³</span></span>
                <span className="text-slate-400">Estimated Time: <span className="text-amber-400 font-bold">{((batchPhases.reduce((s, p) => s + p.volume, 0) / 10) * 60).toFixed(0)} min</span></span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">📈 Process Trends</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700"><h3 className="text-sm font-semibold text-cyan-400 mb-3">Flow & Temperature</h3><ResponsiveContainer width="100%" height={180}><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 10 }} /><YAxis yAxisId="l" stroke="#06b6d4" /><YAxis yAxisId="r" orientation="right" stroke="#f97316" /><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} /><Line yAxisId="l" type="monotone" dataKey="flow" stroke="#06b6d4" dot={false} name="Flow" /><Line yAxisId="r" type="monotone" dataKey="temp" stroke="#f97316" dot={false} name="Temp" /></LineChart></ResponsiveContainer></div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700"><h3 className="text-sm font-semibold text-green-400 mb-3">Efficiency & Water Quality</h3><ResponsiveContainer width="100%" height={180}><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 10 }} /><YAxis yAxisId="l" stroke="#22c55e" domain={[70, 100]} /><YAxis yAxisId="r" orientation="right" stroke="#3b82f6" domain={[0, 200]} /><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} /><ReferenceLine yAxisId="l" y={targets.oilEff} stroke="#22c55e" strokeDasharray="5 5" /><ReferenceLine yAxisId="r" y={targets.waterQuality} stroke="#3b82f6" strokeDasharray="5 5" /><Line yAxisId="l" type="monotone" dataKey="oilEff" stroke="#22c55e" dot={false} name="Oil Eff" /><Line yAxisId="r" type="monotone" dataKey="wq" stroke="#3b82f6" dot={false} name="OiW" /></LineChart></ResponsiveContainer></div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700"><h3 className="text-sm font-semibold text-purple-400 mb-3">Speed & Power</h3><ResponsiveContainer width="100%" height={180}><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 10 }} /><YAxis yAxisId="l" stroke="#a855f7" /><YAxis yAxisId="r" orientation="right" stroke="#ef4444" /><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} /><Line yAxisId="l" type="monotone" dataKey="speed" stroke="#a855f7" dot={false} name="Speed" /><Line yAxisId="r" type="monotone" dataKey="power" stroke="#ef4444" dot={false} name="Power" /></LineChart></ResponsiveContainer></div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700"><h3 className="text-sm font-semibold text-amber-400 mb-3">Vibration</h3><ResponsiveContainer width="100%" height={180}><AreaChart data={trendData}><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 10 }} /><YAxis stroke="#f59e0b" domain={[0, 10]} /><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} /><ReferenceLine y={7} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Alarm', fill: '#ef4444', fontSize: 10 }} /><Area type="monotone" dataKey="vib" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} name="Vibration" /></AreaChart></ResponsiveContainer></div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700"><h3 className="text-sm font-semibold text-teal-400 mb-3">pH</h3><ResponsiveContainer width="100%" height={180}><AreaChart data={trendData}><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 10 }} /><YAxis stroke="#14b8a6" domain={[5, 10]} /><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} /><ReferenceLine y={targets.pH.max} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'High', fill: '#ef4444', fontSize: 10 }} /><ReferenceLine y={targets.pH.min} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Low', fill: '#ef4444', fontSize: 10 }} /><ReferenceLine y={7} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'Neutral', fill: '#22c55e', fontSize: 10 }} /><Area type="monotone" dataKey="pH" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.3} name="pH" /></AreaChart></ResponsiveContainer></div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700"><h3 className="text-sm font-semibold text-indigo-400 mb-3">Turbidity</h3><ResponsiveContainer width="100%" height={180}><AreaChart data={trendData}><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 10 }} /><YAxis stroke="#818cf8" domain={[0, 200]} /><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} /><ReferenceLine y={targets.turbidity} stroke="#22c55e" strokeDasharray="5 5" label={{ value: 'Target', fill: '#22c55e', fontSize: 10 }} /><Area type="monotone" dataKey="turbidity" stroke="#818cf8" fill="#818cf8" fillOpacity={0.3} name="Turbidity" /></AreaChart></ResponsiveContainer></div>
            </div>
          </div>
        )}

        {activeTab === 'kpi' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">📊 KPI Dashboard</h2>

            {/* Process Performance KPIs */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">CENTRIFUGE PERFORMANCE</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                <KPI title="Oil Recovery" val={smoothedProc.oilEff} unit="%" target={targets.oilEff} icon="🛢️" />
                <KPI title="Solids Removal" val={smoothedProc.solidsEff} unit="%" target={targets.solidsEff} icon="🪨" />
                <KPI title="Throughput" val={smoothedProc.feedFlow} unit="m³/h" target={targets.minFlow} icon="📊" />
                <KPI title="G-Force" val={smoothedProc.gForce} unit="G" target={2000} icon="🔄" />
                <KPI title="Vibration" val={smoothedProc.vibration} unit="mm/s" target={targets.maxVib} icon="📳" good={smoothedProc.vibration <= targets.maxVib} />
              </div>
            </div>

            {/* Final Discharge Quality KPIs (Post-GAC Filter) */}
            <div className="bg-slate-800 rounded-lg p-4 border border-teal-900/50">
              <h3 className="text-sm font-semibold text-teal-400 mb-3">FINAL DISCHARGE QUALITY (Post-GAC Filter)</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                <KPI title="OiW (Final)" val={polishingFilter.outletOiW} unit="ppm" target={dischargeLimits.oilInWater} icon="💧" good={polishingFilter.outletOiW <= dischargeLimits.oilInWater} />
                <KPI title="Turbidity (Final)" val={polishingFilter.outletTurbidity} unit="NTU" target={dischargeLimits.turbidity} icon="🌫️" good={polishingFilter.outletTurbidity <= dischargeLimits.turbidity} />
                <KPI title="Pond TPH" val={pond.oilInWater || polishingFilter.outletOiW} unit="ppm" target={dischargeLimits.tph} icon="🏊" good={(pond.oilInWater || polishingFilter.outletOiW) <= dischargeLimits.tph} />
                <KPI title="pH" val={pond.pH} unit="" target={7.0} icon="🧪" good={pond.pH >= dischargeLimits.pH.min && pond.pH <= dischargeLimits.pH.max} />
                <KPI title="OiW Reduction" val={smoothedProc.waterQuality > 0 ? ((1 - polishingFilter.outletOiW / smoothedProc.waterQuality) * 100) : 0} unit="%" target={70} icon="📉" good={true} />
              </div>
            </div>

            {/* GAC Filter Performance */}
            <div className="bg-slate-800 rounded-lg p-4 border border-blue-900/50">
              <h3 className="text-sm font-semibold text-blue-400 mb-3">SPDD1600 GAC FILTER PERFORMANCE</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                <KPI title="Turbidity Removal" val={polishingFilter.turbidityRemoval} unit="%" target={85} icon="🔵" good={polishingFilter.turbidityRemoval >= 80} />
                <KPI title="Oil Removal" val={polishingFilter.oilRemoval} unit="%" target={70} icon="🛢️" good={polishingFilter.oilRemoval >= 65} />
                <KPI title="Bed Saturation" val={polishingFilter.bedSaturation} unit="%" target={80} icon="📊" good={polishingFilter.bedSaturation < 80} />
                <KPI title="Differential P" val={polishingFilter.differentialPressure} unit="bar" target={polishingFilter.backwashTriggerDP} icon="⬆️" good={polishingFilter.differentialPressure < polishingFilter.backwashTriggerDP} />
                <KPI title="Total Filtered" val={polishingFilter.totalFiltered} unit="m³" target={100} icon="💧" />
              </div>
            </div>

            {/* Energy & Operations */}
            <div className="bg-slate-800 rounded-lg p-4 border border-yellow-900/50">
              <h3 className="text-sm font-semibold text-yellow-400 mb-3">ENERGY & OPERATIONS</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                <KPI title="Specific Energy" val={computed.specificEnergy} unit="kWh/m³" target={targets.maxEnergy} icon="⚡" good={computed.specificEnergy <= targets.maxEnergy} />
                <KPI title="Total Power" val={smoothedProc.totalPower} unit="kW" target={150} icon="🔌" />
                <KPI title="Run Time" val={totals.runTime / 3600} unit="h" target={8} icon="⏱️" />
                <KPI title="Sludge Rate" val={smoothedProc.solidsOut * 1000} unit="L/h" target={1000} icon="🪨" good={smoothedProc.solidsOut * 1000 <= 1500} />
                <KPI title="Sludge Total" val={totals.solids * 1000} unit="L" target={5000} icon="🚛" />
              </div>
            </div>

            {/* Sludge Disposal Summary */}
            <div className="bg-slate-800 rounded-lg p-4 border border-orange-900/50">
              <h3 className="text-sm font-semibold text-orange-400 mb-3">🚛 SLUDGE DISPOSAL</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                <KPI title="Sludge Rate" val={smoothedProc.solidsOut} unit="m³/h" target={0.5} icon="📊" good={smoothedProc.solidsOut <= 1.0} />
                <KPI title="Session Total" val={totals.solids * 1000} unit="L" target={5000} icon="🛢️" />
                <KPI title="Cake Moisture" val={smoothedProc.sludgeMoisture || 20} unit="%" target={productLimits.sludgeMoisture} icon="💧" good={(smoothedProc.sludgeMoisture || 20) <= productLimits.sludgeMoisture} />
                <KPI title="Disposal Cost" val={totals.solids * costs.sludgeDisposal} unit="$" target={500} icon="💰" />
                <KPI title="Cost Rate" val={smoothedProc.solidsOut * costs.sludgeDisposal} unit="$/h" target={100} icon="📈" good={smoothedProc.solidsOut * costs.sludgeDisposal <= 150} />
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700"><h3 className="text-lg font-semibold text-cyan-400 mb-4">📈 Session Statistics</h3><div className="grid md:grid-cols-4 gap-4">{Object.entries(kpiStats).map(([k, s]) => (<div key={k} className="bg-slate-700/30 rounded-lg p-3"><div className="text-sm text-slate-400 mb-2 capitalize">{k.replace(/([A-Z])/g, ' $1')}</div><div className="grid grid-cols-2 gap-2 text-xs"><div>Mean: <span className="text-cyan-400 font-bold">{s.mean.toFixed(2)}</span></div><div>σ: <span className="text-amber-400 font-bold">{s.stdDev.toFixed(2)}</span></div><div>Min: <span className="text-blue-400 font-bold">{s.min.toFixed(2)}</span></div><div>Max: <span className="text-red-400 font-bold">{s.max.toFixed(2)}</span></div></div></div>))}</div></div>
          </div>
        )}

        {activeTab === 'spc' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">📉 SPC Charts</h2>
            <div className="bg-slate-800 rounded-lg p-4 border border-green-900/50"><h3 className="text-lg font-semibold text-green-400 mb-4">Oil Efficiency X̄ Chart</h3><ResponsiveContainer width="100%" height={220}><LineChart data={kpiHistory}><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 10 }} /><YAxis stroke="#22c55e" domain={[Math.max(0, kpiStats.oilEff.mean - 4 * Math.max(kpiStats.oilEff.stdDev, 1)), Math.min(100, kpiStats.oilEff.mean + 4 * Math.max(kpiStats.oilEff.stdDev, 1))]} /><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} /><ReferenceLine y={kpiStats.oilEff.mean + 3 * kpiStats.oilEff.stdDev} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'UCL', fill: '#ef4444', fontSize: 10 }} /><ReferenceLine y={kpiStats.oilEff.mean} stroke="#22c55e" label={{ value: 'CL', fill: '#22c55e', fontSize: 10 }} /><ReferenceLine y={Math.max(0, kpiStats.oilEff.mean - 3 * kpiStats.oilEff.stdDev)} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'LCL', fill: '#ef4444', fontSize: 10 }} /><ReferenceLine y={targets.oilEff} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: 'Target', fill: '#3b82f6', fontSize: 10 }} /><Line type="monotone" dataKey="oilEff" stroke="#22c55e" dot={false} /></LineChart></ResponsiveContainer><div className="mt-2 grid grid-cols-4 gap-4 text-sm"><div>UCL: <span className="text-red-400">{(kpiStats.oilEff.mean + 3 * kpiStats.oilEff.stdDev).toFixed(2)}%</span></div><div>CL: <span className="text-green-400">{kpiStats.oilEff.mean.toFixed(2)}%</span></div><div>LCL: <span className="text-red-400">{Math.max(0, kpiStats.oilEff.mean - 3 * kpiStats.oilEff.stdDev).toFixed(2)}%</span></div><div>Cp: <span className="text-cyan-400">{kpiStats.oilEff.stdDev > 0 ? ((100 - targets.oilEff) / (3 * kpiStats.oilEff.stdDev)).toFixed(2) : 'N/A'}</span></div></div></div>
            <div className="bg-slate-800 rounded-lg p-4 border border-blue-900/50"><h3 className="text-lg font-semibold text-blue-400 mb-4">Water Quality X̄ Chart</h3><ResponsiveContainer width="100%" height={220}><LineChart data={kpiHistory}><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 10 }} /><YAxis stroke="#3b82f6" domain={[0, Math.max(200, kpiStats.wq.mean + 4 * Math.max(kpiStats.wq.stdDev, 10))]} /><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} /><ReferenceLine y={kpiStats.wq.mean + 3 * kpiStats.wq.stdDev} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'UCL', fill: '#ef4444', fontSize: 10 }} /><ReferenceLine y={kpiStats.wq.mean} stroke="#3b82f6" label={{ value: 'CL', fill: '#3b82f6', fontSize: 10 }} /><ReferenceLine y={targets.waterQuality} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'Target', fill: '#22c55e', fontSize: 10 }} /><Line type="monotone" dataKey="wq" stroke="#3b82f6" dot={false} /></LineChart></ResponsiveContainer></div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="space-y-6 print:space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
              <h2 className="text-xl font-bold">📋 Operations Report</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Phase report print function
                    const avg = (stats: { sum: number; count: number }) => stats.count > 0 ? stats.sum / stats.count : 0;
                    const overallTotals = phaseData.reduce((acc, p) => ({
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
                    const totalCosts = overallTotals.costs.energy + overallTotals.costs.chemicals +
                      overallTotals.costs.disposal + overallTotals.costs.water +
                      overallTotals.costs.labor + overallTotals.costs.filter;
                    const weightedQuality = phaseData.reduce((acc, p) => {
                      const weight = p.totals.feed;
                      return {
                        oilEff: acc.oilEff + avg(p.quality.oilEfficiency) * weight,
                        solidsEff: acc.solidsEff + avg(p.quality.solidsEfficiency) * weight,
                        wq: acc.wq + avg(p.quality.waterQuality) * weight,
                        totalWeight: acc.totalWeight + weight,
                      };
                    }, { oilEff: 0, solidsEff: 0, wq: 0, totalWeight: 0 });
                    const avgOilEffOverall = weightedQuality.totalWeight > 0 ? weightedQuality.oilEff / weightedQuality.totalWeight : 0;
                    const avgSolidsEffOverall = weightedQuality.totalWeight > 0 ? weightedQuality.solidsEff / weightedQuality.totalWeight : 0;
                    const avgWQOverall = weightedQuality.totalWeight > 0 ? weightedQuality.wq / weightedQuality.totalWeight : 0;
                    const overallMassBalance = overallTotals.feed > 0
                      ? ((overallTotals.water + overallTotals.oil + overallTotals.solids) / overallTotals.feed) * 100
                      : 100;

                    const phaseRows = phaseData.map((p, i) => `
                      <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
                        <td class="py-2 px-3 font-medium">${p.phaseName}</td>
                        <td class="py-2 px-3 text-right">${formatTime(p.startTime)} - ${formatTime(p.endTime || p.startTime)}</td>
                        <td class="py-2 px-3 text-right">${formatTime(p.totals.duration)}</td>
                        <td class="py-2 px-3 text-right">${p.totals.feed.toFixed(3)} m³</td>
                        <td class="py-2 px-3 text-right">${(p.totals.water * 1000).toFixed(0)} L</td>
                        <td class="py-2 px-3 text-right">${(p.totals.oil * 1000).toFixed(1)} L</td>
                        <td class="py-2 px-3 text-right">${(p.totals.solids * 1000).toFixed(1)} L</td>
                      </tr>
                    `).join('');
                    const phaseCostRows = phaseData.map((p, i) => `
                      <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
                        <td class="py-2 px-3 font-medium">${p.phaseName}</td>
                        <td class="py-2 px-3 text-right">$${p.costs.energy.toFixed(2)}</td>
                        <td class="py-2 px-3 text-right">$${p.costs.chemicals.toFixed(2)}</td>
                        <td class="py-2 px-3 text-right">$${p.costs.disposal.toFixed(2)}</td>
                        <td class="py-2 px-3 text-right">$${p.costs.water.toFixed(2)}</td>
                        <td class="py-2 px-3 text-right">$${p.costs.labor.toFixed(2)}</td>
                        <td class="py-2 px-3 text-right font-bold">$${(p.costs.energy + p.costs.chemicals + p.costs.disposal + p.costs.water + p.costs.labor + p.costs.filter).toFixed(2)}</td>
                      </tr>
                    `).join('');
                    const fractionQualityRows = phaseData.map((p, i) => `
                      <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
                        <td class="py-2 px-3 font-medium" rowspan="3">${p.phaseName}</td>
                        <td class="py-2 px-3 text-blue-600 font-medium">Water</td>
                        <td class="py-2 px-3 text-right">${(p.totals.water * 1000).toFixed(0)} L</td>
                        <td class="py-2 px-3 text-right">${p.totals.feed > 0 ? ((p.totals.water / p.totals.feed) * 100).toFixed(1) : 0}%</td>
                        <td class="py-2 px-3 text-right">${avg(p.fractions.water.oilContent).toFixed(0)} ppm OiW</td>
                        <td class="py-2 px-3 text-right">${avg(p.fractions.water.tss).toFixed(0)} mg/L TSS</td>
                        <td class="py-2 px-3 text-center">${avg(p.fractions.water.oilContent) < 500 ? '✅' : '⚠️'}</td>
                      </tr>
                      <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
                        <td class="py-2 px-3 text-amber-600 font-medium">Oil</td>
                        <td class="py-2 px-3 text-right">${(p.totals.oil * 1000).toFixed(1)} L</td>
                        <td class="py-2 px-3 text-right">${p.totals.feed > 0 ? ((p.totals.oil / p.totals.feed) * 100).toFixed(2) : 0}%</td>
                        <td class="py-2 px-3 text-right">${avg(p.fractions.oil.waterContent).toFixed(1)}% H₂O</td>
                        <td class="py-2 px-3 text-right">${avg(p.fractions.oil.recovery).toFixed(1)}% recovery</td>
                        <td class="py-2 px-3 text-center">${avg(p.fractions.oil.recovery) >= 95 ? '✅' : '⚠️'}</td>
                      </tr>
                      <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''} border-b-2 border-gray-300">
                        <td class="py-2 px-3 text-orange-600 font-medium">Solids</td>
                        <td class="py-2 px-3 text-right">${(p.totals.solids * 1000).toFixed(1)} L</td>
                        <td class="py-2 px-3 text-right">${p.totals.feed > 0 ? ((p.totals.solids / p.totals.feed) * 100).toFixed(2) : 0}%</td>
                        <td class="py-2 px-3 text-right">${avg(p.fractions.solids.moisture).toFixed(1)}% moisture</td>
                        <td class="py-2 px-3 text-right">${avg(p.fractions.solids.recovery).toFixed(1)}% recovery</td>
                        <td class="py-2 px-3 text-center">${avg(p.fractions.solids.moisture) <= 20 ? '✅' : '⚠️'}</td>
                      </tr>
                    `).join('');
                    const massBalanceRows = phaseData.map((p, i) => `
                      <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
                        <td class="py-2 px-3 font-medium">${p.phaseName}</td>
                        <td class="py-2 px-3 text-right">${p.massBalance.totalIn.toFixed(4)} m³</td>
                        <td class="py-2 px-3 text-right">${p.massBalance.totalOut.toFixed(4)} m³</td>
                        <td class="py-2 px-3 text-right font-bold ${Math.abs(avg(p.massBalance.closurePct) - 100) < 2 ? 'text-green-600' : 'text-red-600'}">${avg(p.massBalance.closurePct).toFixed(1)}%</td>
                        <td class="py-2 px-3 text-center">${Math.abs(avg(p.massBalance.closurePct) - 100) < 2 ? '✅ Valid' : '⚠️ Check'}</td>
                        <td class="py-2 px-3 text-right text-gray-500">${p.dataQuality.samplesCollected}</td>
                      </tr>
                    `).join('');
                    const anomalySummary = phaseData.flatMap(p =>
                      p.dataQuality.anomalies.map(a => `<li>${p.phaseName}: ${a}</li>`)
                    ).slice(0, 15).join('');

                    const printContent = `
                      <html>
                      <head>
                        <title>Phase Cost & Three-Fraction Quality Report - Karratha WTP</title>
                        <style>
                          body { font-family: Arial, sans-serif; padding: 30px; color: #333; font-size: 11px; }
                          h1 { color: #0d9488; border-bottom: 2px solid #0d9488; padding-bottom: 10px; font-size: 20px; }
                          h2 { color: #1e40af; margin-top: 25px; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
                          table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
                          th { background: #1e40af; color: white; padding: 8px 6px; text-align: left; }
                          td { border: 1px solid #e5e7eb; padding: 6px; }
                          .bg-gray-50 { background: #f9fafb; }
                          .positive { color: #16a34a; font-weight: bold; }
                          .negative { color: #dc2626; }
                          .highlight { background: #fef3c7; }
                          .metric-box { display: inline-block; padding: 12px; margin: 5px; border: 2px solid #ddd; border-radius: 8px; text-align: center; min-width: 120px; }
                          .metric-value { font-size: 18px; font-weight: bold; }
                          .metric-label { font-size: 9px; color: #666; margin-top: 3px; }
                          .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 9px; color: #666; }
                          .text-right { text-align: right; }
                          .text-center { text-align: center; }
                          .text-blue-600 { color: #2563eb; }
                          .text-amber-600 { color: #d97706; }
                          .text-orange-600 { color: #ea580c; }
                          .text-green-600 { color: #16a34a; }
                          .text-red-600 { color: #dc2626; }
                          .text-gray-500 { color: #6b7280; }
                          .font-bold { font-weight: bold; }
                          .font-medium { font-weight: 500; }
                          @media print { body { padding: 15px; } }
                        </style>
                      </head>
                      <body>
                        <h1>📊 Simulation Phase Cost & Three-Fraction Quality Report</h1>
                        <p><strong>Equipment:</strong> SACOR Delta-Canter 20-843A Three-Phase Tricanter</p>
                        <p><strong>Feedstock:</strong> ${feedstockTypes[selectedFeedstock].name} | <strong>Destination:</strong> ${transportDestinations[selectedDestination].name}</p>
                        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>

                        <div style="display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0;">
                          <div class="metric-box"><div class="metric-value">${phaseData.length}</div><div class="metric-label">Phases Completed</div></div>
                          <div class="metric-box"><div class="metric-value">${formatTime(overallTotals.duration)}</div><div class="metric-label">Total Run Time</div></div>
                          <div class="metric-box"><div class="metric-value">${overallTotals.feed.toFixed(2)} m³</div><div class="metric-label">Feed Processed</div></div>
                          <div class="metric-box" style="border-color: #16a34a;"><div class="metric-value positive">${(overallTotals.oil * 1000).toFixed(1)} L</div><div class="metric-label">Oil Recovered</div></div>
                          <div class="metric-box"><div class="metric-value">${avgOilEffOverall.toFixed(1)}%</div><div class="metric-label">Avg Oil Recovery</div></div>
                          <div class="metric-box" style="border-color: ${Math.abs(overallMassBalance - 100) < 2 ? '#16a34a' : '#dc2626'};"><div class="metric-value ${Math.abs(overallMassBalance - 100) < 2 ? 'positive' : 'negative'}">${overallMassBalance.toFixed(1)}%</div><div class="metric-label">Mass Balance</div></div>
                          <div class="metric-box" style="border-color: #dc2626;"><div class="metric-value negative">$${totalCosts.toFixed(2)}</div><div class="metric-label">Total Cost</div></div>
                        </div>

                        <h2>📦 Phase Volume Summary</h2>
                        <table><thead><tr><th>Phase</th><th class="text-right">Time Window</th><th class="text-right">Duration</th><th class="text-right">Feed In</th><th class="text-right">Water Out</th><th class="text-right">Oil Out</th><th class="text-right">Solids Out</th></tr></thead>
                        <tbody>${phaseRows}<tr class="highlight font-bold"><td>TOTAL</td><td class="text-right">-</td><td class="text-right">${formatTime(overallTotals.duration)}</td><td class="text-right">${overallTotals.feed.toFixed(3)} m³</td><td class="text-right">${(overallTotals.water * 1000).toFixed(0)} L</td><td class="text-right">${(overallTotals.oil * 1000).toFixed(1)} L</td><td class="text-right">${(overallTotals.solids * 1000).toFixed(1)} L</td></tr></tbody></table>

                        <h2>💰 Phase Cost Breakdown</h2>
                        <table><thead><tr><th>Phase</th><th class="text-right">Energy</th><th class="text-right">Chemicals</th><th class="text-right">Disposal</th><th class="text-right">Water</th><th class="text-right">Labor</th><th class="text-right">Total</th></tr></thead>
                        <tbody>${phaseCostRows}<tr class="highlight font-bold"><td>TOTAL</td><td class="text-right">$${overallTotals.costs.energy.toFixed(2)}</td><td class="text-right">$${overallTotals.costs.chemicals.toFixed(2)}</td><td class="text-right">$${overallTotals.costs.disposal.toFixed(2)}</td><td class="text-right">$${overallTotals.costs.water.toFixed(2)}</td><td class="text-right">$${overallTotals.costs.labor.toFixed(2)}</td><td class="text-right">$${totalCosts.toFixed(2)}</td></tr></tbody></table>

                        <h2>🔬 Three-Fraction Quality Report</h2>
                        <table><thead><tr><th>Phase</th><th>Fraction</th><th class="text-right">Volume</th><th class="text-right">Yield %</th><th class="text-right">Primary</th><th class="text-right">Secondary</th><th class="text-center">Status</th></tr></thead>
                        <tbody>${fractionQualityRows}</tbody></table>

                        <h2>⚖️ Mass Balance Validation</h2>
                        <table><thead><tr><th>Phase</th><th class="text-right">Mass In</th><th class="text-right">Mass Out</th><th class="text-right">Closure %</th><th class="text-center">Validation</th><th class="text-right">Samples</th></tr></thead>
                        <tbody>${massBalanceRows}<tr class="highlight font-bold"><td>OVERALL</td><td class="text-right">${overallTotals.feed.toFixed(4)} m³</td><td class="text-right">${(overallTotals.water + overallTotals.oil + overallTotals.solids).toFixed(4)} m³</td><td class="text-right ${Math.abs(overallMassBalance - 100) < 2 ? 'text-green-600' : 'text-red-600'}">${overallMassBalance.toFixed(1)}%</td><td class="text-center">${Math.abs(overallMassBalance - 100) < 2 ? '✅' : '⚠️'}</td><td class="text-right">-</td></tr></tbody></table>

                        ${anomalySummary ? `<h2>🚨 Anomalies</h2><ul style="margin-left: 20px; color: #dc2626;">${anomalySummary}</ul>` : ''}

                        <h2>📈 Overall Performance</h2>
                        <table><thead><tr><th>Metric</th><th class="text-right">Value</th><th class="text-right">Target</th><th class="text-center">Status</th></tr></thead>
                        <tbody>
                          <tr><td>Oil Recovery</td><td class="text-right font-bold">${avgOilEffOverall.toFixed(1)}%</td><td class="text-right">≥95%</td><td class="text-center">${avgOilEffOverall >= 95 ? '✅' : '⚠️'}</td></tr>
                          <tr class="bg-gray-50"><td>Solids Removal</td><td class="text-right font-bold">${avgSolidsEffOverall.toFixed(1)}%</td><td class="text-right">≥95%</td><td class="text-center">${avgSolidsEffOverall >= 95 ? '✅' : '⚠️'}</td></tr>
                          <tr><td>Water Quality</td><td class="text-right font-bold">${avgWQOverall.toFixed(0)} ppm</td><td class="text-right">≤500 ppm</td><td class="text-center">${avgWQOverall <= 500 ? '✅' : '⚠️'}</td></tr>
                          <tr class="bg-gray-50"><td>Specific Energy</td><td class="text-right font-bold">${overallTotals.feed > 0 ? (overallTotals.energy / overallTotals.feed).toFixed(2) : 0} kWh/m³</td><td class="text-right">≤5 kWh/m³</td><td class="text-center">${overallTotals.feed > 0 && (overallTotals.energy / overallTotals.feed) <= 5 ? '✅' : '⚠️'}</td></tr>
                          <tr><td>Cost per m³</td><td class="text-right font-bold">$${overallTotals.feed > 0 ? (totalCosts / overallTotals.feed).toFixed(2) : 0}</td><td class="text-right">-</td><td class="text-center">📊</td></tr>
                          <tr class="highlight"><td class="font-bold">Mass Balance</td><td class="text-right font-bold">${overallMassBalance.toFixed(1)}%</td><td class="text-right">98-102%</td><td class="text-center">${Math.abs(overallMassBalance - 100) < 2 ? '✅' : '⚠️'}</td></tr>
                        </tbody></table>

                        <div class="footer">
                          <p><strong>Karratha WTP Simulator v15</strong> | SACOR Delta-Canter 20-843A | ${new Date().toISOString()}</p>
                        </div>
                      </body></html>
                    `;
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(printContent);
                      printWindow.document.close();
                      printWindow.print();
                    }
                  }}
                  disabled={phaseData.length === 0}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    phaseData.length > 0
                      ? 'bg-purple-600 hover:bg-purple-500'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                  title={phaseData.length === 0 ? 'Run a batch first' : `${phaseData.length} phases recorded`}
                >
                  📊 Phase Report {phaseData.length > 0 && `(${phaseData.length})`}
                </button>
                <button onClick={() => addEvent('NOTE', 'Manual checkpoint')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">➕ Add Note</button>
                <button onClick={() => window.print()} className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm font-medium">🖨️ Print</button>
                <button onClick={() => { if (window.confirm('Reset all data?')) dailyReset(); }} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium">🔄 Reset</button>
              </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block text-center border-b-2 border-slate-600 pb-4 mb-4">
              <h1 className="text-2xl font-bold">Centrifuge Operations Report</h1>
              <p className="text-slate-400">Generated: {new Date().toLocaleString()}</p>
            </div>

            {/* Shift Information */}
            <div className="bg-slate-800 rounded-lg p-4 border border-blue-900/50 print:bg-white print:border-slate-300">
              <h3 className="text-lg font-semibold text-blue-400 mb-4 print:text-blue-600">📝 Shift Information</h3>
              <div className="grid md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-slate-400">Date</label>
                  <input type="date" value={shiftInfo.date} onChange={e => setShiftInfo(p => ({ ...p, date: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1 focus:border-cyan-500 focus:outline-none print:bg-white print:border-slate-300" />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Shift</label>
                  <select value={shiftInfo.shift} onChange={e => setShiftInfo(p => ({ ...p, shift: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1 focus:border-cyan-500 focus:outline-none print:bg-white print:border-slate-300">
                    <option>Day (06:00-18:00)</option>
                    <option>Night (18:00-06:00)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Operator</label>
                  <input type="text" value={shiftInfo.operator} onChange={e => setShiftInfo(p => ({ ...p, operator: e.target.value }))} placeholder="Name" className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1 focus:border-cyan-500 focus:outline-none print:bg-white print:border-slate-300" />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Run Time</label>
                  <div className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1 text-lg font-bold text-cyan-400 print:bg-white print:border-slate-300">
                    {formatTime(totals.runTime)}
                  </div>
                </div>
              </div>
            </div>

            {/* Production Summary */}
            <div className="bg-slate-800 rounded-lg p-4 border border-green-900/50">
              <h3 className="text-lg font-semibold text-green-400 mb-4">📊 Production Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left py-2 px-3 text-slate-400">Stream</th>
                      <th className="text-right py-2 px-3 text-slate-400">Volume (m³)</th>
                      <th className="text-right py-2 px-3 text-slate-400">Volume (L)</th>
                      <th className="text-right py-2 px-3 text-slate-400">% of Feed</th>
                      <th className="text-right py-2 px-3 text-slate-400">Avg Rate (m³/h)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-700 bg-blue-900/20">
                      <td className="py-2 px-3 font-bold text-blue-400">📥 Feed Processed</td>
                      <td className="text-right py-2 px-3 font-mono text-blue-400">{totals.feed.toFixed(3)}</td>
                      <td className="text-right py-2 px-3 font-mono">{(totals.feed * 1000).toFixed(0)}</td>
                      <td className="text-right py-2 px-3 font-mono">100.0%</td>
                      <td className="text-right py-2 px-3 font-mono">{totals.runTime > 0 ? (totals.feed / (totals.runTime / 3600)).toFixed(2) : '0.00'}</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-2 px-3 text-cyan-400">💧 Water Discharged</td>
                      <td className="text-right py-2 px-3 font-mono">{totals.water.toFixed(3)}</td>
                      <td className="text-right py-2 px-3 font-mono">{(totals.water * 1000).toFixed(0)}</td>
                      <td className="text-right py-2 px-3 font-mono">{totals.feed > 0 ? ((totals.water / totals.feed) * 100).toFixed(1) : '0.0'}%</td>
                      <td className="text-right py-2 px-3 font-mono">{totals.runTime > 0 ? (totals.water / (totals.runTime / 3600)).toFixed(2) : '0.00'}</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-2 px-3 text-amber-400">🛢️ Oil Recovered</td>
                      <td className="text-right py-2 px-3 font-mono">{totals.oil.toFixed(4)}</td>
                      <td className="text-right py-2 px-3 font-mono font-bold text-amber-400">{(totals.oil * 1000).toFixed(1)}</td>
                      <td className="text-right py-2 px-3 font-mono">{totals.feed > 0 ? ((totals.oil / totals.feed) * 100).toFixed(2) : '0.00'}%</td>
                      <td className="text-right py-2 px-3 font-mono">{totals.runTime > 0 ? (totals.oil / (totals.runTime / 3600)).toFixed(4) : '0.0000'}</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-2 px-3 text-orange-400">🪨 Sludge Generated</td>
                      <td className="text-right py-2 px-3 font-mono">{totals.solids.toFixed(4)}</td>
                      <td className="text-right py-2 px-3 font-mono">{(totals.solids * 1000).toFixed(1)}</td>
                      <td className="text-right py-2 px-3 font-mono">{totals.feed > 0 ? ((totals.solids / totals.feed) * 100).toFixed(2) : '0.00'}%</td>
                      <td className="text-right py-2 px-3 font-mono">{totals.runTime > 0 ? (totals.solids / (totals.runTime / 3600)).toFixed(4) : '0.0000'}</td>
                    </tr>
                    <tr className="bg-slate-700/30">
                      <td className="py-2 px-3 font-bold">⚡ Energy Consumed</td>
                      <td className="text-right py-2 px-3 font-mono font-bold text-yellow-400" colSpan="2">{totals.energy.toFixed(1)} kWh</td>
                      <td className="text-right py-2 px-3 font-mono" colSpan="2">{totals.feed > 0 ? (totals.energy / totals.feed).toFixed(2) : '0.00'} kWh/m³</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-800 rounded-lg p-4 border border-amber-900/50">
              <h3 className="text-lg font-semibold text-amber-400 mb-4">💰 Financial Summary</h3>
              {(() => {
                const revenue = totals.oil * costs.oilValue;
                const energyCost = totals.energy * costs.elec;
                const sludgeCost = totals.solids * costs.sludgeDisposal;
                const waterCost = totals.water * costs.waterTreatment;
                const laborCost = (totals.runTime / 3600) * costs.laborRate;
                const totalCosts = energyCost + sludgeCost + waterCost + laborCost;
                const netProfit = revenue - totalCosts;
                const isProfit = netProfit >= 0;
                return (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-semibold text-green-400 mb-2">Revenue</h4>
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="border-b border-slate-700">
                            <td className="py-2">Oil Recovered ({(totals.oil * 1000).toFixed(0)} L @ ${costs.oilValue}/m³)</td>
                            <td className="py-2 text-right text-green-400 font-bold">+${revenue.toFixed(2)}</td>
                          </tr>
                          <tr className="bg-green-900/20">
                            <td className="py-2 font-bold">Total Revenue</td>
                            <td className="py-2 text-right text-green-400 font-bold text-lg">${revenue.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-red-400 mb-2">Operating Costs</h4>
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="border-b border-slate-700">
                            <td className="py-1">Electricity ({totals.energy.toFixed(1)} kWh @ ${costs.elec}/kWh)</td>
                            <td className="py-1 text-right text-red-400">-${energyCost.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-slate-700">
                            <td className="py-1">Sludge Disposal ({(totals.solids * 1000).toFixed(0)} L @ ${costs.sludgeDisposal}/m³)</td>
                            <td className="py-1 text-right text-red-400">-${sludgeCost.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-slate-700">
                            <td className="py-1">Water Treatment ({totals.water.toFixed(2)} m³ @ ${costs.waterTreatment}/m³)</td>
                            <td className="py-1 text-right text-red-400">-${waterCost.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-slate-700">
                            <td className="py-1">Labor ({(totals.runTime / 3600).toFixed(1)} hrs @ ${costs.laborRate}/hr)</td>
                            <td className="py-1 text-right text-red-400">-${laborCost.toFixed(2)}</td>
                          </tr>
                          <tr className="bg-red-900/20">
                            <td className="py-2 font-bold">Total Costs</td>
                            <td className="py-2 text-right text-red-400 font-bold text-lg">-${totalCosts.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="md:col-span-2">
                      <div className={`p-4 rounded-lg border-2 ${isProfit ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'}`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-lg font-bold">NET {isProfit ? 'PROFIT' : 'LOSS'}</div>
                            <div className="text-sm text-slate-400">
                              {totals.feed > 0 ? `$${(netProfit / totals.feed).toFixed(2)} per m³ processed` : 'No feed processed'}
                            </div>
                          </div>
                          <div className={`text-3xl font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                            {isProfit ? '+' : ''}${netProfit.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* KPI Performance */}
            <div className="bg-slate-800 rounded-lg p-4 border border-purple-900/50">
              <h3 className="text-lg font-semibold text-purple-400 mb-4">🎯 KPI Performance vs Targets</h3>
              <div className="grid md:grid-cols-4 gap-3">
                {[
                  { name: 'Oil Recovery', current: kpiStats.oilEff.mean, target: targets.oilEff, unit: '%', good: kpiStats.oilEff.mean >= targets.oilEff },
                  { name: 'Solids Removal', current: kpiStats.solidsEff.mean, target: targets.solidsEff, unit: '%', good: kpiStats.solidsEff.mean >= targets.solidsEff },
                  { name: 'Water Quality (OiW)', current: kpiStats.wq.mean, target: targets.waterQuality, unit: 'ppm', good: kpiStats.wq.mean <= targets.waterQuality },
                  { name: 'pH', current: kpiStats.pH.mean, target: '6.5-8.5', unit: '', good: kpiStats.pH.mean >= targets.pH.min && kpiStats.pH.mean <= targets.pH.max },
                  { name: 'Turbidity', current: kpiStats.turbidity.mean, target: targets.turbidity, unit: 'NTU', good: kpiStats.turbidity.mean <= targets.turbidity },
                  { name: 'Specific Energy', current: totals.feed > 0 ? totals.energy / totals.feed : 0, target: targets.maxEnergy, unit: 'kWh/m³', good: (totals.feed > 0 ? totals.energy / totals.feed : 0) <= targets.maxEnergy },
                  { name: 'Throughput', current: totals.runTime > 0 ? totals.feed / (totals.runTime / 3600) : 0, target: targets.minFlow, unit: 'm³/h', good: (totals.runTime > 0 ? totals.feed / (totals.runTime / 3600) : 0) >= targets.minFlow },
                  { name: 'Vibration', current: kpiStats.vib.mean, target: targets.maxVib, unit: 'mm/s', good: kpiStats.vib.mean <= targets.maxVib },
                ].map((kpi, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${kpi.good ? 'bg-green-900/20 border-green-500/50' : 'bg-red-900/20 border-red-500/50'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm text-slate-300">{kpi.name}</span>
                      <span className={`text-lg ${kpi.good ? '✅' : '❌'}`}></span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <div className={`text-2xl font-bold ${kpi.good ? 'text-green-400' : 'text-red-400'}`}>
                          {kpi.current.toFixed(kpi.unit === 'ppm' || kpi.unit === 'NTU' ? 0 : 1)}
                        </div>
                        <div className="text-xs text-slate-500">{kpi.unit}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-400">Target</div>
                        <div className="text-lg text-slate-300">{kpi.target}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment Status */}
            <div className="bg-slate-800 rounded-lg p-4 border border-cyan-900/50">
              <h3 className="text-lg font-semibold text-cyan-400 mb-4">🔧 Equipment Status</h3>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">Bearing Condition</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${equipment.bearingCondition > 70 ? 'bg-green-500' : equipment.bearingCondition > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${equipment.bearingCondition}%` }} />
                    </div>
                    <span className={`font-bold ${equipment.bearingCondition > 70 ? 'text-green-400' : equipment.bearingCondition > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {equipment.bearingCondition}%
                    </span>
                  </div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">Avg Vibration</div>
                  <div className={`text-xl font-bold ${kpiStats.vib.mean <= 5 ? 'text-green-400' : kpiStats.vib.mean <= 7 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {kpiStats.vib.mean.toFixed(2)} mm/s
                  </div>
                  <div className="text-xs text-slate-500">Max: {kpiStats.vib.max.toFixed(2)} mm/s</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">Avg G-Force</div>
                  <div className="text-xl font-bold text-purple-400">{kpiStats.gForce ? kpiStats.gForce.mean.toFixed(0) : smoothedProc.gForce.toFixed(0)} G</div>
                  <div className="text-xs text-slate-500">Bowl: {equipment.bowlDiameter}mm @ {loops.SIC.sp} RPM</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">Heater/Motor Load</div>
                  <div className="text-xl font-bold text-yellow-400">
                    {computed.utilization.average.toFixed(0)}%
                  </div>
                  <div className="text-xs text-slate-500">Avg capacity utilization</div>
                </div>
              </div>
            </div>

            {/* Pond & Water Quality Status */}
            <div className="bg-slate-800 rounded-lg p-4 border border-cyan-900/50">
              <h3 className="text-lg font-semibold text-cyan-400 mb-4">🌊 Pond & Water Quality</h3>
              <div className="grid md:grid-cols-5 gap-4">
                <div className="bg-cyan-900/20 rounded-lg p-3 text-center border border-cyan-500/30">
                  <div className="text-xs text-cyan-400">Pond Level</div>
                  <div className="text-2xl font-bold text-cyan-400">{pond.level.toFixed(1)}%</div>
                  <div className="text-xs text-slate-500">{(pond.volume / 1000000).toFixed(2)} / 8 ML</div>
                </div>
                <div className={`rounded-lg p-3 text-center border ${kpiStats.pH.mean >= targets.pH.min && kpiStats.pH.mean <= targets.pH.max ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                  <div className="text-xs text-slate-400">Avg pH</div>
                  <div className={`text-2xl font-bold ${kpiStats.pH.mean >= targets.pH.min && kpiStats.pH.mean <= targets.pH.max ? 'text-green-400' : 'text-red-400'}`}>
                    {kpiStats.pH.mean.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500">Target: 6.5-8.5</div>
                </div>
                <div className={`rounded-lg p-3 text-center border ${kpiStats.turbidity.mean <= targets.turbidity ? 'bg-green-900/20 border-green-500/30' : 'bg-yellow-900/20 border-yellow-500/30'}`}>
                  <div className="text-xs text-slate-400">Avg Turbidity</div>
                  <div className={`text-2xl font-bold ${kpiStats.turbidity.mean <= targets.turbidity ? 'text-green-400' : 'text-yellow-400'}`}>
                    {kpiStats.turbidity.mean.toFixed(0)} NTU
                  </div>
                  <div className="text-xs text-slate-500">Target: &lt;{targets.turbidity}</div>
                </div>
                <div className={`rounded-lg p-3 text-center border ${kpiStats.wq.mean <= targets.waterQuality ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                  <div className="text-xs text-slate-400">Avg OiW</div>
                  <div className={`text-2xl font-bold ${kpiStats.wq.mean <= targets.waterQuality ? 'text-green-400' : 'text-red-400'}`}>
                    {kpiStats.wq.mean.toFixed(0)} ppm
                  </div>
                  <div className="text-xs text-slate-500">Target: &lt;{targets.waterQuality}</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-400">Water Discharged</div>
                  <div className="text-2xl font-bold text-blue-400">{totals.water.toFixed(2)} m³</div>
                  <div className="text-xs text-slate-500">{(totals.water * 1000).toFixed(0)} L</div>
                </div>
              </div>
            </div>

            {/* Alarm Summary */}
            <div className="bg-slate-800 rounded-lg p-4 border border-red-900/50">
              <h3 className="text-lg font-semibold text-red-400 mb-4">🚨 Alarm Summary</h3>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="bg-red-900/20 rounded-lg p-3 text-center border border-red-500/30">
                  <div className="text-xs text-red-400">Current Active</div>
                  <div className="text-3xl font-bold text-red-400">{alarms.length}</div>
                </div>
                <div className="bg-orange-900/20 rounded-lg p-3 text-center border border-orange-500/30">
                  <div className="text-xs text-orange-400">Pending</div>
                  <div className="text-3xl font-bold text-orange-400">{pendingAlarms.length}</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3 text-center border border-slate-600">
                  <div className="text-xs text-slate-400">Interlock Events</div>
                  <div className="text-3xl font-bold text-slate-300">
                    {reportEvents.filter(e => e.type === 'INTERLOCK').length}
                  </div>
                </div>
              </div>
              {alarms.length > 0 && (
                <div className="space-y-2">
                  {alarms.map((a, i) => (
                    <div key={i} className={`p-2 rounded border ${a.sev === 'critical' ? 'bg-red-900/30 border-red-700' : 'bg-yellow-900/30 border-yellow-700'}`}>
                      <div className="flex justify-between items-center">
                        <span className={`font-medium ${a.sev === 'critical' ? 'text-red-400' : 'text-yellow-400'}`}>
                          {a.sev === 'critical' ? '🔴' : '🟡'} {a.type.replace(/_/g, ' ')}
                        </span>
                        <span className="font-mono">{a.val.toFixed(1)} (Limit: {a.lim})</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Event Log */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold text-slate-300 mb-4">📜 Event Log ({reportEvents.length} events)</h3>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-800">
                    <tr className="border-b border-slate-600">
                      <th className="text-left py-2 px-2 text-slate-400">Real Time</th>
                      <th className="text-left py-2 px-2 text-slate-400">Sim Time</th>
                      <th className="text-left py-2 px-2 text-slate-400">Type</th>
                      <th className="text-left py-2 px-2 text-slate-400">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportEvents.slice().reverse().map((e, i) => (
                      <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="py-2 px-2 text-slate-400 font-mono text-xs">{e.time}</td>
                        <td className="py-2 px-2 text-slate-400 font-mono text-xs">{formatTime(e.simTime)}</td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            e.type === 'START' ? 'bg-green-900/50 text-green-400' : 
                            e.type === 'COMPLETE' ? 'bg-blue-900/50 text-blue-400' : 
                            e.type === 'PHASE' ? 'bg-purple-900/50 text-purple-400' : 
                            e.type === 'INTERLOCK' ? 'bg-red-900/50 text-red-400' :
                            e.type === 'ALARM' ? 'bg-orange-900/50 text-orange-400' :
                            'bg-slate-700 text-slate-400'
                          }`}>{e.type}</span>
                        </td>
                        <td className="py-2 px-2">{e.desc}</td>
                      </tr>
                    ))}
                    {reportEvents.length === 0 && (
                      <tr>
                        <td colSpan="4" className="py-8 text-center text-slate-500">No events recorded yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Operator Notes */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold text-slate-300 mb-4">📝 Operator Notes</h3>
              <textarea 
                className="w-full h-32 bg-slate-700 border border-slate-600 rounded px-3 py-2 focus:border-cyan-500 focus:outline-none resize-none"
                placeholder="Enter shift notes, observations, issues, handover information..."
                value={shiftInfo.notes || ''}
                onChange={e => setShiftInfo(p => ({ ...p, notes: e.target.value }))}
              />
            </div>

            {/* Sign-off */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold text-slate-300 mb-4">✅ Shift Sign-off</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-400">Outgoing Operator</label>
                  <input type="text" value={shiftInfo.operator} readOnly className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Incoming Operator</label>
                  <input type="text" placeholder="Name" className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1 focus:border-cyan-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Handover Time</label>
                  <input type="time" defaultValue={new Date().toTimeString().slice(0, 5)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1 focus:border-cyan-500 focus:outline-none" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/*                    CAPITAL MODEL TAB                           */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'capital' && (() => {
          // Calculate capital breakdown
          const capBreakdown = {
            equipment: capitalModel.totalInvestment * (capitalModel.breakdown.equipment / 100),
            installation: capitalModel.totalInvestment * (capitalModel.breakdown.installation / 100),
            engineering: capitalModel.totalInvestment * (capitalModel.breakdown.engineering / 100),
            instrumentation: capitalModel.totalInvestment * (capitalModel.breakdown.instrumentation / 100),
            contingency: capitalModel.totalInvestment * (capitalModel.breakdown.contingency / 100),
          };

          // Annual production from mass balance (use current efficiency or design)
          const avgOilEff = smoothedProc.oilEff > 0 ? smoothedProc.oilEff : 95;
          const avgSolidsEff = smoothedProc.solidsEff > 0 ? smoothedProc.solidsEff : 95;
          const annualFeed = capitalModel.annualFeedVolume;
          const annualOilRecovered = annualFeed * (capitalModel.feedOilContent / 100) * (avgOilEff / 100);
          const annualSolids = annualFeed * (capitalModel.feedSolidsContent / 100) * (avgSolidsEff / 100);
          const annualWater = annualFeed - annualOilRecovered - annualSolids;

          // Annual revenue (oil value minus transport to Kalgoorlie)
          const annualOilGrossRevenue = annualOilRecovered * costs.oilValue;
          const annualOilTransportCost = annualOilRecovered * costs.oilTransport; // $0.22/L = $220/m³
          const annualOilNetRevenue = annualOilGrossRevenue - annualOilTransportCost;
          const totalAnnualRevenue = annualOilNetRevenue;

          // Annual operating costs
          const avgPowerKW = 56 * 0.7; // 70% of installed power
          const annualEnergyCost = avgPowerKW * capitalModel.operatingHours * costs.elec;
          const annualSludgeCost = annualSolids * costs.sludgeDisposal;
          const annualWaterCost = annualWater * costs.waterTreatment;
          const annualPondCost = annualWater * costs.pondDisposal; // $3.5/1000L = $3.5/m³
          const annualLaborCost = capitalModel.operatingHours * costs.laborRate * 0.5; // 0.5 FTE
          const annualChemicalCost = annualFeed * 2.5; // ~$2.50/m³ for chemicals
          const annualInsurance = capitalModel.totalInvestment * (capitalModel.insurancePct / 100);
          const subtotalOpex = annualEnergyCost + annualSludgeCost + annualWaterCost + annualPondCost + annualLaborCost +
                               annualChemicalCost + capitalModel.maintenanceCost + annualInsurance;
          const annualOverhead = subtotalOpex * (capitalModel.overheadPct / 100);
          const totalAnnualOpex = subtotalOpex + annualOverhead;

          // Optional items
          const optionalCosts =
            (capitalModel.extendedWarrantyY2 ? 12500 : 0) +
            (capitalModel.extendedWarrantyY3 ? 15000 : 0) +
            (capitalModel.remoteMonitoring ? 8500 : 0) +
            (capitalModel.additionalTraining * 2200);

          // Net annual benefit
          const netAnnualBenefit = totalAnnualRevenue - totalAnnualOpex;

          // Simple payback period
          const simplePayback = capitalModel.totalInvestment / Math.max(netAnnualBenefit, 1);

          // ROI
          const roi = (netAnnualBenefit / capitalModel.totalInvestment) * 100;

          // NPV calculation (over project life)
          const discountRate = capitalModel.discountRate / 100;
          let npv = -capitalModel.totalInvestment;
          const cashFlows = [-capitalModel.totalInvestment];
          for (let year = 1; year <= capitalModel.projectLife; year++) {
            const escalatedRevenue = totalAnnualRevenue * Math.pow(1 + (capitalModel.inflationRate + capitalModel.oilPriceEscalation) / 100, year - 1);
            const escalatedOpex = totalAnnualOpex * Math.pow(1 + capitalModel.inflationRate / 100, year - 1);
            const yearCashFlow = escalatedRevenue - escalatedOpex;
            cashFlows.push(yearCashFlow);
            npv += yearCashFlow / Math.pow(1 + discountRate, year);
          }

          // IRR calculation (Newton-Raphson approximation)
          const calculateIRR = (flows: number[], guess = 0.1): number => {
            let rate = guess;
            for (let i = 0; i < 100; i++) {
              let npvCalc = 0;
              let derivCalc = 0;
              for (let t = 0; t < flows.length; t++) {
                npvCalc += flows[t] / Math.pow(1 + rate, t);
                derivCalc -= t * flows[t] / Math.pow(1 + rate, t + 1);
              }
              const newRate = rate - npvCalc / derivCalc;
              if (Math.abs(newRate - rate) < 0.0001) return newRate * 100;
              rate = newRate;
            }
            return rate * 100;
          };
          const irr = netAnnualBenefit > 0 ? calculateIRR(cashFlows) : 0;

          // Profitability Index
          const profitabilityIndex = (npv + capitalModel.totalInvestment) / capitalModel.totalInvestment;

          // Print function for capital model
          const printCapitalModel = () => {
            const printContent = `
              <html>
              <head>
                <title>Capital Investment Model - Karratha WTP</title>
                <style>
                  body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                  h1 { color: #0d9488; border-bottom: 2px solid #0d9488; padding-bottom: 10px; }
                  h2 { color: #1e40af; margin-top: 30px; }
                  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                  th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                  th { background: #f3f4f6; }
                  .positive { color: #16a34a; font-weight: bold; }
                  .negative { color: #dc2626; }
                  .highlight { background: #fef3c7; }
                  .metric-box { display: inline-block; padding: 15px; margin: 10px; border: 2px solid #ddd; border-radius: 8px; text-align: center; min-width: 150px; }
                  .metric-value { font-size: 24px; font-weight: bold; }
                  .metric-label { font-size: 12px; color: #666; }
                  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
                </style>
              </head>
              <body>
                <h1>💰 Capital Investment Model</h1>
                <p><strong>Equipment:</strong> SACOR Delta-Canter 20-843A Three-Phase Tricanter</p>
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>

                <h2>📊 Investment Summary</h2>
                <div class="metric-box" style="border-color: #16a34a;">
                  <div class="metric-value positive">${formatCurrency(capitalModel.totalInvestment, 2)}</div>
                  <div class="metric-label">Total Investment</div>
                </div>
                <div class="metric-box">
                  <div class="metric-value">${simplePayback.toFixed(1)} yrs</div>
                  <div class="metric-label">Payback Period</div>
                </div>
                <div class="metric-box">
                  <div class="metric-value">${roi.toFixed(1)}%</div>
                  <div class="metric-label">Annual ROI</div>
                </div>
                <div class="metric-box">
                  <div class="metric-value positive">${formatCurrency(npv, 2)}</div>
                  <div class="metric-label">NPV (${capitalModel.projectLife}yr)</div>
                </div>
                <div class="metric-box">
                  <div class="metric-value">${irr.toFixed(1)}%</div>
                  <div class="metric-label">IRR</div>
                </div>

                <h2>🏗️ Capital Breakdown</h2>
                <table>
                  <tr><th>Item</th><th>%</th><th>Amount</th></tr>
                  <tr><td>Equipment (centrifuge, motors)</td><td>${capitalModel.breakdown.equipment}%</td><td>${formatCurrency(capBreakdown.equipment, 0)}</td></tr>
                  <tr><td>Installation</td><td>${capitalModel.breakdown.installation}%</td><td>${formatCurrency(capBreakdown.installation, 0)}</td></tr>
                  <tr><td>Engineering & Commissioning</td><td>${capitalModel.breakdown.engineering}%</td><td>${formatCurrency(capBreakdown.engineering, 0)}</td></tr>
                  <tr><td>Instrumentation & Controls</td><td>${capitalModel.breakdown.instrumentation}%</td><td>${formatCurrency(capBreakdown.instrumentation, 0)}</td></tr>
                  <tr><td>Contingency</td><td>${capitalModel.breakdown.contingency}%</td><td>${formatCurrency(capBreakdown.contingency, 0)}</td></tr>
                  <tr class="highlight"><td><strong>Total</strong></td><td><strong>100%</strong></td><td><strong>${formatCurrency(capitalModel.totalInvestment, 2)}</strong></td></tr>
                </table>

                <h2>📈 Annual Revenue (Mass Balance)</h2>
                <p style="color: #94a3b8; font-size: 12px; margin-bottom: 8px;">Feedstock: <strong>${feedstockTypes[selectedFeedstock].name}</strong> | Destination: <strong>${transportDestinations[selectedDestination].name}</strong></p>
                <table>
                  <tr><th>Item</th><th>Volume</th><th>Amount</th></tr>
                  <tr><td>${feedstockTypes[selectedFeedstock].name} Oil Value</td><td>${annualOilRecovered.toFixed(0)} m³ @ $${costs.oilValue}/m³</td><td class="positive">+${formatCurrency(annualOilGrossRevenue, 2)}</td></tr>
                  <tr><td>Transport → ${transportDestinations[selectedDestination].name}</td><td>${Math.round(annualOilRecovered).toLocaleString()} kL @ $${(costs.oilTransport / 1000).toFixed(2)}/L</td><td class="negative">-${formatCurrency(annualOilTransportCost, 2)}</td></tr>
                  <tr class="highlight"><td><strong>Net Oil Revenue</strong></td><td></td><td class="positive"><strong>+${formatCurrency(annualOilNetRevenue, 2)}</strong></td></tr>
                </table>

                <h2>📉 Annual Operating Costs</h2>
                <table>
                  <tr><th>Item</th><th>Details</th><th>Amount</th></tr>
                  <tr><td>Electricity</td><td>${(avgPowerKW * capitalModel.operatingHours / 1000).toFixed(0)} MWh @ $${costs.elec}/kWh</td><td class="negative">-${formatCurrency(annualEnergyCost, 0)}</td></tr>
                  <tr><td>Sludge Disposal</td><td>${annualSolids.toFixed(0)} m³ @ $${costs.sludgeDisposal}/m³</td><td class="negative">-${formatCurrency(annualSludgeCost, 0)}</td></tr>
                  <tr><td>Water Treatment</td><td>${annualWater.toFixed(0)} m³ @ $${costs.waterTreatment}/m³</td><td class="negative">-${formatCurrency(annualWaterCost, 0)}</td></tr>
                  <tr><td>Pond Disposal</td><td>${annualWater.toFixed(0)} m³ @ $${costs.pondDisposal}/m³</td><td class="negative">-${formatCurrency(annualPondCost, 0)}</td></tr>
                  <tr><td>Labor</td><td>0.5 FTE @ $${costs.laborRate}/h</td><td class="negative">-${formatCurrency(annualLaborCost, 0)}</td></tr>
                  <tr><td>Chemicals</td><td>${annualFeed.toFixed(0)} m³ @ $2.50/m³</td><td class="negative">-${formatCurrency(annualChemicalCost, 0)}</td></tr>
                  <tr><td>Maintenance Contract</td><td>Annual</td><td class="negative">-${formatCurrency(capitalModel.maintenanceCost, 0)}</td></tr>
                  <tr><td>Insurance</td><td>${capitalModel.insurancePct}% of capital</td><td class="negative">-${formatCurrency(annualInsurance, 0)}</td></tr>
                  <tr><td>Overhead</td><td>${capitalModel.overheadPct}% of OPEX</td><td class="negative">-${formatCurrency(annualOverhead, 0)}</td></tr>
                  <tr class="highlight"><td><strong>Total Annual OPEX</strong></td><td></td><td class="negative"><strong>-${formatCurrency(totalAnnualOpex, 2)}</strong></td></tr>
                </table>

                <h2>💵 Net Annual Benefit</h2>
                <div class="metric-box" style="border-color: ${netAnnualBenefit > 0 ? '#16a34a' : '#dc2626'}; width: 100%; text-align: center;">
                  <div class="metric-value ${netAnnualBenefit > 0 ? 'positive' : 'negative'}">${formatCurrency(netAnnualBenefit, 2)}</div>
                  <div class="metric-label">${(netAnnualBenefit / annualFeed).toFixed(2)} per m³ processed</div>
                </div>

                <h2>⚙️ Model Assumptions</h2>
                <table>
                  <tr><td>Operating Hours/Year</td><td>${capitalModel.operatingHours.toLocaleString()} hrs</td></tr>
                  <tr><td>Annual Feed Volume</td><td>${capitalModel.annualFeedVolume.toLocaleString()} m³</td></tr>
                  <tr><td>Feed Oil Content</td><td>${capitalModel.feedOilContent}%</td></tr>
                  <tr><td>Feed Solids Content</td><td>${capitalModel.feedSolidsContent}%</td></tr>
                  <tr><td>Oil Recovery Efficiency</td><td>${avgOilEff.toFixed(1)}%</td></tr>
                  <tr><td>Discount Rate (WACC)</td><td>${capitalModel.discountRate}%</td></tr>
                  <tr><td>Project Life</td><td>${capitalModel.projectLife} years</td></tr>
                  <tr><td>Inflation Rate</td><td>${capitalModel.inflationRate}%</td></tr>
                </table>

                <div class="footer">
                  <p><strong>Karratha Water Treatment Plant Simulator v15</strong></p>
                  <p>Equipment: SACOR Delta-Canter 20-843A | Reference: SAC-PRO-A26-003</p>
                  <p>This document is for planning purposes only. Actual results may vary.</p>
                </div>
              </body>
              </html>
            `;
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.write(printContent);
              printWindow.document.close();
              printWindow.print();
            }
          };

          // ═══════════════════════════════════════════════════════════════
          // PHASE COST & THREE-FRACTION QUALITY REPORT GENERATOR
          // ═══════════════════════════════════════════════════════════════
          const printPhaseReport = () => {
            // Helper functions for statistics
            const avg = (stats: { sum: number; count: number }) => stats.count > 0 ? stats.sum / stats.count : 0;
            const range = (stats: { min: number; max: number }) => `${stats.min.toFixed(1)} - ${stats.max.toFixed(1)}`;

            // Calculate overall totals and weighted averages
            const overallTotals = phaseData.reduce((acc, p) => ({
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

            const totalCosts = overallTotals.costs.energy + overallTotals.costs.chemicals +
              overallTotals.costs.disposal + overallTotals.costs.water +
              overallTotals.costs.labor + overallTotals.costs.filter;

            // Weighted average quality metrics
            const weightedQuality = phaseData.reduce((acc, p) => {
              const weight = p.totals.feed;
              return {
                oilEff: acc.oilEff + avg(p.quality.oilEfficiency) * weight,
                solidsEff: acc.solidsEff + avg(p.quality.solidsEfficiency) * weight,
                wq: acc.wq + avg(p.quality.waterQuality) * weight,
                totalWeight: acc.totalWeight + weight,
              };
            }, { oilEff: 0, solidsEff: 0, wq: 0, totalWeight: 0 });

            const avgOilEffOverall = weightedQuality.totalWeight > 0 ? weightedQuality.oilEff / weightedQuality.totalWeight : 0;
            const avgSolidsEffOverall = weightedQuality.totalWeight > 0 ? weightedQuality.solidsEff / weightedQuality.totalWeight : 0;
            const avgWQOverall = weightedQuality.totalWeight > 0 ? weightedQuality.wq / weightedQuality.totalWeight : 0;

            // Overall mass balance
            const overallMassBalance = overallTotals.feed > 0
              ? ((overallTotals.water + overallTotals.oil + overallTotals.solids) / overallTotals.feed) * 100
              : 100;

            // Generate phase rows for the table
            const phaseRows = phaseData.map((p, i) => `
              <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
                <td class="py-2 px-3 font-medium">${p.phaseName}</td>
                <td class="py-2 px-3 text-right">${formatTime(p.startTime)} - ${formatTime(p.endTime || p.startTime)}</td>
                <td class="py-2 px-3 text-right">${formatTime(p.totals.duration)}</td>
                <td class="py-2 px-3 text-right">${p.totals.feed.toFixed(3)} m³</td>
                <td class="py-2 px-3 text-right">${(p.totals.water * 1000).toFixed(0)} L</td>
                <td class="py-2 px-3 text-right">${(p.totals.oil * 1000).toFixed(1)} L</td>
                <td class="py-2 px-3 text-right">${(p.totals.solids * 1000).toFixed(1)} L</td>
              </tr>
            `).join('');

            // Generate phase cost breakdown rows
            const phaseCostRows = phaseData.map((p, i) => `
              <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
                <td class="py-2 px-3 font-medium">${p.phaseName}</td>
                <td class="py-2 px-3 text-right">$${p.costs.energy.toFixed(2)}</td>
                <td class="py-2 px-3 text-right">$${p.costs.chemicals.toFixed(2)}</td>
                <td class="py-2 px-3 text-right">$${p.costs.disposal.toFixed(2)}</td>
                <td class="py-2 px-3 text-right">$${p.costs.water.toFixed(2)}</td>
                <td class="py-2 px-3 text-right">$${p.costs.labor.toFixed(2)}</td>
                <td class="py-2 px-3 text-right font-bold">$${(p.costs.energy + p.costs.chemicals + p.costs.disposal + p.costs.water + p.costs.labor + p.costs.filter).toFixed(2)}</td>
              </tr>
            `).join('');

            // Generate three-fraction quality rows
            const fractionQualityRows = phaseData.map((p, i) => `
              <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
                <td class="py-2 px-3 font-medium" rowspan="3">${p.phaseName}</td>
                <td class="py-2 px-3 text-blue-600 font-medium">Water</td>
                <td class="py-2 px-3 text-right">${(p.totals.water * 1000).toFixed(0)} L</td>
                <td class="py-2 px-3 text-right">${p.totals.feed > 0 ? ((p.totals.water / p.totals.feed) * 100).toFixed(1) : 0}%</td>
                <td class="py-2 px-3 text-right">${avg(p.fractions.water.oilContent).toFixed(0)} ppm OiW</td>
                <td class="py-2 px-3 text-right">${avg(p.fractions.water.tss).toFixed(0)} mg/L TSS</td>
                <td class="py-2 px-3 text-center">${avg(p.fractions.water.oilContent) < 500 ? '✅' : '⚠️'}</td>
              </tr>
              <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
                <td class="py-2 px-3 text-amber-600 font-medium">Oil</td>
                <td class="py-2 px-3 text-right">${(p.totals.oil * 1000).toFixed(1)} L</td>
                <td class="py-2 px-3 text-right">${p.totals.feed > 0 ? ((p.totals.oil / p.totals.feed) * 100).toFixed(2) : 0}%</td>
                <td class="py-2 px-3 text-right">${avg(p.fractions.oil.waterContent).toFixed(1)}% H₂O</td>
                <td class="py-2 px-3 text-right">${avg(p.fractions.oil.recovery).toFixed(1)}% recovery</td>
                <td class="py-2 px-3 text-center">${avg(p.fractions.oil.recovery) >= 95 ? '✅' : '⚠️'}</td>
              </tr>
              <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''} border-b-2 border-gray-300">
                <td class="py-2 px-3 text-orange-600 font-medium">Solids</td>
                <td class="py-2 px-3 text-right">${(p.totals.solids * 1000).toFixed(1)} L</td>
                <td class="py-2 px-3 text-right">${p.totals.feed > 0 ? ((p.totals.solids / p.totals.feed) * 100).toFixed(2) : 0}%</td>
                <td class="py-2 px-3 text-right">${avg(p.fractions.solids.moisture).toFixed(1)}% moisture</td>
                <td class="py-2 px-3 text-right">${avg(p.fractions.solids.recovery).toFixed(1)}% recovery</td>
                <td class="py-2 px-3 text-center">${avg(p.fractions.solids.moisture) <= 20 ? '✅' : '⚠️'}</td>
              </tr>
            `).join('');

            // Generate mass balance validation rows
            const massBalanceRows = phaseData.map((p, i) => `
              <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
                <td class="py-2 px-3 font-medium">${p.phaseName}</td>
                <td class="py-2 px-3 text-right">${p.massBalance.totalIn.toFixed(4)} m³</td>
                <td class="py-2 px-3 text-right">${p.massBalance.totalOut.toFixed(4)} m³</td>
                <td class="py-2 px-3 text-right font-bold ${Math.abs(avg(p.massBalance.closurePct) - 100) < 2 ? 'text-green-600' : 'text-red-600'}">${avg(p.massBalance.closurePct).toFixed(1)}%</td>
                <td class="py-2 px-3 text-center">${Math.abs(avg(p.massBalance.closurePct) - 100) < 2 ? '✅ Valid' : '⚠️ Check'}</td>
                <td class="py-2 px-3 text-right text-gray-500">${p.dataQuality.samplesCollected}</td>
              </tr>
            `).join('');

            // Generate data quality summary
            const anomalySummary = phaseData.flatMap(p =>
              p.dataQuality.anomalies.map(a => `<li>${p.phaseName}: ${a}</li>`)
            ).slice(0, 15).join('');

            const printContent = `
              <html>
              <head>
                <title>Phase Cost & Three-Fraction Quality Report - Karratha WTP</title>
                <style>
                  body { font-family: Arial, sans-serif; padding: 30px; color: #333; font-size: 11px; }
                  h1 { color: #0d9488; border-bottom: 2px solid #0d9488; padding-bottom: 10px; font-size: 20px; }
                  h2 { color: #1e40af; margin-top: 25px; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
                  h3 { color: #374151; margin-top: 15px; font-size: 12px; }
                  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
                  th { background: #1e40af; color: white; padding: 8px 6px; text-align: left; font-weight: 600; }
                  td { border: 1px solid #e5e7eb; padding: 6px; }
                  .bg-gray-50 { background: #f9fafb; }
                  .positive { color: #16a34a; font-weight: bold; }
                  .negative { color: #dc2626; }
                  .highlight { background: #fef3c7; }
                  .metric-box { display: inline-block; padding: 12px; margin: 5px; border: 2px solid #ddd; border-radius: 8px; text-align: center; min-width: 120px; }
                  .metric-value { font-size: 18px; font-weight: bold; }
                  .metric-label { font-size: 9px; color: #666; margin-top: 3px; }
                  .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 9px; color: #666; }
                  .section { margin-bottom: 20px; }
                  .assumption-box { background: #f3f4f6; padding: 10px; border-radius: 6px; margin: 10px 0; }
                  .text-right { text-align: right; }
                  .text-center { text-align: center; }
                  .text-blue-600 { color: #2563eb; }
                  .text-amber-600 { color: #d97706; }
                  .text-orange-600 { color: #ea580c; }
                  .text-green-600 { color: #16a34a; }
                  .text-red-600 { color: #dc2626; }
                  .text-gray-500 { color: #6b7280; }
                  .border-b-2 { border-bottom: 2px solid #d1d5db; }
                  .font-bold { font-weight: bold; }
                  .font-medium { font-weight: 500; }
                  @media print { body { padding: 15px; } }
                </style>
              </head>
              <body>
                <h1>📊 Simulation Phase Cost & Three-Fraction Quality Report</h1>
                <p><strong>Equipment:</strong> SACOR Delta-Canter 20-843A Three-Phase Tricanter</p>
                <p><strong>Feedstock:</strong> ${feedstockTypes[selectedFeedstock].name} | <strong>Destination:</strong> ${transportDestinations[selectedDestination].name}</p>
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>

                <!-- Executive Summary -->
                <div class="section">
                  <h2>📋 Executive Summary</h2>
                  <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    <div class="metric-box">
                      <div class="metric-value">${phaseData.length}</div>
                      <div class="metric-label">Phases Completed</div>
                    </div>
                    <div class="metric-box">
                      <div class="metric-value">${formatTime(overallTotals.duration)}</div>
                      <div class="metric-label">Total Run Time</div>
                    </div>
                    <div class="metric-box">
                      <div class="metric-value">${overallTotals.feed.toFixed(2)} m³</div>
                      <div class="metric-label">Feed Processed</div>
                    </div>
                    <div class="metric-box" style="border-color: #16a34a;">
                      <div class="metric-value positive">${(overallTotals.oil * 1000).toFixed(1)} L</div>
                      <div class="metric-label">Oil Recovered</div>
                    </div>
                    <div class="metric-box">
                      <div class="metric-value">${avgOilEffOverall.toFixed(1)}%</div>
                      <div class="metric-label">Avg Oil Recovery</div>
                    </div>
                    <div class="metric-box" style="border-color: ${Math.abs(overallMassBalance - 100) < 2 ? '#16a34a' : '#dc2626'};">
                      <div class="metric-value ${Math.abs(overallMassBalance - 100) < 2 ? 'positive' : 'negative'}">${overallMassBalance.toFixed(1)}%</div>
                      <div class="metric-label">Mass Balance Closure</div>
                    </div>
                    <div class="metric-box" style="border-color: #dc2626;">
                      <div class="metric-value negative">$${totalCosts.toFixed(2)}</div>
                      <div class="metric-label">Total Operating Cost</div>
                    </div>
                  </div>
                </div>

                <!-- Phase Volume Summary -->
                <div class="section">
                  <h2>📦 Phase Volume Summary</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Phase</th>
                        <th class="text-right">Time Window</th>
                        <th class="text-right">Duration</th>
                        <th class="text-right">Feed In</th>
                        <th class="text-right">Water Out</th>
                        <th class="text-right">Oil Out</th>
                        <th class="text-right">Solids Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${phaseRows}
                      <tr class="highlight font-bold">
                        <td class="py-2 px-3">TOTAL</td>
                        <td class="py-2 px-3 text-right">-</td>
                        <td class="py-2 px-3 text-right">${formatTime(overallTotals.duration)}</td>
                        <td class="py-2 px-3 text-right">${overallTotals.feed.toFixed(3)} m³</td>
                        <td class="py-2 px-3 text-right">${(overallTotals.water * 1000).toFixed(0)} L</td>
                        <td class="py-2 px-3 text-right">${(overallTotals.oil * 1000).toFixed(1)} L</td>
                        <td class="py-2 px-3 text-right">${(overallTotals.solids * 1000).toFixed(1)} L</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Phase Cost Breakdown -->
                <div class="section">
                  <h2>💰 Phase Cost Breakdown</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Phase</th>
                        <th class="text-right">Energy</th>
                        <th class="text-right">Chemicals</th>
                        <th class="text-right">Disposal</th>
                        <th class="text-right">Water Treat</th>
                        <th class="text-right">Labor</th>
                        <th class="text-right">Phase Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${phaseCostRows}
                      <tr class="highlight font-bold">
                        <td class="py-2 px-3">TOTAL</td>
                        <td class="py-2 px-3 text-right">$${overallTotals.costs.energy.toFixed(2)}</td>
                        <td class="py-2 px-3 text-right">$${overallTotals.costs.chemicals.toFixed(2)}</td>
                        <td class="py-2 px-3 text-right">$${overallTotals.costs.disposal.toFixed(2)}</td>
                        <td class="py-2 px-3 text-right">$${overallTotals.costs.water.toFixed(2)}</td>
                        <td class="py-2 px-3 text-right">$${overallTotals.costs.labor.toFixed(2)}</td>
                        <td class="py-2 px-3 text-right font-bold">$${totalCosts.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div class="assumption-box">
                    <strong>Cost Rates:</strong> Electricity $${costs.elec}/kWh | Sludge Disposal $${costs.sludgeDisposal}/m³ | Water Treatment $${costs.waterTreatment}/m³ | Labor $${costs.laborRate}/hr
                  </div>
                </div>

                <!-- Three-Fraction Quality Report -->
                <div class="section">
                  <h2>🔬 Three-Fraction Quality Report</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Phase</th>
                        <th>Fraction</th>
                        <th class="text-right">Volume</th>
                        <th class="text-right">Yield %</th>
                        <th class="text-right">Primary Metric</th>
                        <th class="text-right">Secondary Metric</th>
                        <th class="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${fractionQualityRows}
                    </tbody>
                  </table>
                  <div class="assumption-box">
                    <strong>Quality Targets (SACOR Guarantees):</strong><br/>
                    • Water: ≤500 ppm OiW (TPH) for discharge compliance<br/>
                    • Oil: ≥95% recovery efficiency, ≤5% water content<br/>
                    • Solids: ≤20% residual moisture in CF cake
                  </div>
                </div>

                <!-- Mass Balance Validation -->
                <div class="section">
                  <h2>⚖️ Mass Balance Validation</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Phase</th>
                        <th class="text-right">Mass In</th>
                        <th class="text-right">Mass Out</th>
                        <th class="text-right">Closure %</th>
                        <th class="text-center">Validation</th>
                        <th class="text-right">Samples</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${massBalanceRows}
                      <tr class="highlight font-bold">
                        <td class="py-2 px-3">OVERALL</td>
                        <td class="py-2 px-3 text-right">${overallTotals.feed.toFixed(4)} m³</td>
                        <td class="py-2 px-3 text-right">${(overallTotals.water + overallTotals.oil + overallTotals.solids).toFixed(4)} m³</td>
                        <td class="py-2 px-3 text-right font-bold ${Math.abs(overallMassBalance - 100) < 2 ? 'text-green-600' : 'text-red-600'}">${overallMassBalance.toFixed(1)}%</td>
                        <td class="py-2 px-3 text-center">${Math.abs(overallMassBalance - 100) < 2 ? '✅ Valid' : '⚠️ Review'}</td>
                        <td class="py-2 px-3 text-right">-</td>
                      </tr>
                    </tbody>
                  </table>
                  <div class="assumption-box">
                    <strong>Mass Balance Methodology:</strong> Unforced closure calculation (no artificial adjustment). Acceptable range: 98-102% closure.
                    Deviation indicates potential metering errors, accumulation, or leakage.
                  </div>
                </div>

                <!-- Data Quality & Exceptions -->
                <div class="section">
                  <h2>🚨 Data Quality & Exceptions</h2>
                  ${anomalySummary ? `
                    <h3>Anomalies Detected:</h3>
                    <ul style="margin-left: 20px; color: #dc2626;">
                      ${anomalySummary}
                    </ul>
                  ` : '<p style="color: #16a34a;">✅ No significant anomalies detected during this batch run.</p>'}
                  <div class="assumption-box">
                    <strong>Data Sources:</strong><br/>
                    • Flow rates: Simulated Coriolis mass flow meters (±0.1% accuracy assumed)<br/>
                    • Quality metrics: Online analyzers with periodic grab sample validation<br/>
                    • Energy: Integrated power metering on main and back-drive motors<br/>
                    • Chemical dosing: Pump stroke counters with density correction
                  </div>
                </div>

                <!-- Overall Weighted Averages -->
                <div class="section">
                  <h2>📈 Overall Performance (Volume-Weighted Averages)</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th class="text-right">Weighted Average</th>
                        <th class="text-right">Target</th>
                        <th class="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td class="py-2 px-3">Oil Recovery Efficiency</td>
                        <td class="py-2 px-3 text-right font-bold">${avgOilEffOverall.toFixed(1)}%</td>
                        <td class="py-2 px-3 text-right">≥95%</td>
                        <td class="py-2 px-3 text-center">${avgOilEffOverall >= 95 ? '✅' : '⚠️'}</td>
                      </tr>
                      <tr class="bg-gray-50">
                        <td class="py-2 px-3">Solids Removal Efficiency</td>
                        <td class="py-2 px-3 text-right font-bold">${avgSolidsEffOverall.toFixed(1)}%</td>
                        <td class="py-2 px-3 text-right">≥95%</td>
                        <td class="py-2 px-3 text-center">${avgSolidsEffOverall >= 95 ? '✅' : '⚠️'}</td>
                      </tr>
                      <tr>
                        <td class="py-2 px-3">Water Quality (OiW)</td>
                        <td class="py-2 px-3 text-right font-bold">${avgWQOverall.toFixed(0)} ppm</td>
                        <td class="py-2 px-3 text-right">≤500 ppm</td>
                        <td class="py-2 px-3 text-center">${avgWQOverall <= 500 ? '✅' : '⚠️'}</td>
                      </tr>
                      <tr class="bg-gray-50">
                        <td class="py-2 px-3">Specific Energy</td>
                        <td class="py-2 px-3 text-right font-bold">${overallTotals.feed > 0 ? (overallTotals.energy / overallTotals.feed).toFixed(2) : 0} kWh/m³</td>
                        <td class="py-2 px-3 text-right">≤5 kWh/m³</td>
                        <td class="py-2 px-3 text-center">${overallTotals.feed > 0 && (overallTotals.energy / overallTotals.feed) <= 5 ? '✅' : '⚠️'}</td>
                      </tr>
                      <tr>
                        <td class="py-2 px-3">Operating Cost per m³</td>
                        <td class="py-2 px-3 text-right font-bold">$${overallTotals.feed > 0 ? (totalCosts / overallTotals.feed).toFixed(2) : 0}</td>
                        <td class="py-2 px-3 text-right">-</td>
                        <td class="py-2 px-3 text-center">📊</td>
                      </tr>
                      <tr class="highlight">
                        <td class="py-2 px-3 font-bold">Mass Balance Closure</td>
                        <td class="py-2 px-3 text-right font-bold">${overallMassBalance.toFixed(1)}%</td>
                        <td class="py-2 px-3 text-right">98-102%</td>
                        <td class="py-2 px-3 text-center">${Math.abs(overallMassBalance - 100) < 2 ? '✅' : '⚠️'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div class="footer">
                  <p><strong>Karratha Water Treatment Plant Simulator v15</strong></p>
                  <p>Equipment: SACOR Delta-Canter 20-843A Three-Phase Tricanter | Reference: SAC-PRO-A26-003</p>
                  <p>This report is generated from simulation data. Mass balance uses unforced closure methodology.</p>
                  <p>Report generated: ${new Date().toISOString()}</p>
                </div>
              </body>
              </html>
            `;

            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.write(printContent);
              printWindow.document.close();
              printWindow.print();
            }
          };

          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">💰 Capital Investment Model</h2>
                <div className="flex gap-2">
                  <button
                    onClick={printPhaseReport}
                    disabled={phaseData.length === 0}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors print:hidden ${
                      phaseData.length > 0
                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                    title={phaseData.length === 0 ? 'Run a batch to generate phase data' : `${phaseData.length} phases recorded`}
                  >
                    📊 Phase Report {phaseData.length > 0 && `(${phaseData.length})`}
                  </button>
                  <button
                    onClick={printCapitalModel}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 transition-colors print:hidden"
                  >
                    🖨️ Print Capital Report
                  </button>
                </div>
              </div>

              {/* Investment Slider */}
              <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 rounded-xl p-6 border border-green-700/50">
                <h3 className="text-lg font-semibold text-green-400 mb-4">📊 Total Capital Investment (AUD)</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400 text-sm w-16">$0</span>
                    <input
                      type="range"
                      min={0}
                      max={10000000}
                      step={10000}
                      value={capitalModel.totalInvestment}
                      onChange={e => setCapitalModel(p => ({ ...p, totalInvestment: Number(e.target.value) }))}
                      className="flex-1 h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                    <span className="text-slate-400 text-sm w-24">$10,000,000</span>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-green-400">
                      {formatCurrency(capitalModel.totalInvestment, 2)}
                    </div>
                    <div className="text-sm text-slate-400 mt-1">
                      SACOR Base Price: $587.75K | With Options: {formatCurrency(587750 + optionalCosts, 2)}
                    </div>
                  </div>
                  {/* Quick select buttons */}
                  <div className="flex flex-wrap gap-2 justify-center">
                    {[587750, 750000, 1000000, 1500000, 2000000, 3000000, 5000000].map(v => (
                      <button
                        key={v}
                        onClick={() => setCapitalModel(p => ({ ...p, totalInvestment: v }))}
                        className={`px-3 py-1 rounded text-sm ${capitalModel.totalInvestment === v ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                      >
                        ${(v / 1000000).toFixed(v < 1000000 ? 2 : 1)}M
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Key Financial Metrics */}
              <div className="grid md:grid-cols-5 gap-4">
                <div className={`bg-slate-800 rounded-lg p-4 border ${simplePayback < 3 ? 'border-green-500' : simplePayback < 5 ? 'border-yellow-500' : 'border-red-500'}`}>
                  <div className="text-sm text-slate-400">Simple Payback</div>
                  <div className={`text-2xl font-bold ${simplePayback < 3 ? 'text-green-400' : simplePayback < 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {simplePayback.toFixed(1)} years
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Target: &lt;3 years</div>
                </div>
                <div className={`bg-slate-800 rounded-lg p-4 border ${roi > 30 ? 'border-green-500' : roi > 15 ? 'border-yellow-500' : 'border-red-500'}`}>
                  <div className="text-sm text-slate-400">Annual ROI</div>
                  <div className={`text-2xl font-bold ${roi > 30 ? 'text-green-400' : roi > 15 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {roi.toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Target: &gt;25%</div>
                </div>
                <div className={`bg-slate-800 rounded-lg p-4 border ${npv > 0 ? 'border-green-500' : 'border-red-500'}`}>
                  <div className="text-sm text-slate-400">NPV ({capitalModel.projectLife}yr)</div>
                  <div className={`text-2xl font-bold ${npv > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(npv, 2)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">@ {capitalModel.discountRate}% discount</div>
                </div>
                <div className={`bg-slate-800 rounded-lg p-4 border ${irr > capitalModel.discountRate ? 'border-green-500' : 'border-red-500'}`}>
                  <div className="text-sm text-slate-400">IRR</div>
                  <div className={`text-2xl font-bold ${irr > capitalModel.discountRate ? 'text-green-400' : 'text-red-400'}`}>
                    {irr.toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Hurdle: {capitalModel.discountRate}%</div>
                </div>
                <div className={`bg-slate-800 rounded-lg p-4 border ${profitabilityIndex > 1.2 ? 'border-green-500' : profitabilityIndex > 1 ? 'border-yellow-500' : 'border-red-500'}`}>
                  <div className="text-sm text-slate-400">Profitability Index</div>
                  <div className={`text-2xl font-bold ${profitabilityIndex > 1.2 ? 'text-green-400' : profitabilityIndex > 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {profitabilityIndex.toFixed(2)}x
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Target: &gt;1.2x</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Capital Breakdown */}
                <div className="bg-slate-800 rounded-lg p-4 border border-blue-900/50">
                  <h3 className="text-lg font-semibold text-blue-400 mb-4">🏗️ Capital Breakdown</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">Equipment (centrifuge, motors)</td>
                        <td className="py-2 text-right">
                          <input type="number" value={capitalModel.breakdown.equipment} onChange={e => setCapitalModel(p => ({ ...p, breakdown: { ...p.breakdown, equipment: Number(e.target.value) } }))} className="w-12 bg-slate-700 rounded px-1 text-right" />%
                        </td>
                        <td className="py-2 text-right text-blue-400 font-mono">{formatCurrency(capBreakdown.equipment, 0)}</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">Installation (mechanical/electrical)</td>
                        <td className="py-2 text-right">
                          <input type="number" value={capitalModel.breakdown.installation} onChange={e => setCapitalModel(p => ({ ...p, breakdown: { ...p.breakdown, installation: Number(e.target.value) } }))} className="w-12 bg-slate-700 rounded px-1 text-right" />%
                        </td>
                        <td className="py-2 text-right text-blue-400 font-mono">{formatCurrency(capBreakdown.installation, 0)}</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">Engineering & commissioning</td>
                        <td className="py-2 text-right">
                          <input type="number" value={capitalModel.breakdown.engineering} onChange={e => setCapitalModel(p => ({ ...p, breakdown: { ...p.breakdown, engineering: Number(e.target.value) } }))} className="w-12 bg-slate-700 rounded px-1 text-right" />%
                        </td>
                        <td className="py-2 text-right text-blue-400 font-mono">{formatCurrency(capBreakdown.engineering, 0)}</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">Instrumentation & controls</td>
                        <td className="py-2 text-right">
                          <input type="number" value={capitalModel.breakdown.instrumentation} onChange={e => setCapitalModel(p => ({ ...p, breakdown: { ...p.breakdown, instrumentation: Number(e.target.value) } }))} className="w-12 bg-slate-700 rounded px-1 text-right" />%
                        </td>
                        <td className="py-2 text-right text-blue-400 font-mono">{formatCurrency(capBreakdown.instrumentation, 0)}</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">Contingency</td>
                        <td className="py-2 text-right">
                          <input type="number" value={capitalModel.breakdown.contingency} onChange={e => setCapitalModel(p => ({ ...p, breakdown: { ...p.breakdown, contingency: Number(e.target.value) } }))} className="w-12 bg-slate-700 rounded px-1 text-right" />%
                        </td>
                        <td className="py-2 text-right text-blue-400 font-mono">{formatCurrency(capBreakdown.contingency, 0)}</td>
                      </tr>
                      <tr className="bg-blue-900/30">
                        <td className="py-2 font-bold">Total Capital</td>
                        <td className="py-2 text-right font-bold">{Object.values(capitalModel.breakdown).reduce((a, b) => a + b, 0)}%</td>
                        <td className="py-2 text-right text-blue-400 font-bold text-lg">{formatCurrency(capitalModel.totalInvestment, 2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Annual Operating Costs */}
                <div className="bg-slate-800 rounded-lg p-4 border border-red-900/50">
                  <h3 className="text-lg font-semibold text-red-400 mb-4">📉 Annual Operating Costs</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">Electricity ({(avgPowerKW * capitalModel.operatingHours / 1000).toFixed(0)} MWh)</td>
                        <td className="py-2 text-right text-red-400 font-mono">-{formatCurrency(annualEnergyCost, 0)}</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">Sludge disposal ({annualSolids.toFixed(0)} m³)</td>
                        <td className="py-2 text-right text-red-400 font-mono">-{formatCurrency(annualSludgeCost, 0)}</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">Water treatment ({annualWater.toFixed(0)} m³)</td>
                        <td className="py-2 text-right text-red-400 font-mono">-{formatCurrency(annualWaterCost, 0)}</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">Pond disposal ({annualWater.toFixed(0)} m³ @ $3.5/kL)</td>
                        <td className="py-2 text-right text-red-400 font-mono">-{formatCurrency(annualPondCost, 0)}</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">Labor (0.5 FTE @ ${costs.laborRate}/h)</td>
                        <td className="py-2 text-right text-red-400 font-mono">-{formatCurrency(annualLaborCost, 0)}</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">Chemicals (~$2.50/m³)</td>
                        <td className="py-2 text-right text-red-400 font-mono">-{formatCurrency(annualChemicalCost, 0)}</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">Maintenance contract</td>
                        <td className="py-2 text-right text-red-400 font-mono">-{formatCurrency(capitalModel.maintenanceCost, 0)}</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">Insurance ({capitalModel.insurancePct}%)</td>
                        <td className="py-2 text-right text-red-400 font-mono">-{formatCurrency(annualInsurance, 0)}</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">Overhead ({capitalModel.overheadPct}%)</td>
                        <td className="py-2 text-right text-red-400 font-mono">-{formatCurrency(annualOverhead, 0)}</td>
                      </tr>
                      <tr className="bg-red-900/30">
                        <td className="py-2 font-bold">Total Annual OPEX</td>
                        <td className="py-2 text-right text-red-400 font-bold text-lg">-{formatCurrency(totalAnnualOpex, 2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Annual Revenue (from Mass Balance) */}
                <div className="bg-slate-800 rounded-lg p-4 border border-green-900/50">
                  <h3 className="text-lg font-semibold text-green-400 mb-4">📈 Annual Revenue (Mass Balance)</h3>

                  {/* Feedstock Badge */}
                  <div className="mb-3 flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${feedstockTypes[selectedFeedstock].color} bg-slate-700`}>
                      🛢️ {feedstockTypes[selectedFeedstock].name}
                    </span>
                    <span className="px-2 py-1 rounded text-xs font-medium text-cyan-400 bg-slate-700">
                      🚛 → {transportDestinations[selectedDestination].name}
                    </span>
                  </div>

                  <div className="mb-4 p-3 bg-slate-700/50 rounded-lg">
                    <div className="text-xs text-slate-400 mb-2">Production Summary (Current Efficiency: {avgOilEff.toFixed(1)}%)</div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold text-blue-400">{annualFeed.toLocaleString()}</div>
                        <div className="text-xs text-slate-500">m³ Feed/yr</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-amber-400">{annualOilRecovered.toLocaleString()}</div>
                        <div className="text-xs text-slate-500">m³ Oil/yr</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-orange-400">{annualSolids.toLocaleString()}</div>
                        <div className="text-xs text-slate-500">m³ Sludge/yr</div>
                      </div>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-700">
                        <td className="py-2">
                          <span className={feedstockTypes[selectedFeedstock].color}>{feedstockTypes[selectedFeedstock].name}</span> oil ({annualOilRecovered.toFixed(0)} m³ @ ${costs.oilValue}/m³)
                        </td>
                        <td className="py-2 text-right text-green-400 font-mono">+{formatCurrency(annualOilGrossRevenue, 2)}</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-2 text-amber-400">
                          Transport → {transportDestinations[selectedDestination].name} ({annualOilRecovered.toLocaleString(undefined, {maximumFractionDigits: 0})} kL @ ${(costs.oilTransport / 1000).toFixed(2)}/L)
                        </td>
                        <td className="py-2 text-right text-amber-400 font-mono">-{formatCurrency(annualOilTransportCost, 2)}</td>
                      </tr>
                      <tr className="bg-green-900/30">
                        <td className="py-2 font-bold">Net Oil Revenue</td>
                        <td className="py-2 text-right text-green-400 font-bold text-lg">+{formatCurrency(annualOilNetRevenue, 2)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className={`mt-4 p-4 rounded-lg ${netAnnualBenefit > 0 ? 'bg-green-900/30 border border-green-600' : 'bg-red-900/30 border border-red-600'}`}>
                    <div className="flex justify-between items-center">
                      <div className="font-bold">Net Annual Benefit</div>
                      <div className={`text-2xl font-bold ${netAnnualBenefit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {netAnnualBenefit > 0 ? '+' : ''}{formatCurrency(netAnnualBenefit, 2)}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      ${(netAnnualBenefit / annualFeed).toFixed(2)} per m³ processed
                    </div>
                  </div>
                </div>

                {/* Operating Assumptions */}
                <div className="bg-slate-800 rounded-lg p-4 border border-purple-900/50">
                  <h3 className="text-lg font-semibold text-purple-400 mb-4">⚙️ Model Assumptions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400">Operating Hours/Year</label>
                      <input type="number" value={capitalModel.operatingHours} onChange={e => setCapitalModel(p => ({ ...p, operatingHours: Number(e.target.value) }))} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Annual Feed Volume (m³)</label>
                      <input type="number" value={capitalModel.annualFeedVolume} onChange={e => setCapitalModel(p => ({ ...p, annualFeedVolume: Number(e.target.value) }))} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Feed Oil Content (%)</label>
                      <input type="number" value={capitalModel.feedOilContent} onChange={e => setCapitalModel(p => ({ ...p, feedOilContent: Number(e.target.value) }))} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Feed Solids Content (%)</label>
                      <input type="number" value={capitalModel.feedSolidsContent} onChange={e => setCapitalModel(p => ({ ...p, feedSolidsContent: Number(e.target.value) }))} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Discount Rate (WACC %)</label>
                      <input type="number" step="0.5" value={capitalModel.discountRate} onChange={e => setCapitalModel(p => ({ ...p, discountRate: Number(e.target.value) }))} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Project Life (years)</label>
                      <input type="number" value={capitalModel.projectLife} onChange={e => setCapitalModel(p => ({ ...p, projectLife: Number(e.target.value) }))} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Inflation Rate (%)</label>
                      <input type="number" step="0.5" value={capitalModel.inflationRate} onChange={e => setCapitalModel(p => ({ ...p, inflationRate: Number(e.target.value) }))} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Maintenance $/year</label>
                      <input type="number" value={capitalModel.maintenanceCost} onChange={e => setCapitalModel(p => ({ ...p, maintenanceCost: Number(e.target.value) }))} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mt-1" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Cash Flow Projection */}
              <div className="bg-slate-800 rounded-lg p-4 border border-cyan-900/50">
                <h3 className="text-lg font-semibold text-cyan-400 mb-4">📊 {capitalModel.projectLife}-Year Cash Flow Projection</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashFlows.map((cf, i) => ({
                      year: i === 0 ? 'Y0' : `Y${i}`,
                      cashFlow: cf,
                      cumulative: cashFlows.slice(0, i + 1).reduce((a, b) => a + b, 0),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="year" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={v => formatCurrency(v, 1)} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                        formatter={(value: number) => [formatCurrency(value, 2), '']}
                      />
                      <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="cashFlow" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.3} name="Annual" />
                      <Area type="monotone" dataKey="cumulative" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Cumulative" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-4 text-center">
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400">Year 1 Cash Flow</div>
                    <div className="text-lg font-bold text-cyan-400">{formatCurrency(cashFlows[1] || 0, 2)}</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400">Year 5 Cumulative</div>
                    <div className="text-lg font-bold text-green-400">{formatCurrency(cashFlows.slice(0, 6).reduce((a, b) => a + b, 0), 2)}</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400">Year 10 Cumulative</div>
                    <div className="text-lg font-bold text-green-400">{formatCurrency(cashFlows.slice(0, 11).reduce((a, b) => a + b, 0), 2)}</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400">Total {capitalModel.projectLife}yr Return</div>
                    <div className="text-lg font-bold text-green-400">{formatCurrency(cashFlows.reduce((a, b) => a + b, 0), 2)}</div>
                  </div>
                </div>
              </div>

              {/* SACOR Optional Items */}
              <div className="bg-slate-800 rounded-lg p-4 border border-amber-900/50">
                <h3 className="text-lg font-semibold text-amber-400 mb-4">📋 SACOR Optional Items</h3>
                <div className="grid md:grid-cols-4 gap-4">
                  <label className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700">
                    <input type="checkbox" checked={capitalModel.extendedWarrantyY2} onChange={e => setCapitalModel(p => ({ ...p, extendedWarrantyY2: e.target.checked }))} className="w-5 h-5 accent-amber-500" />
                    <div>
                      <div className="font-medium">Extended Warranty Y2</div>
                      <div className="text-sm text-amber-400">+$12,500</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700">
                    <input type="checkbox" checked={capitalModel.extendedWarrantyY3} onChange={e => setCapitalModel(p => ({ ...p, extendedWarrantyY3: e.target.checked }))} className="w-5 h-5 accent-amber-500" />
                    <div>
                      <div className="font-medium">Extended Warranty Y3</div>
                      <div className="text-sm text-amber-400">+$15,000</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700">
                    <input type="checkbox" checked={capitalModel.remoteMonitoring} onChange={e => setCapitalModel(p => ({ ...p, remoteMonitoring: e.target.checked }))} className="w-5 h-5 accent-amber-500" />
                    <div>
                      <div className="font-medium">Remote Monitoring</div>
                      <div className="text-sm text-amber-400">+$8,500</div>
                    </div>
                  </label>
                  <div className="p-3 bg-slate-700/50 rounded-lg">
                    <div className="font-medium mb-1">Additional Training Days</div>
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} max={10} value={capitalModel.additionalTraining} onChange={e => setCapitalModel(p => ({ ...p, additionalTraining: Number(e.target.value) }))} className="w-16 bg-slate-600 rounded px-2 py-1" />
                      <span className="text-sm text-amber-400">× $2,200/day</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex justify-between items-center p-3 bg-amber-900/20 rounded-lg">
                  <span className="font-medium">Total Optional Items</span>
                  <span className="text-xl font-bold text-amber-400">+{formatCurrency(optionalCosts, 0)}</span>
                </div>
              </div>

              {/* Investment Decision Summary */}
              <div className={`rounded-xl p-6 border-2 ${npv > 0 && irr > capitalModel.discountRate ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      {npv > 0 && irr > capitalModel.discountRate ? '✅' : '⚠️'} Investment Decision
                    </h3>
                    <div className="text-slate-400 mt-1">
                      {npv > 0 && irr > capitalModel.discountRate
                        ? `Project meets investment criteria. NPV positive at ${formatCurrency(npv, 2)} with ${irr.toFixed(1)}% IRR exceeding ${capitalModel.discountRate}% hurdle rate.`
                        : `Project does not meet investment criteria. Consider adjusting operating assumptions or capital investment.`
                      }
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-400">Lifetime Value Created</div>
                    <div className={`text-3xl font-bold ${npv > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(npv + capitalModel.totalInvestment, 2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {activeTab === 'alarms' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">🚨 Alarm Management</h2>
            {pendingAlarms.length > 0 && (<div className="bg-orange-900/20 rounded-xl p-6 border border-orange-900/50"><h3 className="text-lg font-semibold text-orange-400 mb-4">⏳ Pending Alarms (3 second delay)</h3><div className="grid md:grid-cols-3 gap-3">{pendingAlarms.map((a, i) => (<div key={i} className="p-3 rounded-lg border bg-orange-900/20 border-orange-700"><div className="flex items-center justify-between"><span className="text-orange-300 text-sm font-medium">{a.type.replace(/_/g, ' ')}</span><span className="text-lg font-bold text-orange-400">{a.remain.toFixed(1)}s</span></div><div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${((3 - a.remain) / 3) * 100}%` }} /></div></div>))}</div></div>)}
            <div className={`rounded-xl p-6 border ${alarms.length > 0 ? 'bg-red-900/20 border-red-500' : 'bg-green-900/20 border-green-500'}`}><h3 className="text-lg font-semibold mb-4">{alarms.length > 0 ? `🔴 ${alarms.length} Active Alarm${alarms.length > 1 ? 's' : ''}` : '✅ All Clear'}</h3>{alarms.length === 0 ? <div className="text-center py-8 text-slate-400">No active alarms - all process values within limits</div> : (<div className="space-y-3">{alarms.map((a, i) => (<div key={i} className={`p-4 rounded-lg border ${a.sev === 'critical' ? 'bg-red-900/30 border-red-700' : 'bg-yellow-900/30 border-yellow-700'}`}><div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className={`text-2xl ${a.sev === 'critical' ? 'animate-pulse' : ''}`}>{a.sev === 'critical' ? '🔴' : '🟡'}</span><div><div className="font-bold">{a.type.replace(/_/g, ' ')}</div><div className="text-sm text-slate-400 capitalize">{a.sev}</div></div></div><div className="text-right"><div className="text-2xl font-bold">{a.val.toFixed(1)}</div><div className="text-xs text-slate-400">Limit: {a.lim}</div></div></div></div>))}</div>)}</div>
          </div>
        )}

        {activeTab === 'massBalance' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">⚖️ Mass Balance & Commercial Overview</h2>
            
            {/* Mass Balance Table */}
            <div className="bg-slate-800 rounded-xl p-6 border border-green-900/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-green-400">Mass Balance (Live)</h3>
                <div className={`px-4 py-2 rounded-lg ${Math.abs(computed.massBalanceClosure - 100) < 2 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'} font-bold`}>
                  {Math.abs(computed.massBalanceClosure - 100) < 2 ? '✓' : '⚠️'} Closure: {computed.massBalanceClosure.toFixed(1)}%
                </div>
              </div>
              
              {/* Detailed table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left py-2 px-3 text-slate-400">Stream</th>
                      <th className="text-right py-2 px-3 text-slate-400">m³/h</th>
                      <th className="text-right py-2 px-3 text-slate-400">L/h</th>
                      <th className="text-right py-2 px-3 text-slate-400">% of Feed</th>
                      <th className="text-right py-2 px-3 text-slate-400">Daily (m³)</th>
                      <th className="text-right py-2 px-3 text-slate-400">$/h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Feed Input */}
                    <tr className="border-b border-slate-700 bg-blue-900/20">
                      <td className="py-3 px-3 font-bold text-blue-400">📥 FEED IN</td>
                      <td className="text-right py-3 px-3 font-mono text-blue-400">{smoothedProc.feedFlow.toFixed(3)}</td>
                      <td className="text-right py-3 px-3 font-mono text-blue-300">{(smoothedProc.feedFlow * 1000).toFixed(0)}</td>
                      <td className="text-right py-3 px-3 font-mono text-blue-400">100.0%</td>
                      <td className="text-right py-3 px-3 font-mono text-blue-300">{computed.dailyProjection.feed.toFixed(1)}</td>
                      <td className="text-right py-3 px-3 font-mono text-slate-500">-</td>
                    </tr>
                    {/* Stage 1: Centrifuge Outputs */}
                    <tr className="border-b border-slate-600 bg-slate-700/20">
                      <td colSpan={6} className="py-1 px-3 text-xs text-slate-400 font-semibold">STAGE 1: CENTRIFUGE SEPARATION</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-3 px-3 text-amber-400">🛢️ Oil Recovered</td>
                      <td className="text-right py-3 px-3 font-mono">{smoothedProc.oilOut.toFixed(4)}</td>
                      <td className="text-right py-3 px-3 font-mono text-slate-400">{(smoothedProc.oilOut * 1000).toFixed(1)}</td>
                      <td className="text-right py-3 px-3 font-mono text-amber-400">{computed.flowPct.oil.toFixed(2)}%</td>
                      <td className="text-right py-3 px-3 font-mono text-slate-400">{computed.dailyProjection.oil.toFixed(2)}</td>
                      <td className="text-right py-3 px-3 font-mono text-green-400">+${computed.hourly.oilRevenue.toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-3 px-3 text-orange-400">🪨 Sludge/Solids</td>
                      <td className="text-right py-3 px-3 font-mono">{smoothedProc.solidsOut.toFixed(4)}</td>
                      <td className="text-right py-3 px-3 font-mono text-slate-400">{(smoothedProc.solidsOut * 1000).toFixed(1)}</td>
                      <td className="text-right py-3 px-3 font-mono text-orange-400">{computed.flowPct.solids.toFixed(2)}%</td>
                      <td className="text-right py-3 px-3 font-mono text-slate-400">{computed.dailyProjection.solids.toFixed(2)}</td>
                      <td className="text-right py-3 px-3 font-mono text-red-400">-${computed.hourly.sludgeCost.toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-slate-700/50 bg-cyan-900/10">
                      <td className="py-3 px-3 text-cyan-400">💧 Water (pre-filter)</td>
                      <td className="text-right py-3 px-3 font-mono">{smoothedProc.waterOut.toFixed(3)}</td>
                      <td className="text-right py-3 px-3 font-mono text-slate-400">{(smoothedProc.waterOut * 1000).toFixed(0)}</td>
                      <td className="text-right py-3 px-3 font-mono text-cyan-400">{computed.flowPct.water.toFixed(1)}%</td>
                      <td className="text-right py-3 px-3 font-mono text-slate-400">{computed.dailyProjection.water.toFixed(1)}</td>
                      <td className="text-right py-3 px-3 font-mono text-slate-500">{smoothedProc.waterQuality.toFixed(0)} ppm OiW</td>
                    </tr>
                    {/* Stage 2: GAC Polishing Filter */}
                    <tr className="border-b border-slate-600 bg-slate-700/20">
                      <td colSpan={6} className="py-1 px-3 text-xs text-slate-400 font-semibold">STAGE 2: SPDD1600 GAC POLISHING FILTER</td>
                    </tr>
                    <tr className="border-b border-slate-700/50 bg-teal-900/10">
                      <td className="py-3 px-3 text-teal-400">🔵 Filtered Water (to pond)</td>
                      <td className="text-right py-3 px-3 font-mono">{polishingFilter.outletFlow.toFixed(3)}</td>
                      <td className="text-right py-3 px-3 font-mono text-slate-400">{(polishingFilter.outletFlow * 1000).toFixed(0)}</td>
                      <td className="text-right py-3 px-3 font-mono text-teal-400">{smoothedProc.feedFlow > 0 ? ((polishingFilter.outletFlow / smoothedProc.feedFlow) * 100).toFixed(1) : '0.0'}%</td>
                      <td className="text-right py-3 px-3 font-mono text-slate-400">{(polishingFilter.outletFlow * 24).toFixed(1)}</td>
                      <td className="text-right py-3 px-3 font-mono text-teal-400">{polishingFilter.outletOiW.toFixed(0)} ppm OiW</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-3 px-3 text-slate-400 pl-6">├─ Turbidity reduction</td>
                      <td colSpan={3} className="text-right py-3 px-3 font-mono text-slate-400">
                        {polishingFilter.inletTurbidity.toFixed(1)} → {polishingFilter.outletTurbidity.toFixed(1)} NTU ({polishingFilter.turbidityRemoval.toFixed(0)}% removal)
                      </td>
                      <td className="text-right py-3 px-3 font-mono text-slate-400">ΔP: {polishingFilter.differentialPressure.toFixed(2)} bar</td>
                      <td className="text-right py-3 px-3 font-mono text-slate-400">Bed: {polishingFilter.bedSaturation.toFixed(0)}%</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-3 px-3 text-slate-400 pl-6">└─ OiW reduction</td>
                      <td colSpan={3} className="text-right py-3 px-3 font-mono text-slate-400">
                        {polishingFilter.inletOiW.toFixed(0)} → {polishingFilter.outletOiW.toFixed(0)} ppm ({polishingFilter.oilRemoval.toFixed(0)}% removal)
                      </td>
                      <td className="text-right py-3 px-3 font-mono text-slate-400">{polishingFilter.totalFiltered.toFixed(1)} m³ filtered</td>
                      <td className="text-right py-3 px-3 font-mono text-red-400">-${(filterCosts.total).toFixed(2)}</td>
                    </tr>
                    {/* Final Output Summary */}
                    <tr className="bg-slate-700/30">
                      <td className="py-3 px-3 font-bold text-slate-300">📤 TOTAL OUT</td>
                      <td className="text-right py-3 px-3 font-mono font-bold">{computed.totalOut.toFixed(3)}</td>
                      <td className="text-right py-3 px-3 font-mono">{(computed.totalOut * 1000).toFixed(0)}</td>
                      <td className="text-right py-3 px-3 font-mono font-bold">{computed.flowPct.total.toFixed(1)}%</td>
                      <td className="text-right py-3 px-3 font-mono">{(computed.totalOut * 24).toFixed(1)}</td>
                      <td className="text-right py-3 px-3 font-mono">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Efficiency metrics row */}
              <div className="mt-4 grid grid-cols-5 gap-3">
                <div className="bg-green-900/20 rounded-lg p-3 text-center border border-green-500/30">
                  <div className="text-xs text-green-400">Oil Recovery</div>
                  <div className="text-xl font-bold text-green-400">{smoothedProc.oilEff.toFixed(1)}%</div>
                </div>
                <div className="bg-purple-900/20 rounded-lg p-3 text-center border border-purple-500/30">
                  <div className="text-xs text-purple-400">Solids Removal</div>
                  <div className="text-xl font-bold text-purple-400">{smoothedProc.solidsEff.toFixed(1)}%</div>
                </div>
                <div className="bg-cyan-900/20 rounded-lg p-3 text-center border border-cyan-500/30">
                  <div className="text-xs text-cyan-400">Final OiW (post-GAC)</div>
                  <div className="text-xl font-bold text-cyan-400">{polishingFilter.outletOiW.toFixed(0)} ppm</div>
                  <div className="text-xs text-slate-500">Pre: {smoothedProc.waterQuality.toFixed(0)} ppm</div>
                </div>
                <div className="bg-blue-900/20 rounded-lg p-3 text-center border border-blue-500/30">
                  <div className="text-xs text-blue-400">Final Turbidity</div>
                  <div className="text-xl font-bold text-blue-400">{polishingFilter.outletTurbidity.toFixed(1)} NTU</div>
                  <div className="text-xs text-slate-500">Pre: {smoothedProc.turbidity.toFixed(1)} NTU</div>
                </div>
                <div className="bg-amber-900/20 rounded-lg p-3 text-center border border-amber-500/30">
                  <div className="text-xs text-amber-400">G-Force</div>
                  <div className="text-xl font-bold text-amber-400">{smoothedProc.gForce.toFixed(0)} G</div>
                </div>
              </div>
            </div>

            {/* Commercial P&L - Hourly */}
            <div className="bg-slate-800 rounded-xl p-6 border border-amber-900/50">
              <h3 className="text-lg font-semibold text-amber-400 mb-4">💰 Hourly Operating P&L</h3>
              
              <div className="grid md:grid-cols-3 gap-6">
                {/* Revenue */}
                <div>
                  <h4 className="text-sm text-green-400 font-semibold mb-3 uppercase">Revenue</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between p-2 bg-green-900/20 rounded border border-green-500/30">
                      <span className="text-sm">🛢️ Oil ({smoothedProc.oilOut.toFixed(2)} m³/h)</span>
                      <span className="text-green-400 font-bold">+${computed.hourly.oilRevenue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-green-900/30 rounded font-bold">
                      <span>Total Revenue</span>
                      <span className="text-green-400">${computed.hourly.oilRevenue.toFixed(2)}/h</span>
                    </div>
                  </div>
                </div>

                {/* Operating Costs */}
                <div>
                  <h4 className="text-sm text-red-400 font-semibold mb-3 uppercase">Operating Costs</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between p-2 bg-red-900/10 rounded border border-red-500/20">
                      <span className="text-sm">⚡ Energy ({smoothedProc.totalPower.toFixed(1)} kW)</span>
                      <span className="text-red-400">-${computed.hourly.energyCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-orange-900/10 rounded border border-orange-500/20">
                      <span className="text-sm">🪨 Sludge ({smoothedProc.solidsOut.toFixed(2)} m³/h)</span>
                      <span className="text-orange-400">-${computed.hourly.sludgeCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-cyan-900/10 rounded border border-cyan-500/20">
                      <span className="text-sm">💧 Water Treatment ({polishingFilter.outletFlow.toFixed(2)} m³/h)</span>
                      <span className="text-cyan-400">-${computed.hourly.waterCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-pink-900/10 rounded border border-pink-500/20">
                      <span className="text-sm">💉 Chemicals ({Object.values(chemDosing).filter(c => c.enabled).length} active)</span>
                      <span className="text-pink-400">-${computed.hourly.chemicalCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-teal-900/10 rounded border border-teal-500/20">
                      <span className="text-sm">🔵 GAC Filter ({polishingFilter.backwashCount} BW)</span>
                      <span className="text-teal-400">-${computed.hourly.filterCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-purple-900/10 rounded border border-purple-500/20">
                      <span className="text-sm">👷 Labor (1 op)</span>
                      <span className="text-purple-400">-${computed.hourly.laborCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-red-900/30 rounded font-bold">
                      <span>Total Costs</span>
                      <span className="text-red-400">-${computed.hourly.totalCosts.toFixed(2)}/h</span>
                    </div>
                  </div>
                </div>

                {/* Net Result */}
                <div>
                  <h4 className="text-sm text-slate-400 font-semibold mb-3 uppercase">Net Result</h4>
                  <div className={`p-4 rounded-xl border-2 ${computed.hourly.isProfit ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'}`}>
                    <div className="text-center">
                      <div className="text-sm text-slate-400">Net {computed.hourly.isProfit ? 'Profit' : 'Loss'}</div>
                      <div className={`text-3xl font-bold ${computed.hourly.isProfit ? 'text-green-400' : 'text-red-400'}`}>
                        {computed.hourly.isProfit ? '+' : ''}${computed.hourly.netProfit.toFixed(2)}/h
                      </div>
                      <div className={`text-sm ${computed.hourly.isProfit ? 'text-green-300' : 'text-red-300'}`}>
                        {computed.hourly.margin.toFixed(1)}% margin
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-600 grid grid-cols-2 gap-2 text-xs">
                      <div className="text-center">
                        <div className="text-slate-400">Per m³ Feed</div>
                        <div className={`font-bold ${computed.hourly.isProfit ? 'text-green-400' : 'text-red-400'}`}>
                          ${computed.hourly.perM3Feed.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-400">Daily (24h)</div>
                        <div className={`font-bold ${computed.hourly.isProfit ? 'text-green-400' : 'text-red-400'}`}>
                          ${computed.hourly.daily.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cost breakdown bars */}
              <div className="mt-6 pt-4 border-t border-slate-700">
                <h4 className="text-sm text-slate-400 mb-3">Cost Structure Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="w-20 text-xs text-yellow-400">Energy</span>
                    <div className="flex-1 h-5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 rounded-full flex items-center justify-end pr-2" style={{ width: `${computed.costBreakdown.energy.pct}%` }}>
                        <span className="text-xs text-white font-bold">{computed.costBreakdown.energy.pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <span className="w-16 text-right text-xs text-yellow-400">${computed.costBreakdown.energy.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-20 text-xs text-orange-400">Sludge</span>
                    <div className="flex-1 h-5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full flex items-center justify-end pr-2" style={{ width: `${computed.costBreakdown.sludge.pct}%` }}>
                        <span className="text-xs text-white font-bold">{computed.costBreakdown.sludge.pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <span className="w-16 text-right text-xs text-orange-400">${computed.costBreakdown.sludge.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-20 text-xs text-cyan-400">Water</span>
                    <div className="flex-1 h-5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full flex items-center justify-end pr-2" style={{ width: `${computed.costBreakdown.water.pct}%` }}>
                        <span className="text-xs text-white font-bold">{computed.costBreakdown.water.pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <span className="w-16 text-right text-xs text-cyan-400">${computed.costBreakdown.water.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-20 text-xs text-purple-400">Labor</span>
                    <div className="flex-1 h-5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full flex items-center justify-end pr-2" style={{ width: `${computed.costBreakdown.labor.pct}%` }}>
                        <span className="text-xs text-white font-bold">{computed.costBreakdown.labor.pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <span className="w-16 text-right text-xs text-purple-400">${computed.costBreakdown.labor.amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Session Totals with Full P&L */}
            <div className="bg-slate-800 rounded-xl p-6 border border-cyan-900/50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-cyan-400">📊 Session Totals & P&L</h3>
                <div className="flex items-center gap-4">
                  <span className="text-slate-400">⏱️ {formatTime(totals.runTime)}</span>
                  <button onClick={() => setTotals({ feed: 0, water: 0, oil: 0, solids: 0, energy: 0, runTime: 0 })} className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm transition-colors">Reset</button>
                </div>
              </div>

              {/* Volume totals */}
              <div className="grid grid-cols-5 gap-3 mb-4">
                <div className="bg-blue-900/20 rounded-lg p-3 text-center border border-blue-500/30">
                  <div className="text-xs text-blue-400">Feed</div>
                  <div className="text-lg font-bold text-blue-400">{totals.feed.toFixed(2)} m³</div>
                </div>
                <div className="bg-cyan-900/20 rounded-lg p-3 text-center border border-cyan-500/30">
                  <div className="text-xs text-cyan-400">Water</div>
                  <div className="text-lg font-bold text-cyan-400">{totals.water.toFixed(2)} m³</div>
                  <div className="text-xs text-red-400">-${(totals.water * costs.waterTreatment).toFixed(2)}</div>
                </div>
                <div className="bg-amber-900/20 rounded-lg p-3 text-center border border-amber-500/30">
                  <div className="text-xs text-amber-400">Oil</div>
                  <div className="text-lg font-bold text-amber-400">{(totals.oil * 1000).toFixed(0)} L</div>
                  <div className="text-xs text-green-400">+${(totals.oil * costs.oilValue).toFixed(2)}</div>
                </div>
                <div className="bg-orange-900/20 rounded-lg p-3 text-center border border-orange-500/30">
                  <div className="text-xs text-orange-400">Sludge</div>
                  <div className="text-lg font-bold text-orange-400">{(totals.solids * 1000).toFixed(0)} L</div>
                  <div className="text-xs text-red-400">-${computed.session.sludgeCost.toFixed(2)}</div>
                </div>
                <div className="bg-yellow-900/20 rounded-lg p-3 text-center border border-yellow-500/30">
                  <div className="text-xs text-yellow-400">Energy</div>
                  <div className="text-lg font-bold text-yellow-400">{totals.energy.toFixed(1)} kWh</div>
                  <div className="text-xs text-red-400">-${computed.session.energyCost.toFixed(2)}</div>
                </div>
              </div>

              {/* Session Financial Summary */}
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-green-400">Oil Revenue</span><span className="text-green-400">+${computed.session.oilRevenue.toFixed(2)}</span></div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-yellow-400">Energy</span><span className="text-red-400">-${computed.session.energyCost.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-orange-400">Sludge Disposal</span><span className="text-red-400">-${computed.session.sludgeCost.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-cyan-400">Water Treatment</span><span className="text-red-400">-${computed.session.waterCost.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-pink-400">Chemicals (all)</span><span className="text-red-400">-${chemCosts.total.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-teal-400">GAC Filter</span><span className="text-red-400">-${filterCosts.total.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-purple-400">Labor ({(totals.runTime / 3600).toFixed(1)}h)</span><span className="text-red-400">-${computed.session.laborCost.toFixed(2)}</span></div>
                    <div className="flex justify-between border-t border-slate-600 pt-1 font-bold"><span>Total Costs</span><span className="text-red-400">-${(computed.session.totalCosts + chemCosts.total + filterCosts.total).toFixed(2)}</span></div>
                  </div>
                </div>
                <div className={`p-4 rounded-lg border-2 ${(computed.session.netProfit - chemCosts.total - filterCosts.total) >= 0 ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-lg">NET SESSION {(computed.session.netProfit - chemCosts.total - filterCosts.total) >= 0 ? 'PROFIT' : 'LOSS'}</div>
                      {totals.feed > 0 && <div className="text-sm text-slate-400">${((computed.session.netProfit - chemCosts.total - filterCosts.total) / totals.feed).toFixed(2)} per m³ processed</div>}
                    </div>
                    <div className={`text-3xl font-bold ${(computed.session.netProfit - chemCosts.total - filterCosts.total) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(computed.session.netProfit - chemCosts.total - filterCosts.total) >= 0 ? '+' : ''}${(computed.session.netProfit - chemCosts.total - filterCosts.total).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Process Flow Summary */}
              <div className="bg-slate-900/50 rounded-lg p-4 mt-4">
                <h4 className="text-sm text-slate-400 font-semibold mb-3">🔄 PROCESS FLOW (Final Output Quality)</h4>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="bg-blue-900/30 rounded p-2 text-center border border-blue-500/30">
                    <div className="text-blue-400 font-bold">FEED</div>
                    <div className="text-slate-300">{smoothedProc.feedFlow.toFixed(1)} m³/h</div>
                  </div>
                  <div className="text-slate-500">→</div>
                  <div className="bg-amber-900/30 rounded p-2 text-center border border-amber-500/30">
                    <div className="text-amber-400 font-bold">CENTRIFUGE</div>
                    <div className="text-slate-300">OiW: {smoothedProc.waterQuality.toFixed(0)} ppm</div>
                    <div className="text-slate-400">Turb: {smoothedProc.turbidity.toFixed(0)} NTU</div>
                  </div>
                  <div className="text-slate-500">→</div>
                  <div className="bg-teal-900/30 rounded p-2 text-center border border-teal-500/30">
                    <div className="text-teal-400 font-bold">SPDD1600 GAC</div>
                    <div className="text-slate-300">OiW: {polishingFilter.outletOiW.toFixed(0)} ppm</div>
                    <div className="text-slate-400">Turb: {polishingFilter.outletTurbidity.toFixed(1)} NTU</div>
                  </div>
                  <div className="text-slate-500">→</div>
                  <div className="bg-green-900/30 rounded p-2 text-center border border-green-500/30">
                    <div className="text-green-400 font-bold">TO POND</div>
                    <div className="text-slate-300">{polishingFilter.outletFlow.toFixed(1)} m³/h</div>
                    <div className="text-green-400 text-xs">✓ Treated</div>
                  </div>
                </div>
              </div>

              {/* WATER DISCHARGE Compliance Status - License Conditions */}
              {/* Note: These limits ONLY apply to water discharge, NOT to oil or sludge products */}
              {dischargeLimits.enabled && (
                <div className="bg-slate-900/50 rounded-lg p-4 mt-4">
                  <h4 className="text-sm text-slate-400 font-semibold mb-3">💧 WATER DISCHARGE - LICENSE COMPLIANCE</h4>
                  {(() => {
                    const trhPass = polishingFilter.outletTRH <= dischargeLimits.trh;
                    const codPass = polishingFilter.outletCOD <= dischargeLimits.cod;
                    const phPass = proc.pH >= dischargeLimits.pH.min && proc.pH <= dischargeLimits.pH.max;
                    const oiwPass = polishingFilter.outletOiW <= dischargeLimits.oilInWater;
                    const turbPass = polishingFilter.outletTurbidity <= dischargeLimits.turbidity;
                    const allPass = trhPass && codPass && phPass && oiwPass && turbPass;
                    return (
                      <div className={`p-3 rounded-lg border-2 ${allPass ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{allPass ? '✅' : '❌'}</span>
                            <div>
                              <div className={`font-bold text-lg ${allPass ? 'text-green-400' : 'text-red-400'}`}>
                                WATER DISCHARGE {allPass ? 'COMPLIANT' : 'NON-COMPLIANT'}
                              </div>
                              <div className="text-xs text-slate-400">
                                Water to pond: TRH ≤{dischargeLimits.trh} mg/L | COD ≤{dischargeLimits.cod} mg/L | pH {dischargeLimits.pH.min}-{dischargeLimits.pH.max}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 text-sm flex-wrap">
                            <span className={`px-2 py-1 rounded ${trhPass ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                              TRH: {polishingFilter.outletTRH.toFixed(0)} mg/L
                            </span>
                            <span className={`px-2 py-1 rounded ${codPass ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                              COD: {polishingFilter.outletCOD.toFixed(0)} mg/L
                            </span>
                            <span className={`px-2 py-1 rounded ${phPass ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                              pH: {proc.pH.toFixed(1)}
                            </span>
                            <span className={`px-2 py-1 rounded ${oiwPass ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                              OiW: {polishingFilter.outletOiW.toFixed(0)} ppm
                            </span>
                            <span className={`px-2 py-1 rounded ${turbPass ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                              Turb: {polishingFilter.outletTurbidity.toFixed(1)} NTU
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Unit Economics */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-slate-300 mb-4">📈 Unit Economics</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                  <div className="text-xs text-slate-400 mb-1">Cost per m³ Feed</div>
                  <div className="text-2xl font-bold text-red-400">
                    ${computed.unitEcon.costPerM3Feed.toFixed(2)}
                  </div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                  <div className="text-xs text-slate-400 mb-1">Revenue per m³ Feed</div>
                  <div className="text-2xl font-bold text-green-400">
                    ${computed.unitEcon.revenuePerM3Feed.toFixed(2)}
                  </div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                  <div className="text-xs text-slate-400 mb-1">Specific Energy</div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {computed.specificEnergy.toFixed(1)} kWh/m³
                  </div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                  <div className="text-xs text-slate-400 mb-1">Sludge Cost per L Oil</div>
                  <div className="text-2xl font-bold text-orange-400">
                    ${computed.unitEcon.sludgeCostPerLOil.toFixed(3)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
