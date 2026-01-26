/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CENTRIFUGE PHYSICS MODEL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Physics-based calculations with explicit labeling of data sources.
 * Every value indicates whether it is MEASURED, MODELED, or ESTIMATED.
 *
 * Equipment: SACOR Delta-Canter 20-843A
 *
 * @standard API RP 13C, Stokes Law, Richardson-Zaki
 */

export type DataSource =
  | 'MEASURED'      // Direct measurement (sensor)
  | 'CALCULATED'    // Derived from measured values via physics
  | 'MODELED'       // From empirical correlation or model
  | 'ESTIMATED'     // Engineering estimate, may not reflect reality
  | 'ASSUMED'       // Assumed constant or default
  | 'UNKNOWN';      // Source not established

export interface LabeledValue {
  value: number;
  unit: string;
  source: DataSource;
  confidence: number;     // 0-100%
  basis: string;          // Explanation of how value was determined
  timestamp?: number;
  sensorTag?: string;     // If measured, which sensor
}

export interface CentrifugeGeometry {
  bowlRadius: LabeledValue;         // m
  bowlLength: LabeledValue;         // m
  beachLength: LabeledValue;        // m
  clarifierLength: LabeledValue;    // m
  halfConeAngle: LabeledValue;      // degrees
  pondDepth: LabeledValue;          // mm
  weirDiameter: LabeledValue;       // m
}

export interface FluidProperties {
  density: LabeledValue;            // kg/m³
  viscosity: LabeledValue;          // Pa·s
  temperature: LabeledValue;        // °C
  solidsContent: LabeledValue;      // wt%
  oilContent: LabeledValue;         // wt%
}

export interface ParticleProperties {
  d50: LabeledValue;                // µm (median particle size)
  d10: LabeledValue;                // µm (10th percentile)
  d90: LabeledValue;                // µm (90th percentile)
  particleDensity: LabeledValue;    // kg/m³
  sphericity: LabeledValue;         // dimensionless
}

export interface OperatingConditions {
  bowlSpeed: LabeledValue;          // RPM
  differentialSpeed: LabeledValue;  // RPM
  feedRate: LabeledValue;           // m³/hr
  polymerDose: LabeledValue;        // mg/L
}

export interface SeparationResults {
  gForce: LabeledValue;             // g
  sigma: LabeledValue;              // m² (equivalent area)
  residenceTime: LabeledValue;      // s
  criticalParticleSize: LabeledValue; // µm
  solidsRemoval: LabeledValue;      // %
  oilRemoval: LabeledValue;         // %
  cakeMoisture: LabeledValue;       // %
  centrateClarity: LabeledValue;    // NTU
  throughputFactor: LabeledValue;   // dimensionless
}

// SACOR Delta-Canter 20-843A Nameplate Data
const EQUIPMENT_GEOMETRY: CentrifugeGeometry = {
  bowlRadius: { value: 0.250, unit: 'm', source: 'MEASURED', confidence: 100, basis: 'Nameplate data' },
  bowlLength: { value: 1.200, unit: 'm', source: 'MEASURED', confidence: 100, basis: 'Nameplate data' },
  beachLength: { value: 0.400, unit: 'm', source: 'MEASURED', confidence: 100, basis: 'Nameplate data' },
  clarifierLength: { value: 0.800, unit: 'm', source: 'CALCULATED', confidence: 95, basis: 'Bowl length - beach length' },
  halfConeAngle: { value: 8.5, unit: 'deg', source: 'MEASURED', confidence: 100, basis: 'Nameplate data' },
  pondDepth: { value: 130, unit: 'mm', source: 'ASSUMED', confidence: 80, basis: 'Typical operating point' },
  weirDiameter: { value: 0.440, unit: 'm', source: 'MEASURED', confidence: 100, basis: 'Nameplate data' },
};

/**
 * Create a labeled value
 */
export function createLabeledValue(
  value: number,
  unit: string,
  source: DataSource,
  confidence: number,
  basis: string,
  sensorTag?: string
): LabeledValue {
  return {
    value,
    unit,
    source,
    confidence,
    basis,
    timestamp: Date.now(),
    sensorTag,
  };
}

