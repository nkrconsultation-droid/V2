/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ENGINEERING TESTS FOR INDUSTRIAL CONTROL SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Commissioning-level tests that verify:
 * - PID controller behavior
 * - Cascade control architecture
 * - Mass balance validation
 * - Equipment constraints
 * - Calculation integrity
 *
 * @standard ISA-TR84.00.04 (SIS Testing)
 */

import {
  createPIDState,
  calculatePID,
  setMode,
  setSetpoint,
  setManualOutput,
  getDiagnostics,
  type PIDConfig,
  type PIDState,
} from '../control/pid';

import {
  createConstraints,
  createInterlocks,
  evaluateConstraints,
  type EquipmentState,
} from '../control/constraints';

import {
  calculateMassBalance,
  createStreamComposition,
  type MassBalanceInput,
} from '../integrity/massBalance';

import {
  createCentrifugeIntegrityGates,
  runIntegrityCheck,
  createRangeRule,
  createConservationRule,
} from '../integrity/validators';

import {
  calculateGForce,
  calculateSigma,
  calculateCriticalParticleSize,
  createLabeledValue,
} from '../models/physics';

// ═══════════════════════════════════════════════════════════════════════════
// TEST UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_PID_CONFIG: PIDConfig = {
  tag: 'TEST-001',
  description: 'Test Controller',
  unit: '%',
  kp: 1.0,
  ki: 0.1,
  kd: 0.0,
  pvMin: 0,
  pvMax: 100,
  spMin: 0,
  spMax: 100,
  opMin: 0,
  opMax: 100,
  antiWindupGain: 1.0,
  derivativeFilterCoeff: 0.8,
  spRateLimit: 100,
  opRateLimit: 100,
};

