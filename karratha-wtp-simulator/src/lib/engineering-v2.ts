/**
 * KARRATHA WTP - ADVANCED ENGINEERING CALCULATIONS
 * 
 * Comprehensive engineering calculations for oily water treatment
 * with full scientific references and correlations.
 * 
 * =============================================================================
 * REFERENCES:
 * =============================================================================
 * [1] Stokes, G.G. (1851) - Terminal settling velocity
 * [2] Richardson, J.F. & Zaki, W.N. (1954) - Hindered settling
 * [3] API Publication 421 (2012) - Oil-Water Separator Design
 * [4] Hadamard-Rybczynski (1911) - Droplet internal circulation
 * [5] Oseen, C.W. (1910) - Inertial correction to Stokes
 * [6] Schiller-Naumann (1935) - Intermediate Re drag correlation
 * [7] Perry's Chemical Engineers' Handbook, 9th Ed
 * [8] Coulson & Richardson, Vol. 2 - Particle Technology
 * [9] AS 1940-2017 - Flammable/Combustible Liquids Storage
 * [10] API RP 14E - Offshore Pipeline Flow
 * =============================================================================
 */

// =============================================================================
// PHYSICAL CONSTANTS
// =============================================================================

export const CONSTANTS = {
  // Fundamental
  g: 9.80665,                     // Gravitational acceleration (m/s²) - standard
  R: 8.31446,                     // Universal gas constant (J/mol·K)
  Na: 6.02214e23,                 // Avogadro's number
  kB: 1.38065e-23,                // Boltzmann constant (J/K)
  
  // Water properties at reference conditions
  WATER_DENSITY_4C: 999.97,       // Maximum density (kg/m³)
  WATER_DENSITY_25C: 997.05,      // At 25°C (kg/m³)
  WATER_VISCOSITY_20C: 1.002e-3,  // At 20°C (Pa·s)
  WATER_VISCOSITY_25C: 0.890e-3,  // At 25°C (Pa·s)
  WATER_SPECIFIC_HEAT: 4186,      // J/kg·K
  WATER_THERMAL_COND: 0.598,      // W/m·K at 20°C
  WATER_SURFACE_TENSION: 0.0728,  // N/m at 20°C
  
  // Typical oil properties
  OIL_DENSITY_TYPICAL: 850,       // kg/m³
  OIL_VISCOSITY_TYPICAL: 0.030,   // Pa·s at 25°C
  OIL_SPECIFIC_HEAT: 2000,        // J/kg·K (approximate)
  
  // Solids (sludge)
  SOLIDS_DENSITY_TYPICAL: 2500,   // kg/m³
  
  // Process design constants
  API_DESIGN_DROPLET: 150e-6,     // 150 μm design droplet (per API 421)
  STOKES_REGIME_LIMIT: 0.1,       // Re < 0.1 for Stokes law validity
  INTERMEDIATE_RE_LIMIT: 500,     // Re for intermediate regime
  NEWTON_RE_LIMIT: 2e5,           // Re for Newton's law regime
};

// =============================================================================
// FLUID PROPERTY CORRELATIONS
// =============================================================================

/**
 * Water Dynamic Viscosity - Vogel Equation
 * 
 * μ = A × exp(B / (T - C))
 * 
 * Valid range: 0-100°C
 * Accuracy: ±0.5%
 * 
 * Reference: Vogel, H. (1921) Physik. Z., 22, 645
 */
export function waterViscosityVogel(T_celsius: number): number {
  const T = T_celsius;
  const A = 2.414e-5;   // Pa·s
  const B = 247.8;      // K
  const C = 140;        // K
  
  if (T < 0 || T > 100) {
    console.warn(`Temperature ${T}°C outside valid range for Vogel equation`);
  }
  
  return A * Math.pow(10, B / (T + 273.15 - C));
}

/**
 * Water Dynamic Viscosity - DIPPR Correlation
 * 
 * More accurate polynomial fit for industrial calculations
 * 
 * Reference: DIPPR 801 Database
 */
export function waterViscosityDIPPR(T_celsius: number): number {
  const T = T_celsius + 273.15; // Convert to Kelvin
  
  // DIPPR coefficients for water
  const A = -52.843;
  const B = 3703.6;
  const C = 5.866;
  const D = -5.879e-29;
  const E = 10;
  
  const lnMu = A + B/T + C*Math.log(T) + D*Math.pow(T, E);
  return Math.exp(lnMu);
}

/**
 * Water Density - Polynomial Correlation
 * 
 * ρ = A₀ + A₁T + A₂T² + A₃T³ + A₄T⁴
 * 
 * Valid range: 0-100°C
 * Maximum density at 3.98°C
 * 
 * Reference: Kell, G.S. (1975) J. Chem. Eng. Data, 20, 97
 */
