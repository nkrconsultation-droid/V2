/**
 * KARRATHA WTP - COMPREHENSIVE SIMULATION ENGINE
 * Based on Block Flow Diagrams KA-00X (Sheets 1-3)
 * 
 * Full process simulation with engineering-grade calculations
 */

import type {
  ProcessState,
  TankConfiguration,
  PumpConfiguration,
  APISeparatorConfiguration,
  CentrifugeConfiguration,
  FilterConfiguration,
  HeaterConfiguration,
  ChemicalDosingSystem,
  ManifoldConfiguration,
  EvaporationPond,
  InstrumentConfiguration,
  InterlockConfiguration,
  TransferOperation,
  Alarm,
  ProcessKPIs,
  CostAnalysis,
  SimulationConfig,
  StreamComposition,
  TankPhaseInterface,
  SettlingDynamics,
  RoutePermission,
} from './types-v2';

import {
  waterDensityKell,
  waterViscosityVogel,
  oilDensityTemperature,
  stokesVelocity,
  generalSettlingVelocity,
  hinderedSettlingVelocity,
  richardsonZakiExponent,
  particleReynolds,
  designAPISeparator,
  centrifugeGForce,
  pumpHydraulicPower,
  estimatePumpEfficiency,
  tankHeatLoss,
  CONSTANTS,
} from './engineering-v2';

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

function createDefaultWaterProps() {
  return {
    pH: 7.2,
    conductivity: 2500,
    tds: 1800,
    tss: 500,
    cod: 5000,
    bod: 1500,
    oilAndGrease: 2500,
    tph: 2000,
    chlorides: 500,
    sulphates: 200,
    ammonia: 25,
    phosphate: 5,
    temperature: 35,
  };
}

function createDefaultOilProps() {
  return {
    apiGravity: 28,
    density15C: 880,
    viscosity40C: 45,
    viscosity100C: 8,
    viscosityIndex: 95,
    pourPoint: -15,
    flashPoint: 180,
    waterContent: 3,
    ashContent: 0.8,
    sulphurContent: 0.5,
    acidNumber: 2.5,
    baseNumber: 8,
  };
}

function createDefaultSolidsProps() {
  return {
    particleDensity: 2500,
    bulkDensity: 1400,
    d50: 50,
    moistureContent: 65,
    organicContent: 15,
    oilContent: 20,
    heavyMetals: {
      lead: 25,
      zinc: 150,
      copper: 80,
      chromium: 45,
      nickel: 35,
    },
  };
}

function createDefaultComposition(waterFrac: number, oilFrac: number, solidsFrac: number): StreamComposition {
  return {
    waterFraction: waterFrac,
    oilFraction: oilFrac,
    solidsFraction: solidsFrac,
    waterProps: createDefaultWaterProps(),
    oilProps: createDefaultOilProps(),
    solidsProps: createDefaultSolidsProps(),
    emulsion: null,
  };
}

function createDefaultPhaseInterface(): TankPhaseInterface {
  return {
    oilWaterInterface: 0,
    waterSludgeInterface: 0,
    emulsionBandThickness: 0.1,
    oilLayerThickness: 0,
    waterLayerThickness: 0,
    sludgeLayerThickness: 0,
  };
}

function createDefaultSettling(): SettlingDynamics {
  return {
    stokesVelocity: 0.001,
    hinderedSettlingFactor: 0.8,
    effectiveSettlingVelocity: 0.0008,
    coalescenceRate: 100,
    residenceTime: 2,
    separationEfficiency: 0.85,
  };
}

// =============================================================================
// INITIAL PLANT CONFIGURATION
// =============================================================================

function createInitialTanks(): TankConfiguration[] {
  const tanks: TankConfiguration[] = [];
  
  // Vertical Tanks 1-6 (per BFD Sheet 1)
  for (let i = 1; i <= 6; i++) {
    const service = i <= 2 ? 'mixed_infeed_buffer' : 
                    i <= 4 ? 'water_processing' : 
                    i === 5 ? 'treatment_feed' : 'treated_water';
    
    tanks.push({
      id: `VT-00${i}`,
      name: `Vertical Tank ${i}`,
      type: 'vertical',
      service: service as any,
      capacity: 100,
      diameter: 4.5,
      height: 6.5,
      wallThickness: 8,
      material: 'Carbon Steel',
      nozzles: [
        { id: `VT-00${i}-N1`, position: 'top', elevation: 6.3, size: 150, flangeRating: 'PN16', service: 'inlet' },
        { id: `VT-00${i}-N2`, position: 'bottom', elevation: 0.2, size: 150, flangeRating: 'PN16', service: 'outlet' },
        { id: `VT-00${i}-N3`, position: 'top', elevation: 6.5, size: 50, flangeRating: 'PN16', service: 'vent' },
      ],
      fillMethod: 'top_fill',
      primaryDrawOff: 'bottom',
      currentLevel: 45 + Math.random() * 20,
      currentVolume: 0,
      temperature: 32 + Math.random() * 8,
      pressure: 0,
      composition: createDefaultComposition(0.70, 0.25, 0.05),
      phaseInterface: createDefaultPhaseInterface(),
      settlingDynamics: createDefaultSettling(),
      levelInstrumentation: {
        primaryType: 'radar',
        backupType: 'sight_glass',
        range: { min: 0, max: 100 },
        accuracy: 0.5,
        currentReading: 0,
        LALL: 5,
        LAL: 15,
        LAH: 85,
        LAHH: 95,
        independentHHEnabled: true,
        independentHHSetpoint: 95,
      },
      temperatureInstrumentation: {
        type: 'rtd',
        currentReading: 35,
        alarmHigh: 70,
        alarmLow: 10,
      },
      heating: {
        type: i === 5 ? 'electric_immersion' : 'none',
        dutyRating: i === 5 ? 150 : 0,
        currentDuty: 0,
        setpoint: 65,
        deadband: 2,
        maxTemp: 85,
        enabled: false,
      },
      agitator: {
        type: i <= 4 ? 'propeller' : 'none',
        power: 7.5,
        speed: 45,
        diameter: 1.2,
        numberOfBlades: 3,
        running: false,
        tipSpeed: 2.8,
        reynoldsNumber: 50000,
        powerNumber: 0.35,
      },
      insulated: i === 5,
      insulationType: 'mineral_wool',
      insulationThickness: 50,
    });
  }
  
  // Horizontal Tanks 1-7 (per BFD Sheet 1)
  for (let i = 1; i <= 7; i++) {
    tanks.push({
      id: `HT-00${i}`,
      name: `Horizontal Tank ${i}`,
      type: 'horizontal',
      service: 'oil_storage',
      capacity: 50,
      diameter: 2.8,
      height: 8,
      wallThickness: 6,
      material: 'Carbon Steel',
      nozzles: [
        { id: `HT-00${i}-N1`, position: 'top', elevation: 2.6, size: 100, flangeRating: 'PN16', service: 'inlet' },
        { id: `HT-00${i}-N2`, position: 'bottom', elevation: 0.15, size: 100, flangeRating: 'PN16', service: 'outlet' },
      ],
      fillMethod: 'top_fill',
      primaryDrawOff: 'bottom',
      currentLevel: 30 + Math.random() * 30,
      currentVolume: 0,
      temperature: 30 + Math.random() * 5,
      pressure: 0,
      composition: createDefaultComposition(0.03, 0.95, 0.02),
      phaseInterface: createDefaultPhaseInterface(),
      settlingDynamics: createDefaultSettling(),
      levelInstrumentation: {
        primaryType: 'radar',
        backupType: 'sight_glass',
        range: { min: 0, max: 100 },
        accuracy: 0.5,
        currentReading: 0,
        LALL: 5,
        LAL: 15,
        LAH: 85,
        LAHH: 95,
        independentHHEnabled: true,
        independentHHSetpoint: 95,
      },
      temperatureInstrumentation: {
        type: 'rtd',
        currentReading: 32,
        alarmHigh: 60,
        alarmLow: 10,
      },
      heating: { type: 'none', dutyRating: 0, currentDuty: 0, setpoint: 25, deadband: 2, maxTemp: 60, enabled: false },
      agitator: { type: 'none', power: 0, speed: 0, diameter: 0, numberOfBlades: 0, running: false, tipSpeed: 0, reynoldsNumber: 0, powerNumber: 0 },
      insulated: false,
    });
  }
  
  // Sludge Tank (per BFD Sheet 1 & 3)
  tanks.push({
    id: 'ST-001',
    name: 'Sludge Holding Tank',
    type: 'vertical',
    service: 'sludge_holding',
    capacity: 30,
    diameter: 3,
    height: 4.5,
    wallThickness: 8,
    material: 'Carbon Steel',
    nozzles: [
      { id: 'ST-001-N1', position: 'top', elevation: 4.3, size: 100, flangeRating: 'PN16', service: 'inlet' },
      { id: 'ST-001-N2', position: 'bottom', elevation: 0.15, size: 100, flangeRating: 'PN16', service: 'outlet' },
    ],
    fillMethod: 'top_fill',
    primaryDrawOff: 'bottom',
    currentLevel: 35,
    currentVolume: 0,
    temperature: 30,
    pressure: 0,
    composition: createDefaultComposition(0.30, 0.20, 0.50),
    phaseInterface: createDefaultPhaseInterface(),
    settlingDynamics: createDefaultSettling(),
    levelInstrumentation: {
      primaryType: 'ultrasonic',
      backupType: 'sight_glass',
      range: { min: 0, max: 100 },
      accuracy: 1,
      currentReading: 35,
      LALL: 5,
      LAL: 10,
      LAH: 85,
      LAHH: 95,
      independentHHEnabled: true,
      independentHHSetpoint: 95,
    },
    temperatureInstrumentation: { type: 'rtd', currentReading: 30, alarmHigh: 50, alarmLow: 5 },
    heating: { type: 'none', dutyRating: 0, currentDuty: 0, setpoint: 25, deadband: 2, maxTemp: 50, enabled: false },
    agitator: { type: 'anchor', power: 5.5, speed: 20, diameter: 2.5, numberOfBlades: 2, running: false, tipSpeed: 2.6, reynoldsNumber: 5000, powerNumber: 1.5 },
    insulated: false,
  });
  
  // Calculate volumes
  tanks.forEach(t => {
    t.currentVolume = t.capacity * t.currentLevel / 100;
    t.levelInstrumentation.currentReading = t.currentLevel;
  });
  
  return tanks;
}

