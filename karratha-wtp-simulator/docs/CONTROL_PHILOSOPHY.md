# Control Philosophy Document

## SACOR Delta-Canter 20-843A Centrifuge Simulator
### Karratha WTP - Version 2.0

---

## Document Control

| Revision | Date | Author | Description |
|----------|------|--------|-------------|
| 2.0 | 2024-01 | Engineering | Industrial-grade control implementation |

---

## 1. SCOPE AND PURPOSE

This document defines the control philosophy for the SACOR Delta-Canter 20-843A decanter centrifuge simulator at Karratha Water Treatment Plant. It establishes the control architecture, safety systems, and operational boundaries that govern the simulation.

### 1.1 Applicable Standards

- **ISA-5.1** - Instrumentation Symbols and Identification
- **ISA-18.2** - Management of Alarm Systems
- **ISA-88** - Batch Control
- **ISA-95** - Enterprise-Control System Integration
- **ISA-101** - Human Machine Interfaces
- **ISA-84 / IEC 61511** - Safety Instrumented Systems

### 1.2 Equipment Identification

| Equipment Tag | Description | Manufacturer Model |
|---------------|-------------|-------------------|
| CF-001 | Decanter Centrifuge | SACOR Delta-Canter 20-843A |
| TIC-001 | Feed Temperature Control | Cascade Slave Loop |
| FIC-001 | Feed Flow Control | Cascade Slave Loop |
| SIC-001 | Bowl Speed Control | Cascade Slave Loop |
| QIC-001 | Quality Master Controller | Cascade Master |

---

## 2. CONTROL ARCHITECTURE

### 2.1 Cascade Control Structure

The centrifuge operates under a true cascade control architecture where a Quality Master (QIC-001) manipulates slave loop setpoints to maintain product quality.

```
                    ┌─────────────────┐
                    │   QIC-001       │
                    │ Quality Master  │
                    │   (AUTO/MAN)    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ TIC-001  │  │ FIC-001  │  │ SIC-001  │
        │  Temp    │  │  Flow    │  │  Speed   │
        │(CAS/AUTO)│  │(CAS/AUTO)│  │(CAS/AUTO)│
        └──────────┘  └──────────┘  └──────────┘
              │              │              │
              ▼              ▼              ▼
          Heater         Feed Pump      VFD
```

### 2.2 Control Modes

| Mode | Description | Behavior |
|------|-------------|----------|
| **OFF** | Controller disabled | Output held, no calculation |
| **MAN** | Manual mode | Operator directly controls output |
| **AUTO** | Automatic mode | PID calculates output from SP/PV |
| **CAS** | Cascade mode | SP comes from master controller |

### 2.3 Cascade Startup Sequence

The cascade system follows a deterministic startup sequence:

| Step | State | Description | Transition Criteria |
|------|-------|-------------|---------------------|
| 0 | IDLE | System idle | Start command |
| 1 | HEATER_WARMUP | Heater ramping | T > 50°C |
| 2 | HEATER_STABLE | Temp stable | Deviation < 2°C for 30s |
| 3 | CENTRIFUGE_START | Bowl accelerating | RPM > 1800 |
| 4 | CENTRIFUGE_STABLE | Speed stable | Deviation < 50 RPM for 30s |
| 5 | CHEMISTRY_START | Polymer dosing | Dose rate stable |
| 6 | CHEMISTRY_STABLE | Chemistry ready | Deviation < 5% for 60s |
| 7 | FEED_START | Feed ramping | Flow > 1 m³/hr |
| 8 | FEED_STABLE | Feed stable | Deviation < 0.5 m³/hr for 60s |
| 9 | CASCADE_READY | All slaves stable | Manual cascade enable |
| 10 | CASCADE_ACTIVE | Full automatic | Continuous operation |

### 2.4 Bumpless Transfer

Mode transfers are implemented bumplessly:

- **MAN → AUTO**: Integral term initialized to match current output
- **AUTO → CAS**: SP set to current value before cascade engagement
- **Any → MAN**: Manual output captures current automatic output

---

## 3. PID CONTROLLER IMPLEMENTATION

### 3.1 Algorithm

Standard ISA parallel form with derivative-on-PV:

```
Output = Kp × e + Ki × ∫e dt + Kd × d(PV)/dt + Bias
```

Where:
- e = SP - PV (error)
- Kp = Proportional gain
- Ki = Integral gain (1/s)
- Kd = Derivative gain (s)
- Bias = 50% (default)

### 3.2 Anti-Windup

Back-calculation method prevents integral windup:

```
When saturated:
  Integral += AntiWindupGain × (ClampedOutput - RawOutput) × dt
```

### 3.3 Derivative Filtering

First-order filter on derivative term:

```
FilteredDerivative = α × PreviousDerivative + (1-α) × RawDerivative
```

Where α = derivativeFilterCoeff (default 0.8)

### 3.4 Default Tuning Parameters

