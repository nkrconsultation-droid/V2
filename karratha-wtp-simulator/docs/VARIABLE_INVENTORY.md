# Karratha WTP Simulator - Comprehensive Variable Inventory

**Generated:** 2026-01-28
**Repository:** karratha-wtp-simulator
**Total Variables Documented:** 700+

---

## Table of Contents

1. [State Variables](#1-state-variables)
2. [Constants & Configuration](#2-constants--configuration)
3. [Process Parameters](#3-process-parameters)
4. [Cost Variables](#4-cost-variables)
5. [Calculated/Derived Values](#5-calculatedderived-values)
6. [Flagged Issues](#6-flagged-issues)

---

## 1. State Variables

### Summary
- **Total useState declarations:** 73
- **Total useReducer declarations:** 0
- **Files with state:** 8
- **Largest component:** CentrifugeProcessControl.tsx (57 states)

---

### 1.1 App.tsx

| Variable | Line | Type | Initial Value | Purpose |
|----------|------|------|---------------|---------|
| `currentPage` | 37 | `Page` (union) | `'home'` | Current page navigation |
| `initialTab` | 38 | `string` | `'feed'` | Initial simulator tab |
| `plantStatus` | 39 | `object` | `{isRunning: true, activeAlarms: 0, throughput: 15.0, oilEfficiency: 95.2}` | Plant KPIs |

---

### 1.2 PFDViewer.tsx

| Variable | Line | Type | Initial Value | Purpose |
|----------|------|------|---------------|---------|
| `svgContent` | 237 | `string \| null` | `null` | SVG diagram content |
| `error` | 238 | `string \| null` | `null` | Error message |
| `zoom` | 239 | `number` | `0.8` | Zoom level (0.2-5.0) |
| `pan` | 240 | `{x, y}` | `{x: 50, y: 20}` | Pan offset |
| `isDragging` | 241 | `boolean` | `false` | Drag state |
| `dragStart` | 242 | `{x, y}` | `{x: 0, y: 0}` | Drag start position |
| `showPrintPreview` | 243 | `boolean` | `false` | Print dialog |
| `isFullscreen` | 244 | `boolean` | `false` | Fullscreen mode |

---

### 1.3 CentrifugeProcessControl.tsx (Main Simulator)

#### Simulation Control

| Variable | Line | Type | Initial Value | Purpose |
|----------|------|------|---------------|---------|
| `isRunning` | 413 | `boolean` | `false` | Simulation active |
| `simSpeed` | 414 | `number` | `10` | Speed multiplier |
| `simTime` | 415 | `number` | `0` | Elapsed time (s) |
| `activeTab` | 416 | `string` | `initialTab` | Current tab |

#### Equipment Configuration

| Variable | Line | Type | Initial Value | Purpose |
|----------|------|------|---------------|---------|
| `equipment` | 427 | `object` | Delta-Canter specs | Equipment parameters |
| `feedProps` | 434 | `object` | Phase fractions, densities | Feed characterization |

#### Process State

| Variable | Line | Type | Initial Value | Purpose |
|----------|------|------|---------------|---------|
| `proc` | 736 | `object` | Base operating point | Real-time process state |
| `alarms` | 748 | `array` | `[]` | Active alarms |
| `pendingAlarms` | 749 | `array` | `[]` | Delayed alarms |
| `totals` | 752 | `object` | All zeros | Session totals |
| `smoothedProc` | 994 | `object` | Smoothed values | UI display values |

#### Tank Farm

| Variable | Line | Type | Initial Value | Purpose |
|----------|------|------|---------------|---------|
| `tankFarm` | 490 | `array[6]` | VT-001 to VT-006 | Feed tank states |
| `selectedTank` | 498 | `null \| string` | `null` | Selected feed tank |
| `oilTanks` | 500 | `array[6]` | HT-001 to HT-006 | Oil tank states |
| `selectedOilTank` | 508 | `string` | `'HT-001'` | Selected oil tank |
| `oilInterlock` | 509 | `object` | `{active: false}` | Interlock status |
| `pond` | 511 | `object` | 8ML, 25% level | Evaporation pond |

#### Control Loops

| Variable | Line | Type | Initial Value | Purpose |
|----------|------|------|---------------|---------|
| `loops` | 544 | `object` | TIC, FIC, SIC | PID control loops |
| `chemDosing` | 553 | `object` | 7 chemical systems | Dosing configuration |
| `chemState` | 656 | `object` | Zeta potential, floc size | Chemical process effects |
| `chemCosts` | 668 | `object` | All zeros | Chemical costs |

#### Costs & Economics

| Variable | Line | Type | Initial Value | Purpose |
|----------|------|------|---------------|---------|
| `selectedFeedstock` | 801 | `string` | `'refinerySlop'` | Feedstock type |
| `selectedDestination` | 802 | `string` | `'kalgoorlie'` | Transport destination |
| `costs` | 805 | `object` | `DEFAULT_COSTS` | Market rates |
| `capitalModel` | 827 | `object` | SACOR Scenario 2 | NPV analysis inputs |

#### Performance & Compliance

| Variable | Line | Type | Initial Value | Purpose |
|----------|------|------|---------------|---------|
| `targets` | 872 | `object` | Delta-Canter guarantees | Performance targets |
| `dischargeLimits` | 880 | `object` | Environmental limits | Compliance limits |
| `productLimits` | 896 | `object` | Quality specs | Product specs |
| `aqc` | 905 | `object` | ADVISORY mode | Auto quality control |

---

### 1.4 ProcessOverview/index.tsx

| Variable | Line | Type | Initial Value | Purpose |
|----------|------|------|---------------|---------|
| `blockPositions` | 48 | `Record<string, {x, y}>` | From EQUIPMENT_BLOCKS | Block positions |
| `viewMode` | 57 | `'block' \| 'topology'` | `'block'` | Display mode |
| `selectedBlock` | 58 | `string \| null` | `null` | Selected equipment |
| `hoveredBlock` | 59 | `string \| null` | `null` | Hovered equipment |
| `animationEnabled` | 60 | `boolean` | `true` | Flow animations |
| `highlightedStream` | 61 | `string \| null` | `null` | Highlighted stream |
| `editMode` | 62 | `boolean` | `false` | Edit mode |

---

### 1.5 Hooks

#### useSimulation.ts

| Variable | Line | Type | Initial Value | Purpose |
|----------|------|------|---------------|---------|
| `smoothed` | 46 | `T` (generic) | `rawValues` | Smoothed UI values |
| `trendData` | 97 | `TrendDataPoint[]` | `[]` | Trend history |
| `alarms` | 165 | `ProcessAlarm[]` | `[]` | Alarm states |
| `isVisible` | 370 | `boolean` | `false` | Debug panel |

---

## 2. Constants & Configuration

### 2.1 Simulation Configuration

**File:** `src/hooks/useSimulation.ts`

| Constant | Value | Units | Purpose |
|----------|-------|-------|---------|
| `SIM_CONFIG.maxTrendPoints` | 300 | points | Max trend history |
| `SIM_CONFIG.logIntervalSec` | 1 | s | Logging interval |
| `SIM_CONFIG.smoothWindowMs` | 8000 | ms | Smoothing window |
| `SIM_CONFIG.smoothUpdateIntervalMs` | 250 | ms | Update interval |

---

### 2.2 Database Configuration

**File:** `src/lib/database.ts`

| Constant | Value | Units | Purpose |
|----------|-------|-------|---------|
| `DB_NAME` | 'KarrathaWTP' | - | Database name |
| `DB_VERSION` | 1 | - | Schema version |
| `LIMITS.sessions` | 50 | records | Max sessions |
| `LIMITS.trends` | 10000 | records | Max trend points |
| `LIMITS.alarms` | 5000 | records | Max alarm records |

---

### 2.3 Physical Constants

**File:** `src/lib/engineering-v2.ts`

| Constant | Value | Units | Purpose |
|----------|-------|-------|---------|
| `CONSTANTS.g` | 9.80665 | m/s² | Gravitational acceleration |
| `CONSTANTS.R` | 8.31446 | J/mol·K | Gas constant |
| `CONSTANTS.Na` | 6.02214e23 | mol⁻¹ | Avogadro's number |
| `CONSTANTS.kB` | 1.38065e-23 | J/K | Boltzmann constant |
| `CONSTANTS.WATER_DENSITY_25C` | 997.05 | kg/m³ | Water density |
| `CONSTANTS.WATER_VISCOSITY_25C` | 0.890e-3 | Pa·s | Water viscosity |
| `CONSTANTS.OIL_DENSITY_TYPICAL` | 850 | kg/m³ | Oil density |
| `CONSTANTS.SOLIDS_DENSITY_TYPICAL` | 2500 | kg/m³ | Solids density |
| `CONSTANTS.API_DESIGN_DROPLET` | 150e-6 | m | API 421 design droplet |

---

### 2.4 PFD Viewer Constants

**File:** `src/components/PFDViewer.tsx`

| Constant | Value | Units | Purpose |
|----------|-------|-------|---------|
| `MIN_ZOOM` | 0.2 | ratio | Minimum zoom |
| `MAX_ZOOM` | 5 | ratio | Maximum zoom |
| `renderCounter` | (incremented) | - | Unique render ID |

---

## 3. Process Parameters

### 3.1 Delta-Canter 20-843A Equipment Specifications

**File:** `src/lib/equipment-config.ts`

#### Bowl Geometry

| Parameter | Value | Units | Purpose |
|-----------|-------|-------|---------|
| `bowl.diameter` | 520 | mm | Bowl diameter |
| `bowl.length` | 1800 | mm | Bowl length |
| `bowl.ldRatio` | 4.0 | - | L/D ratio |
| `bowl.coneAngle` | 8.5 | degrees | Cone angle |

#### Operating Parameters

| Parameter | Value | Units | Purpose |
|-----------|-------|-------|---------|
| `operation.maxGForce` | 3000 | G | Maximum G-force |
| `operation.bowlSpeedMin` | 2200 | RPM | Minimum speed |
| `operation.bowlSpeedMax` | 3600 | RPM | Maximum speed |
| `operation.bowlSpeedNominal` | 3200 | RPM | Nominal speed |
| `operation.diffSpeedMin` | 2 | RPM | Min differential |
| `operation.diffSpeedMax` | 45 | RPM | Max differential |

#### Capacity

| Parameter | Value | Units | Purpose |
|-----------|-------|-------|---------|
| `capacity.designThroughput` | 15 | m³/h | Design capacity |
| `capacity.operatingMin` | 10 | m³/h | Min operating |
| `capacity.operatingMax` | 30 | m³/h | Max operating |

#### Motors

| Parameter | Value | Units | Purpose |
|-----------|-------|-------|---------|
| `motors.mainMotorPower` | 45 | kW | Main motor |
| `motors.backDriveMotorPower` | 11 | kW | Back drive |
| `motors.totalInstalledPower` | 75 | kW | Total power |
| `motors.motorEfficiency` | 0.94 | - | IE3 efficiency |
| `motors.vfdEfficiency` | 0.97 | - | VFD efficiency |

---

### 3.2 Performance Guarantees

**File:** `src/lib/equipment-config.ts`

| Parameter | Value | Units | Purpose |
|-----------|-------|-------|---------|
| `oilRecoveryEfficiency` | 95 | % | Oil recovery guarantee |
| `solidsRecoveryEfficiency` | 95 | % | Solids recovery guarantee |
| `centrateTPH` | 500 | mg/L | TPH in water phase |
| `cakeDryness` | 80 | % | Dry solids in cake |
| `massBalanceAccuracy` | 3 | % | Mass balance variance |
| `mechanicalAvailability` | 90 | % | 12-month availability |

---

### 3.3 Alarm Limits (ISO 10816-3)

**File:** `src/lib/equipment-config.ts`

#### Vibration Zones

| Zone | Limit | Units | Status |
|------|-------|-------|--------|
| A | 1.8 | mm/s RMS | Good |
| B | 4.5 | mm/s RMS | Acceptable |
| C | 7.1 | mm/s RMS | Warning |
| D | 11.2 | mm/s RMS | Danger |

#### Bearing Temperature

| Level | Value | Units |
|-------|-------|-------|
| Normal | 60 | °C |
| High Alarm | 80 | °C |
| High-High | 90 | °C |
| Trip | 95 | °C |

#### Bowl Speed

| Level | Value | Units |
|-------|-------|-------|
| Low | 2000 | RPM |
| Low-Low | 1800 | RPM |
| High | 3700 | RPM |
| High-High | 3800 | RPM |

#### Water Quality

| Level | Value | Units |
|-------|-------|-------|
| Target | 300 | ppm OiW |
| Acceptable | 500 | ppm OiW |
| Alarm | 750 | ppm OiW |
| Trip | 1000 | ppm OiW |

---

### 3.4 Discharge Limits (Environmental Compliance)

**File:** `src/lib/equipment-config.ts`

| Parameter | Value | Units |
|-----------|-------|-------|
| `oilInWater` | 500 | ppm |
| `tph` | 500 | ppm |
| `trh` | 15 | mg/L |
| `cod` | 250 | mg/L |
| `turbidity` | 50 | NTU |
| `pH.min` | 6.0 | - |
| `pH.max` | 9.0 | - |
| `tss` | 50 | mg/L |
| `temperature` | 40 | °C |

---

### 3.5 PID Control Parameters

**File:** `src/components/CentrifugeProcessControl.tsx`

#### Temperature Controller (TIC-001)

| Parameter | Value | Units |
|-----------|-------|-------|
| Setpoint | 65 | °C |
| Kp | 2.0 | - |
| Ki | 0.1 | - |
| Kd | 0.5 | - |

#### Feed Flow Controller (FIC-001)

| Parameter | Value | Units |
|-----------|-------|-------|
| Setpoint | 15 | m³/h |
| Kp | 1.5 | - |
| Ki | 0.2 | - |
| Kd | 0.1 | - |

#### Speed Controller (SIC-001)

| Parameter | Value | Units |
|-----------|-------|-------|
| Setpoint | 3200 | RPM |
| Kp | 0.5 | - |
| Ki | 0.05 | - |
| Kd | 0.02 | - |

---

### 3.6 Chemical Dosing Parameters

**File:** `src/components/CentrifugeProcessControl.tsx`

#### Demulsifier (CHEM-001)

| Parameter | Value | Units |
|-----------|-------|-------|
| `minDose` | 0 | ppm |
| `maxDose` | 500 | ppm |
| `defaultDose` | 50 | ppm |
| `pumpCapacity` | 100 | L/h |
| `concentration` | 100 | % |
| `density` | 980 | kg/m³ |
| `costPerLiter` | 4.50 | $/L |
| `optimalRange.min` | 20 | ppm |
| `optimalRange.max` | 150 | ppm |

#### Flocculant (CHEM-002)

| Parameter | Value | Units |
|-----------|-------|-------|
| `minDose` | 0 | ppm |
| `maxDose` | 200 | ppm |
| `defaultDose` | 0 | ppm |
| `pumpCapacity` | 50 | L/h |
| `concentration` | 0.5 | % |
| `costPerLiter` | 8.00 | $/L |

#### Coagulant (CHEM-003)

| Parameter | Value | Units |
|-----------|-------|-------|
| `minDose` | 0 | ppm |
| `maxDose` | 300 | ppm |
| `costPerLiter` | 0.85 | $/L |

#### Acid (CHEM-004)

| Parameter | Value | Units |
|-----------|-------|-------|
| `maxDose` | 500 | mL/m³ |
| `density` | 1840 | kg/m³ |
| `concentration` | 98 | % |
| `costPerLiter` | 0.35 | $/L |

#### Caustic (CHEM-005)

| Parameter | Value | Units |
|-----------|-------|-------|
| `maxDose` | 500 | mL/m³ |
| `density` | 1530 | kg/m³ |
| `concentration` | 50 | % |
| `costPerLiter` | 0.45 | $/L |

#### Scale Inhibitor (CHEM-006)

| Parameter | Value | Units |
|-----------|-------|-------|
| `maxDose` | 50 | ppm |
| `defaultDose` | 5 | ppm |
| `costPerLiter` | 12.00 | $/L |

#### Antifoam (CHEM-007)

| Parameter | Value | Units |
|-----------|-------|-------|
| `maxDose` | 100 | ppm |
| `defaultDose` | 10 | ppm |
| `costPerLiter` | 6.50 | $/L |

---

### 3.7 SPDD1600 Polishing Filter

**File:** `src/components/CentrifugeProcessControl.tsx`

#### Physical Specifications

| Parameter | Value | Units |
|-----------|-------|-------|
| `portSize` | 100 | mm |
| `bedDepth` | 1200 | mm |
| `innerDiameter` | 1600 | mm |
| `filterArea` | 2.01 | m² |
| `mediaVolume` | 2.366 | m³ |

#### Operating Parameters

| Parameter | Value | Units |
|-----------|-------|-------|
| `pressureRange.min` | 2.5 | bar |
| `pressureRange.max` | 10 | bar |
| `maxDifferentialPressure` | 1.5 | bar |
| `turbidityRemoval` | 0.85 | ratio |
| `oilRemoval` | 0.70 | ratio |
| `nominalMicron` | 20 | μm |
| `backwashDuration` | 300 | s |

---

### 3.8 Batch Processing Phases

**File:** `src/lib/constants/batch-phases.ts`

| Phase | Water % | Oil % | Sed % | Volume (m³) | Temp (°C) | Flow (m³/h) | RPM |
|-------|---------|-------|-------|-------------|-----------|-------------|-----|
| Heavy Sediment | 60 | 10 | 30 | 2.75 | 55 | 6 | 4200 |
| Mixed Sludge | 65 | 15 | 20 | 5.5 | 58 | 8 | 4000 |
| Emulsion Layer | 50 | 45 | 5 | 8.25 | 65 | 10 | 3800 |
| Water-Rich | 85 | 12 | 3 | 22.0 | 62 | 14 | 3200 |
| Oil-Rich | 30 | 65 | 5 | 11.0 | 68 | 12 | 3500 |
| Final Rinse | 95 | 4 | 1 | 5.5 | 55 | 10 | 3000 |
| **Total** | - | - | - | **55.0** | - | - | - |

---

## 4. Cost Variables

### 4.1 Electricity Costs

| Variable | Value | Units | File | Line | Notes |
|----------|-------|-------|------|------|-------|
| Base Rate | 0.28 | $/kWh | simulation.ts | 45 | Standard daytime |
| Peak Rate | 0.45 | $/kWh | simulation.ts | 46 | 14:00-20:00 |
| Alt Rate | 0.34 | $/kWh | feedstock.ts | 110 | Alternative default |
| Engineering | 0.28 | $/kWh | equipment-config.ts | 292 | WA commercial |

---

### 4.2 Chemical Costs

| Chemical | Value | Units | File | Line |
|----------|-------|-------|------|------|
| Demulsifier | 8.50 | $/L | simulation.ts | 50 |
| Flocculant | 3.20 | $/kg | simulation.ts | 51 |
| Acid | 1.50 | $/L | simulation.ts | 52 |
| Caustic | 1.80 | $/L | simulation.ts | 53 |
| Generic | 2.50 | $/kg | engineering.ts | 547 |

---

### 4.3 Disposal & Waste Costs

| Category | Value | Units | File | Line |
|----------|-------|-------|------|------|
| Sludge (Primary) | 180 | $/m³ | simulation.ts | 56 |
| Sludge (Alternative) | 270 | $/m³ | feedstock.ts | 111 |
| Sludge (Engineering) | 150 | $/m³ | engineering.ts | 548 |
| Oily Waste | 250 | $/m³ | simulation.ts | 57 |
| Water Treatment | 2.50 | $/m³ | equipment-config.ts | 294 |
| Water Treatment (Alt) | 3.50 | $/m³ | feedstock.ts | 112 |
| Pond Disposal | 3.50 | $/m³ | feedstock.ts | 115 |

---

### 4.4 Labour Costs

| Category | Value | Units | File | Line |
|----------|-------|-------|------|------|
| Operator Rate | 85 | $/hr | simulation.ts | 60 |
| Maintenance Rate | 120 | $/hr | simulation.ts | 61 |
| Alt Labour Rate | 140 | $/hr | feedstock.ts | 116 |
| Operators/Shift | 1 | count | simulation.ts | 62 |
| Daily Hours | 4 | hrs/day | engineering.ts | 551 |

---

### 4.5 Revenue & Product Value

| Category | Value | Units | File | Line |
|----------|-------|-------|------|------|
| Oil Recovery | 450 | $/m³ | simulation.ts | 65 |
| Treatment Fee | 85 | $/m³ | simulation.ts | 66 |

---

### 4.6 Feedstock-Specific Oil Values

| Feedstock Type | Oil Value | Units | Oil Content |
|----------------|-----------|-------|-------------|
| Wash Water | 350 | $/m³ | 2.5% |
| Refinery Slop | 450 | $/m³ | 8.0% |
| Tank Bottoms | 280 | $/m³ | 15.0% |
| Produced Water | 400 | $/m³ | 1.5% |
| Light Crude | 520 | $/m³ | 25.0% |
| Heavy Crude | 380 | $/m³ | 20.0% |

---

### 4.7 Transport Costs

| Destination | Cost | Units | Distance |
|-------------|------|-------|----------|
| Kalgoorlie | 220 | $/m³ | 1,200 km |
| Perth (Kwinana) | 280 | $/m³ | 1,500 km |
| Local Processing | 80 | $/m³ | <50 km |
| Port Hedland | 150 | $/m³ | 240 km |

---

### 4.8 Maintenance Costs

| Category | Value | Units | Notes |
|----------|-------|-------|-------|
| Maintenance Factor | 0.02 | %/year | 2% of CAPEX annually |
| Hourly Allowance | 5 | $/hr | Operating contingency |
| Quarterly Interval | 2160 | hours | 90 days |
| Annual Interval | 8760 | hours | 365 days |

---

### 4.9 Capital Model (SACOR Scenario 2)

| Parameter | Value | Units |
|-----------|-------|-------|
| Investment | 587,750 | $ |

---

## 5. Calculated/Derived Values

### 5.1 Mass Balance Calculations

**File:** `src/lib/integrity/massBalance.ts`

| Calculation | Formula | Units |
|-------------|---------|-------|
| Total Mass In | `feed.totalMass` | kg/hr |
| Total Mass Out | `centrate + cake + oilRecovered` | kg/hr |
| Closure Error | `totalIn - totalOut` | kg/hr |
| Closure Error % | `(closureError / totalIn) × 100` | % |
| Closure | `(totalOut / totalIn) × 100` | % |
| Oil Recovery | `(oilRecovered / feedOil) × 100` | % |
| Cake Moisture | `(cake.waterMass / cake.totalMass) × 100` | % |

---

### 5.2 Stokes Law Separation

**File:** `src/lib/engineering.ts`

| Calculation | Formula | Units |
|-------------|---------|-------|
| Terminal Velocity | `(g × d² × Δρ) / (18 × μ)` | m/s |
| Reynolds Number | `(ρf × v × d) / μ` | - |

**Correction Factors by Regime:**
- Stokes (Re < 0.1): CF = 1.0
- Oseen (Re 0.1-1): CF = √(24 / (Re × Cd))
- Intermediate (Re 1-500): Schiller-Naumann
- Newton (Re > 500): CF = √(24 / (Re × 0.44))

---

### 5.3 API Separator Design

**File:** `src/lib/engineering.ts`

| Calculation | Formula | Units |
|-------------|---------|-------|
| Required Surface Area | `Q / vt` | m² |
| Hydraulic Loading | `flowRate / As` | m³/m²/hr |
| Oil Retention Time | `(volume × 0.2) / Q` | seconds |
| Water Retention Time | `volume / Q` | seconds |
| Removal Efficiency | `targetRemoval × (vt / (Q / As))` | fraction |
| Effluent Oil | `inlet × (1 - efficiency)` | ppm |

---

### 5.4 Heat Transfer

**File:** `src/lib/engineering.ts`

| Calculation | Formula | Units |
|-------------|---------|-------|
| Heating Duty | `ṁ × Cp × ΔT` | W |
| Energy Cost/Hour | `powerKW × rate` | $/hr |
| Heat Loss | `U × A × (T_tank - T_ambient)` | W |

---

### 5.5 Pump Performance

**File:** `src/lib/engineering.ts`

| Calculation | Formula | Units |
|-------------|---------|-------|
| Hydraulic Power | `ρ × g × Q × H` | W |
| Shaft Power | `P_hydraulic / efficiency` | kW |
| NPSH Required | `2 + 0.01 × Q` | m |
| Operating Cost | `shaftPower × electricityCost` | $/hr |

---

### 5.6 Daily Cost Calculations

**File:** `src/lib/engineering.ts`

| Calculation | Formula | Units |
|-------------|---------|-------|
| Daily Electricity | `(pumpPower + heaterPower) × hours × rate` | $/day |
| Daily Chemicals | `(throughput × 1000 × dosage / 1e6) × cost` | $/day |
| Daily Sludge | `sludgeProduction × disposalCost` | $/day |
| Daily Maintenance | `(CAPEX × 0.02) / 365` | $/day |
| Daily Labour | `hours × rate` | $/day |
| Cost per m³ | `dailyTotal / throughput` | $/m³ |

---

### 5.7 Revenue Calculations

**File:** `src/lib/simulation.ts`

| Calculation | Formula | Units |
|-------------|---------|-------|
| Oil Revenue | `oilRecovered × oilValue` | $/day |
| Treatment Revenue | `processed × treatmentFee` | $/day |
| Net Cost | `totalCost - (oilRevenue + treatmentRevenue)` | $/day |

---

### 5.8 Hindered Settling (Richardson-Zaki)

**File:** `src/lib/engineering-v2.ts`

| Calculation | Formula | Units |
|-------------|---------|-------|
| Richardson-Zaki n (Re < 0.2) | 4.65 | - |
| Richardson-Zaki n (0.2 < Re < 1) | 4.35 × Re^(-0.03) | - |
| Richardson-Zaki n (1 < Re < 500) | 4.45 × Re^(-0.1) | - |
| Hindered Velocity | `v_t × (1 - φ)^n` | m/s |

---

### 5.9 Centrifuge G-Force & Capacity

**File:** `src/lib/engineering-v2.ts`

| Calculation | Formula | Units |
|-------------|---------|-------|
| G-Force | `(2πN/60)² × r / g` | G |
| Sigma Factor | `(2π × L × ω² × (r₂³ - r₁³)) / (3 × g × ln(r₂/r₁))` | m² |
| Capacity | `Σ × 2 × v_s × 3600` | m³/hr |

---

### 5.10 Pump Affinity Laws

**File:** `src/lib/engineering-v2.ts`

| Calculation | Formula |
|-------------|---------|
| Flow | `Q₂ = Q₁ × (N₂/N₁)` |
| Head | `H₂ = H₁ × (N₂/N₁)²` |
| Power | `P₂ = P₁ × (N₂/N₁)³` |

---

## 6. Flagged Issues

### 6.1 Inconsistent Values (Same Parameter, Different Values)

| Parameter | Location 1 | Value 1 | Location 2 | Value 2 | Recommendation |
|-----------|------------|---------|------------|---------|----------------|
| Electricity Rate | simulation.ts:45 | 0.28 $/kWh | feedstock.ts:110 | 0.34 $/kWh | Consolidate to single source |
| Electricity Rate | engineering.ts:382 | 0.25 $/kWh | equipment-config.ts:292 | 0.28 $/kWh | Use config file only |
| Sludge Disposal | simulation.ts:56 | 180 $/m³ | feedstock.ts:111 | 270 $/m³ | Document which is default |
| Sludge Disposal | engineering.ts:548 | 150 $/m³ | - | - | Three different values |
| Water Treatment | equipment-config.ts:294 | 2.50 $/m³ | feedstock.ts:112 | 3.50 $/m³ | Consolidate |
| Labour Rate | simulation.ts:60 | 85 $/hr | feedstock.ts:116 | 140 $/hr | Clarify which is correct |

---

### 6.2 Missing Units/Time Basis

| Variable | Location | Issue |
|----------|----------|-------|
| `maintenanceFactor` | engineering.ts:549 | Value 0.02 - is this %/year or %/month? |
| `CAPEX assumption` | engineering.ts:559 | Hardcoded $500k - should be configurable |
| Several PID gains | CentrifugeProcessControl.tsx | Kp, Ki, Kd units not documented |

---

### 6.3 Hardcoded Values (Should Be Configurable)

| Value | Location | Current Value | Recommendation |
|-------|----------|---------------|----------------|
| CAPEX for maintenance calc | engineering.ts:559 | $500,000 | Move to config |
| Peak hours | simulation.ts:46 | 14:00-20:00 | Make configurable |
| Max trend points | useSimulation.ts | 300 | Move to user settings |
| Chemical dosage default | engineering.ts:547 | 50 mg/L | Already in chemDosing state |

---

### 6.4 Duplicate Constants

| Constant | Locations | Recommendation |
|----------|-----------|----------------|
| `g` (gravity) | engineering.ts, engineering-v2.ts | Use single physics constants file |
| `WATER_DENSITY_25C` | engineering.ts, engineering-v2.ts | Consolidate |
| `OIL_DENSITY_TYPICAL` | engineering.ts, engineering-v2.ts | Consolidate |

---

### 6.5 Missing ROI/Payback Calculations

The codebase tracks costs and revenue but does not currently include:
- ROI calculation
- Payback period calculation
- NPV/IRR calculations (referenced in capitalModel state but not implemented)

**Recommendation:** Add financial analysis module with:
```typescript
interface FinancialMetrics {
  roi: number;              // % return on investment
  paybackPeriod: number;    // months or years
  npv: number;              // net present value
  irr: number;              // internal rate of return
}
```

---

### 6.6 State Variables That Could Be Derived

| Variable | Location | Could Be Derived From |
|----------|----------|----------------------|
| `totals` | CentrifugeProcessControl:752 | Could use useReducer for cleaner accumulation |
| `smoothedProc` | CentrifugeProcessControl:994 | Already using custom hook, good pattern |

---

## Appendix: File Index

| File | State Vars | Constants | Cost Vars | Calculations |
|------|------------|-----------|-----------|--------------|
| App.tsx | 3 | 0 | 0 | 0 |
| PFDViewer.tsx | 8 | 2 | 0 | 0 |
| CentrifugeProcessControl.tsx | 57 | 50+ | 20+ | 30+ |
| ProcessOverview/index.tsx | 7 | 5 | 0 | 0 |
| NetworkTopology.tsx | 6 | 0 | 0 | 0 |
| AlarmBanner.tsx | 1 | 0 | 0 | 0 |
| useSimulation.ts | 4 | 4 | 0 | 5 |
| usePhaseTracking.ts | 1 | 0 | 0 | 0 |
| engineering.ts | 0 | 10 | 5 | 20+ |
| engineering-v2.ts | 0 | 30 | 0 | 50+ |
| equipment-config.ts | 0 | 100+ | 5 | 0 |
| simulation.ts | 0 | 20 | 10 | 30+ |
| simulation-v2.ts | 0 | 80+ | 0 | 40+ |
| feedstock.ts | 0 | 30 | 15 | 0 |
| batch-phases.ts | 0 | 40 | 0 | 0 |
| constraints.ts | 0 | 50+ | 0 | 0 |
| cascade.ts | 0 | 30 | 0 | 10 |
| massBalance.ts | 0 | 5 | 0 | 20+ |
| database.ts | 0 | 10 | 0 | 0 |

---

**End of Variable Inventory**