function createInitialPumps(): PumpConfiguration[] {
  const pumps: PumpConfiguration[] = [];
  
  // Low Shear Transfer Pumps - 50 m³/hr per BFD
  const lowShearPumps = [
    { id: 'P-001', name: 'Infeed Pump 1', source: 'INFEED', dest: 'VT-001' },
    { id: 'P-002', name: 'Infeed Pump 2', source: 'INFEED', dest: 'VT-002' },
    { id: 'P-003', name: 'Process Transfer Pump 1', source: 'VT', dest: 'API-001' },
    { id: 'P-004', name: 'Process Transfer Pump 2', source: 'VT', dest: 'HT' },
    { id: 'P-005', name: 'Vertical Tank Output Pump', source: 'VT', dest: 'MANIFOLD' },
    { id: 'P-006', name: 'Horizontal Tank Output Pump', source: 'HT', dest: 'MANIFOLD' },
    { id: 'P-007', name: 'Pond Discharge Pump', source: 'VT-006', dest: 'POND' },
  ];
  
  lowShearPumps.forEach((p, idx) => {
    pumps.push({
      id: p.id,
      name: p.name,
      type: 'progressive_cavity',
      designFlow: 50,
      designHead: 25,
      designEfficiency: 0.65,
      ratedPower: 15,
      vfdEquipped: true,
      minSpeed: 30,
      maxSpeed: 100,
      currentSpeed: 0,
      synchronousSpeed: 1450,
      performanceCurve: {
        flowPoints: [0, 12.5, 25, 37.5, 50, 62.5],
        headPoints: [32, 30, 27, 23, 18, 12],
        efficiencyPoints: [0, 45, 58, 65, 65, 60],
        npshRequiredPoints: [1, 1.5, 2, 2.8, 3.8, 5],
        powerPoints: [2, 5, 8, 11, 14, 18],
      },
      currentOperatingPoint: {
        flow: 0,
        head: 0,
        efficiency: 0,
        power: 0,
        npshRequired: 1,
        npshAvailable: 8,
        npshMargin: 7,
      },
      impellerDiameter: 180,
      numberOfStages: 1,
      sealType: 'single_mechanical',
      sealFlushRequired: true,
      status: 'stopped',
      runHours: Math.random() * 5000,
      startCount: Math.floor(Math.random() * 500),
      lastStartTime: null,
      motorPower: 15,
      motorEfficiency: 0.92,
      motorCurrent: 0,
      motorVoltage: 415,
      motorPowerFactor: 0.85,
      vibrationDE: 1.2 + Math.random() * 0.5,
      vibrationNDE: 1.0 + Math.random() * 0.4,
      bearingTempDE: 35 + Math.random() * 10,
      bearingTempNDE: 33 + Math.random() * 8,
      suctionSource: p.source,
      dischargeDestination: p.dest,
      suctionPressure: 0,
      dischargePressure: 0,
    });
  });
  
  // Treatment Package Feed Pump - 5-15 m³/hr per BFD
  pumps.push({
    id: 'P-008',
    name: 'Treatment Package Feed Pump',
    type: 'progressive_cavity',
    designFlow: 15,
    designHead: 35,
    designEfficiency: 0.60,
    ratedPower: 7.5,
    vfdEquipped: true,
    minSpeed: 20,
    maxSpeed: 100,
    currentSpeed: 0,
    synchronousSpeed: 1450,
    performanceCurve: {
      flowPoints: [0, 3.75, 7.5, 11.25, 15, 18.75],
      headPoints: [42, 40, 37, 33, 28, 22],
      efficiencyPoints: [0, 40, 52, 60, 60, 55],
      npshRequiredPoints: [0.5, 1, 1.5, 2.2, 3, 4],
      powerPoints: [0.5, 2, 3.5, 5, 6.5, 8],
    },
    currentOperatingPoint: { flow: 0, head: 0, efficiency: 0, power: 0, npshRequired: 0.5, npshAvailable: 6, npshMargin: 5.5 },
    impellerDiameter: 120,
    numberOfStages: 1,
    sealType: 'single_mechanical',
    sealFlushRequired: true,
    status: 'stopped',
    runHours: 2500,
    startCount: 250,
    lastStartTime: null,
    motorPower: 7.5,
    motorEfficiency: 0.90,
    motorCurrent: 0,
    motorVoltage: 415,
    motorPowerFactor: 0.82,
    vibrationDE: 1.5,
    vibrationNDE: 1.3,
    bearingTempDE: 38,
    bearingTempNDE: 36,
    suctionSource: 'VT-005',
    dischargeDestination: 'TREATMENT',
    suctionPressure: 0,
    dischargePressure: 0,
  });
  
  // Centrifuge Output Pumps - >15 m³/hr per BFD Sheet 2
  pumps.push({
    id: 'P-009',
    name: 'Centrifuge Water Out Pump',
    type: 'centrifugal_end_suction',
    designFlow: 20,
    designHead: 30,
    designEfficiency: 0.70,
    ratedPower: 5.5,
    vfdEquipped: true,
    minSpeed: 40,
    maxSpeed: 100,
    currentSpeed: 0,
    synchronousSpeed: 2900,
    performanceCurve: {
      flowPoints: [0, 5, 10, 15, 20, 25],
      headPoints: [35, 34, 32, 29, 25, 20],
      efficiencyPoints: [0, 50, 62, 70, 70, 65],
      npshRequiredPoints: [1, 1.5, 2, 2.8, 3.8, 5],
      powerPoints: [1, 2, 3, 4, 5, 6],
    },
    currentOperatingPoint: { flow: 0, head: 0, efficiency: 0, power: 0, npshRequired: 1, npshAvailable: 5, npshMargin: 4 },
    impellerDiameter: 160,
    numberOfStages: 1,
    sealType: 'single_mechanical',
    sealFlushRequired: false,
    status: 'stopped',
    runHours: 1800,
    startCount: 180,
    lastStartTime: null,
    motorPower: 5.5,
    motorEfficiency: 0.88,
    motorCurrent: 0,
    motorVoltage: 415,
    motorPowerFactor: 0.85,
    vibrationDE: 2.0,
    vibrationNDE: 1.8,
    bearingTempDE: 40,
    bearingTempNDE: 38,
    suctionSource: 'TREATMENT',
    dischargeDestination: 'GAC-001',
    suctionPressure: 0,
    dischargePressure: 0,
  });
  
  pumps.push({
    id: 'P-010',
    name: 'Centrifuge Oil Out Pump',
    type: 'progressive_cavity',
    designFlow: 15,
    designHead: 25,
    designEfficiency: 0.62,
    ratedPower: 5.5,
    vfdEquipped: true,
    minSpeed: 30,
    maxSpeed: 100,
    currentSpeed: 0,
    synchronousSpeed: 1450,
    performanceCurve: {
      flowPoints: [0, 3.75, 7.5, 11.25, 15, 18.75],
      headPoints: [30, 28, 26, 23, 19, 14],
      efficiencyPoints: [0, 42, 55, 62, 62, 57],
      npshRequiredPoints: [0.5, 1, 1.5, 2, 2.8, 3.8],
      powerPoints: [0.5, 1.5, 2.8, 4, 5.2, 6.5],
    },
    currentOperatingPoint: { flow: 0, head: 0, efficiency: 0, power: 0, npshRequired: 0.5, npshAvailable: 5, npshMargin: 4.5 },
    impellerDiameter: 140,
    numberOfStages: 1,
    sealType: 'single_mechanical',
    sealFlushRequired: true,
    status: 'stopped',
    runHours: 1500,
    startCount: 150,
    lastStartTime: null,
    motorPower: 5.5,
    motorEfficiency: 0.88,
    motorCurrent: 0,
    motorVoltage: 415,
    motorPowerFactor: 0.82,
    vibrationDE: 1.8,
    vibrationNDE: 1.5,
    bearingTempDE: 38,
    bearingTempNDE: 35,
    suctionSource: 'TREATMENT',
    dischargeDestination: 'FLT-002',
    suctionPressure: 0,
    dischargePressure: 0,
  });
  
  // Mono Pump for Sludge - <7 m³/hr per BFD
  pumps.push({
    id: 'P-011',
    name: 'Sludge Transfer Mono Pump',
    type: 'progressive_cavity',
    designFlow: 7,
    designHead: 40,
    designEfficiency: 0.55,
    ratedPower: 4,
    vfdEquipped: true,
    minSpeed: 20,
    maxSpeed: 100,
    currentSpeed: 0,
    synchronousSpeed: 960,
    performanceCurve: {
      flowPoints: [0, 1.75, 3.5, 5.25, 7, 8.75],
      headPoints: [48, 46, 43, 39, 34, 28],
      efficiencyPoints: [0, 35, 48, 55, 55, 50],
      npshRequiredPoints: [0.3, 0.5, 0.8, 1.2, 1.8, 2.5],
      powerPoints: [0.3, 1, 1.8, 2.6, 3.4, 4.2],
    },
    currentOperatingPoint: { flow: 0, head: 0, efficiency: 0, power: 0, npshRequired: 0.3, npshAvailable: 4, npshMargin: 3.7 },
    impellerDiameter: 100,
    numberOfStages: 1,
    sealType: 'packed',
    sealFlushRequired: false,
    status: 'stopped',
    runHours: 800,
    startCount: 120,
    lastStartTime: null,
    motorPower: 4,
    motorEfficiency: 0.85,
    motorCurrent: 0,
    motorVoltage: 415,
    motorPowerFactor: 0.80,
    vibrationDE: 2.5,
    vibrationNDE: 2.2,
    bearingTempDE: 42,
    bearingTempNDE: 40,
    suctionSource: 'ST-001',
    dischargeDestination: 'TREATMENT',
    suctionPressure: 0,
    dischargePressure: 0,
  });
  
  return pumps;
}

