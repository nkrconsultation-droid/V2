/**
 * PROCESS OVERVIEW DIAGRAM CONFIGURATION
 * =======================================
 * Block definitions, positions, colors, and flow connections
 * matching the reference block flow diagram.
 */

// ═══════════════════════════════════════════════════════════════
// COLOR PALETTE (matching reference diagram)
// ═══════════════════════════════════════════════════════════════
export const DIAGRAM_COLORS = {
  feed: {
    primary: '#E07050',      // Feed/Pre-treatment blocks (coral/salmon)
    secondary: '#F4A460',    // Suction block (sandy brown)
  },
  process: {
    main: '#2E8B8B',         // Core separation equipment (dark teal)
    aux: '#5F9EA0',          // Chemical dosing, Bypass (cadet blue)
  },
  output: {
    primary: '#A9A9A9',      // Output handling (dark gray)
    secondary: '#D3D3D3',    // Final products (light gray)
  },
  utility: {
    flush: '#87CEEB',        // Fresh water flush (sky blue)
    recirculation: '#DC143C', // Recirculation boundary (crimson)
  },
  streams: {
    oil: '#8B4513',          // Oil stream lines (saddle brown)
    water: '#4169E1',        // Water stream lines (royal blue)
    solids: '#696969',       // Solids stream lines (dim gray)
    chemical: '#9370DB',     // Chemical dosing lines (medium purple)
    main: '#2F4F4F',         // Main process flow (dark slate gray)
  },
};

// ═══════════════════════════════════════════════════════════════
// EQUIPMENT BLOCK DEFINITIONS
// ═══════════════════════════════════════════════════════════════
export interface EquipmentBlock {
  id: string;
  name: string;
  shortName?: string;
  description?: string;
  color: string;
  textColor?: string;
  borderColor?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  icon?: string;
  category: 'feed' | 'process' | 'output' | 'utility' | 'storage';
  parameters?: Array<{
    label: string;
    key: string;
    unit: string;
  }>;
}

