/**
 * KARRATHA WATER TREATMENT PLANT - ENGINEERING CALCULATIONS LIBRARY
 * 
 * This module implements fundamental engineering and scientific principles
 * for oily water separation and treatment process simulation.
 * 
 * References:
 * - Stokes, G.G. (1851) "On the Effect of Internal Friction of Fluids on the Motion of Pendulums"
 * - API Publication 421 - Design and Operation of Oil-Water Separators
 * - Perry's Chemical Engineers' Handbook, 9th Edition
 * - AS 1940 - Storage and Handling of Flammable and Combustible Liquids
 */

// =============================================================================
// PHYSICAL CONSTANTS
// =============================================================================

export const CONSTANTS = {
  g: 9.81,                    // Gravitational acceleration (m/s²)
  R: 8.314,                   // Universal gas constant (J/mol·K)
  WATER_DENSITY_25C: 997,     // Water density at 25°C (kg/m³)
  OIL_DENSITY_TYPICAL: 850,   // Typical crude oil density (kg/m³)
  WATER_VISCOSITY_25C: 0.89e-3, // Water dynamic viscosity at 25°C (Pa·s)
  WATER_VISCOSITY_65C: 0.43e-3, // Water dynamic viscosity at 65°C (Pa·s)
};

// =============================================================================
// FLUID PROPERTY CALCULATIONS
// =============================================================================

/**
 * Andrade Equation for temperature-dependent viscosity
 * μ = A * exp(B/T)
 * 
 * Reference: Andrade, E.N.C. (1930) "The Viscosity of Liquids"
 */
export function calculateWaterViscosity(temperatureC: number): number {
  const T = temperatureC + 273.15; // Convert to Kelvin
  const A = 2.414e-5; // Pa·s
  const B = 247.8;    // K
  const C = 140;      // K
  return A * Math.pow(10, B / (T - C));
}

/**
 * Water density as function of temperature
 * Uses polynomial approximation valid for 0-100°C
 */
export function calculateWaterDensity(temperatureC: number): number {
  const T = temperatureC;
  return 1000 * (1 - Math.abs(T - 4) * 0.00008);
}

/**
 * Oil density temperature correction
 * ASTM D1250 volume correction factor approach
 */
export function calculateOilDensity(baseDensity: number, tempC: number, baseTemp: number = 15): number {
  const alpha = 0.00064; // Typical thermal expansion coefficient for crude oil
  return baseDensity / (1 + alpha * (tempC - baseTemp));
}

// =============================================================================
// STOKES LAW SEPARATION CALCULATIONS
// =============================================================================

/**
 * STOKES LAW - Terminal Settling Velocity
 * 
 * vt = (g * d² * (ρp - ρf)) / (18 * μ)
 * 
 * Where:
 *   vt = terminal settling velocity (m/s)
 *   g  = gravitational acceleration (9.81 m/s²)
 *   d  = particle/droplet diameter (m)
 *   ρp = particle/droplet density (kg/m³)
 *   ρf = fluid density (kg/m³)
 *   μ  = dynamic viscosity of fluid (Pa·s)
 * 
 * Assumptions (Stokes regime):
 *   - Re < 0.1 (creeping flow)
 *   - Spherical particles
 *   - No particle interaction
 *   - Infinite fluid extent
 * 
 * Reference: Stokes, G.G. (1851)
 */
export function stokesSettlingVelocity(
  particleDiameter: number,      // meters
  particleDensity: number,       // kg/m³
  fluidDensity: number,          // kg/m³
  fluidViscosity: number         // Pa·s
): number {
  const g = CONSTANTS.g;
  const d = particleDiameter;
  const deltaRho = particleDensity - fluidDensity;
  
  // For oil droplets rising in water, deltaRho is negative
  // Velocity magnitude
  const vt = (g * Math.pow(d, 2) * Math.abs(deltaRho)) / (18 * fluidViscosity);
  
  return vt;
}

/**
 * Calculate Reynolds number for settling particle
 * Re = (ρf * v * d) / μ
 */
export function particleReynoldsNumber(
  velocity: number,
  diameter: number,
  fluidDensity: number,
  fluidViscosity: number
): number {
  return (fluidDensity * velocity * diameter) / fluidViscosity;
}

/**
 * Validate Stokes regime applicability
 * Returns correction factor if outside Stokes regime
 */