function createInitialAPISeparator(): APISeparatorConfiguration {
  return {
    id: 'API-001',
    name: 'API Oil/Water Separator',
    length: 15,
    width: 3,
    depth: 2,
    surfaceArea: 45,
    volume: 90,
    zones: [
      { name: 'Inlet Zone', length: 2, function: 'inlet' },
      { name: 'Separation Zone', length: 10, function: 'separation' },
      { name: 'Oil Collection', length: 1.5, function: 'oil_collection' },
      { name: 'Outlet Zone', length: 1.5, function: 'outlet' },
    ],
    designFlow: 75,
    designDropletSize: 150,
    designOilDensity: 880,
    designTemperature: 35,
    designRemovalEfficiency: 0.95,
    horizontalVelocity: 0,
    verticalRiseVelocity: 0,
    hydraulicLoading: 0,
    retentionTime: 0,
    currentFlow: 0,
    currentTemperature: 35,
    inletOilConcentration: 250000,
    inletSolidsConcentration: 50000,
    inletEmulsionStability: 0.3,
    effluentOilConcentration: 0,
    effluentSolidsConcentration: 0,
    oilRemovalEfficiency: 0,
    solidsRemovalEfficiency: 0,
    oilSkimmerType: 'weir',
    oilSkimRate: 0,
    skimmedOilQuality: 85,
    sludgeDrawRate: 0,
    sludgeConcentration: 30,
    oilPadLevel: 50,
    waterLevel: 1800,
    sludgeBlanketLevel: 150,
  };
}

function createInitialCentrifuge(): CentrifugeConfiguration {
  return {
    id: 'CENT-001',
    name: 'Treatment Package (Tricanter)',
    type: 'three_phase_tricanter',
    bowlDiameter: 450,
    bowlLength: 1500,
    maxSpeed: 3500,
    maxGForce: 3000,
    designFeedRate: 15,
    currentSpeed: 0,
    currentGForce: 0,
    currentFeedRate: 0,
    differentialSpeed: 15,
    pondDepth: 120,
    feedTemperature: 35,
    feedOilContent: 25,
    feedWaterContent: 70,
    feedSolidsContent: 5,
    oilRecoveryEfficiency: 95,
    waterClarityEfficiency: 98,
    solidsRemovalEfficiency: 92,
    waterOutFlow: 0,
    waterOutOilContent: 50,
    oilOutFlow: 0,
    oilOutWaterContent: 3,
    sludgeOutFlow: 0,
    sludgeOutSolidsContent: 35,
    mainDrivePower: 45,
    backDrivePower: 7.5,
    flushWaterRate: 500,
    status: 'stopped',
    runHours: 3500,
    vibration: 2.5,
    bearingTemperature: 45,
  };
}

function createInitialFilters(): FilterConfiguration[] {
  return [
    {
      id: 'FLT-001',
      name: 'Coarse Infeed Screen',
      type: 'coarse_screen',
      meshSize: 20000,
      designFlow: 75,
      designDP: 2,
      maxDP: 20,
      currentFlow: 0,
      currentDP: 3,
      status: 'operating',
    },
    {
      id: 'FLT-002',
      name: 'Auto Self-Cleaning Fines Filter',
      type: 'auto_backwash',
      meshSize: 500,
      designFlow: 15,
      designDP: 15,
      maxDP: 50,
      currentFlow: 0,
      currentDP: 18,
      status: 'operating',
      backwashFrequency: 4,
      backwashDuration: 3,
      backwashWaterRate: 25,
      lastBackwash: new Date(),
    },
    {
      id: 'GAC-001',
      name: 'GAC Adsorption Filter',
      type: 'gac_adsorption',
      meshSize: 2000,
      designFlow: 20,
      designDP: 10,
      maxDP: 40,
      currentFlow: 0,
      currentDP: 12,
      status: 'operating',
      gacVolume: 5,
      gacType: 'Coconut Shell 8x30',
      bedDepth: 1.5,
      ebct: 15,
      throughput: 15000,
      breakthroughPercent: 35,
    },
  ];
}