export function waterDensityKell(T_celsius: number): number {
  const T = T_celsius;
  
  // Coefficients for density in kg/m³
  const A0 = 999.83952;
  const A1 = 16.945176;
  const A2 = -7.9870401e-3;
  const A3 = -46.170461e-6;
  const A4 = 105.56302e-9;
  const A5 = -280.54253e-12;
  const B = 16.897850e-3;
  
  const numerator = A0 + A1*T + A2*Math.pow(T,2) + A3*Math.pow(T,3) + 
                    A4*Math.pow(T,4) + A5*Math.pow(T,5);
  const denominator = 1 + B*T;
  
  return numerator / denominator;
}

/**
 * Oil Density - ASTM D1250 Volume Correction
 * 
 * Corrects oil density for temperature variation
 * 
 * ρ_T = ρ_15 / [1 + α(T - 15)]
 * 
 * where α = thermal expansion coefficient
 * 
 * Reference: ASTM D1250, API 2540
 */
export function oilDensityTemperature(
  density15C: number,       // kg/m³ at 15°C
  T_celsius: number,
  apiGravity?: number
): number {
  // Calculate thermal expansion coefficient
  // Approximation: α decreases with increasing density
  let alpha: number;
  
  if (apiGravity !== undefined) {
    // Use API gravity correlation
    // K₀ = exp(-1.62080 + 0.00021592 × API²·⁵)
    const K0 = Math.exp(-1.62080 + 0.00021592 * Math.pow(apiGravity, 2.5));
    alpha = K0 / density15C;
  } else {
    // Generic correlation for crude oils
    alpha = 0.00064; // Typical value ~6.4×10⁻⁴ per °C
  }
  
  const temperatureCorrection = 1 + alpha * (T_celsius - 15);
  return density15C / temperatureCorrection;
}

/**
 * Oil Viscosity - Walther Equation (ASTM D341)
 * 
 * log log (ν + 0.7) = A - B × log(T)
 * 
 * Where ν is kinematic viscosity in cSt, T in Kelvin
 * 
 * Reference: ASTM D341, Walther, C. (1931)
 */
export function oilViscosityWalther(
  viscosity40C: number,     // cSt at 40°C
  viscosity100C: number,    // cSt at 100°C
  T_celsius: number
): number {
  const T1 = 40 + 273.15;   // K
  const T2 = 100 + 273.15;  // K
  const T = T_celsius + 273.15; // K
  
  // Calculate Walther parameters
  const W1 = Math.log10(Math.log10(viscosity40C + 0.7));
  const W2 = Math.log10(Math.log10(viscosity100C + 0.7));
  
  const B = (W1 - W2) / (Math.log10(T2) - Math.log10(T1));
  const A = W1 + B * Math.log10(T1);
  
  // Calculate viscosity at target temperature
  const W = A - B * Math.log10(T);
  const logNu = Math.pow(10, W);
  const nu = Math.pow(10, logNu) - 0.7; // cSt
  
  return nu * 1e-6; // Convert to m²/s
}

/**
 * Calculate Viscosity Index (VI)
 * 
 * Reference: ASTM D2270
 */
export function viscosityIndex(viscosity40C: number, viscosity100C: number): number {
  // Simplified VI calculation
  const L = viscosity40C; // Low reference oil viscosity
  const H = viscosity100C; // High reference oil viscosity
  
  // For typical lubricating oils
  const VI = ((L - viscosity40C) / (L - H)) * 100;
  return Math.max(0, Math.min(200, VI));
}

// =============================================================================
// MIXTURE PROPERTIES
// =============================================================================

/**
 * Mixture Density - Volume Average
 * 
 * ρ_mix = Σ(φᵢ × ρᵢ)
 * 
 * where φᵢ is volume fraction
 */
export function mixtureDensity(
  waterFraction: number,
  oilFraction: number,
  solidsFraction: number,
  waterDensity: number,
  oilDensity: number,
  solidsDensity: number = 2500
): number {
  return waterFraction * waterDensity + 
         oilFraction * oilDensity + 
         solidsFraction * solidsDensity;
}

/**
 * Mixture Viscosity - Arrhenius Equation
 * 
 * ln(μ_mix) = Σ(φᵢ × ln(μᵢ))
 * 
 * More accurate for oil-water mixtures than linear mixing
 * 
 * Reference: Arrhenius, S. (1887)
 */