export function stokesRegimeCorrection(Re: number): { valid: boolean; correctionFactor: number; regime: string } {
  if (Re < 0.1) {
    return { valid: true, correctionFactor: 1.0, regime: 'Stokes (creeping flow)' };
  } else if (Re < 1) {
    // Oseen correction for 0.1 < Re < 1
    const Cd = (24 / Re) * (1 + 0.15 * Math.pow(Re, 0.687));
    return { valid: true, correctionFactor: Math.sqrt(24 / (Re * Cd)), regime: 'Oseen (transitional)' };
  } else if (Re < 500) {
    // Intermediate regime - use Schiller-Naumann
    const Cd = (24 / Re) * (1 + 0.15 * Math.pow(Re, 0.687));
    return { valid: true, correctionFactor: Math.sqrt(24 / (Re * Cd)), regime: 'Intermediate' };
  } else {
    // Newton regime - constant Cd ≈ 0.44
    return { valid: false, correctionFactor: Math.sqrt(24 / (Re * 0.44)), regime: 'Newton (turbulent)' };
  }
}

// =============================================================================
// API SEPARATOR DESIGN CALCULATIONS
// =============================================================================

/**
 * API Separator Design
 * Based on API Publication 421
 * 
 * Design equation: As = Q / vt
 * 
 * Where:
 *   As = surface area of separator (m²)
 *   Q  = volumetric flow rate (m³/s)
 *   vt = critical rise velocity (m/s)
 */
export interface APISeparatorDesign {
  surfaceArea: number;        // m²
  length: number;             // m
  width: number;              // m
  depth: number;              // m
  oilRetentionTime: number;   // seconds
  waterRetentionTime: number; // seconds
  hydraulicLoading: number;   // m³/m²/hr
  riseVelocity: number;       // m/s
  effluent_oil_ppm: number;   // predicted effluent oil concentration
}

export function designAPISeparator(
  flowRate: number,           // m³/hr
  inletOilConcentration: number, // ppm or mg/L
  oilDensity: number,         // kg/m³
  temperature: number,        // °C
  targetRemoval: number = 0.95, // 95% removal default
  targetDropletSize: number = 150e-6 // 150 micron design droplet
): APISeparatorDesign {
  // Calculate fluid properties
  const waterDensity = calculateWaterDensity(temperature);
  const waterViscosity = calculateWaterViscosity(temperature);
  
  // Calculate critical rise velocity using Stokes Law
  const vt = stokesSettlingVelocity(targetDropletSize, oilDensity, waterDensity, waterViscosity);
  
  // Convert flow rate to m³/s
  const Q = flowRate / 3600;
  
  // Required surface area
  const As = Q / vt;
  
  // Typical L:W ratio for API separators is 5:1 to 10:1
  const LWratio = 6;
  const width = Math.sqrt(As / LWratio);
  const length = width * LWratio;
  
  // Depth typically 1.5-3m, use 2m
  const depth = 2.0;
  
  // Hydraulic loading rate
  const hydraulicLoading = flowRate / As;
  
  // Retention times
  const volume = As * depth;
  const oilRetentionTime = (volume * 0.2) / Q; // Oil layer ~20% depth
  const waterRetentionTime = volume / Q;
  
  // Predict effluent quality (simplified correlation)
  // Based on typical API separator performance curves
  const removalEfficiency = Math.min(0.99, targetRemoval * (vt / (Q / As)));
  const effluent_oil_ppm = inletOilConcentration * (1 - removalEfficiency);
  
  return {
    surfaceArea: As,
    length,
    width,
    depth,
    oilRetentionTime,
    waterRetentionTime,
    hydraulicLoading,
    riseVelocity: vt,
    effluent_oil_ppm
  };
}

// =============================================================================
// TANK SETTLING MODEL
// =============================================================================

export interface SettlingPhases {
  oilLayer: number;      // Volume fraction
  emulsionLayer: number; // Volume fraction
  waterLayer: number;    // Volume fraction
  sludgeLayer: number;   // Volume fraction
}

export interface TankSettlingResult {
  phases: SettlingPhases;
  settlingTime: number;      // hours to achieve separation
  oilQuality: number;        // % water in oil
  waterQuality: number;      // ppm oil in water
  sludgeAccumulation: number; // kg
}

/**
 * Batch Settling Model for Vertical Tanks
 * Implements hindered settling and coalescence kinetics
 */