function createInitialHeaters(): HeaterConfiguration[] {
  return [
    {
      id: 'HTR-001',
      name: 'Treatment Feed Heater',
      type: 'electric_inline',
      dutyRating: 150,
      designFlow: 15,
      designTempRise: 30,
      maxOutletTemp: 85,
      enabled: false,
      currentDuty: 0,
      inletTemperature: 35,
      outletTemperature: 35,
      setpoint: 65,
      controlMode: 'modulating',
      controlOutput: 0,
      highTempTrip: 85,
      lowFlowTrip: 3,
      tripped: false,
    },
  ];
}

function createInitialChemicalDosing(): ChemicalDosingSystem[] {
  return [
    {
      id: 'CHEM-001',
      name: 'Demulsifier Dosing',
      chemical: {
        name: 'EC9523A Demulsifier',
        type: 'demulsifier',
        concentration: 30,
        density: 0.92,
        viscosity: 25,
        ph: 7,
        hazardClass: 'Non-hazardous',
        storageTemp: { min: 5, max: 40 },
        shelfLife: 12,
      },
      tankCapacity: 1000,
      tankLevel: 72,
      tankTemperature: 28,
      daysOnSite: 15,
      pumpType: 'diaphragm',
      maxDoseRate: 10,
      currentDoseRate: 0,
      strokeLength: 50,
      strokeFrequency: 60,
      pumpRunning: false,
      injectionPoint: 'VT-003',
      quillType: 'multi_port',
      mixingEnergy: 50,
      controlMode: 'flow_paced',
      setpoint: 50,
      currentDose: 0,
      unitCost: 8.5,
      dailyConsumption: 0,
      dailyCost: 0,
    },
    {
      id: 'CHEM-002',
      name: 'Flocculant Dosing',
      chemical: {
        name: 'Polyacrylamide Flocculant',
        type: 'flocculant',
        concentration: 0.5,
        density: 1.01,
        viscosity: 500,
        ph: 7,
        hazardClass: 'Non-hazardous',
        storageTemp: { min: 5, max: 35 },
        shelfLife: 6,
      },
      tankCapacity: 500,
      tankLevel: 65,
      tankTemperature: 25,
      daysOnSite: 8,
      pumpType: 'peristaltic',
      maxDoseRate: 5,
      currentDoseRate: 0,
      strokeLength: 100,
      strokeFrequency: 30,
      pumpRunning: false,
      injectionPoint: 'INLINE-MIXER',
      quillType: 'static_mixer',
      mixingEnergy: 100,
      controlMode: 'flow_paced',
      setpoint: 20,
      currentDose: 0,
      unitCost: 3.2,
      dailyConsumption: 0,
      dailyCost: 0,
    },
    {
      id: 'CHEM-003',
      name: 'pH Correction (Acid)',
      chemical: {
        name: 'Sulphuric Acid',
        type: 'acid',
        concentration: 98,
        density: 1.84,
        viscosity: 25,
        ph: 0,
        hazardClass: 'Class 8 Corrosive',
        storageTemp: { min: -10, max: 50 },
        shelfLife: 24,
      },
      tankCapacity: 1000,
      tankLevel: 55,
      tankTemperature: 28,
      daysOnSite: 20,
      pumpType: 'diaphragm',
      maxDoseRate: 2,
      currentDoseRate: 0,
      strokeLength: 25,
      strokeFrequency: 30,
      pumpRunning: false,
      injectionPoint: 'VT-005',
      quillType: 'simple',
      mixingEnergy: 30,
      controlMode: 'feedback',
      setpoint: 7.0,
      currentDose: 0,
      unitCost: 1.5,
      dailyConsumption: 0,
      dailyCost: 0,
    },
  ];
}

function createInitialEvaporationPonds(): EvaporationPond[] {
  return [1, 2, 3, 4].map(i => ({
    id: `POND-00${i}`,
    name: `Evaporation Pond ${i}`,
    surfaceArea: 10000,
    depth: 2,
    capacity: 20000,
    currentVolume: 5000 + Math.random() * 8000,
    freeboard: 0.8,
    inflowRate: 0,
    evaporationRate: 8,
    netAccumulation: 0,
    tphConcentration: 15,
    tdsConcentration: 45000,
    pH: 7.8,
    flowTotalizer: 125000 + Math.random() * 50000,
    lastSampleDate: new Date(),
  }));
}

function createInitialInstruments(): InstrumentConfiguration[] {
  const instruments: InstrumentConfiguration[] = [];
  
  // Flow instruments
  const flowInstruments = [
    { id: 'FIT-001', tag: 'FIT-001', desc: 'Infeed Flow', range: { min: 0, max: 100 } },
    { id: 'FIT-002', tag: 'FIT-002', desc: 'API Separator Feed', range: { min: 0, max: 100 } },
    { id: 'FIT-003', tag: 'FIT-003', desc: 'Pond Discharge', range: { min: 0, max: 60 } },
    { id: 'FIT-004', tag: 'FIT-004', desc: 'Oil Export', range: { min: 0, max: 60 } },
    { id: 'FIT-005', tag: 'FIT-005', desc: 'Treatment Feed', range: { min: 0, max: 20 } },
    { id: 'FIT-006', tag: 'FIT-006', desc: 'Centrifuge Water Out', range: { min: 0, max: 20 } },
    { id: 'FIT-007', tag: 'FIT-007', desc: 'Centrifuge Oil Out', range: { min: 0, max: 20 } },
    { id: 'FIT-008', tag: 'FIT-008', desc: 'Sludge Transfer', range: { min: 0, max: 10 } },
  ];
  
  flowInstruments.forEach(f => {
    instruments.push({
      id: f.id,
      tag: f.tag,
      description: f.desc,
      type: 'flow_magnetic',
      range: f.range,
      unit: 'm³/hr',
      accuracy: 0.5,
      repeatability: 0.1,
      currentValue: 0,
      rawValue: 0,
      quality: 'good',
      lastUpdate: new Date(),
      alarmLow: f.range.max * 0.1,
      alarmHigh: f.range.max * 0.9,
      alarmDeadband: 1,
      currentAlarmState: 'normal',
      lastCalibration: new Date(Date.now() - 90 * 24 * 3600 * 1000),
      nextCalibration: new Date(Date.now() + 275 * 24 * 3600 * 1000),
      calibrationDue: false,
    });
  });
  
  // Oil-in-water analyzers
  instruments.push({
    id: 'AIT-001',
    tag: 'AIT-001',
    description: 'API Effluent Oil-in-Water',
    type: 'oil_in_water_analyzer',
    range: { min: 0, max: 500 },
    unit: 'mg/L',
    accuracy: 5,
    repeatability: 2,
    currentValue: 45,
    rawValue: 45,
    quality: 'good',
    lastUpdate: new Date(),
    alarmHigh: 100,
    alarmHighHigh: 200,
    alarmDeadband: 5,
    currentAlarmState: 'normal',
    lastCalibration: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    nextCalibration: new Date(Date.now() + 60 * 24 * 3600 * 1000),
    calibrationDue: false,
  });
  
  instruments.push({
    id: 'AIT-002',
    tag: 'AIT-002',
    description: 'Pond Discharge Oil-in-Water',
    type: 'oil_in_water_analyzer',
    range: { min: 0, max: 100 },
    unit: 'mg/L',
    accuracy: 2,
    repeatability: 1,
    currentValue: 12,
    rawValue: 12,
    quality: 'good',
    lastUpdate: new Date(),
    alarmHigh: 30,
    alarmHighHigh: 50,
    alarmDeadband: 2,
    currentAlarmState: 'normal',
    lastCalibration: new Date(Date.now() - 14 * 24 * 3600 * 1000),
    nextCalibration: new Date(Date.now() + 76 * 24 * 3600 * 1000),
    calibrationDue: false,
  });
  
  // pH analyzer
  instruments.push({
    id: 'AIT-003',
    tag: 'AIT-003',
    description: 'Treatment Feed pH',
    type: 'pH_probe',
    range: { min: 0, max: 14 },
    unit: 'pH',
    accuracy: 0.1,
    repeatability: 0.05,
    currentValue: 7.2,
    rawValue: 7.2,
    quality: 'good',
    lastUpdate: new Date(),
    alarmLow: 5.5,
    alarmHigh: 9.0,
    alarmLowLow: 4.5,
    alarmHighHigh: 10.0,
    alarmDeadband: 0.1,
    currentAlarmState: 'normal',
    lastCalibration: new Date(Date.now() - 7 * 24 * 3600 * 1000),
    nextCalibration: new Date(Date.now() + 23 * 24 * 3600 * 1000),
    calibrationDue: false,
  });
  
  return instruments;
}