export function mixtureViscosityArrhenius(
  waterFraction: number,
  oilFraction: number,
  waterViscosity: number,
  oilViscosity: number
): number {
  const lnMuMix = waterFraction * Math.log(waterViscosity) + 
                  oilFraction * Math.log(oilViscosity);
  return Math.exp(lnMuMix);
}

/**
 * Emulsion Viscosity - Pal-Rhodes Model
 * 
 * For dispersed systems, accounts for droplet interactions
 * 
 * μ_r = [1 + (1.25 × μ_d)/(μ_d + μ_c)]^(2.5φ/(1-φ/φ_m))
 * 
 * Reference: Pal, R. & Rhodes, E. (1989) J. Rheology
 */
export function emulsionViscosityPalRhodes(
  continuousViscosity: number,
  dispersedViscosity: number,
  dispersedFraction: number,
  maxPacking: number = 0.74        // Random close packing
): number {
  const phi = dispersedFraction;
  const phi_m = maxPacking;
  
  const K = 1.25 * dispersedViscosity / (dispersedViscosity + continuousViscosity);
  const exponent = (2.5 * phi) / (1 - phi / phi_m);
  
  const relativeViscosity = Math.pow(1 + K, exponent);
  return continuousViscosity * relativeViscosity;
}

// =============================================================================
// PARTICLE/DROPLET SETTLING - STOKES LAW AND EXTENSIONS
// =============================================================================

/**
 * STOKES LAW - Terminal Settling Velocity
 * 
 * v_t = (g × d² × Δρ) / (18 × μ)
 * 
 * Assumptions:
 * - Re_p < 0.1 (creeping flow)
 * - Spherical particles
 * - Infinite fluid extent
 * - No particle interaction
 * - Rigid sphere (no internal circulation)
 * 
 * Reference: Stokes, G.G. (1851) Trans. Cambridge Phil. Soc., 9, 8-106
 */
export function stokesVelocity(
  diameter: number,           // m
  particleDensity: number,    // kg/m³
  fluidDensity: number,       // kg/m³
  fluidViscosity: number      // Pa·s
): number {
  const d = diameter;
  const deltaRho = Math.abs(particleDensity - fluidDensity);
  
  const vt = (CONSTANTS.g * Math.pow(d, 2) * deltaRho) / (18 * fluidViscosity);
  return vt;
}

/**
 * Hadamard-Rybczynski Correction for Fluid Droplets
 * 
 * Accounts for internal circulation within fluid droplets
 * 
 * v_HR = v_Stokes × (μ_c + μ_d) / (μ_c + 1.5×μ_d)
 * 
 * For gas bubbles: v_HR ≈ 1.5 × v_Stokes
 * For rigid spheres: v_HR = v_Stokes
 * 
 * Reference: Hadamard, J. (1911); Rybczynski, W. (1911)
 */
export function hadamardRybczynskiVelocity(
  stokesVelocity: number,
  continuousViscosity: number,
  dispersedViscosity: number
): number {
  const correction = (continuousViscosity + dispersedViscosity) / 
                     (continuousViscosity + 1.5 * dispersedViscosity);
  return stokesVelocity * correction;
}

/**
 * Calculate Particle Reynolds Number
 * 
 * Re_p = (ρ_f × v × d) / μ
 */
export function particleReynolds(
  velocity: number,
  diameter: number,
  fluidDensity: number,
  fluidViscosity: number
): number {
  return (fluidDensity * velocity * diameter) / fluidViscosity;
}

/**
 * Oseen Correction for Higher Reynolds Numbers
 * 
 * Valid for 0.1 < Re < 1
 * 
 * C_D = (24/Re) × (1 + 3×Re/16)
 * 
 * Reference: Oseen, C.W. (1910) Ark. Mat. Astron. Fys., 6, 29
 */
export function oseenDragCoefficient(Re: number): number {
  return (24 / Re) * (1 + 3 * Re / 16);
}

/**
 * Schiller-Naumann Drag Correlation
 * 
 * Valid for 0.1 < Re < 1000
 * 
 * C_D = (24/Re) × (1 + 0.15 × Re^0.687)
 * 
 * Reference: Schiller, L. & Naumann, A. (1935)
 */
export function schillerNaumannDrag(Re: number): number {
  return (24 / Re) * (1 + 0.15 * Math.pow(Re, 0.687));
}

/**
 * General Drag Correlation - All Regimes
 * 
 * Automatically selects appropriate correlation based on Re
 * 
 * Returns: { Cd: number, regime: string, velocity: number }
 */