/**
 * Calculate g-force from RPM
 *
 * Physics: a = ω²r where ω = 2πN/60
 * g = a/9.81 = (2πN/60)² × r / 9.81
 */
export function calculateGForce(
  rpm: LabeledValue,
  radius: LabeledValue = EQUIPMENT_GEOMETRY.bowlRadius
): LabeledValue {
  const omega = (2 * Math.PI * rpm.value) / 60;
  const acceleration = omega * omega * radius.value;
  const gForce = acceleration / 9.81;

  // Confidence is min of inputs
  const confidence = Math.min(rpm.confidence, radius.confidence);

  return {
    value: gForce,
    unit: 'g',
    source: 'CALCULATED',
    confidence,
    basis: `g = (2πN/60)² × r / 9.81, N=${rpm.value} RPM, r=${radius.value}m`,
    timestamp: Date.now(),
  };
}

/**
 * Calculate equivalent settling area (Sigma)
 *
 * Sigma = 2π × ω² × L × (r₁³ - r₂³) / (3g)
 *
 * For a decanter: Sigma ≈ π × ω² × L × r² / g
 */
export function calculateSigma(
  rpm: LabeledValue,
  geometry: CentrifugeGeometry = EQUIPMENT_GEOMETRY
): LabeledValue {
  const omega = (2 * Math.PI * rpm.value) / 60;
  const g = 9.81;

  // Outer radius at weir
  const r1 = geometry.bowlRadius.value;
  // Inner radius (liquid surface)
  const pondDepthM = geometry.pondDepth.value / 1000;
  const r2 = r1 - pondDepthM;

  // Effective length for clarification
  const L = geometry.clarifierLength.value;

  // Sigma calculation
  const sigma = (2 * Math.PI * omega * omega * L * (r1 * r1 * r1 - r2 * r2 * r2)) / (3 * g);

  const confidence = Math.min(
    rpm.confidence,
    geometry.bowlRadius.confidence,
    geometry.clarifierLength.confidence,
    geometry.pondDepth.confidence
  ) * 0.9; // Model uncertainty

  return {
    value: sigma,
    unit: 'm²',
    source: 'MODELED',
    confidence,
    basis: 'Sigma = 2π × ω² × L × (r₁³ - r₂³) / (3g)',
    timestamp: Date.now(),
  };
}

/**
 * Calculate residence time in clarifier zone
 */
export function calculateResidenceTime(
  feedRate: LabeledValue,
  geometry: CentrifugeGeometry = EQUIPMENT_GEOMETRY
): LabeledValue {
  const flowRateM3s = feedRate.value / 3600; // Convert m³/hr to m³/s

  // Volume of clarifier zone (annular cylinder)
  const r1 = geometry.bowlRadius.value;
  const pondDepthM = geometry.pondDepth.value / 1000;
  const r2 = r1 - pondDepthM;
  const L = geometry.clarifierLength.value;
  const volume = Math.PI * (r1 * r1 - r2 * r2) * L;

  const residenceTime = flowRateM3s > 0 ? volume / flowRateM3s : 0;

  const confidence = Math.min(
    feedRate.confidence,
    geometry.bowlRadius.confidence,
    geometry.clarifierLength.confidence,
    geometry.pondDepth.confidence
  );

  return {
    value: residenceTime,
    unit: 's',
    source: 'CALCULATED',
    confidence,
    basis: 'τ = V / Q, V = π(r₁² - r₂²)L',
    timestamp: Date.now(),
  };
}

/**
 * Calculate critical particle size using Stokes law
 *
 * d_c = √(18μQ / (ρ_s - ρ_l) × Sigma)
 *
 * Particles larger than d_c will settle, smaller will escape
 */