function createInitialInterlocks(): InterlockConfiguration[] {
  const interlocks: InterlockConfiguration[] = [];
  
  // Tank overfill interlocks (per AS 1940 / UR-OPS-015)
  const tanks = ['VT-001', 'VT-002', 'VT-003', 'VT-004', 'VT-005', 'VT-006', 
                 'HT-001', 'HT-002', 'HT-003', 'HT-004', 'HT-005', 'HT-006', 'HT-007', 'ST-001'];
  
  tanks.forEach(tank => {
    interlocks.push({
      id: `IL-${tank}-OVERFILL`,
      name: `${tank} Overfill Protection`,
      description: `Independent high-high level protection per AS 1940`,
      conditions: [
        { tag: `LIT-${tank}`, operator: '>=', value: 95, description: 'Level >= 95%' }
      ],
      logicOperator: 'AND',
      tripAction: `Close all inlet valves to ${tank}`,
      affectedEquipment: [`XV-${tank}-IN`],
      status: 'healthy',
      bypassAuthorized: false,
      resetType: 'manual',
      resetRequired: false,
      tripCount: 0,
      urReference: 'UR-OPS-015',
      standardReference: 'AS 1940 Cl. 5.4.2',
    });
  });
  
  // Oil-to-pond prevention (per UR-OPS-008)
  interlocks.push({
    id: 'IL-OIL-POND',
    name: 'Oil to Pond Prevention',
    description: 'Prevents discharge to evaporation ponds when oil content exceeds limit',
    conditions: [
      { tag: 'AIT-002', operator: '>', value: 50, description: 'Oil-in-water > 50 mg/L' }
    ],
    logicOperator: 'AND',
    tripAction: 'Close pond discharge valve, divert to recirculation',
    affectedEquipment: ['XV-POND-001'],
    status: 'healthy',
    bypassAuthorized: false,
    resetType: 'auto',
    resetRequired: false,
    tripCount: 0,
    urReference: 'UR-OPS-008',
  });
  
  // Centrifuge protection
  interlocks.push({
    id: 'IL-CENT-TEMP',
    name: 'Centrifuge Low Feed Temperature',
    description: 'Prevents centrifuge operation below minimum feed temperature',
    conditions: [
      { tag: 'TIT-005', operator: '<', value: 55, description: 'Feed temp < 55°C' }
    ],
    logicOperator: 'AND',
    tripAction: 'Block centrifuge start, alarm operator',
    affectedEquipment: ['CENT-001'],
    status: 'healthy',
    bypassAuthorized: false,
    resetType: 'auto',
    resetRequired: false,
    tripCount: 0,
  });
  
  return interlocks;
}

function createRoutePermissions(): RoutePermission[] {
  return [
    // Permitted routes
    { routeId: 'TR-001', source: 'INFEED', destination: 'VT-001', permitted: true },
    { routeId: 'TR-002', source: 'INFEED', destination: 'VT-002', permitted: true },
    { routeId: 'TR-003', source: 'VT-001', destination: 'API-001', permitted: true },
    { routeId: 'TR-004', source: 'VT-002', destination: 'API-001', permitted: true },
    { routeId: 'TR-005', source: 'VT', destination: 'HT', permitted: true },
    { routeId: 'TR-006', source: 'API-001', destination: 'VT', permitted: true },
    { routeId: 'TR-007', source: 'VT', destination: 'POND', permitted: true },
    { routeId: 'TR-008', source: 'VT', destination: 'TREATMENT', permitted: true },
    { routeId: 'TR-009', source: 'TREATMENT', destination: 'HT', permitted: true },
    { routeId: 'TR-010', source: 'TREATMENT', destination: 'VT', permitted: true },
    { routeId: 'TR-011', source: 'TREATMENT', destination: 'POND', permitted: true },
    { routeId: 'TR-012', source: 'HT', destination: 'EXPORT', permitted: true },
    { routeId: 'TR-013', source: 'ST', destination: 'TREATMENT', permitted: true },
    
    // PROHIBITED routes (per UR-OPS-008)
    { routeId: 'TR-PROHIB-001', source: 'HT', destination: 'POND', permitted: false, reason: 'UR-OPS-008: Oil tanks to evaporation ponds prohibited' },
    { routeId: 'TR-PROHIB-002', source: 'INFEED', destination: 'POND', permitted: false, reason: 'Untreated waste to ponds prohibited' },
  ];
}

// =============================================================================
// SIMULATION ENGINE CLASS
// =============================================================================

export class SimulationEngineV2 {
  private state: ProcessState;
  private config: SimulationConfig;
  private running: boolean = false;
  private cumulativeData = {
    totalProcessed: 0,
    totalOilRecovered: 0,
    totalEnergyConsumed: 0,
    operatingHours: 0,
  };
  
  constructor() {
    this.config = {
      timeStep: 1,
      speedMultiplier: 1,
      startTime: new Date(),
      currentTime: new Date(),
      running: false,
      ambientTemperature: 35,
      humidity: 45,
      windSpeed: 5,
      feedCompositionVariability: 0.1,
      feedFlowVariability: 0.05,
      enableRandomUpsets: false,
      upsetFrequency: 0.5,
    };
    
    this.state = this.createInitialState();
  }
  
  private createInitialState(): ProcessState {
    return {
      timestamp: new Date(),
      simulationTime: 0,
      tanks: createInitialTanks(),
      pumps: createInitialPumps(),
      apiSeparator: createInitialAPISeparator(),
      centrifuge: createInitialCentrifuge(),
      filters: createInitialFilters(),
      heaters: createInitialHeaters(),
      chemicalDosing: createInitialChemicalDosing(),
      manifolds: [],
      evaporationPonds: createInitialEvaporationPonds(),
      sludgeHandling: null as any,
      oilExport: null as any,
      mbrFuture: {
        id: 'MBR-001',
        name: 'MBR Aerobic Bio Tank (FUTURE)',
        status: 'tie_in_ready',
        inletTieIn: { location: 'MANIFOLD-002', size: 100, elevation: 1.5 },
        outletTieIn: { location: 'GAC-001', size: 100, elevation: 2.0 },
        designFlow: 15,
        designCODRemoval: 95,
        designBODRemoval: 98,
      },
      instruments: createInitialInstruments(),
      interlocks: createInitialInterlocks(),
      routePermissions: createRoutePermissions(),
      activeTransfers: [],
      activeAlarms: [],
      alarmHistory: [],
      operatingMode: 'normal',
    };
  }
  
  getState(): ProcessState {
    return this.state;
  }
  
  getConfig(): SimulationConfig {
    return this.config;
  }
  
  updateConfig(updates: Partial<SimulationConfig>) {
    this.config = { ...this.config, ...updates };
  }
  
  start() {
    this.running = true;
    this.config.running = true;
  }
  
  stop() {
    this.running = false;
    this.config.running = false;
  }
  
  reset() {
    this.state = this.createInitialState();
    this.cumulativeData = {
      totalProcessed: 0,
      totalOilRecovered: 0,
      totalEnergyConsumed: 0,
      operatingHours: 0,
    };
  }
  
  step(dt: number): ProcessState {
    if (!this.running) return this.state;
    
    this.state.simulationTime += dt;
    this.state.timestamp = new Date();
    
    // Update all subsystems
    this.updateTankLevels(dt);
    this.updateSettlingDynamics(dt);
    this.updateAPISeparator(dt);
    this.updateCentrifuge(dt);
    this.updateHeaters(dt);
    this.updatePumps(dt);
    this.updateInstruments();
    this.checkInterlocks();
    this.updateChemicalDosing(dt);
    this.updateEvaporationPonds(dt);
    
    // Track cumulative data
    this.cumulativeData.operatingHours += dt / 3600;
    
    return this.state;
  }
  