export function generalSettlingVelocity(
  diameter: number,
  particleDensity: number,
  fluidDensity: number,
  fluidViscosity: number
): { velocity: number; Re: number; Cd: number; regime: string } {
  // Start with Stokes velocity as initial guess
  let v = stokesVelocity(diameter, particleDensity, fluidDensity, fluidViscosity);
  let Re = particleReynolds(v, diameter, fluidDensity, fluidViscosity);
  let Cd: number;
  let regime: string;
  
  // Iterate to find consistent velocity
  const maxIterations = 20;
  const tolerance = 1e-6;
  
  for (let i = 0; i < maxIterations; i++) {
    const vOld = v;
    
    if (Re < CONSTANTS.STOKES_REGIME_LIMIT) {
      // Stokes regime
      Cd = 24 / Re;
      regime = 'Stokes (creeping flow)';
      v = stokesVelocity(diameter, particleDensity, fluidDensity, fluidViscosity);
    } else if (Re < 1) {
      // Oseen regime
      Cd = oseenDragCoefficient(Re);
      regime = 'Oseen (low inertia)';
    } else if (Re < CONSTANTS.INTERMEDIATE_RE_LIMIT) {
      // Intermediate regime - Schiller-Naumann
      Cd = schillerNaumannDrag(Re);
      regime = 'Intermediate (Schiller-Naumann)';
    } else if (Re < CONSTANTS.NEWTON_RE_LIMIT) {
      // Newton regime
      Cd = 0.44;
      regime = 'Newton (turbulent)';
    } else {
      // Drag crisis / supercritical
      Cd = 0.1;
      regime = 'Supercritical';
    }
    
    // Calculate velocity from drag coefficient
    if (Re >= CONSTANTS.STOKES_REGIME_LIMIT) {
      const deltaRho = Math.abs(particleDensity - fluidDensity);
      v = Math.sqrt((4 * diameter * deltaRho * CONSTANTS.g) / (3 * Cd * fluidDensity));
    }
    
    Re = particleReynolds(v, diameter, fluidDensity, fluidViscosity);
    
    if (Math.abs(v - vOld) / v < tolerance) {
      break;
    }
  }
  
  return { velocity: v, Re, Cd: Cd!, regime: regime! };
}

// =============================================================================
// HINDERED SETTLING
// =============================================================================

/**
 * Richardson-Zaki Hindered Settling Correlation
 * 
 * v_h = v_t × ε^n
 * 
 * where:
 *   ε = voidage (1 - particle concentration)
 *   n = Richardson-Zaki exponent
 * 
 * For Re_t < 0.2:  n = 4.65
 * For Re_t < 1:    n = 4.35 × Re_t^(-0.03)
 * For Re_t < 500:  n = 4.45 × Re_t^(-0.1)
 * For Re_t > 500:  n = 2.39
 * 
 * Reference: Richardson, J.F. & Zaki, W.N. (1954) Trans. IChemE, 32, 35-53
 */
export function richardsonZakiExponent(Re_terminal: number): number {
  if (Re_terminal < 0.2) {
    return 4.65;
  } else if (Re_terminal < 1) {
    return 4.35 * Math.pow(Re_terminal, -0.03);
  } else if (Re_terminal < 500) {
    return 4.45 * Math.pow(Re_terminal, -0.1);
  } else {
    return 2.39;
  }
}

export function hinderedSettlingVelocity(
  terminalVelocity: number,
  voidage: number,            // ε = 1 - φ, where φ is particle volume fraction
  Re_terminal: number
): number {
  const n = richardsonZakiExponent(Re_terminal);
  return terminalVelocity * Math.pow(voidage, n);
}

/**
 * Batch Settling - Kynch Theory
 * 
 * Predicts settling behavior in batch operations
 * 
 * Reference: Kynch, G.J. (1952) Trans. Faraday Soc., 48, 166-176
 */
export interface BatchSettlingProfile {
  time: number;               // hours
  clarifiedHeight: number;    // m (clear liquid above)
  interfaceHeight: number;    // m (settling interface)
  sedimentHeight: number;     // m (compacted sediment)
  
  clarifiedVolume: number;    // m³
  concentrateVolume: number;  // m³
  
  settlingVelocity: number;   // m/s (current interface velocity)
}