| Controller | Kp | Ki | Kd | Description |
|------------|----|----|----|----|
| TIC-001 | 2.0 | 0.05 | 0.5 | Temperature |
| FIC-001 | 1.5 | 0.2 | 0.0 | Flow |
| SIC-001 | 1.0 | 0.1 | 0.2 | Speed |
| QIC-001 | 0.5 | 0.02 | 0.0 | Quality Master |

---

## 4. EQUIPMENT CONSTRAINTS

### 4.1 Hard Constraints (Enforced)

These limits are automatically enforced and cannot be overridden:

| ID | Variable | Limit | Unit | Action |
|----|----------|-------|------|--------|
| CS-001 | Bowl Speed | ≤ 3200 | RPM | Limit output |
| CS-003 | Differential | ≤ 25 | RPM | Limit output |
| CS-005 | Scroll Torque | ≤ 650 | Nm | Reduce feed |
| CS-007 | Vibration | ≤ 4.5 | mm/s | Reduce speed |
| CS-011 | Feed Rate | ≤ 15 | m³/hr | Limit output |

### 4.2 Soft Constraints (Advisory)

These generate alarms but can be bypassed:

| ID | Variable | Limit | Unit | Bypassable |
|----|----------|-------|------|------------|
| CS-002 | Bowl Speed | ≥ 1800 | RPM | Yes |
| CS-012 | Feed Temp | ≥ 55 | °C | Yes |
| CS-014 | Pond Depth | ≥ 100 | mm | Yes |
| CS-017 | Runtime | ≤ 168 | hr | Yes |

### 4.3 Trip Points

These cause immediate protective action:

| ID | Variable | Limit | Action | Reset |
|----|----------|-------|--------|-------|
| CS-006 | Torque | > 715 Nm | Stop feed | Manual |
| CS-008 | Vibration | > 6.75 mm/s | Shutdown | Manual |

---

## 5. SAFETY INTERLOCKS

### 5.1 Start Permissives

The following conditions must be met before feed can start:

| ID | Condition | Threshold |
|----|-----------|-----------|
| IL-001 | Feed temperature | ≥ 55°C |
| IL-002 | Bowl speed | ≥ 1800 RPM |

### 5.2 Process Trips

| ID | Condition | Action | Auto-Reset |
|----|-----------|--------|------------|
| IL-003 | Torque > 715 Nm | Stop feed | No |
| IL-004 | Vibration > 6.75 mm/s | Stop centrifuge | No |
| IL-005 | Bearing temp > 90°C | Stop centrifuge | No |

### 5.3 Safety Interlocks

| ID | Condition | Action | Auto-Reset |
|----|-----------|--------|------------|
| IL-006 | Speed < 1620 RPM | Stop feed | Yes (5s) |
| IL-007 | Feed pressure > 400 kPa | Close valve | Yes (10s) |

---

## 6. MASS BALANCE VALIDATION

### 6.1 Philosophy

Mass balance is calculated **independently** without forced closure. Any discrepancy between inlet and outlet is **reported**, not hidden.

### 6.2 Balance Equations

```
Total:   Feed_mass = Centrate_mass + Cake_mass + Oil_recovered + Error
Water:   Feed_water = Centrate_water + Cake_water + Error
Solids:  Feed_solids = Centrate_solids + Cake_solids + Error
Oil:     Feed_oil = Centrate_oil + Cake_oil + Oil_recovered + Error
```

### 6.3 Tolerance Limits

| Parameter | Warning | Alarm |
|-----------|---------|-------|
| Overall closure | ±1.5% | ±3.0% |
| Component closure | ±3.0% | ±5.0% |

### 6.4 Quality Targets

| Parameter | Target | Tolerance |
|-----------|--------|-----------|
| Centrate solids | < 0.5% | - |
| Cake moisture | 65% | ±5% |
| Oil recovery | > 85% | - |

---

## 7. CALCULATION INTEGRITY

### 7.1 Data Source Classification

Every calculated value carries an explicit source label:

| Symbol | Source | Confidence | Description |
|--------|--------|------------|-------------|
| ● | MEASURED | 90-100% | Direct sensor reading |
| ◆ | CALCULATED | 80-95% | Derived from measurements |
| ■ | MODELED | 60-85% | Empirical correlation |
| ○ | ESTIMATED | 40-70% | Engineering estimate |
| △ | ASSUMED | 50-80% | Default or assumed value |

### 7.2 Validation Gates

Each calculated value passes through validation gates before display:

1. **Range check**: Value within physical limits
2. **Rate check**: Change rate within expected bounds
3. **Conservation check**: Mass/energy balance satisfied
4. **Consistency check**: Related values are coherent

### 7.3 Gate Modes

| Mode | Behavior |
|------|----------|
| HARD | Invalid values replaced with last good value |
| SOFT | Invalid values flagged but passed through |
| REPORT_ONLY | Validation recorded, no blocking |

---

