# Karratha WTP Simulator V2

Professional-grade water treatment plant simulator for oily water processing, based on Block Flow Diagrams KA-00X (Sheets 1-3) for CWY LSG Karratha.

## Overview

A comprehensive React/TypeScript simulation of an oily water treatment facility featuring:

- **Real-time physics-based simulation** using Stokes Law, Richardson-Zaki correlations, and API 421 design methodology
- **Full process architecture** per Block Flow Diagrams including API separator, centrifuge/tricanter, tank farm, and evaporation ponds
- **Engineering-grade calculations** with adjustable parameters for senior engineers
- **AS 1940 compliant** overfill protection and interlock logic
- **Cost analysis** with configurable rates for electricity, chemicals, and disposal

## Process Architecture

Based on Cleanaway Block Flow Diagrams KA-00X Rev A:

### Sheet 1 - Infeed & Tank Outputs
```
MIXED INFEED → Coarse Filter (<20mm) → API Separator (75 m³/hr) → Low Shear Pump (50 m³/hr) → Vertical Tanks 1-6
                                                                                            ↓
Vertical Tanks (BOTTOM TAKE OFF) → Low Shear Pump (50 m³/hr) → Manifold → Horizontal Tanks / Ponds / Treatment
                                                                        ↓
                                          Demulsifier + Floc + pH → Inline Mixer → Heat (65°C) → Treatment Package
```

### Sheet 2 - Centrifuge Outputs
```
Treatment Package:
  ├── WATER OUT → Transfer Pump (>15 m³/hr) → GAC Filter → Manifold → Evap Ponds / MBR (Future) / VTs
  ├── OIL OUT → Low Shear Pump (>15 m³/hr) → Auto Self-Cleaning Fines Filter (<500μ) → Horizontal Tanks
  └── SLUDGE OUT → Mono Pump (<7 m³/hr) → Conveyor → Fixation Pads
```

### Sheet 3 - Additional Outputs
```
Oil Tank Output → Low Shear Pumps (50 m³/hr) → Manifold → API Unloading Terminal / Used Lub Oil Out
Sludge Tank → Mono Pump (<7 m³/hr) → Treatment Package (with Make-up Water)
```

## Engineering Calculations

### Fluid Properties
- **Water Viscosity**: Vogel equation - μ = A × exp(B / (T - C))
- **Water Density**: Kell correlation (0-100°C)
- **Oil Density**: ASTM D1250 temperature correction

### Settling Theory
- **Stokes Law**: v_t = (g·d²·Δρ)/(18·μ)
- **Hadamard-Rybczynski**: Correction for fluid droplet internal circulation
- **Richardson-Zaki**: Hindered settling - v_h = v_t × ε^n
- **Oseen/Schiller-Naumann**: Drag correlations for higher Re

### API Separator Design (per API Publication 421)
- Surface area sizing: A = Q / v_rise
- Horizontal velocity check: v_h < 15 × v_rise
- Hydraulic loading rate
- Retention time calculation

### Centrifuge
- G-force: G = ω²r/g = (2πN/60)²r/g
- Sigma factor for scale-up
- Three-phase separation efficiency

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/karratha-wtp-simulator.git
cd karratha-wtp-simulator

# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build
```

## Usage

### Development
```bash
pnpm dev
```
Opens at `http://localhost:5173`

### Production Build
```bash
pnpm build
```
Output in `dist/` folder

## Project Structure

```
karratha-wtp-simulator/
├── src/
│   ├── App.tsx                 # Main application (960 lines)
│   ├── lib/
│   │   ├── types-v2.ts         # Comprehensive type definitions
│   │   ├── engineering-v2.ts   # Engineering calculations
│   │   └── simulation-v2.ts    # Simulation engine
│   ├── components/ui/          # shadcn/ui components
│   └── index.css               # Tailwind CSS
├── dist/                       # Vite build output
└── package.json
```

## Key Features

### Tanks
- **Vertical Tanks 1-6**: 100 m³ each, various services (feed buffer, processing, treatment feed, treated water)
- **Horizontal Tanks 1-7**: 50 m³ each, oil storage
- **Sludge Tank**: 30 m³ with agitator

### Pumps (10 total)
- Progressive cavity (low shear) for oil-water mixtures
- Centrifugal for treated water
- Mono pump for high-solids sludge
- All with VFD speed control

### Instrumentation
- Flow (magnetic)
- Level (radar with independent HH protection)
- Temperature (RTD)
- Oil-in-water analyzers
- pH measurement

### Interlocks (per AS 1940 & UR-OPS)
- Tank overfill protection (LAHH)
- Oil-to-pond prevention (UR-OPS-008)
- Centrifuge feed temperature permissive
- Manual reset required after trip (UR-OPS-017)

### Chemical Dosing
- Demulsifier (EC9523A)
- Flocculant (Polyacrylamide)
- pH correction (H2SO4)

## User Requirements Traceability

| UR | Description | Status |
|----|-------------|--------|
| UR-OPS-001 | Batch-transfer mode operation | ✅ |
| UR-OPS-002 | 60-100 kL/day throughput envelope | ✅ |
| UR-OPS-003 | 50 m³/hr transfer capacity | ✅ |
| UR-OPS-004 | Stream segregation (oil/water/sludge) | ✅ |
| UR-OPS-007 | Permitted/prohibited transfer routes | ✅ |
| UR-OPS-008 | Oil to pond prevention | ✅ |
| UR-OPS-015 | Overfill protection (AS 1940) | ✅ |
| UR-OPS-016 | HH level independent protection | ✅ |
| UR-OPS-017 | Manual reset required after trip | ✅ |
| UR-OPS-018 | Pond flow metering/totalisation | ✅ |
| UR-OPS-022 | HMI standard transfer line-ups | ✅ |
| UR-OPS-024 | Prioritised actionable alarms | ✅ |

## Engineering References

1. Stokes, G.G. (1851) - Terminal settling velocity
2. Richardson, J.F. & Zaki, W.N. (1954) - Hindered settling correlation
3. API Publication 421 (2012) - Oil-Water Separator Design
4. Hadamard-Rybczynski (1911) - Droplet internal circulation
5. Vogel, H. (1921) - Viscosity-temperature correlation
6. Kell, G.S. (1975) - Water density correlation
7. ASTM D1250 / API 2540 - Petroleum volume correction
8. Perry's Chemical Engineers' Handbook, 9th Ed
9. AS 1940-2017 - Flammable/Combustible Liquids Storage

## Tech Stack

- **React 19** with TypeScript
- **Vite 7** build tooling
- **Tailwind CSS** styling
- **shadcn/ui** component library
- **Recharts** for data visualization
- **Lucide React** icons

## License

Proprietary - CWY LSG Karratha

## Document Reference

- Drawing: KA-00X (Block Flow Diagrams)
- Revision: A
- Date: 6/01/2026
- Project: CWY LSG KARRATHA P&ID