export function batchSettlingKynch(
  initialHeight: number,      // m
  initialConcentration: number, // volume fraction
  terminalVelocity: number,   // m/s
  particleDensity: number,
  fluidDensity: number,
  fluidViscosity: number,
  diameter: number,
  timeHours: number,
  tankDiameter: number
): BatchSettlingProfile {
  const dt = timeHours * 3600; // seconds
  
  // Calculate hindered settling velocity
  const voidage = 1 - initialConcentration;
  const Re_t = particleReynolds(terminalVelocity, diameter, fluidDensity, fluidViscosity);
  const vh = hinderedSettlingVelocity(terminalVelocity, voidage, Re_t);
  
  // Interface descent
  const interfaceDescent = vh * dt;
  const currentInterfaceHeight = Math.max(0, initialHeight - interfaceDescent);
  
  // Clear layer growth
  const clarifiedHeight = initialHeight - currentInterfaceHeight;
  
  // Sediment compression (simplified model)
  const maxConcentration = 0.64; // Random close packing
  const sedimentHeight = (initialHeight * initialConcentration) / maxConcentration;
  
  // Tank cross-sectional area
  const area = Math.PI * Math.pow(tankDiameter / 2, 2);
  
  return {
    time: timeHours,
    clarifiedHeight,
    interfaceHeight: currentInterfaceHeight,
    sedimentHeight: Math.min(sedimentHeight, currentInterfaceHeight),
    clarifiedVolume: clarifiedHeight * area,
    concentrateVolume: currentInterfaceHeight * area,
    settlingVelocity: vh
  };
}

// =============================================================================
// API SEPARATOR DESIGN
// =============================================================================

/**
 * API Separator Design Calculations
 * 
 * Based on API Publication 421 (2012)
 * 
 * Key design criteria:
 * - Horizontal velocity < 15 × v_rise (to prevent re-entrainment)
 * - Typical design droplet: 150 μm
 * - L:W ratio: typically 5:1 to 10:1
 * - Depth: typically 1.5 - 3 m
 */
export interface APISeparatorDesign {
  // Input parameters
  designFlow: number;           // m³/hr
  designTemperature: number;    // °C
  oilDensity: number;           // kg/m³
  designDropletSize: number;    // m
  targetRemoval: number;        // fraction (0-1)
  
  // Calculated fluid properties
  waterDensity: number;
  waterViscosity: number;
  deltaDensity: number;
  
  // Stokes velocity
  riseVelocity: number;         // m/s
  Re_droplet: number;
  
  // Sizing
  minimumSurfaceArea: number;   // m²
  recommendedLength: number;    // m
  recommendedWidth: number;     // m
  recommendedDepth: number;     // m
  actualSurfaceArea: number;    // m²
  actualVolume: number;         // m³
  
  // Performance parameters
  horizontalVelocity: number;   // m/s
  hydraulicLoading: number;     // m³/m²/hr
  retentionTime: number;        // minutes
  velocityRatio: number;        // v_h / v_rise (should be < 15)
  
  // Expected performance
  expectedRemoval: number;      // fraction
  expectedEffluentOil: number;  // mg/L
}

export function designAPISeparator(
  flowRate: number,             // m³/hr
  temperature: number,          // °C
  oilDensity: number,           // kg/m³
  inletOilConcentration: number, // mg/L
  dropletSize: number = 150e-6, // m
  LWratio: number = 6           // Length:Width
): APISeparatorDesign {
  // Calculate fluid properties
  const waterDensity = waterDensityKell(temperature);
  const waterViscosity = waterViscosityVogel(temperature);
  const deltaDensity = waterDensity - oilDensity;
  
  // Calculate rise velocity using Stokes
  const vRise = stokesVelocity(dropletSize, oilDensity, waterDensity, waterViscosity);
  const Re_droplet = particleReynolds(vRise, dropletSize, waterDensity, waterViscosity);
  
  // Required surface area: A = Q / v_rise
  const Q_m3s = flowRate / 3600;
  const minArea = Q_m3s / vRise;
  
  // Apply safety factor (1.5x)
  const designArea = minArea * 1.5;
  
  // Calculate dimensions
  const width = Math.sqrt(designArea / LWratio);
  const length = width * LWratio;
  const depth = 2.0; // Standard depth
  
  const actualArea = length * width;
  const actualVolume = actualArea * depth;
  
  // Calculate performance parameters
  const crossSection = width * depth;
  const horizontalVelocity = Q_m3s / crossSection;
  const hydraulicLoading = flowRate / actualArea;
  const retentionTime = actualVolume / Q_m3s / 60; // minutes
  const velocityRatio = horizontalVelocity / vRise;
  
  // Expected removal efficiency
  // Simplified: based on ratio of actual to required area
  const removalEfficiency = Math.min(0.99, 1 - Math.exp(-actualArea / minArea));
  const effluentOil = inletOilConcentration * (1 - removalEfficiency);
  
  return {
    designFlow: flowRate,
    designTemperature: temperature,
    oilDensity,
    designDropletSize: dropletSize,
    targetRemoval: 0.95,
    
    waterDensity,
    waterViscosity,
    deltaDensity,
    
    riseVelocity: vRise,
    Re_droplet,
    
    minimumSurfaceArea: minArea,
    recommendedLength: length,
    recommendedWidth: width,
    recommendedDepth: depth,
    actualSurfaceArea: actualArea,
    actualVolume,
    
    horizontalVelocity,
    hydraulicLoading,
    retentionTime,
    velocityRatio,
    
    expectedRemoval: removalEfficiency,
    expectedEffluentOil: effluentOil
  };
}