## 8. ALARM MANAGEMENT (ISA-18.2)

### 8.1 Alarm Priority

| Priority | Response Time | Description |
|----------|---------------|-------------|
| 1 - Critical | Immediate | Equipment damage or safety risk |
| 2 - High | < 5 min | Process deviation requiring action |
| 3 - Medium | < 30 min | Abnormal condition, attention needed |
| 4 - Low | Shift | Informational, no immediate action |

### 8.2 Alarm States

```
                    ┌──────────────────┐
                    │                  │
    Trigger         │     ACTIVE       │◄───────┐
    ───────────────►│  UNACKNOWLEDGED  │        │
                    │                  │        │
                    └────────┬─────────┘        │
                             │                  │
                    Acknowledge                 │
                             │                  │
                             ▼                  │
                    ┌──────────────────┐        │
                    │                  │        │
                    │     ACTIVE       │        │
                    │   ACKNOWLEDGED   │        │
                    │                  │        │
                    └────────┬─────────┘        │
                             │                  │
                    Clear (condition normal)   Re-trigger
                             │                  │
                             ▼                  │
                    ┌──────────────────┐        │
                    │                  │        │
                    │     CLEARED      │────────┘
                    │                  │
                    └──────────────────┘
```

---

## 9. PHYSICS MODEL

### 9.1 Separation Theory

Based on Stokes settling with centrifugal enhancement:

```
Critical Particle Size: d_c = √(18μQ / (Δρ × Σ))

Where:
  μ = Dynamic viscosity (Pa·s)
  Q = Volumetric flow rate (m³/s)
  Δρ = Density difference (kg/m³)
  Σ = Equivalent settling area (m²)
```

### 9.2 G-Force Calculation

```
G = (2πN/60)² × r / 9.81

Where:
  N = Bowl speed (RPM)
  r = Bowl radius (m)
```

### 9.3 Sigma Factor

```
Σ = 2π × ω² × L × (r₁³ - r₂³) / (3g)

Where:
  ω = Angular velocity (rad/s)
  L = Clarifier length (m)
  r₁ = Bowl radius (m)
  r₂ = Pond inner radius (m)
```

### 9.4 Model Limitations

The following are explicitly labeled as **ESTIMATED** and should be validated:

- Cake moisture (empirical correlation)
- Oil separation efficiency
- Centrate clarity
- Polymer effectiveness

---

## 10. OPERATOR INTERFACE

### 10.1 Display Hierarchy (ISA-101)

| Level | Content | Update Rate |
|-------|---------|-------------|
| L1 - Overview | Plant status, key KPIs | 5s |
| L2 - Control | Loop faceplates, trends | 1s |
| L3 - Diagnostic | Cascade map, integrity | 1s |
| L4 - Configuration | Tuning, limits | On demand |

### 10.2 Color Coding

| Color | Meaning |
|-------|---------|
| Green | Normal, running, valid |
| Yellow | Warning, manual mode |
| Orange | Alarm, constraint active |
| Red | Trip, fault, invalid |
| Blue | Cascade mode |
| Gray | Off, disabled |

---

## 11. REVISION HISTORY

### Version 2.0 Changes

1. Implemented true cascade control architecture (QIC-001 master)
2. Replaced forced mass balance with independent validation
3. Added explicit data source labeling (MEASURED/MODELED/ESTIMATED)
4. Implemented equipment constraints as enforced limits (not advisory)
5. Added calculation integrity gates with validation
6. ISA-18.2 compliant alarm management
7. Deterministic startup sequence state machine

---

## APPENDIX A: EQUIPMENT NAMEPLATE DATA

### SACOR Delta-Canter 20-843A

| Parameter | Value | Unit |
|-----------|-------|------|
| Bowl Diameter | 500 | mm |
| Bowl Length | 1200 | mm |
| Max Bowl Speed | 3200 | RPM |
| Max G-Force | 2850 | g |
| Max Throughput | 15 | m³/hr |
| Main Motor | 75 | kW |
| Scroll Motor | 22 | kW |
| Max Torque | 650 | Nm |
| Beach Angle | 8.5 | deg |
| Weight (empty) | 4500 | kg |

---

## APPENDIX B: INSTRUMENT LIST

| Tag | Description | Type | Range | Unit |
|-----|-------------|------|-------|------|
| TT-001 | Feed Temperature | RTD | 0-100 | °C |
| FT-001 | Feed Flow | Mag | 0-20 | m³/hr |
| ST-001 | Bowl Speed | Encoder | 0-4000 | RPM |
| PT-001 | Feed Pressure | Piezo | 0-600 | kPa |
| VT-001 | Vibration | Accel | 0-20 | mm/s |
| TT-002 | Bearing Temp | RTD | 0-120 | °C |
| AT-001 | Scroll Torque | Strain | 0-1000 | Nm |
| DT-001 | Pond Depth | Ultrasonic | 0-200 | mm |

---

*End of Document*
