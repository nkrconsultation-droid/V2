/**
 * PROCESS OVERVIEW DIAGRAM CONFIGURATION
 * =======================================
 * Block definitions, positions, colors, and flow connections
 * matching the reference block flow diagram.
 *
 * Layout uses a scalable coordinate system for responsive sizing.
 */

// ═══════════════════════════════════════════════════════════════
// LAYOUT CONSTANTS (scalable base units)
// ═══════════════════════════════════════════════════════════════
const GRID = {
  // Base spacing unit - all positions are multiples of this
  unit: 20,
  // Standard block sizes
  blockWidth: 130,
  blockHeight: 70,
  smallBlockWidth: 100,
  smallBlockHeight: 55,
  // Spacing between elements
  horizontalGap: 50,
  verticalGap: 30,
  // Row positions (Y coordinates)
  row1: 50,   // Chemical dosing
  row2: 150,  // Primary separation path
  row3: 260,  // Secondary separation
  row4: 370,  // Polishing / Recirculation
  row5: 480,  // Clean water discharge
  // Column positions (X coordinates)
  col1: 40,   // Feed section
  col2: 220,  // Inlet manifold
  col3: 400,  // Primary/Mech separation
  col4: 580,  // Bypass / Outlet
  col5: 760,  // Output handling
  col6: 960,  // Final products
  col7: 1160, // Cost boxes / DWER
};

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
    primary: '#708090',      // Output handling (slate gray)
    secondary: '#B8C4CE',    // Final products (light blue-gray)
  },
  utility: {
    flush: '#87CEEB',        // Fresh water flush (sky blue)
    recirculation: '#DC143C', // Recirculation boundary (crimson)
  },
  streams: {
    oil: '#CD853F',          // Oil stream lines (peru/tan)
    water: '#4169E1',        // Water stream lines (royal blue)
    solids: '#808080',       // Solids stream lines (gray)
    chemical: '#9370DB',     // Chemical dosing lines (medium purple)
    main: '#40E0D0',         // Main process flow (turquoise)
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
  // ═══════════════════════════════════════════════════════════════
  // FEED SECTION (Column 1)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'FEED-01',
    name: 'Suction and Feed',
    shortName: 'Suction and Feed',
    color: DIAGRAM_COLORS.feed.secondary,
    x: GRID.col1,
    y: GRID.row1,
    width: GRID.blockWidth,
    height: GRID.blockHeight,
    category: 'feed',
    parameters: [
      { label: 'Flow', key: 'feedFlow', unit: 'm³/h' },
    ],
  },
  {
    id: 'PRE-01',
    name: 'Feed Conditioning / Pre-Treatment',
    shortName: 'Feed Conditioning / Pre-Treatment',
    color: DIAGRAM_COLORS.feed.primary,
    x: GRID.col1,
    y: GRID.row2,
    width: GRID.blockWidth,
    height: GRID.blockHeight + 10,
    category: 'feed',
  },
  {
    id: 'FLUSH-01',
    name: 'Fresh Water Flush',
    shortName: 'Fresh Water Flush',
    color: DIAGRAM_COLORS.utility.flush,
    textColor: '#1a1a1a',
    x: GRID.col1,
    y: GRID.row3,
    width: GRID.blockWidth,
    height: GRID.blockHeight,
    category: 'utility',
  },

  // ═══════════════════════════════════════════════════════════════
  // INLET & CHEMICAL SECTION (Column 2-3)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'MAN-IN',
    name: 'Inlet Manifold',
    shortName: 'Inlet Manifold',
    color: DIAGRAM_COLORS.process.main,
    x: GRID.col2,
    y: GRID.row2,
    width: GRID.smallBlockWidth + 20,
    height: GRID.smallBlockHeight,
    category: 'process',
  },
  {
    id: 'CHEM-01',
    name: 'Chemical Dosing',
    shortName: 'Chemical Dosing',
    color: DIAGRAM_COLORS.process.aux,
    x: GRID.col3,
    y: GRID.row1,
    width: GRID.blockWidth,
    height: GRID.blockHeight,
    category: 'process',
    parameters: [
      { label: 'Demulsifier', key: 'demulsifierRate', unit: 'ppm' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // SEPARATION SECTION (Column 3-4)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'PRIM-01',
    name: 'Primary Separation',
    shortName: 'Primary Separation',
    color: DIAGRAM_COLORS.process.main,
    x: GRID.col3,
    y: GRID.row2,
    width: GRID.blockWidth,
    height: GRID.blockHeight + 10,
    category: 'process',
    parameters: [
      { label: 'Efficiency', key: 'oilEff', unit: '%' },
    ],
  },
  {
    id: 'BYPASS',
    name: 'Bypass',
    shortName: 'Bypass',
    color: DIAGRAM_COLORS.process.aux,
    x: GRID.col4,
    y: GRID.row2,
    width: GRID.smallBlockWidth,
    height: GRID.smallBlockHeight,
    category: 'process',
  },
  {
    id: 'MECH-01',
    name: 'Mechanical Separation',
    shortName: 'Mechanical Separation',
    color: DIAGRAM_COLORS.process.main,
    x: GRID.col3,
    y: GRID.row3,
    width: GRID.blockWidth,
    height: GRID.blockHeight + 10,
    category: 'process',
  },
  {
    id: 'POLISH-01',
    name: 'Polishing Separation',
    shortName: 'Polishing Separation',
    color: DIAGRAM_COLORS.process.main,
    x: GRID.col3,
    y: GRID.row4,
    width: GRID.blockWidth,
    height: GRID.blockHeight + 10,
    category: 'process',
  },

  // ═══════════════════════════════════════════════════════════════
  // RECIRCULATION (Column 2)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'RECIRC',
    name: 'Recirculation Loop',
    shortName: 'Recirculation Loop',
    color: 'transparent',
    borderColor: DIAGRAM_COLORS.utility.recirculation,
    x: GRID.col2,
    y: GRID.row4,
    width: GRID.smallBlockWidth + 20,
    height: GRID.smallBlockHeight,
    category: 'utility',
  },

  // ═══════════════════════════════════════════════════════════════
  // OUTLET MANIFOLD (Column 4)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'MAN-OUT',
    name: 'Outlet Manifold',
    shortName: 'Outlet Manifold',
    color: DIAGRAM_COLORS.process.main,
    x: GRID.col4,
    y: GRID.row3 + 40,
    width: GRID.smallBlockWidth + 20,
    height: GRID.smallBlockHeight,
    category: 'process',
  },

  // ═══════════════════════════════════════════════════════════════
  // OUTPUT - SOLIDS PATH (Row 2)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'FIX-01',
    name: 'Fixation Pad',
    shortName: 'Fixation Pad',
    color: DIAGRAM_COLORS.output.primary,
    x: GRID.col5,
    y: GRID.row2,
    width: GRID.blockWidth,
    height: GRID.blockHeight,
    category: 'output',
  },
  {
    id: 'SLUDGE-01',
    name: 'Dewatered Sludge',
    shortName: 'Dewatered Sludge',
    description: 'Dryness 20-35% w/w',
    color: DIAGRAM_COLORS.output.secondary,
    textColor: '#1a1a1a',
    x: GRID.col6,
    y: GRID.row2,
    width: GRID.blockWidth + 10,
    height: GRID.blockHeight,
    category: 'storage',
  },

  // ═══════════════════════════════════════════════════════════════
  // OUTPUT - OIL PATH (Row 3)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'HTANK-01',
    name: 'Horizontal Tanks',
    shortName: 'Horizontal Tanks',
    color: DIAGRAM_COLORS.output.primary,
    x: GRID.col5,
    y: GRID.row3,
    width: GRID.blockWidth,
    height: GRID.blockHeight,
    category: 'output',
  },
  {
    id: 'OIL-01',
    name: 'Recovered Oil',
    shortName: 'Recovered Oil',
    description: 'Water content <5%',
    color: DIAGRAM_COLORS.output.secondary,
    textColor: '#1a1a1a',
    x: GRID.col6,
    y: GRID.row3,
    width: GRID.blockWidth + 10,
    height: GRID.blockHeight,
    category: 'storage',
  },

  // ═══════════════════════════════════════════════════════════════
  // OUTPUT - WATER PATH (Row 4)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'EVAP-01',
    name: 'Evaporation Pond',
    shortName: 'Evaporation Pond',
    color: DIAGRAM_COLORS.output.primary,
    x: GRID.col5,
    y: GRID.row4,
    width: GRID.blockWidth,
    height: GRID.blockHeight,
    category: 'output',
  },
  {
    id: 'WATER-01',
    name: 'Treated Water',
    shortName: 'Treated Water',
    description: '<500 mg/L TPH',
    color: DIAGRAM_COLORS.output.secondary,
    textColor: '#1a1a1a',
    x: GRID.col6,
    y: GRID.row4,
    width: GRID.blockWidth + 10,
    height: GRID.blockHeight,
    category: 'storage',
  },

  // ═══════════════════════════════════════════════════════════════
  // CLEAN WATER DISCHARGE PATH (Row 5)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'CLEAN-01',
    name: 'Clean Water Storage',
    shortName: 'Clean Water Storage',
    color: DIAGRAM_COLORS.utility.flush,
    textColor: '#1a1a1a',
    x: GRID.col5,
    y: GRID.row5,
    width: GRID.blockWidth,
    height: GRID.blockHeight,
    category: 'storage',
  },
  {
    id: 'DISCHARGE-01',
    name: 'Treated Water',
    shortName: 'Treated Water',
    description: '<5 mg/L TPH',
    color: DIAGRAM_COLORS.output.secondary,
    textColor: '#1a1a1a',
    x: GRID.col6,
    y: GRID.row5,
    width: GRID.blockWidth + 10,
    height: GRID.blockHeight,
    category: 'storage',
  },
  {
    id: 'DWER-01',
    name: 'Discharged to land per DWER license',
    shortName: 'DWER Discharge',
    color: '#228B22',
    x: GRID.col7,
    y: GRID.row5,
    width: GRID.blockWidth + 30,
    height: GRID.blockHeight,
    category: 'output',
    borderColor: '#DC143C',
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
    x: GRID.col7,
    y: GRID.row2,
  },
  {
    id: 'cost-oil',
    parentId: 'OIL-01',
    lines: [
      { label: 'Disposal Cost:' },
      { label: 'Recoverable Cost:' },
    ],
    x: GRID.col7,
    y: GRID.row3,
  },
  {
    id: 'evap-rate',
    parentId: 'WATER-01',
    lines: [
      { label: 'Possible evaporation' },
      { label: 'rate: 6-8ML/yr' },
    ],
    x: GRID.col7,
    y: GRID.row4,
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

// Export grid configuration for responsive calculations
export const LAYOUT_CONFIG = GRID;