// =============================================================================
// CENTRIFUGE CALCULATIONS
// =============================================================================

/**
 * Centrifuge G-Force Calculation
 * 
 * G = ω² × r / g = (2πN/60)² × r / g
 * 
 * where N = RPM, r = radius (m)
 */
export function centrifugeGForce(rpm: number, radiusM: number): number {
  const omega = (2 * Math.PI * rpm) / 60;
  return (Math.pow(omega, 2) * radiusM) / CONSTANTS.g;
}

/**
 * Sigma Factor for Centrifuge Scale-Up
 * 
 * Σ = (2π × L × ω² × (r₂³ - r₁³)) / (3 × g × ln(r₂/r₁))
 * 
 * For bowl centrifuges
 * 
 * Reference: Stokes Equivalent Settling Area
 */
export function sigmaFactor(
  length: number,               // m
  rpm: number,
  innerRadius: number,          // m
  outerRadius: number           // m
): number {
  const omega = (2 * Math.PI * rpm) / 60;
  const r1 = innerRadius;
  const r2 = outerRadius;
  
  const numerator = 2 * Math.PI * length * Math.pow(omega, 2) * 
                    (Math.pow(r2, 3) - Math.pow(r1, 3));
  const denominator = 3 * CONSTANTS.g * Math.log(r2 / r1);
  
  return numerator / denominator;
}

/**
 * Centrifuge Capacity
 * 
 * Q = Σ × 2 × v_s
 * 
 * where v_s = Stokes settling velocity
 */
export function centrifugeCapacity(
  sigma: number,
  stokesVelocity: number
): number {
  return sigma * 2 * stokesVelocity * 3600; // m³/hr
}

// =============================================================================
// HEAT TRANSFER
// =============================================================================

/**
 * Heating Duty Calculation
 * 
 * Q = ṁ × Cp × ΔT
 */
export function heatingDuty(
  massFlowRate: number,         // kg/s
  specificHeat: number,         // J/kg·K
  temperatureRise: number       // °C or K
): number {
  return massFlowRate * specificHeat * temperatureRise; // Watts
}

/**
 * Tank Heat Loss - Cylindrical Surface
 * 
 * Q_loss = U × A × (T_tank - T_ambient)
 * 
 * U = overall heat transfer coefficient
 * A = surface area
 */
export interface TankHeatLoss {
  surfaceArea: number;          // m²
  heatLoss: number;             // kW
  overallU: number;             // W/m²·K
  heatLossPerHour: number;      // kWh
  coolingRate: number;          // °C/hr
}

export function tankHeatLoss(
  diameter: number,
  height: number,
  tankTemp: number,
  ambientTemp: number,
  volume: number,
  fluidDensity: number,
  fluidCp: number,
  insulated: boolean = false,
  insulationThickness: number = 0.05
): TankHeatLoss {
  // Surface area (cylinder + top)
  const sidewallArea = Math.PI * diameter * height;
  const topArea = Math.PI * Math.pow(diameter / 2, 2);
  const surfaceArea = sidewallArea + topArea;
  
  // Overall heat transfer coefficient
  let U: number;
  if (insulated) {
    // Insulated tank: U ≈ 0.5 - 1 W/m²·K
    const kInsulation = 0.04; // W/m·K for mineral wool
    U = kInsulation / insulationThickness;
  } else {
    // Uninsulated steel tank: U ≈ 5-10 W/m²·K
    U = 8;
  }
  
  const deltaT = tankTemp - ambientTemp;
  const heatLossW = U * surfaceArea * deltaT;
  const heatLossKW = heatLossW / 1000;
  
  // Cooling rate
  const mass = volume * fluidDensity;
  const coolingRate = (heatLossW / (mass * fluidCp)) * 3600; // °C/hr
  
  return {
    surfaceArea,
    heatLoss: heatLossKW,
    overallU: U,
    heatLossPerHour: heatLossKW,
    coolingRate
  };
}

// =============================================================================
// PUMP CALCULATIONS
// =============================================================================

/**
 * Pump Hydraulic Power
 * 
 * P_h = ρ × g × Q × H
 */
export function pumpHydraulicPower(
  flowRate: number,             // m³/s
  head: number,                 // m
  fluidDensity: number          // kg/m³
): number {
  return fluidDensity * CONSTANTS.g * flowRate * head; // Watts
}