  private updateTankLevels(dt: number) {
    for (const tank of this.state.tanks) {
      // Apply active transfers
      let netFlow = 0;
      for (const transfer of this.state.activeTransfers) {
        if (transfer.destination === tank.id) {
          netFlow += transfer.actualFlow;
        }
        if (transfer.source === tank.id) {
          netFlow -= transfer.actualFlow;
        }
      }
      
      // Update volume
      const volumeChange = (netFlow * dt) / 3600; // m³
      tank.currentVolume = Math.max(0, Math.min(tank.capacity, tank.currentVolume + volumeChange));
      tank.currentLevel = (tank.currentVolume / tank.capacity) * 100;
      tank.levelInstrumentation.currentReading = tank.currentLevel;
      
      // Update temperature (natural cooling)
      const heatLoss = tankHeatLoss(
        tank.diameter,
        tank.height,
        tank.temperature,
        this.config.ambientTemperature,
        tank.currentVolume,
        950,
        2500,
        tank.insulated,
        tank.insulationThickness ? tank.insulationThickness / 1000 : 0.05
      );
      tank.temperature -= heatLoss.coolingRate * (dt / 3600);
      tank.temperatureInstrumentation.currentReading = tank.temperature;
    }
  }
  
  private updateSettlingDynamics(dt: number) {
    for (const tank of this.state.tanks) {
      if (tank.currentVolume < 1) continue;
      
      const waterDensity = waterDensityKell(tank.temperature);
      const waterViscosity = waterViscosityVogel(tank.temperature);
      const oilDensity = oilDensityTemperature(tank.composition.oilProps.density15C, tank.temperature);
      
      // Calculate Stokes velocity for characteristic droplet
      const dropletSize = 150e-6; // 150 micron
      const vStokes = stokesVelocity(dropletSize, oilDensity, waterDensity, waterViscosity);
      
      // Hindered settling
      const voidage = 1 - tank.composition.oilFraction;
      const Re_t = particleReynolds(vStokes, dropletSize, waterDensity, waterViscosity);
      const n = richardsonZakiExponent(Re_t);
      const vHindered = vStokes * Math.pow(voidage, n);
      
      // Update settling dynamics
      tank.settlingDynamics = {
        stokesVelocity: vStokes,
        hinderedSettlingFactor: Math.pow(voidage, n),
        effectiveSettlingVelocity: vHindered,
        coalescenceRate: 100 * (1 + tank.temperature / 50),
        residenceTime: tank.currentVolume > 0 ? tank.currentVolume / Math.max(0.1, this.getInflowRate(tank.id)) : 0,
        separationEfficiency: Math.min(0.98, 0.5 + 0.4 * Math.min(1, tank.settlingDynamics.residenceTime)),
      };
      
      // Gradually separate phases
      const separationRate = vHindered * (dt / tank.height) * 0.1;
      if (tank.composition.oilFraction > 0.01) {
        tank.composition.oilFraction = Math.max(0.01, tank.composition.oilFraction - separationRate);
        tank.composition.waterFraction = 1 - tank.composition.oilFraction - tank.composition.solidsFraction;
      }
    }
  }
  
  private getInflowRate(tankId: string): number {
    return this.state.activeTransfers
      .filter(t => t.destination === tankId)
      .reduce((sum, t) => sum + t.actualFlow, 0);
  }
  
  private updateAPISeparator(dt: number) {
    const api = this.state.apiSeparator;
    
    // Get total inflow
    let totalInflow = 0;
    for (const transfer of this.state.activeTransfers) {
      if (transfer.destination === 'API-001') {
        totalInflow += transfer.actualFlow;
      }
    }
    api.currentFlow = totalInflow;
    
    if (totalInflow > 0) {
      // Calculate fluid properties
      const waterDensity = waterDensityKell(api.currentTemperature);
      const waterViscosity = waterViscosityVogel(api.currentTemperature);
      const oilDensity = oilDensityTemperature(api.designOilDensity, api.currentTemperature);
      
      // Stokes velocity
      const dropletSize = api.designDropletSize * 1e-6;
      const settling = generalSettlingVelocity(dropletSize, oilDensity, waterDensity, waterViscosity);
      api.verticalRiseVelocity = settling.velocity;
      
      // Hydraulic parameters
      const crossSection = api.width * api.depth;
      api.horizontalVelocity = (totalInflow / 3600) / crossSection;
      api.hydraulicLoading = totalInflow / api.surfaceArea;
      api.retentionTime = (api.volume / totalInflow) * 60; // minutes
      
      // Separation efficiency
      const areaRatio = api.surfaceArea / ((totalInflow / 3600) / settling.velocity);
      api.oilRemovalEfficiency = Math.min(0.98, 1 - Math.exp(-areaRatio * 0.8));
      api.solidsRemovalEfficiency = api.oilRemovalEfficiency * 0.7;
      
      // Outlet concentrations
      api.effluentOilConcentration = api.inletOilConcentration * (1 - api.oilRemovalEfficiency);
      api.effluentSolidsConcentration = api.inletSolidsConcentration * (1 - api.solidsRemovalEfficiency);
      
      // Skim rates
      api.oilSkimRate = (api.inletOilConcentration / 1e6) * totalInflow * api.oilRemovalEfficiency;
      api.sludgeDrawRate = (api.inletSolidsConcentration / 1e6) * totalInflow * api.solidsRemovalEfficiency;
      
      // Update cumulative data
      this.cumulativeData.totalProcessed += (totalInflow * dt) / 3600;
      this.cumulativeData.totalOilRecovered += (api.oilSkimRate * dt) / 3600;
    } else {
      api.horizontalVelocity = 0;
      api.hydraulicLoading = 0;
      api.oilSkimRate = 0;
    }
  }
  
  private updateCentrifuge(dt: number) {
    const cent = this.state.centrifuge;
    
    if (cent.status === 'running' && cent.currentFeedRate > 0) {
      // G-force
      cent.currentGForce = centrifugeGForce(cent.currentSpeed, cent.bowlDiameter / 2000);
      
      // Separation efficiencies (temperature dependent)
      const tempFactor = Math.min(1.2, 0.8 + (cent.feedTemperature - 40) / 50);
      cent.oilRecoveryEfficiency = Math.min(98, 90 * tempFactor);
      cent.waterClarityEfficiency = Math.min(99, 95 * tempFactor);
      cent.solidsRemovalEfficiency = Math.min(95, 88 * tempFactor);
      
      // Output flows
      const feedMassFlow = cent.currentFeedRate * 1000; // kg/hr (approx)
      cent.waterOutFlow = cent.currentFeedRate * (cent.feedWaterContent / 100) * (cent.waterClarityEfficiency / 100);
      cent.oilOutFlow = cent.currentFeedRate * (cent.feedOilContent / 100) * (cent.oilRecoveryEfficiency / 100);
      cent.sludgeOutFlow = Math.min(7, cent.currentFeedRate * (cent.feedSolidsContent / 100) * 3); // Limited by mono pump
      
      // Output qualities
      cent.waterOutOilContent = 50 * (100 - cent.waterClarityEfficiency) / 5;
      cent.oilOutWaterContent = 3 * (100 - cent.oilRecoveryEfficiency) / 10;
      
      // Update run hours
      cent.runHours += dt / 3600;
    } else {
      cent.waterOutFlow = 0;
      cent.oilOutFlow = 0;
      cent.sludgeOutFlow = 0;
    }
  }
  