export function calculateBatchSettling(
  totalVolume: number,        // m³
  initialOilFraction: number, // 0-1
  initialSolidsFraction: number, // 0-1
  oilDensity: number,         // kg/m³
  temperature: number,        // °C
  settlingTime: number,       // hours
  tankDiameter: number        // m
): TankSettlingResult {
  // Fluid properties
  const waterDensity = calculateWaterDensity(temperature);
  const waterViscosity = calculateWaterViscosity(temperature);
  
  // Characteristic droplet sizes
  const oilDropletSize = 100e-6; // 100 micron average
  const solidParticleSize = 50e-6; // 50 micron average
  
  // Base settling velocities
  const oilRiseVelocity = stokesSettlingVelocity(
    oilDropletSize, oilDensity, waterDensity, waterViscosity
  );
  const solidSettleVelocity = stokesSettlingVelocity(
    solidParticleSize, 2500, waterDensity, waterViscosity // Assume solids density 2500 kg/m³
  );
  
  // Hindered settling correction (Richardson-Zaki)
  // vh = vt * (1 - φ)^n where n ≈ 4.65 for Stokes regime
  const n = 4.65;
  const hinderedOilVelocity = oilRiseVelocity * Math.pow(1 - initialOilFraction, n);
  const hinderedSolidVelocity = solidSettleVelocity * Math.pow(1 - initialSolidsFraction, n);
  
  // Tank geometry
  const tankHeight = (4 * totalVolume) / (Math.PI * Math.pow(tankDiameter, 2));
  
  // Calculate phase separation over time
  const timeSeconds = settlingTime * 3600;
  
  // Oil rise distance
  const oilRiseDistance = Math.min(tankHeight, hinderedOilVelocity * timeSeconds);
  const oilSeparated = (oilRiseDistance / tankHeight) * initialOilFraction;
  
  // Solids settling distance
  const solidSettleDistance = Math.min(tankHeight, hinderedSolidVelocity * timeSeconds);
  const solidsSeparated = (solidSettleDistance / tankHeight) * initialSolidsFraction;
  
  // Calculate final phase distribution
  const phases: SettlingPhases = {
    oilLayer: oilSeparated,
    emulsionLayer: Math.max(0, initialOilFraction - oilSeparated) * 1.5, // Emulsion contains some water
    waterLayer: 1 - initialOilFraction - initialSolidsFraction - (initialOilFraction - oilSeparated) * 1.5 - solidsSeparated,
    sludgeLayer: solidsSeparated * 1.2 // Sludge contains some water
  };
  
  // Quality calculations
  const oilQuality = Math.max(0.5, 10 - settlingTime * 2); // % water in oil
  const waterQuality = Math.max(50, 2000 * Math.exp(-settlingTime / 2)); // ppm oil in water
  
  return {
    phases,
    settlingTime,
    oilQuality,
    waterQuality,
    sludgeAccumulation: solidsSeparated * totalVolume * 2500 // kg
  };
}

// =============================================================================
// HEAT TRANSFER CALCULATIONS
// =============================================================================

/**
 * Calculate heating requirements for process conditioning
 * Q = m * Cp * ΔT
 */
export function calculateHeatingDuty(
  volumeFlowRate: number,  // m³/hr
  inletTemp: number,       // °C
  outletTemp: number,      // °C
  fluidDensity: number = 980 // kg/m³ (oily water mix)
): { duty: number; powerKW: number; energyCostPerHour: number } {
  const massFlowRate = volumeFlowRate * fluidDensity / 3600; // kg/s
  const Cp = 3800; // J/kg·K (approximate for oily water)
  const deltaT = outletTemp - inletTemp;
  
  const duty = massFlowRate * Cp * deltaT; // Watts
  const powerKW = duty / 1000;
  
  // Assuming electrical heating @ $0.25/kWh
  const energyCostPerHour = powerKW * 0.25;
  
  return { duty, powerKW, energyCostPerHour };
}

/**
 * Heat loss calculation for insulated tanks
 * Q_loss = U * A * (T_tank - T_ambient)
 */
export function calculateHeatLoss(
  tankDiameter: number,    // m
  tankHeight: number,      // m
  tankTemp: number,        // °C
  ambientTemp: number,     // °C
  insulationThickness: number = 0.05 // m (50mm default)
): number {
  // Calculate surface area (cylindrical tank)
  const sidewallArea = Math.PI * tankDiameter * tankHeight;
  const topArea = Math.PI * Math.pow(tankDiameter / 2, 2);
  const totalArea = sidewallArea + topArea;
  
  // U-value for insulated steel tank
  // k_insulation ≈ 0.04 W/m·K for mineral wool
  const k_insulation = 0.04;
  const U = k_insulation / insulationThickness; // W/m²·K (simplified)
  
  const heatLoss = U * totalArea * (tankTemp - ambientTemp); // Watts
  
  return heatLoss;
}