/**
 * Pump Shaft Power
 * 
 * P_shaft = P_hydraulic / η_pump
 */
export function pumpShaftPower(
  hydraulicPower: number,
  efficiency: number
): number {
  return hydraulicPower / efficiency;
}

/**
 * Pump Efficiency Estimation
 * 
 * Based on specific speed correlation
 */
export function estimatePumpEfficiency(
  flowRate: number,             // m³/hr
  head: number                  // m
): number {
  // Specific speed (metric)
  const Q = flowRate / 3600;    // m³/s
  const ns = (Math.sqrt(Q) * 1000) / Math.pow(head, 0.75);
  
  // Efficiency correlation (simplified)
  // Peak efficiency around ns = 50-150
  if (flowRate < 5) {
    return 0.45;
  } else if (flowRate < 20) {
    return 0.55;
  } else if (flowRate < 50) {
    return 0.65 + (flowRate - 20) * 0.003;
  } else {
    return Math.min(0.85, 0.75 + (flowRate - 50) * 0.001);
  }
}

/**
 * Pump Affinity Laws
 * 
 * For speed changes:
 * Q₂/Q₁ = N₂/N₁
 * H₂/H₁ = (N₂/N₁)²
 * P₂/P₁ = (N₂/N₁)³
 */
export function pumpAffinityLaws(
  flow1: number,
  head1: number,
  power1: number,
  speed1: number,
  speed2: number
): { flow: number; head: number; power: number } {
  const ratio = speed2 / speed1;
  return {
    flow: flow1 * ratio,
    head: head1 * Math.pow(ratio, 2),
    power: power1 * Math.pow(ratio, 3)
  };
}

/**
 * NPSH Calculation
 * 
 * NPSH_a = P_atm/ρg + z_s - H_f - P_v/ρg
 */
export function npshAvailable(
  atmosphericPressure: number,  // Pa
  suctionStaticHead: number,    // m (positive if below, negative if above)
  frictionLoss: number,         // m
  vaporPressure: number,        // Pa
  fluidDensity: number          // kg/m³
): number {
  const pAtmHead = atmosphericPressure / (fluidDensity * CONSTANTS.g);
  const pvHead = vaporPressure / (fluidDensity * CONSTANTS.g);
  
  return pAtmHead + suctionStaticHead - frictionLoss - pvHead;
}

// =============================================================================
// PIPE FLOW CALCULATIONS
// =============================================================================

/**
 * Reynolds Number for Pipe Flow
 * 
 * Re = (ρ × v × D) / μ = (4 × Q) / (π × D × ν)
 */
export function pipeReynolds(
  flowRate: number,             // m³/s
  diameter: number,             // m
  fluidDensity: number,         // kg/m³
  fluidViscosity: number        // Pa·s
): number {
  const velocity = (4 * flowRate) / (Math.PI * Math.pow(diameter, 2));
  return (fluidDensity * velocity * diameter) / fluidViscosity;
}

/**
 * Friction Factor - Colebrook-White (implicit)
 * 
 * For Re > 4000:
 * 1/√f = -2 log₁₀(ε/3.7D + 2.51/(Re√f))
 * 
 * Reference: Colebrook, C.F. (1939)
 */
export function frictionFactorColebrook(
  Re: number,
  roughness: number,            // m
  diameter: number              // m
): number {
  if (Re < 2300) {
    // Laminar flow
    return 64 / Re;
  } else if (Re < 4000) {
    // Transitional - interpolate
    return 0.03;
  }
  
  // Iterative solution for turbulent flow
  const relativeRoughness = roughness / diameter;
  let f = 0.02; // Initial guess
  
  for (let i = 0; i < 20; i++) {
    const fOld = f;
    const term1 = relativeRoughness / 3.7;
    const term2 = 2.51 / (Re * Math.sqrt(f));
    f = Math.pow(-2 * Math.log10(term1 + term2), -2);
    
    if (Math.abs(f - fOld) / f < 1e-6) break;
  }
  
  return f;
}

/**
 * Swamee-Jain Explicit Friction Factor
 * 
 * More convenient for calculations, accuracy within 1%
 * 
 * Reference: Swamee, P.K. & Jain, A.K. (1976)
 */
export function frictionFactorSwameeJain(
  Re: number,
  roughness: number,
  diameter: number
): number {
  if (Re < 2300) {
    return 64 / Re;
  }
  
  const eps_D = roughness / diameter;
  const f = 0.25 / Math.pow(
    Math.log10(eps_D/3.7 + 5.74/Math.pow(Re, 0.9)),
    2
  );
  
  return f;
}

