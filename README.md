# Karratha Water Treatment Plant Simulator

Version 15 - Delta-Canter 20-843A Three-Phase Tricanter

## Equipment Specifications (SACOR Australia)

| Parameter | Value |
|-----------|-------|
| Model | Delta-Canter 20-843A |
| Bowl | 520mm × 1800mm |
| Speed Range | 2,200 - 3,600 RPM |
| Max G-Force | 3,000 G |
| Design Throughput | 15 m³/h |
| Motors | 45kW main + 11kW back-drive |

## Quick Start (Windows)

### Prerequisites
- Node.js (v18 or higher) - Download from https://nodejs.org
- npm (comes with Node.js)

### Your Local Setup

```powershell
# 1. Open PowerShell or Command Prompt

# 2. Navigate to your project
cd C:\Users\kelto\Documents\GITHUB\V2\karratha-wtp-simulator

# 3. Install dependencies (first time only)
npm install

# 4. Start the development server
npm run dev
```

Then open **http://localhost:5173** in your browser (Edge, Chrome, etc.)

### Alternative: Double-Click Launch

From `C:\Users\kelto\Documents\GITHUB\V2`:
- **PowerShell**: Right-click `run.ps1` → "Run with PowerShell"
- **Command Prompt**: Double-click `run.bat`

## For Visual Studio Code Users

1. Open folder: `C:\Users\kelto\Documents\GITHUB\V2`
2. Open terminal: `Ctrl+`` ` (backtick) or Terminal → New Terminal
3. Run:
   ```
   cd karratha-wtp-simulator
   npm install
   npm run dev
   ```
4. Ctrl+Click the `http://localhost:5173` link to open in browser

## Project Structure

```
C:\Users\kelto\Documents\GITHUB\V2\
├── README.md                    # This file
├── package.json                 # Root convenience scripts
├── run.ps1                      # PowerShell launcher
├── run.bat                      # Command Prompt launcher
├── dist/                        # Built app (ready to run)
│   └── index.html
├── karratha-wtp-simulator/      # Source code
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   └── CentrifugeProcessControl.tsx
│   │   └── lib/
│   │       ├── equipment-config.ts    # Delta-Canter specs
│   │       ├── excel-export.ts        # Excel report generation
│   │       ├── database.ts            # IndexedDB storage
│   │       ├── hmi-standards.ts       # ISA-101/18.2/88 standards
│   │       └── process-types.ts       # TypeScript definitions
│   └── scripts/
│       └── stokes_calculator.py       # Python calculation validator
```

## Features

### Process Simulation
- Stokes Law separation physics with Richardson-Zaki correlation
- Chemical dosing system (demulsifier, flocculant, coagulant, pH control)
- SPDD1600 polishing filter simulation
- Tank farm management (6 feed tanks + 6 oil tanks)
- 8ML evaporation pond simulation
- Batch processing with 6 phases

### Control Systems
- PID control loops (TIC, FIC, SIC)
- Automatic Quality Control (AQC) system
- ISA-88 batch state machine

### Monitoring & Reporting
- License compliance monitoring (TRH, COD, pH, OiW, turbidity)
- Trend charts, KPI dashboards, SPC charts
- Excel report export with professional styling
- IndexedDB for session persistence

### Industry Standards
- ISA-101: HMI Design
- ISA-18.2: Alarm Management
- ISA-88: Batch Control
- ISO 10816-3: Vibration Limits
- High Performance HMI Principles

## Performance Guarantees (per SACOR)

| Parameter | Guarantee |
|-----------|-----------|
| Oil Recovery | ≥95% |
| Centrate TPH | ≤500 mg/L |
| Cake Dryness | ≤20% moisture |
| Vibration | ≤4.5 mm/s RMS |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `npm: command not found` | Install Node.js from https://nodejs.org |
| `pnpm: command not found` | Use `npm` instead of `pnpm` |
| Port 5173 in use | The dev server will automatically try another port |
| Module not found errors | Run `npm install` first |
| PowerShell script blocked | Run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` |

## Building for Production

```powershell
cd C:\Users\kelto\Documents\GITHUB\V2\karratha-wtp-simulator
npm run build
```

The built files will be in `dist/` folder.