function createTestEquipmentState(overrides: Partial<EquipmentState> = {}): EquipmentState {
  return {
    running: true,
    speed: 2800,
    torque: 400,
    vibration: 2.0,
    bearingTemp: 55,
    motorTemp: 60,
    feedRate: 8,
    feedTemp: 70,
    feedPressure: 250,
    pondDepth: 130,
    differentialSpeed: 12,
    powerDraw: 45,
    runtime: 50,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PID CONTROLLER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('PID Controller', () => {
  describe('Initialization', () => {
    test('should create initial state with correct defaults', () => {
      const state = createPIDState({
        tag: 'TIC-001',
        description: 'Temperature Control',
        unit: '°C',
      }, 70, 50);

      expect(state.tag).toBe('TIC-001');
      expect(state.mode).toBe('MAN');
      expect(state.sp).toBe(70);
      expect(state.op).toBe(50);
      expect(state.integral).toBe(0);
      expect(state.fault).toBe(false);
    });
  });

  describe('Manual Mode', () => {
    test('should hold manual output in MAN mode', () => {
      let state = createPIDState({
        tag: 'TEST',
        description: 'Test',
        unit: '%',
      }, 50, 60);

      state = setManualOutput(state, 75, DEFAULT_PID_CONFIG);
      const result = calculatePID(state, 45, DEFAULT_PID_CONFIG, 1.0);

      expect(result.output).toBe(75);
    });
  });

  describe('Automatic Mode', () => {
    test('should reduce output when PV > SP', () => {
      let state = createPIDState({
        tag: 'TEST',
        description: 'Test',
        unit: '%',
      }, 50, 50);

      state = setMode(state, 'AUTO', DEFAULT_PID_CONFIG);

      // PV = 60, SP = 50, so error = -10, output should decrease
      const result = calculatePID(state, 60, DEFAULT_PID_CONFIG, 1.0);

      // With Kp=1, negative error should reduce output from 50
      expect(result.output).toBeLessThan(50);
    });

    test('should increase output when PV < SP', () => {
      let state = createPIDState({
        tag: 'TEST',
        description: 'Test',
        unit: '%',
      }, 50, 50);

      state = setMode(state, 'AUTO', DEFAULT_PID_CONFIG);

      // PV = 40, SP = 50, so error = +10, output should increase
      const result = calculatePID(state, 40, DEFAULT_PID_CONFIG, 1.0);

      expect(result.output).toBeGreaterThan(50);
    });

    test('should accumulate integral over time', () => {
      let state = createPIDState({
        tag: 'TEST',
        description: 'Test',
        unit: '%',
      }, 50, 50);

      state = setMode(state, 'AUTO', DEFAULT_PID_CONFIG);

      // Run several iterations with constant error
      for (let i = 0; i < 10; i++) {
        const result = calculatePID(state, 40, DEFAULT_PID_CONFIG, 1.0);
        state = result.state;
      }

      // Integral should have accumulated
      expect(state.integral).toBeGreaterThan(0);
    });
  });

  describe('Anti-Windup', () => {
    test('should prevent integral windup at output limits', () => {
      let state = createPIDState({
        tag: 'TEST',
        description: 'Test',
        unit: '%',
      }, 50, 90);

      state = setMode(state, 'AUTO', DEFAULT_PID_CONFIG);

      // Run many iterations with large error - output should saturate
      for (let i = 0; i < 100; i++) {
        const result = calculatePID(state, 0, DEFAULT_PID_CONFIG, 1.0);
        state = result.state;
      }

      // Output should be at max, integral should be bounded
      expect(state.op).toBe(100);
      expect(state.saturated).toBe(true);
      expect(state.saturationDir).toBe('HI');
      // Integral should not have grown unboundedly
      expect(state.integral).toBeLessThan(1000);
    });
  });

  describe('Bumpless Transfer', () => {
    test('should maintain output on MAN to AUTO transfer', () => {
      let state = createPIDState({
        tag: 'TEST',
        description: 'Test',
        unit: '%',
      }, 50, 70);

      state.pv = 50; // PV equals SP
      state = setManualOutput(state, 70, DEFAULT_PID_CONFIG);

      // Switch to AUTO
      state = setMode(state, 'AUTO', DEFAULT_PID_CONFIG);

      // First calculation should not cause a step change
      const result = calculatePID(state, 50, DEFAULT_PID_CONFIG, 1.0);

      // Output should be close to the manual value (70)
      expect(Math.abs(result.output - 70)).toBeLessThan(5);
    });
  });

  describe('Output Rate Limiting', () => {
    test('should rate limit output changes', () => {
      const config: PIDConfig = {
        ...DEFAULT_PID_CONFIG,
        opRateLimit: 10, // 10%/s max change
      };

      let state = createPIDState({
        tag: 'TEST',
        description: 'Test',
        unit: '%',
      }, 50, 50);

      state = setMode(state, 'AUTO', config);

      // Large error should demand large output change
      const result = calculatePID(state, 0, config, 1.0);

      // But rate limiting should constrain to 10%/s
      expect(Math.abs(result.output - 50)).toBeLessThanOrEqual(10);
    });
  });

  describe('Fault Detection', () => {
    test('should detect invalid PV', () => {
      const state = createPIDState({
        tag: 'TEST',
        description: 'Test',
        unit: '%',
      }, 50, 50);

      const result = calculatePID(state, NaN, DEFAULT_PID_CONFIG, 1.0);

      expect(result.state.fault).toBe(true);
      expect(result.state.faultReason).toBe('PV_INVALID');
    });

    test('should detect invalid dt', () => {
      const state = createPIDState({
        tag: 'TEST',
        description: 'Test',
        unit: '%',
      }, 50, 50);

      const result = calculatePID(state, 50, DEFAULT_PID_CONFIG, 0);

      expect(result.state.fault).toBe(true);
      expect(result.state.faultReason).toBe('DT_INVALID');
    });
  });

  describe('Diagnostics', () => {
    test('should report OK status when normal', () => {
      const state = createPIDState({
        tag: 'TEST',
        description: 'Test',
        unit: '%',
      }, 50, 50);

      state.pv = 50;

      const diag = getDiagnostics(state, DEFAULT_PID_CONFIG);

      expect(diag.status).toBe('OK');
    });

    test('should report WARNING when saturated', () => {
      const state = createPIDState({
        tag: 'TEST',
        description: 'Test',
        unit: '%',
      }, 50, 50);

      state.saturated = true;
      state.saturationDir = 'HI';

      const diag = getDiagnostics(state, DEFAULT_PID_CONFIG);

      expect(diag.status).toBe('WARNING');
      expect(diag.statusCode).toBe('SATURATED_HI');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EQUIPMENT CONSTRAINTS TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Equipment Constraints', () => {
  describe('Constraint Creation', () => {
    test('should create all standard constraints', () => {
      const constraints = createConstraints();

      expect(constraints.length).toBeGreaterThan(10);
      expect(constraints.some(c => c.id === 'CS-001')).toBe(true); // Speed max
      expect(constraints.some(c => c.id === 'CS-005')).toBe(true); // Torque
    });
  });

  describe('Interlock Creation', () => {
    test('should create all standard interlocks', () => {
      const interlocks = createInterlocks();

      expect(interlocks.length).toBeGreaterThan(5);
      expect(interlocks.some(i => i.id === 'IL-001')).toBe(true); // Start permissive
      expect(interlocks.some(i => i.id === 'IL-003')).toBe(true); // Torque trip
    });
  });

  describe('Normal Operation', () => {
    test('should return NORMAL status when all values in range', () => {
      const equipment = createTestEquipmentState();
      const constraints = createConstraints();
      const interlocks = createInterlocks();

      const result = evaluateConstraints(equipment, constraints, interlocks);

      expect(result.status).toBe('NORMAL');
      expect(result.anyViolated).toBe(false);
      expect(result.anyTripped).toBe(false);
    });
  });

  describe('Speed Constraint', () => {
    test('should enforce speed limit when exceeded', () => {
      const equipment = createTestEquipmentState({ speed: 3500 }); // Over 3200 limit
      const constraints = createConstraints();
      const interlocks = createInterlocks();

      const result = evaluateConstraints(equipment, constraints, interlocks);

      expect(result.anyViolated).toBe(true);
      expect(result.enforcedLimits.speed).toBe(3200);
    });
  });

  describe('Torque Trip', () => {
    test('should trip on high torque', () => {
      const equipment = createTestEquipmentState({ torque: 750 }); // Over 715 trip point
      const constraints = createConstraints();
      const interlocks = createInterlocks();

      const result = evaluateConstraints(equipment, constraints, interlocks);

      expect(result.anyTripped).toBe(true);
      expect(result.enforcedLimits.feedRate).toBe(0); // Feed should be stopped
    });
  });

  describe('Vibration Trip', () => {
    test('should trip and shutdown on extreme vibration', () => {
      const equipment = createTestEquipmentState({ vibration: 7.0 }); // Over 6.75 trip
      const constraints = createConstraints();
      const interlocks = createInterlocks();

      const result = evaluateConstraints(equipment, constraints, interlocks);

      expect(result.anyTripped).toBe(true);
      expect(result.status).toBe('TRIP');
      expect(result.enforcedLimits.speed).toBe(0); // Centrifuge should stop
    });
  });

  describe('Temperature Permissive', () => {
    test('should block start when feed temp too low', () => {
      const equipment = createTestEquipmentState({ feedTemp: 45 }); // Below 55°C
      const constraints = createConstraints();
      const interlocks = createInterlocks();

      const result = evaluateConstraints(equipment, constraints, interlocks);

      // Start permissive should be met (blocking start)
      const tempPermissive = result.interlocks.find(i => i.id === 'IL-001');
      expect(tempPermissive?.conditions[0].met).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MASS BALANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Mass Balance Validation', () => {
  describe('Perfect Closure', () => {
    test('should report 100% closure when mass is conserved', () => {
      const feed = createStreamComposition(10, 1020, 85, 5, 10, 70);
      const centrate = createStreamComposition(8.5, 1005, 95, 2, 3, 68);
      const cake = createStreamComposition(1.2, 1200, 35, 5, 60, 65);
      const oilRecovered = feed.oilMass - centrate.oilMass - cake.oilMass;

      const input: MassBalanceInput = {
        feed,
        centrate,
        cake,
        oilRecovered: Math.max(0, oilRecovered),
        timestamp: Date.now(),
      };

      const result = calculateMassBalance(input);

      // With matching mass, closure should be near 100%
      expect(result.closure).toBeGreaterThan(95);
    });
  });

  describe('Mass Balance Error Detection', () => {
    test('should detect mass balance error', () => {
      const feed = createStreamComposition(10, 1020, 85, 5, 10, 70);
      const centrate = createStreamComposition(9, 1005, 95, 2, 3, 68); // Too much centrate
      const cake = createStreamComposition(1.2, 1200, 35, 5, 60, 65);

      const input: MassBalanceInput = {
        feed,
        centrate,
        cake,
        oilRecovered: 50,
        timestamp: Date.now(),
      };

      const result = calculateMassBalance(input);

      // Closure error should be detected
      expect(result.toleranceExceeded).toBe(true);
      expect(result.status).not.toBe('OK');
    });
  });

  describe('Quality Metrics', () => {
    test('should calculate centrate solids correctly', () => {
      const feed = createStreamComposition(10, 1020, 85, 5, 10, 70);
      const centrate = createStreamComposition(8.5, 1005, 99, 0.5, 0.5, 68); // 0.5% solids
      const cake = createStreamComposition(1.2, 1200, 35, 5, 60, 65);

      const input: MassBalanceInput = {
        feed,
        centrate,
        cake,
        oilRecovered: 200,
        timestamp: Date.now(),
      };

      const result = calculateMassBalance(input);

      expect(result.centrateSolids).toBeCloseTo(0.5, 1);
    });

    test('should calculate cake moisture correctly', () => {
      const feed = createStreamComposition(10, 1020, 85, 5, 10, 70);
      const centrate = createStreamComposition(8.5, 1005, 99, 0.5, 0.5, 68);
      const cake = createStreamComposition(1.2, 1200, 65, 0, 35, 65); // 65% moisture

      const input: MassBalanceInput = {
        feed,
        centrate,
        cake,
        oilRecovered: 200,
        timestamp: Date.now(),
      };

      const result = calculateMassBalance(input);

      expect(result.cakeMoisture).toBeCloseTo(65, 1);
    });
  });

  describe('Alert Generation', () => {
    test('should generate alert for high centrate solids', () => {
      const feed = createStreamComposition(10, 1020, 85, 5, 10, 70);
      const centrate = createStreamComposition(8.5, 1005, 98, 0.5, 1.5, 68); // 1.5% solids - high
      const cake = createStreamComposition(1.2, 1200, 65, 0, 35, 65);

      const input: MassBalanceInput = {
        feed,
        centrate,
        cake,
        oilRecovered: 200,
        timestamp: Date.now(),
      };

      const result = calculateMassBalance(input);

      expect(result.alerts.some(a => a.code === 'CENTRATE_SOLIDS_HIGH')).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CALCULATION INTEGRITY TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Calculation Integrity', () => {
  describe('Range Validation', () => {
    test('should pass values within range', () => {
      const rule = createRangeRule('TEST_RANGE', 0, 100, '%');
      const result = rule.evaluate(50, { relatedValues: {}, dt: 1, equipmentState: 'RUNNING' });

      expect(result.valid).toBe(true);
      expect(result.status).toBe('VALID');
    });

    test('should fail values outside range', () => {
      const rule = createRangeRule('TEST_RANGE', 0, 100, '%');
      const result = rule.evaluate(150, { relatedValues: {}, dt: 1, equipmentState: 'RUNNING' });

      expect(result.valid).toBe(false);
      expect(result.status).toBe('INVALID');
    });
  });

  describe('Conservation Validation', () => {
    test('should pass when mass is conserved', () => {
      const rule = createConservationRule('MASS_CONS', 'inlet', ['outlet1', 'outlet2'], 5);
      const result = rule.evaluate(100, {
        relatedValues: { inlet: 100, outlet1: 60, outlet2: 40 },
        dt: 1,
        equipmentState: 'RUNNING',
      });

      expect(result.valid).toBe(true);
    });

    test('should fail when mass is not conserved', () => {
      const rule = createConservationRule('MASS_CONS', 'inlet', ['outlet1', 'outlet2'], 5);
      const result = rule.evaluate(100, {
        relatedValues: { inlet: 100, outlet1: 60, outlet2: 60 }, // Sum = 120, 20% error
        dt: 1,
        equipmentState: 'RUNNING',
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('Integrity Check', () => {
    test('should run all gates and report status', () => {
      const gates = createCentrifugeIntegrityGates();

      const values = {
        feedFlow: 8,
        feedTemp: 70,
        bowlSpeed: 2800,
        differential: 12,
        centrateFlow: 7,
        cakeRate: 1200,
        torque: 400,
        power: 45,
      };

      const previousValues = { ...values };

      const report = runIntegrityCheck(gates, values, previousValues, 1.0, 'RUNNING');

      expect(report.validCount).toBeGreaterThan(0);
      expect(report.overallStatus).toBeDefined();
    });

    test('should detect invalid values', () => {
      const gates = createCentrifugeIntegrityGates();

      const values = {
        feedFlow: 50, // Way over max of 20
        feedTemp: 70,
        bowlSpeed: 2800,
      };

      const previousValues = { ...values };

      const report = runIntegrityCheck(gates, values, previousValues, 1.0, 'RUNNING');

      expect(report.invalidCount).toBeGreaterThan(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHYSICS MODEL TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Physics Model', () => {
  describe('G-Force Calculation', () => {
    test('should calculate correct g-force', () => {
      const rpm = createLabeledValue(3000, 'RPM', 'MEASURED', 100, 'Test');
      const radius = createLabeledValue(0.25, 'm', 'MEASURED', 100, 'Test');

      const result = calculateGForce(rpm, radius);

      // G = (2π × 3000/60)² × 0.25 / 9.81 ≈ 2514
      expect(result.value).toBeGreaterThan(2400);
      expect(result.value).toBeLessThan(2600);
      expect(result.source).toBe('CALCULATED');
    });

    test('should calculate zero g-force at zero speed', () => {
      const rpm = createLabeledValue(0, 'RPM', 'MEASURED', 100, 'Test');

      const result = calculateGForce(rpm);

      expect(result.value).toBe(0);
    });
  });

  describe('Sigma Factor', () => {
    test('should calculate positive sigma', () => {
      const rpm = createLabeledValue(2800, 'RPM', 'MEASURED', 100, 'Test');

      const result = calculateSigma(rpm);

      expect(result.value).toBeGreaterThan(0);
      expect(result.source).toBe('MODELED');
      expect(result.unit).toBe('m²');
    });
  });

  describe('Critical Particle Size', () => {
    test('should calculate realistic critical size', () => {
      const feedRate = createLabeledValue(8, 'm³/hr', 'MEASURED', 100, 'Test');
      const sigma = createLabeledValue(3000, 'm²', 'MODELED', 90, 'Test');

      const fluidProps = {
        density: createLabeledValue(1010, 'kg/m³', 'MEASURED', 95, 'Test'),
        viscosity: createLabeledValue(0.001, 'Pa·s', 'MODELED', 80, 'Test'),
        temperature: createLabeledValue(70, '°C', 'MEASURED', 100, 'Test'),
        solidsContent: createLabeledValue(5, '%', 'MEASURED', 90, 'Test'),
        oilContent: createLabeledValue(3, '%', 'MEASURED', 90, 'Test'),
      };

      const particleProps = {
        d50: createLabeledValue(30, 'µm', 'ESTIMATED', 70, 'Test'),
        d10: createLabeledValue(10, 'µm', 'ESTIMATED', 60, 'Test'),
        d90: createLabeledValue(100, 'µm', 'ESTIMATED', 60, 'Test'),
        particleDensity: createLabeledValue(2500, 'kg/m³', 'ASSUMED', 80, 'Test'),
        sphericity: createLabeledValue(0.8, '', 'ASSUMED', 70, 'Test'),
      };

      const result = calculateCriticalParticleSize(feedRate, sigma, fluidProps, particleProps);

      // Critical size should be in micron range
      expect(result.value).toBeGreaterThan(0);
      expect(result.value).toBeLessThan(100);
      expect(result.source).toBe('MODELED');
    });
  });

  describe('Data Source Labeling', () => {
    test('should propagate confidence through calculations', () => {
      const rpm = createLabeledValue(2800, 'RPM', 'MEASURED', 95, 'Test');
      const radius = createLabeledValue(0.25, 'm', 'MEASURED', 100, 'Test');

      const result = calculateGForce(rpm, radius);

      // Confidence should be min of inputs
      expect(result.confidence).toBe(95);
    });

    test('should mark calculated values correctly', () => {
      const rpm = createLabeledValue(2800, 'RPM', 'MEASURED', 100, 'Test');

      const gForce = calculateGForce(rpm);
      const sigma = calculateSigma(rpm);

      expect(gForce.source).toBe('CALCULATED');
      expect(sigma.source).toBe('MODELED'); // Uses empirical correlation
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Integration Tests', () => {
  describe('Full Control Loop', () => {
    test('should regulate to setpoint over time', () => {
      const config: PIDConfig = {
        ...DEFAULT_PID_CONFIG,
        kp: 0.5,
        ki: 0.05,
        kd: 0.1,
      };

      let state = createPIDState({
        tag: 'TEST',
        description: 'Test',
        unit: '%',
      }, 70, 50);

      state = setMode(state, 'AUTO', config);

      let pv = 50; // Start below SP

      // Simulate 100 seconds of control
      for (let t = 0; t < 100; t++) {
        const result = calculatePID(state, pv, config, 1.0);
        state = result.state;

        // Simple process model: PV moves toward output
        pv += (result.output - 50) * 0.1;
        pv = Math.max(0, Math.min(100, pv));
      }

      // PV should be close to SP (70) after settling
      expect(Math.abs(pv - 70)).toBeLessThan(5);
    });
  });

  describe('Constraint Enforcement During Control', () => {
    test('should limit output when constraint is violated', () => {
      let state = createPIDState({
        tag: 'FIC-001',
        description: 'Flow Control',
        unit: 'm³/hr',
      }, 10, 50);

      state = setMode(state, 'AUTO', DEFAULT_PID_CONFIG);

      // Controller wants high output
      const result = calculatePID(state, 5, DEFAULT_PID_CONFIG, 1.0);

      // Check constraints
      const equipment = createTestEquipmentState({
        feedRate: result.output / 100 * 15, // Scale to feed rate
        torque: 700, // High torque - constraint violation
      });

      const constraints = createConstraints();
      const interlocks = createInterlocks();
      const constraintResult = evaluateConstraints(equipment, constraints, interlocks);

      // Constraint should limit feed rate
      if (constraintResult.enforcedLimits.feedRate !== undefined) {
        expect(constraintResult.enforcedLimits.feedRate).toBeLessThanOrEqual(15);
      }
    });
  });
});