/**
 * Head Loss - Darcy-Weisbach Equation
 * 
 * h_f = f × (L/D) × (v²/2g)
 */
export function darcyWeisbachHeadLoss(
  frictionFactor: number,
  length: number,               // m
  diameter: number,             // m
  velocity: number              // m/s
): number {
  return frictionFactor * (length / diameter) * Math.pow(velocity, 2) / (2 * CONSTANTS.g);
}

// =============================================================================
// MASS BALANCE
// =============================================================================

export interface MassBalanceStream {
  name: string;
  massFlow: number;             // kg/hr
  volumeFlow: number;           // m³/hr
  waterMass: number;            // kg/hr
  oilMass: number;              // kg/hr
  solidsMass: number;           // kg/hr
}

export interface MassBalanceResult {
  inlet: MassBalanceStream;
  outlets: MassBalanceStream[];
  totalIn: number;              // kg/hr
  totalOut: number;             // kg/hr
  closure: number;              // %
  accumulation: number;         // kg/hr
}

export function calculateMassBalance(
  inletFlow: number,            // m³/hr
  waterFraction: number,
  oilFraction: number,
  solidsFraction: number,
  waterDensity: number,
  oilDensity: number,
  solidsDensity: number,
  recoveries: {
    oilToProduct: number;       // fraction
    waterToEffluent: number;    // fraction
    solidsToSludge: number;     // fraction
  }
): MassBalanceResult {
  // Inlet stream
  const inletWater = inletFlow * waterFraction * waterDensity;
  const inletOil = inletFlow * oilFraction * oilDensity;
  const inletSolids = inletFlow * solidsFraction * solidsDensity;
  const totalIn = inletWater + inletOil + inletSolids;
  
  // Oil product stream
  const oilProductOil = inletOil * recoveries.oilToProduct;
  const oilProductWater = oilProductOil * 0.03; // 3% BS&W target
  const oilProductTotal = oilProductOil + oilProductWater;
  
  // Treated water stream
  const effluentWater = inletWater * recoveries.waterToEffluent - oilProductWater;
  const effluentOil = inletOil * (1 - recoveries.oilToProduct) * 0.1;
  const effluentTotal = effluentWater + effluentOil;
  
  // Sludge stream
  const sludgeSolids = inletSolids * recoveries.solidsToSludge;
  const sludgeWater = sludgeSolids * 0.7; // 70% moisture
  const sludgeOil = inletOil * (1 - recoveries.oilToProduct) * 0.5;
  const sludgeTotal = sludgeSolids + sludgeWater + sludgeOil;
  
  // Totals
  const totalOut = oilProductTotal + effluentTotal + sludgeTotal;
  const closure = (totalOut / totalIn) * 100;
  
  return {
    inlet: {
      name: 'Infeed',
      massFlow: totalIn,
      volumeFlow: inletFlow,
      waterMass: inletWater,
      oilMass: inletOil,
      solidsMass: inletSolids
    },
    outlets: [
      {
        name: 'Oil Product',
        massFlow: oilProductTotal,
        volumeFlow: oilProductTotal / oilDensity,
        waterMass: oilProductWater,
        oilMass: oilProductOil,
        solidsMass: 0
      },
      {
        name: 'Treated Water',
        massFlow: effluentTotal,
        volumeFlow: effluentWater / waterDensity,
        waterMass: effluentWater,
        oilMass: effluentOil,
        solidsMass: 0
      },
      {
        name: 'Sludge',
        massFlow: sludgeTotal,
        volumeFlow: sludgeTotal / 1500,
        waterMass: sludgeWater,
        oilMass: sludgeOil,
        solidsMass: sludgeSolids
      }
    ],
    totalIn,
    totalOut,
    closure,
    accumulation: totalIn - totalOut
  };
}

// =============================================================================
// EXPORT UTILITY FUNCTIONS
// =============================================================================

export function formatScientific(value: number, decimals: number = 3): string {
  if (Math.abs(value) < 0.001 || Math.abs(value) > 10000) {
    return value.toExponential(decimals);
  }
  return value.toFixed(decimals);
}

export function celsiusToKelvin(celsius: number): number {
  return celsius + 273.15;
}

export function kelvinToCelsius(kelvin: number): number {
  return kelvin - 273.15;
}

export function cStToPaS(cSt: number, density: number): number {
  // Convert kinematic (cSt) to dynamic viscosity (Pa·s)
  // ν = μ/ρ, so μ = ν × ρ
  return (cSt * 1e-6) * density;
}

export function paSTocSt(paS: number, density: number): number {
  return (paS / density) * 1e6;
}