// =============================================================================
// PUMP CALCULATIONS
// =============================================================================

export interface PumpPerformance {
  head: number;           // m
  power: number;          // kW
  efficiency: number;     // fraction
  npshRequired: number;   // m
  operatingCost: number;  // $/hr
}

/**
 * Centrifugal pump performance calculation
 */
export function calculatePumpPerformance(
  flowRate: number,        // m³/hr
  totalHead: number,       // m
  fluidDensity: number = 1000, // kg/m³
  electricityCost: number = 0.25 // $/kWh
): PumpPerformance {
  // Hydraulic power
  const Q = flowRate / 3600; // m³/s
  const hydraulicPower = fluidDensity * CONSTANTS.g * Q * totalHead; // Watts
  
  // Estimate pump efficiency based on flow rate
  // Typical centrifugal pump efficiency curve approximation
  const Qm3hr = flowRate;
  let efficiency: number;
  if (Qm3hr < 10) {
    efficiency = 0.45;
  } else if (Qm3hr < 50) {
    efficiency = 0.55 + (Qm3hr - 10) * 0.005;
  } else {
    efficiency = Math.min(0.80, 0.75 + (Qm3hr - 50) * 0.001);
  }
  
  const shaftPower = hydraulicPower / efficiency / 1000; // kW
  
  // NPSH required (simplified correlation)
  const npshRequired = 2 + 0.01 * flowRate;
  
  return {
    head: totalHead,
    power: shaftPower,
    efficiency,
    npshRequired,
    operatingCost: shaftPower * electricityCost
  };
}

// =============================================================================
// MASS BALANCE CALCULATIONS
// =============================================================================

export interface StreamComposition {
  water: number;      // kg/hr
  oil: number;        // kg/hr
  solids: number;     // kg/hr
  totalMass: number;  // kg/hr
  volumeFlow: number; // m³/hr
}

export interface MassBalance {
  inlet: StreamComposition;
  oilProduct: StreamComposition;
  treatedWater: StreamComposition;
  sludge: StreamComposition;
  losses: StreamComposition;
  closureError: number; // Should be near 0
}

export function calculateMassBalance(
  inletFlowRate: number,     // m³/hr
  inletWaterContent: number, // fraction (0-1)
  inletOilContent: number,   // fraction (0-1)
  inletSolidsContent: number, // fraction (0-1)
  oilRecoveryEfficiency: number = 0.95,
  waterTreatmentEfficiency: number = 0.98,
  solidsRemovalEfficiency: number = 0.90
): MassBalance {
  // Densities
  const waterDensity = 1000;
  const oilDensity = 850;
  const solidsDensity = 2500;
  
  // Calculate inlet mass flows
  const waterMassIn = inletFlowRate * inletWaterContent * waterDensity;
  const oilMassIn = inletFlowRate * inletOilContent * oilDensity;
  const solidsMassIn = inletFlowRate * inletSolidsContent * solidsDensity;
  const totalMassIn = waterMassIn + oilMassIn + solidsMassIn;
  
  const inlet: StreamComposition = {
    water: waterMassIn,
    oil: oilMassIn,
    solids: solidsMassIn,
    totalMass: totalMassIn,
    volumeFlow: inletFlowRate
  };
  
  // Oil product stream (recovered oil + entrained water)
  const oilRecovered = oilMassIn * oilRecoveryEfficiency;
  const waterInOil = oilRecovered * 0.03; // 3% BS&W typical target
  const oilProduct: StreamComposition = {
    water: waterInOil,
    oil: oilRecovered,
    solids: 0,
    totalMass: oilRecovered + waterInOil,
    volumeFlow: (oilRecovered / oilDensity) + (waterInOil / waterDensity)
  };
  
  // Treated water stream
  const treatedWaterMass = (waterMassIn - waterInOil) * waterTreatmentEfficiency;
  const oilInWater = oilMassIn * (1 - oilRecoveryEfficiency) * 0.1; // Residual oil
  const treatedWater: StreamComposition = {
    water: treatedWaterMass,
    oil: oilInWater,
    solids: solidsMassIn * (1 - solidsRemovalEfficiency) * 0.1,
    totalMass: treatedWaterMass + oilInWater,
    volumeFlow: treatedWaterMass / waterDensity
  };
  
  // Sludge stream
  const sludgeSolids = solidsMassIn * solidsRemovalEfficiency;
  const sludgeWater = sludgeSolids * 0.7; // 70% water content in sludge
  const sludgeOil = oilMassIn * (1 - oilRecoveryEfficiency) * 0.5;
  const sludge: StreamComposition = {
    water: sludgeWater,
    oil: sludgeOil,
    solids: sludgeSolids,
    totalMass: sludgeSolids + sludgeWater + sludgeOil,
    volumeFlow: (sludgeSolids + sludgeWater + sludgeOil) / 1500 // Approximate sludge density
  };
  
  // Losses (evaporation, entrainment, etc.)
  const lossWater = waterMassIn - waterInOil - treatedWater.water - sludgeWater;
  const lossOil = oilMassIn - oilRecovered - oilInWater - sludgeOil;
  const lossSolids = solidsMassIn - sludgeSolids - treatedWater.solids;
  const losses: StreamComposition = {
    water: Math.max(0, lossWater),
    oil: Math.max(0, lossOil),
    solids: Math.max(0, lossSolids),
    totalMass: Math.max(0, lossWater + lossOil + lossSolids),
    volumeFlow: 0
  };
  
  // Closure error
  const totalOut = oilProduct.totalMass + treatedWater.totalMass + sludge.totalMass + losses.totalMass;
  const closureError = (totalMassIn - totalOut) / totalMassIn * 100;
  
  return {
    inlet,
    oilProduct,
    treatedWater,
    sludge,
    losses,
    closureError
  };
}