export const EQUIPMENT_BLOCKS: EquipmentBlock[] = [
  // Feed Section (Left)
  {
    id: 'FEED-01',
    name: 'Suction and Feed',
    shortName: 'Feed',
    color: DIAGRAM_COLORS.feed.secondary,
    x: 50,
    y: 80,
    width: 100,
    height: 50,
    category: 'feed',
    icon: '🔄',
    parameters: [
      { label: 'Flow', key: 'feedFlow', unit: 'm³/h' },
    ],
  },
  {
    id: 'PRE-01',
    name: 'Feed Conditioning / Pre-Treatment',
    shortName: 'Pre-Treatment',
    color: DIAGRAM_COLORS.feed.primary,
    x: 50,
    y: 160,
    width: 100,
    height: 60,
    category: 'feed',
    icon: '⚗️',
  },
  {
    id: 'FLUSH-01',
    name: 'Fresh Water Flush',
    shortName: 'Water Flush',
    color: DIAGRAM_COLORS.utility.flush,
    textColor: '#1a1a1a',
    x: 50,
    y: 260,
    width: 100,
    height: 50,
    category: 'utility',
    icon: '💧',
  },

  // Inlet Section
  {
    id: 'MAN-IN',
    name: 'Inlet Manifold',
    shortName: 'Inlet',
    color: DIAGRAM_COLORS.process.main,
    x: 200,
    y: 160,
    width: 90,
    height: 50,
    category: 'process',
  },
  {
    id: 'CHEM-01',
    name: 'Chemical Dosing',
    shortName: 'Chemicals',
    color: DIAGRAM_COLORS.process.aux,
    x: 320,
    y: 60,
    width: 100,
    height: 50,
    category: 'process',
    icon: '🧪',
    parameters: [
      { label: 'Demulsifier', key: 'demulsifierRate', unit: 'ppm' },
    ],
  },

  // Primary Separation Section
  {
    id: 'PRIM-01',
    name: 'Primary Separation',
    shortName: 'Primary Sep',
    color: DIAGRAM_COLORS.process.main,
    x: 320,
    y: 140,
    width: 100,
    height: 60,
    category: 'process',
    icon: '⚙️',
    parameters: [
      { label: 'Speed', key: 'bowlSpeed', unit: 'RPM' },
      { label: 'Efficiency', key: 'oilEff', unit: '%' },
    ],
  },
  {
    id: 'BYPASS',
    name: 'Bypass',
    shortName: 'Bypass',
    color: DIAGRAM_COLORS.process.aux,
    x: 460,
    y: 140,
    width: 80,
    height: 40,
    category: 'process',
  },

  // Secondary Separation Section
  {
    id: 'MECH-01',
    name: 'Mechanical Separation',
    shortName: 'Mech Sep',
    color: DIAGRAM_COLORS.process.main,
    x: 320,
    y: 240,
    width: 100,
    height: 60,
    category: 'process',
    icon: '🔧',
  },
  {
    id: 'POLISH-01',
    name: 'Polishing Separation',
    shortName: 'Polishing',
    color: DIAGRAM_COLORS.process.main,
    x: 320,
    y: 340,
    width: 100,
    height: 60,
    category: 'process',
    icon: '✨',
  },

  // Recirculation
  {
    id: 'RECIRC',
    name: 'Recirculation Loop',
    shortName: 'Recirc',
    color: 'transparent',
    borderColor: DIAGRAM_COLORS.utility.recirculation,
    x: 200,
    y: 340,
    width: 90,
    height: 50,
    category: 'utility',
    icon: '🔁',
  },

  // Outlet Section
  {
    id: 'MAN-OUT',
    name: 'Outlet Manifold',
    shortName: 'Outlet',
    color: DIAGRAM_COLORS.process.main,
    x: 480,
    y: 300,
    width: 90,
    height: 50,
    category: 'process',
  },

  // Output - Solids Path
  {
    id: 'FIX-01',
    name: 'Fixation Pad',
    shortName: 'Fixation',
    color: DIAGRAM_COLORS.output.primary,
    x: 620,
    y: 140,
    width: 100,
    height: 50,
    category: 'output',
  },
  {
    id: 'SLUDGE-01',
    name: 'Dewatered Sludge',
    shortName: 'Sludge',
    description: 'Dryness: 20-35% w/w',
    color: DIAGRAM_COLORS.output.secondary,
    x: 760,
    y: 140,
    width: 110,
    height: 50,
    category: 'storage',
    parameters: [
      { label: 'Dryness', key: 'cakeDryness', unit: '%' },
    ],
  },

  // Output - Oil Path
  {
    id: 'HTANK-01',
    name: 'Horizontal Tanks',
    shortName: 'Oil Tanks',
    color: DIAGRAM_COLORS.output.primary,
    x: 620,
    y: 220,
    width: 100,
    height: 50,
    category: 'output',
    icon: '🛢️',
  },
  {
    id: 'OIL-01',
    name: 'Recovered Oil',
    shortName: 'Oil',
    description: 'Water content <5%',
    color: DIAGRAM_COLORS.output.secondary,
    x: 760,
    y: 220,
    width: 110,
    height: 50,
    category: 'storage',
    parameters: [
      { label: 'Volume', key: 'oilVolume', unit: 'm³' },
    ],
  },

  // Output - Water Path
  {
    id: 'EVAP-01',
    name: 'Evaporation Pond',
    shortName: 'Evap Pond',
    color: DIAGRAM_COLORS.output.primary,
    x: 620,
    y: 300,
    width: 100,
    height: 50,
    category: 'output',
    icon: '🌊',
  },
  {
    id: 'WATER-01',
    name: 'Treated Water',
    shortName: 'Treated',
    description: '<500 mg/L TPH',
    color: DIAGRAM_COLORS.output.secondary,
    x: 760,
    y: 300,
    width: 110,
    height: 50,
    category: 'storage',
    parameters: [
      { label: 'TPH', key: 'waterQuality', unit: 'mg/L' },
    ],
  },

  // Clean Water Storage (DWER Discharge)
  {
    id: 'CLEAN-01',
    name: 'Clean Water Storage',
    shortName: 'Clean Water',
    color: DIAGRAM_COLORS.utility.flush,
    textColor: '#1a1a1a',
    x: 620,
    y: 380,
    width: 100,
    height: 50,
    category: 'storage',
  },
  {
    id: 'DISCHARGE-01',
    name: 'Treated Water',
    shortName: 'Discharge',
    description: '<5 mg/L TPH',
    color: DIAGRAM_COLORS.output.secondary,
    x: 760,
    y: 380,
    width: 110,
    height: 50,
    category: 'storage',
  },
  {
    id: 'DWER-01',
    name: 'Discharged to land per DWER license',
    shortName: 'DWER Discharge',
    color: '#228B22',
    x: 900,
    y: 380,
    width: 120,
    height: 50,
    category: 'output',
  },
];

// ═══════════════════════════════════════════════════════════════
// FLOW CONNECTIONS
// ═══════════════════════════════════════════════════════════════
export interface FlowConnection {
  id: string;
  from: string;
  to: string;
  type: 'main' | 'auxiliary' | 'chemical' | 'recirculation' | 'oil' | 'water' | 'solids';
  style?: 'solid' | 'dashed' | 'dotted';
  animated?: boolean;
  label?: string;
  path?: string; // Custom SVG path if needed
}