export function calculateCriticalParticleSize(
  feedRate: LabeledValue,
  sigma: LabeledValue,
  fluidProps: FluidProperties,
  particleProps: ParticleProperties
): LabeledValue {
  const Q = feedRate.value / 3600; // m³/s
  const mu = fluidProps.viscosity.value;
  const rhoS = particleProps.particleDensity.value;
  const rhoL = fluidProps.density.value;
  const deltaRho = rhoS - rhoL;

  if (deltaRho <= 0 || sigma.value <= 0 || Q <= 0) {
    return {
      value: 0,
      unit: 'µm',
      source: 'CALCULATED',
      confidence: 0,
      basis: 'Invalid inputs for Stokes calculation',
      timestamp: Date.now(),
    };
  }

  // Stokes critical diameter
  const d_c_m = Math.sqrt((18 * mu * Q) / (deltaRho * sigma.value));
  const d_c_um = d_c_m * 1e6; // Convert to µm

  const confidence = Math.min(
    feedRate.confidence,
    sigma.confidence,
    fluidProps.viscosity.confidence,
    fluidProps.density.confidence,
    particleProps.particleDensity.confidence
  ) * 0.85; // Stokes law is idealized

  return {
    value: d_c_um,
    unit: 'µm',
    source: 'MODELED',
    confidence,
    basis: 'd_c = √(18μQ / (Δρ × Σ)) - Stokes law, assumes spherical particles',
    timestamp: Date.now(),
  };
}

/**
 * Calculate theoretical solids removal efficiency
 *
 * Based on particle size distribution vs critical size
 * E = % of particles with d > d_critical
 */
export function calculateSolidsRemoval(
  criticalSize: LabeledValue,
  particleProps: ParticleProperties
): LabeledValue {
  const d_c = criticalSize.value;
  const d50 = particleProps.d50.value;

  // Log-normal distribution assumption
  // Using spread from d10/d90 ratio
  const sigma_g = Math.log(particleProps.d90.value / particleProps.d10.value) / (2 * 1.28);

  // Probability that d > d_c using log-normal CDF
  const z = (Math.log(d_c) - Math.log(d50)) / sigma_g;
  const removalFraction = 0.5 * (1 - erf(z / Math.sqrt(2)));
  const removalPercent = removalFraction * 100;

  // Cap at realistic values
  const cappedRemoval = Math.min(99.5, Math.max(0, removalPercent));

  const confidence = Math.min(
    criticalSize.confidence,
    particleProps.d50.confidence,
    particleProps.d10.confidence,
    particleProps.d90.confidence
  ) * 0.8; // Distribution assumption uncertainty

  return {
    value: cappedRemoval,
    unit: '%',
    source: 'MODELED',
    confidence,
    basis: 'Log-normal PSD integration above critical size - THEORETICAL ONLY',
    timestamp: Date.now(),
  };
}

/**
 * Error function approximation
 */
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

/**
 * Calculate viscosity from temperature
 *
 * Using Arrhenius-type correlation for water-based sludge
 */
export function calculateViscosity(
  temperature: LabeledValue,
  solidsContent: LabeledValue
): LabeledValue {
  // Base water viscosity (Arrhenius)
  const T_K = temperature.value + 273.15;
  const mu_water = 2.414e-5 * Math.pow(10, 247.8 / (T_K - 140));

  // Einstein correction for solids (volume fraction)
  const phi = (solidsContent.value / 100) * 0.4; // Approx volume fraction
  const mu_suspension = mu_water * (1 + 2.5 * phi + 6.2 * phi * phi);

  const confidence = Math.min(temperature.confidence, solidsContent.confidence) * 0.75;

  return {
    value: mu_suspension,
    unit: 'Pa·s',
    source: 'MODELED',
    confidence,
    basis: 'Arrhenius + Einstein viscosity model',
    timestamp: Date.now(),
  };
}

/**
 * Calculate cake moisture from operating parameters
 *
 * Empirical correlation based on residence time in beach zone
 */
export function calculateCakeMoisture(
  differential: LabeledValue,
  feedSolids: LabeledValue,
  polymerDose: LabeledValue,
  geometry: CentrifugeGeometry = EQUIPMENT_GEOMETRY
): LabeledValue {
  // Beach residence time (inversely proportional to differential)
  const beachResidence = 60 / Math.max(differential.value, 1); // seconds approx

  // Base moisture from solids content (higher solids = lower initial moisture)
  const baseMoisture = 75 - feedSolids.value * 0.5;

  // Polymer effect (reduces moisture by improving dewatering)
  const polymerEffect = Math.min(10, polymerDose.value * 0.03);

  // Residence time effect (longer = drier)
  const residenceEffect = Math.min(10, beachResidence * 0.15);

  const moisture = Math.max(55, Math.min(80, baseMoisture - polymerEffect - residenceEffect));

  const confidence = Math.min(
    differential.confidence,
    feedSolids.confidence,
    polymerDose.confidence
  ) * 0.7; // High uncertainty in empirical correlation

  return {
    value: moisture,
    unit: '%',
    source: 'ESTIMATED',
    confidence,
    basis: 'Empirical correlation - HIGH UNCERTAINTY, validate against lab data',
    timestamp: Date.now(),
  };
}