// =============================================================================
// COST CALCULATIONS
// =============================================================================

export interface OperationalCosts {
  electricity: number;
  chemicals: number;
  sludgeDisposal: number;
  maintenance: number;
  labor: number;
  total: number;
  costPerCubicMeter: number;
}

export function calculateOperationalCosts(
  dailyThroughput: number,     // kL/day
  pumpPower: number,           // kW total
  heaterPower: number,         // kW
  operatingHours: number,      // hours/day
  chemicalDosageRate: number = 50, // mg/L (total chemicals)
  sludgeProduction: number = 0.5 // m³/day
): OperationalCosts {
  // Unit costs (AUD)
  const electricityCost = 0.28; // $/kWh
  const chemicalCost = 2.50;    // $/kg
  const sludgeDisposalCost = 150; // $/m³
  const maintenanceFactor = 0.02; // 2% of CAPEX/year
  const laborRate = 85;         // $/hr
  const laborHours = 4;         // hrs/day
  
  // Calculate daily costs
  const dailyElectricity = (pumpPower + heaterPower) * operatingHours * electricityCost;
  const dailyChemicals = (dailyThroughput * 1000 * chemicalDosageRate / 1e6) * chemicalCost;
  const dailySludgeDisposal = sludgeProduction * sludgeDisposalCost;
  
  // Assume $500k CAPEX for maintenance calculation
  const dailyMaintenance = (500000 * maintenanceFactor) / 365;
  const dailyLabor = laborHours * laborRate;
  
  const dailyTotal = dailyElectricity + dailyChemicals + dailySludgeDisposal + dailyMaintenance + dailyLabor;
  
  return {
    electricity: dailyElectricity,
    chemicals: dailyChemicals,
    sludgeDisposal: dailySludgeDisposal,
    maintenance: dailyMaintenance,
    labor: dailyLabor,
    total: dailyTotal,
    costPerCubicMeter: dailyTotal / dailyThroughput
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function formatNumber(value: number, decimals: number = 2): string {
  if (Math.abs(value) < 0.001 && value !== 0) {
    return value.toExponential(decimals);
  }
  return value.toFixed(decimals);
}

export function convertUnits(value: number, from: string, to: string): number {
  const conversions: Record<string, Record<string, number>> = {
    'm3/hr': { 'L/s': 1000/3600, 'kL/day': 24, 'gpm': 4.403 },
    'kL/day': { 'm3/hr': 1/24, 'L/s': 1000/86400 },
    'm': { 'mm': 1000, 'cm': 100, 'ft': 3.281 },
    'kg/m3': { 'g/L': 1, 'lb/ft3': 0.0624 },
    'Pa.s': { 'cP': 1000, 'mPa.s': 1000 },
    'kW': { 'hp': 1.341, 'W': 1000 },
  };
  
  if (conversions[from] && conversions[from][to]) {
    return value * conversions[from][to];
  }
  return value;
}
