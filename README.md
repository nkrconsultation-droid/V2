# Karratha Water Treatment Plant Simulator

Version 13 - Advanced Centrifuge Process Control

## Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm (comes with Node.js)

### Installation & Run

```bash
# 1. Navigate to the project directory
cd karratha-wtp-simulator

# 2. Install dependencies (first time only)
npm install

# 3. Start the development server
npm run dev
```

Then open **http://localhost:5173** in your browser (Edge, Chrome, etc.)

### Alternative: Run from Root Directory

From the V2 root folder, you can use:
```bash
npm run dev
```

This will automatically navigate to the correct directory and start the server.

## For Visual Studio / VS Code Users

1. Open the `V2` folder in Visual Studio or VS Code
2. Open a terminal (Terminal > New Terminal)
3. Run:
   ```
   cd karratha-wtp-simulator
   npm install
   npm run dev
   ```
4. Ctrl+Click the `http://localhost:5173` link to open in Edge

## Static Files (No Server Required)

If you just want to view the built app without running a dev server:
- Open `dist/index.html` directly in your browser
- Note: Some features may require a local server

## Project Structure

```
V2/
├── README.md                    # This file
├── package.json                 # Root convenience scripts
├── dist/                        # Built app (ready to run)
│   └── index.html
├── karratha-wtp-simulator/      # Source code
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   └── components/
│   │       └── CentrifugeProcessControl.tsx
│   └── ...
```

## Features

- Stokes Law separation physics with Richardson-Zaki correlation
- Chemical dosing system (demulsifier, flocculant, coagulant, pH control)
- SPDD1600 polishing filter simulation
- Tank farm management (6 feed tanks + 6 oil tanks)
- 8ML evaporation pond simulation
- Batch processing with 6 phases
- PID control loops (TIC, FIC, SIC)
- Automatic Quality Control (AQC) system
- License compliance monitoring (TRH, COD, pH, OiW, turbidity)
- Trend charts, KPI dashboards, SPC charts

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `npm: command not found` | Install Node.js from https://nodejs.org |
| `pnpm: command not found` | Use `npm` instead of `pnpm` |
| Port 5173 in use | The dev server will automatically try another port |
| Module not found errors | Run `npm install` first |