export const FLOW_CONNECTIONS: FlowConnection[] = [
  // Feed Section
  { id: 'f1', from: 'FEED-01', to: 'PRE-01', type: 'main', animated: true },
  { id: 'f2', from: 'FLUSH-01', to: 'PRE-01', type: 'auxiliary', style: 'dashed' },
  { id: 'f3', from: 'PRE-01', to: 'MAN-IN', type: 'main', animated: true },

  // Chemical Dosing
  { id: 'c1', from: 'CHEM-01', to: 'PRIM-01', type: 'chemical', style: 'dashed' },
  { id: 'c2', from: 'CHEM-01', to: 'BYPASS', type: 'chemical', style: 'dashed' },

  // Primary Separation Path
  { id: 'p1', from: 'MAN-IN', to: 'PRIM-01', type: 'main', animated: true },
  { id: 'p2', from: 'PRIM-01', to: 'BYPASS', type: 'main' },
  { id: 'p3', from: 'BYPASS', to: 'MAN-OUT', type: 'main' },

  // Secondary Separation Path
  { id: 's1', from: 'MAN-IN', to: 'MECH-01', type: 'main', animated: true },
  { id: 's2', from: 'MECH-01', to: 'POLISH-01', type: 'main', animated: true },
  { id: 's3', from: 'POLISH-01', to: 'MAN-OUT', type: 'main', animated: true },

  // Recirculation
  { id: 'r1', from: 'POLISH-01', to: 'RECIRC', type: 'recirculation', style: 'dotted' },
  { id: 'r2', from: 'RECIRC', to: 'MAN-IN', type: 'recirculation', style: 'dotted' },

  // Output - Solids
  { id: 'o1', from: 'MAN-OUT', to: 'FIX-01', type: 'solids', label: 'Solids' },
  { id: 'o2', from: 'FIX-01', to: 'SLUDGE-01', type: 'solids' },

  // Output - Oil
  { id: 'o3', from: 'MAN-OUT', to: 'HTANK-01', type: 'oil', label: 'Oil' },
  { id: 'o4', from: 'HTANK-01', to: 'OIL-01', type: 'oil' },

  // Output - Water
  { id: 'o5', from: 'MAN-OUT', to: 'EVAP-01', type: 'water', label: 'Water' },
  { id: 'o6', from: 'EVAP-01', to: 'WATER-01', type: 'water' },

  // Clean Water Path
  { id: 'w1', from: 'EVAP-01', to: 'CLEAN-01', type: 'water', style: 'dashed' },
  { id: 'w2', from: 'CLEAN-01', to: 'DISCHARGE-01', type: 'water' },
  { id: 'w3', from: 'DISCHARGE-01', to: 'DWER-01', type: 'water' },
];

// ═══════════════════════════════════════════════════════════════
// OUTPUT COST/VALUE BOXES
// ═══════════════════════════════════════════════════════════════
export interface OutputBox {
  id: string;
  parentId: string;
  lines: Array<{ label: string; key?: string }>;
  x: number;
  y: number;
}

export const OUTPUT_BOXES: OutputBox[] = [
  {
    id: 'cost-sludge',
    parentId: 'SLUDGE-01',
    lines: [
      { label: 'Disposal Cost:' },
      { label: 'Recoverable Cost:' },
    ],
    x: 880,
    y: 140,
  },
  {
    id: 'cost-oil',
    parentId: 'OIL-01',
    lines: [
      { label: 'Disposal Cost:' },
      { label: 'Recoverable Cost:' },
    ],
    x: 880,
    y: 220,
  },
  {
    id: 'evap-rate',
    parentId: 'WATER-01',
    lines: [
      { label: 'Possible evaporation' },
      { label: 'rate: 6-8ML/yr' },
    ],
    x: 880,
    y: 300,
  },
];

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════
export function getBlockById(id: string): EquipmentBlock | undefined {
  return EQUIPMENT_BLOCKS.find(b => b.id === id);
}

export function getBlockCenter(block: EquipmentBlock): { x: number; y: number } {
  return {
    x: block.x + block.width / 2,
    y: block.y + block.height / 2,
  };
}

export function getConnectionColor(type: FlowConnection['type']): string {
  switch (type) {
    case 'oil': return DIAGRAM_COLORS.streams.oil;
    case 'water': return DIAGRAM_COLORS.streams.water;
    case 'solids': return DIAGRAM_COLORS.streams.solids;
    case 'chemical': return DIAGRAM_COLORS.streams.chemical;
    case 'recirculation': return DIAGRAM_COLORS.utility.recirculation;
    case 'auxiliary': return DIAGRAM_COLORS.utility.flush;
    default: return DIAGRAM_COLORS.streams.main;
  }
}

export function getConnectionWidth(type: FlowConnection['type']): number {
  switch (type) {
    case 'main': return 3;
    case 'oil':
    case 'water':
    case 'solids': return 2.5;
    case 'chemical': return 2;
    case 'auxiliary':
    case 'recirculation': return 2;
    default: return 2;
  }
}