  private updateHeaters(dt: number) {
    for (const heater of this.state.heaters) {
      if (heater.enabled && !heater.tripped) {
        const targetTemp = heater.setpoint;
        const currentTemp = heater.inletTemperature;
        
        if (currentTemp < targetTemp - heater.controlOutput * 0.01) {
          // Calculate required duty
          const flowRate = this.state.instruments.find(i => i.tag === 'FIT-005')?.currentValue || 0;
          const requiredDuty = flowRate * 1000 * 4.186 * (targetTemp - currentTemp) / 3600; // kW
          
          heater.controlOutput = Math.min(100, (requiredDuty / heater.dutyRating) * 100);
          heater.currentDuty = heater.dutyRating * heater.controlOutput / 100;
          
          // Calculate outlet temperature
          if (flowRate > 0) {
            const tempRise = (heater.currentDuty * 3600) / (flowRate * 1000 * 4.186);
            heater.outletTemperature = Math.min(heater.maxOutletTemp, currentTemp + tempRise);
          }
        } else {
          heater.controlOutput = Math.max(0, heater.controlOutput - 5);
          heater.currentDuty = heater.dutyRating * heater.controlOutput / 100;
        }
        
        // Trip on high temp
        if (heater.outletTemperature >= heater.highTempTrip) {
          heater.tripped = true;
          heater.enabled = false;
          this.addAlarm('critical', `HTR-${heater.id}`, `${heater.name} tripped on high temperature`);
        }
        
        // Track energy
        this.cumulativeData.totalEnergyConsumed += (heater.currentDuty * dt) / 3600;
      } else {
        heater.currentDuty = 0;
        heater.controlOutput = 0;
      }
    }
  }
  
  private updatePumps(dt: number) {
    for (const pump of this.state.pumps) {
      if (pump.status === 'running') {
        // Calculate operating point from curve
        const speedRatio = pump.currentSpeed / 100;
        const flowIndex = pump.currentOperatingPoint.flow / pump.designFlow;
        const idx = Math.min(pump.performanceCurve.flowPoints.length - 1, Math.floor(flowIndex * 5));
        
        pump.currentOperatingPoint.head = pump.performanceCurve.headPoints[idx] * Math.pow(speedRatio, 2);
        pump.currentOperatingPoint.efficiency = pump.performanceCurve.efficiencyPoints[idx];
        pump.currentOperatingPoint.power = pump.performanceCurve.powerPoints[idx] * Math.pow(speedRatio, 3);
        
        // Motor current
        pump.motorCurrent = (pump.currentOperatingPoint.power * 1000) / 
          (Math.sqrt(3) * pump.motorVoltage * pump.motorPowerFactor * pump.motorEfficiency);
        
        // Update pressures
        pump.dischargePressure = pump.suctionPressure + pump.currentOperatingPoint.head * 9.81;
        
        // Run hours
        pump.runHours += dt / 3600;
        
        // Track energy
        this.cumulativeData.totalEnergyConsumed += (pump.currentOperatingPoint.power * dt) / 3600;
      } else {
        pump.motorCurrent = 0;
        pump.currentOperatingPoint.flow = 0;
        pump.currentOperatingPoint.power = 0;
      }
    }
  }
  
  private updateInstruments() {
    // Update flow instruments from active transfers
    for (const inst of this.state.instruments) {
      if (inst.type === 'flow_magnetic') {
        // Find corresponding flow
        let flow = 0;
        for (const transfer of this.state.activeTransfers) {
          if (inst.tag.includes('001') && transfer.source === 'INFEED') flow = transfer.actualFlow;
          if (inst.tag.includes('003') && transfer.destination.includes('POND')) flow = transfer.actualFlow;
          // Add more mappings as needed
        }
        inst.currentValue = flow;
        inst.rawValue = flow;
        inst.lastUpdate = new Date();
        
        // Check alarms
        if (inst.alarmHighHigh && inst.currentValue >= inst.alarmHighHigh) {
          inst.currentAlarmState = 'highhigh';
        } else if (inst.alarmHigh && inst.currentValue >= inst.alarmHigh) {
          inst.currentAlarmState = 'high';
        } else if (inst.alarmLowLow && inst.currentValue <= inst.alarmLowLow) {
          inst.currentAlarmState = 'lowlow';
        } else if (inst.alarmLow && inst.currentValue <= inst.alarmLow) {
          inst.currentAlarmState = 'low';
        } else {
          inst.currentAlarmState = 'normal';
        }
      }
    }
    
    // Update API effluent oil-in-water
    const oiwInst = this.state.instruments.find(i => i.id === 'AIT-001');
    if (oiwInst) {
      oiwInst.currentValue = this.state.apiSeparator.effluentOilConcentration / 1000; // Convert to mg/L
      oiwInst.lastUpdate = new Date();
    }
  }
  
  private checkInterlocks() {
    for (const interlock of this.state.interlocks) {
      let conditionsMet = interlock.logicOperator === 'AND';
      
      for (const condition of interlock.conditions) {
        // Find instrument value
        const inst = this.state.instruments.find(i => i.tag === condition.tag);
        const tank = this.state.tanks.find(t => `LIT-${t.id}` === condition.tag);
        
        let value: number | undefined;
        if (inst) {
          value = inst.currentValue;
        } else if (tank) {
          value = tank.currentLevel;
        }
        
        if (value !== undefined) {
          let conditionResult = false;
          switch (condition.operator) {
            case '>': conditionResult = value > (condition.value as number); break;
            case '>=': conditionResult = value >= (condition.value as number); break;
            case '<': conditionResult = value < (condition.value as number); break;
            case '<=': conditionResult = value <= (condition.value as number); break;
            case '==': conditionResult = value === condition.value; break;
            case '!=': conditionResult = value !== condition.value; break;
          }
          
          if (interlock.logicOperator === 'AND') {
            conditionsMet = conditionsMet && conditionResult;
          } else {
            conditionsMet = conditionsMet || conditionResult;
          }
        }
      }
      
      if (conditionsMet && interlock.status !== 'tripped') {
        interlock.status = 'tripped';
        interlock.resetRequired = interlock.resetType === 'manual';
        interlock.lastTripped = new Date();
        interlock.tripCount++;
        this.addAlarm('high', interlock.id, `Interlock ${interlock.name} tripped`);
      } else if (!conditionsMet && interlock.status === 'tripped' && !interlock.resetRequired) {
        interlock.status = 'healthy';
      }
    }
  }
  
  private updateChemicalDosing(dt: number) {
    for (const chem of this.state.chemicalDosing) {
      if (chem.pumpRunning && chem.currentDoseRate > 0) {
        // Consumption
        const consumption = (chem.currentDoseRate * dt) / 3600; // L
        const tankVolume = chem.tankCapacity * chem.tankLevel / 100;
        const newVolume = Math.max(0, tankVolume - consumption);
        chem.tankLevel = (newVolume / chem.tankCapacity) * 100;
        
        // Cost tracking
        chem.dailyConsumption = chem.currentDoseRate * 24;
        chem.dailyCost = chem.dailyConsumption * chem.unitCost;
        
        // Low level alarm
        if (chem.tankLevel < 15) {
          this.addAlarm('medium', chem.id, `${chem.name} tank level low (${chem.tankLevel.toFixed(0)}%)`);
        }
      }
    }
  }
  
  private updateEvaporationPonds(dt: number) {
    for (const pond of this.state.evaporationPonds) {
      // Evaporation
      const evapVolume = (pond.evaporationRate / 1000) * pond.surfaceArea * (dt / 86400); // m³
      
      // Net change
      const netChange = pond.inflowRate * dt / 3600 - evapVolume;
      pond.currentVolume = Math.max(0, Math.min(pond.capacity, pond.currentVolume + netChange));
      pond.netAccumulation = (pond.inflowRate * 24) - (pond.evaporationRate / 1000 * pond.surfaceArea);
      
      // Freeboard
      pond.freeboard = pond.depth - (pond.currentVolume / pond.surfaceArea);
      
      // Totalizer
      if (pond.inflowRate > 0) {
        pond.flowTotalizer += (pond.inflowRate * dt) / 3600;
      }
    }
  }
  
  private addAlarm(priority: 'emergency' | 'critical' | 'high' | 'medium' | 'low', tag: string, description: string) {
    const alarm: Alarm = {
      id: `ALM-${Date.now()}`,
      timestamp: new Date(),
      tag,
      description,
      priority,
      state: 'active_unack',
    };
    
    this.state.activeAlarms.push(alarm);
    this.state.alarmHistory.push(alarm);
    
    // Limit history
    if (this.state.alarmHistory.length > 1000) {
      this.state.alarmHistory = this.state.alarmHistory.slice(-500);
    }
  }
  
  acknowledgeAlarm(alarmId: string) {
    const alarm = this.state.activeAlarms.find(a => a.id === alarmId);
    if (alarm && alarm.state === 'active_unack') {
      alarm.state = 'active_ack';
      alarm.acknowledgedAt = new Date();
    }
  }
  