/**
 * Calculate all separation results
 */
export function calculateSeparation(
  operating: OperatingConditions,
  fluidProps: FluidProperties,
  particleProps: ParticleProperties,
  geometry: CentrifugeGeometry = EQUIPMENT_GEOMETRY
): SeparationResults {
  const gForce = calculateGForce(operating.bowlSpeed, geometry.bowlRadius);
  const sigma = calculateSigma(operating.bowlSpeed, geometry);
  const residenceTime = calculateResidenceTime(operating.feedRate, geometry);

  const viscosity = calculateViscosity(fluidProps.temperature, fluidProps.solidsContent);
  const criticalSize = calculateCriticalParticleSize(
    operating.feedRate,
    sigma,
    { ...fluidProps, viscosity },
    particleProps
  );

  const solidsRemoval = calculateSolidsRemoval(criticalSize, particleProps);
  const cakeMoisture = calculateCakeMoisture(
    operating.differentialSpeed,
    fluidProps.solidsContent,
    operating.polymerDose,
    geometry
  );

  // Oil removal estimate (empirical)
  const oilRemoval = createLabeledValue(
    Math.min(95, gForce.value / 3000 * 90 + 5),
    '%',
    'ESTIMATED',
    50,
    'Empirical estimate based on g-force - requires validation'
  );

  // Centrate clarity (rough estimate)
  const centrateClarity = createLabeledValue(
    100 - solidsRemoval.value * 0.1,
    'NTU',
    'ESTIMATED',
    40,
    'Rough estimate - measure actual centrate'
  );

  // Throughput factor
  const throughputFactor = createLabeledValue(
    operating.feedRate.value / 15 * gForce.value / 3000,
    '',
    'CALCULATED',
    70,
    'Q/Qmax × G/Gmax'
  );

  return {
    gForce,
    sigma,
    residenceTime,
    criticalParticleSize: criticalSize,
    solidsRemoval,
    oilRemoval,
    cakeMoisture,
    centrateClarity,
    throughputFactor,
  };
}

/**
 * Format labeled value for display with source indicator
 */
export function formatLabeledValue(lv: LabeledValue, precision: number = 2): string {
  const sourceIndicator: Record<DataSource, string> = {
    MEASURED: '●',      // Solid circle = measured
    CALCULATED: '◆',    // Diamond = calculated
    MODELED: '■',       // Square = modeled
    ESTIMATED: '○',     // Open circle = estimated
    ASSUMED: '△',       // Triangle = assumed
    UNKNOWN: '?',       // Question mark = unknown
  };

  return `${lv.value.toFixed(precision)} ${lv.unit} ${sourceIndicator[lv.source]} [${lv.confidence.toFixed(0)}%]`;
}

/**
 * Get color for confidence level
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return 'text-green-500';
  if (confidence >= 70) return 'text-yellow-500';
  if (confidence >= 50) return 'text-orange-500';
  return 'text-red-500';
}

/**
 * Get legend for data sources
 */
export function getDataSourceLegend(): { symbol: string; source: DataSource; description: string }[] {
  return [
    { symbol: '●', source: 'MEASURED', description: 'Direct sensor measurement' },
    { symbol: '◆', source: 'CALCULATED', description: 'Derived from measurements via physics' },
    { symbol: '■', source: 'MODELED', description: 'Empirical model or correlation' },
    { symbol: '○', source: 'ESTIMATED', description: 'Engineering estimate - validate!' },
    { symbol: '△', source: 'ASSUMED', description: 'Assumed value or default' },
    { symbol: '?', source: 'UNKNOWN', description: 'Source not established' },
  ];
}