  resetInterlock(interlockId: string) {
    const interlock = this.state.interlocks.find(i => i.id === interlockId);
    if (interlock && interlock.resetRequired) {
      interlock.status = 'healthy';
      interlock.resetRequired = false;
    }
  }
  
  // Transfer operations
  startTransfer(routeId: string, source: string, destination: string, flowRate: number, pumpId: string): boolean {
    // Check permissions
    const permission = this.state.routePermissions.find(r => r.routeId === routeId);
    if (permission && !permission.permitted) {
      this.addAlarm('high', routeId, `Transfer ${routeId} blocked: ${permission.reason}`);
      return false;
    }
    
    // Check interlocks
    const destTank = this.state.tanks.find(t => t.id === destination);
    if (destTank && destTank.currentLevel >= destTank.levelInstrumentation.LAHH) {
      this.addAlarm('high', destination, `Cannot start transfer: ${destination} at high-high level`);
      return false;
    }
    
    // Start pump
    const pump = this.state.pumps.find(p => p.id === pumpId);
    if (pump) {
      pump.status = 'running';
      pump.currentSpeed = Math.min(100, (flowRate / pump.designFlow) * 100);
      pump.currentOperatingPoint.flow = flowRate;
      pump.lastStartTime = new Date();
      pump.startCount++;
    }
    
    // Create transfer
    const transfer: TransferOperation = {
      id: `TRF-${Date.now()}`,
      routeId,
      name: `${source} to ${destination}`,
      source,
      destination,
      pumpId,
      targetFlow: flowRate,
      actualFlow: flowRate,
      valveIds: [],
      valveStates: {},
      status: 'active',
      startTime: new Date(),
      volumeTransferred: 0,
      permissivesMet: true,
      blockingConditions: [],
    };
    
    this.state.activeTransfers.push(transfer);
    return true;
  }
  
  stopTransfer(transferId: string) {
    const idx = this.state.activeTransfers.findIndex(t => t.id === transferId);
    if (idx >= 0) {
      const transfer = this.state.activeTransfers[idx];
      transfer.status = 'completed';
      transfer.endTime = new Date();
      
      // Stop pump
      const pump = this.state.pumps.find(p => p.id === transfer.pumpId);
      if (pump) {
        pump.status = 'stopped';
        pump.currentSpeed = 0;
        pump.currentOperatingPoint.flow = 0;
      }
      
      this.state.activeTransfers.splice(idx, 1);
    }
  }
  
  // Equipment control
  startPump(pumpId: string, speed: number = 100) {
    const pump = this.state.pumps.find(p => p.id === pumpId);
    if (pump) {
      pump.status = 'running';
      pump.currentSpeed = Math.min(pump.maxSpeed, Math.max(pump.minSpeed, speed));
      pump.lastStartTime = new Date();
      pump.startCount++;
    }
  }
  
  stopPump(pumpId: string) {
    const pump = this.state.pumps.find(p => p.id === pumpId);
    if (pump) {
      pump.status = 'stopped';
      pump.currentSpeed = 0;
      pump.currentOperatingPoint.flow = 0;
    }
  }
  
  setPumpSpeed(pumpId: string, speed: number) {
    const pump = this.state.pumps.find(p => p.id === pumpId);
    if (pump && pump.vfdEquipped) {
      pump.currentSpeed = Math.min(pump.maxSpeed, Math.max(pump.minSpeed, speed));
    }
  }
  
  startCentrifuge(feedRate: number, speed: number) {
    const cent = this.state.centrifuge;
    cent.status = 'running';
    cent.currentFeedRate = Math.min(cent.designFeedRate, feedRate);
    cent.currentSpeed = Math.min(cent.maxSpeed, speed);
  }
  
  stopCentrifuge() {
    this.state.centrifuge.status = 'stopped';
    this.state.centrifuge.currentFeedRate = 0;
    this.state.centrifuge.currentSpeed = 0;
  }
  
  enableHeater(heaterId: string, setpoint?: number) {
    const heater = this.state.heaters.find(h => h.id === heaterId);
    if (heater) {
      heater.enabled = true;
      heater.tripped = false;
      if (setpoint !== undefined) {
        heater.setpoint = Math.min(heater.maxOutletTemp - 5, setpoint);
      }
    }
  }
  
  disableHeater(heaterId: string) {
    const heater = this.state.heaters.find(h => h.id === heaterId);
    if (heater) {
      heater.enabled = false;
    }
  }
  
  startChemicalDosing(chemId: string, doseRate: number) {
    const chem = this.state.chemicalDosing.find(c => c.id === chemId);
    if (chem) {
      chem.pumpRunning = true;
      chem.currentDoseRate = Math.min(chem.maxDoseRate, doseRate);
    }
  }
  
  stopChemicalDosing(chemId: string) {
    const chem = this.state.chemicalDosing.find(c => c.id === chemId);
    if (chem) {
      chem.pumpRunning = false;
      chem.currentDoseRate = 0;
    }
  }
  
  updateTankComposition(tankId: string, composition: Partial<StreamComposition>) {
    const tank = this.state.tanks.find(t => t.id === tankId);
    if (tank) {
      tank.composition = { ...tank.composition, ...composition };
    }
  }
  
  // KPIs
  calculateKPIs(): ProcessKPIs {
    const api = this.state.apiSeparator;
    const cent = this.state.centrifuge;
    
    const totalPower = this.state.pumps
      .filter(p => p.status === 'running')
      .reduce((sum, p) => sum + p.currentOperatingPoint.power, 0) +
      this.state.heaters.reduce((sum, h) => sum + h.currentDuty, 0) +
      (cent.status === 'running' ? cent.mainDrivePower + cent.backDrivePower : 0);
    
    const throughput = api.currentFlow + cent.currentFeedRate;
    
    return {
      instantaneous: {
        infeedRate: this.state.instruments.find(i => i.tag === 'FIT-001')?.currentValue || 0,
        apiThroughput: api.currentFlow,
        centrifugeFeedRate: cent.currentFeedRate,
        pondDischargeRate: this.state.instruments.find(i => i.tag === 'FIT-003')?.currentValue || 0,
        oilRecoveryRate: api.oilSkimRate + cent.oilOutFlow,
        sludgeGenerationRate: api.sludgeDrawRate + cent.sludgeOutFlow,
        apiRemovalEfficiency: api.oilRemovalEfficiency * 100,
        centrifugeOilRecovery: cent.oilRecoveryEfficiency,
        overallOilRecovery: ((api.oilRemovalEfficiency * 100) + cent.oilRecoveryEfficiency) / 2,
        treatedWaterQuality: api.effluentOilConcentration / 1000,
        recoveredOilQuality: 100 - cent.oilOutWaterContent,
        totalPowerConsumption: totalPower,
        specificEnergy: throughput > 0 ? totalPower / throughput : 0,
        chemicalConsumptionRate: this.state.chemicalDosing.reduce((sum, c) => sum + c.currentDoseRate, 0),
      },
      daily: {
        totalInfeed: this.cumulativeData.totalProcessed * 24 / Math.max(1, this.cumulativeData.operatingHours),
        totalPondDischarge: 0,
        totalOilRecovered: this.cumulativeData.totalOilRecovered * 24 / Math.max(1, this.cumulativeData.operatingHours),
        totalSludgeGenerated: 0,
        averageEfficiency: api.oilRemovalEfficiency * 100,
        uptime: 100,
        electricityConsumed: this.cumulativeData.totalEnergyConsumed * 24 / Math.max(1, this.cumulativeData.operatingHours),
        chemicalsConsumed: {
          demulsifier: 0,
          flocculant: 0,
          acid: 0,
          caustic: 0,
        },
      },
      cumulative: {
        totalProcessed: this.cumulativeData.totalProcessed,
        totalOilRecovered: this.cumulativeData.totalOilRecovered,
        totalOperatingHours: this.cumulativeData.operatingHours,
        totalStartups: this.state.pumps.reduce((sum, p) => sum + p.startCount, 0),
        meanTimeBetweenFailures: 500,
      },
    };
  }
}

// Export singleton instance
export const simulationEngineV2 = new SimulationEngineV2();
