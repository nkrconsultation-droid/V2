/**
 * PROCESS OVERVIEW DIAGRAM CONFIGURATION
 * =======================================
 * Modern, refined block definitions with updated color scheme
 * and responsive layout system.
 */

// ═══════════════════════════════════════════════════════════════
// LAYOUT CONSTANTS (scalable base units)
// ═══════════════════════════════════════════════════════════════
const GRID = {
  unit: 20,
  blockWidth: 140,
  blockHeight: 72,
  smallBlockWidth: 110,
  smallBlockHeight: 58,
  horizontalGap: 50,
  verticalGap: 30,
  // Row positions (Y coordinates)
  row1: 50,
  row2: 150,
  row3: 260,
  row4: 370,
  row5: 480,
  // Column positions (X coordinates)
  col1: 40,
  col2: 230,
  col3: 420,
  col4: 600,
  col5: 790,
  col6: 990,
  col7: 1200,
};

// ═══════════════════════════════════════════════════════════════
// MODERN COLOR PALETTE
// ═══════════════════════════════════════════════════════════════
export const DIAGRAM_COLORS = {
  // Feed section - warm orange tones
  feed: {
    primary: '#F97316',     // Vibrant orange
    secondary: '#FB923C',   // Light orange
    gradient: ['#F97316', '#EA580C'],
  },
  // Process section - teal/cyan tones
  process: {
    main: '#0D9488',        // Teal
    aux: '#14B8A6',         // Light teal
    gradient: ['#0D9488', '#0F766E'],
  },
  // Output section - slate/gray tones
  output: {
    primary: '#64748B',     // Slate
    secondary: '#94A3B8',   // Light slate
    gradient: ['#64748B', '#475569'],
  },
  // Utility - blue tones
  utility: {
    flush: '#38BDF8',       // Sky blue
    recirculation: '#EF4444', // Red
    gradient: ['#38BDF8', '#0EA5E9'],
  },
  // Storage/final products - emerald
  storage: {
    primary: '#10B981',     // Emerald
    secondary: '#34D399',   // Light emerald
    gradient: ['#10B981', '#059669'],
  },
  // Stream flow colors
  streams: {
    oil: '#D97706',         // Amber
    water: '#3B82F6',       // Blue
    solids: '#6B7280',      // Gray
    chemical: '#8B5CF6',    // Violet
    main: '#06B6D4',        // Cyan
  },
  // UI colors
  ui: {
    background: '#0F172A',
    surface: '#1E293B',
    border: '#334155',
    borderLight: '#475569',
    text: '#F8FAFC',
    textMuted: '#94A3B8',
    accent: '#06B6D4',
    accentHover: '#22D3EE',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
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
  gradientColors?: string[];
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
    name: 'Suction & Feed',
    shortName: 'Suction & Feed',
    color: DIAGRAM_COLORS.feed.secondary,
    gradientColors: ['#FB923C', '#F97316'],
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
    name: 'Feed Conditioning',
    shortName: 'Feed Conditioning',
    description: 'Pre-Treatment',
    color: DIAGRAM_COLORS.feed.primary,
    gradientColors: DIAGRAM_COLORS.feed.gradient,
    x: GRID.col1,
    y: GRID.row2,
    width: GRID.blockWidth,
    height: GRID.blockHeight + 8,
    category: 'feed',
  },
  {
    id: 'FLUSH-01',
    name: 'Fresh Water Flush',
    shortName: 'Fresh Water Flush',
    color: DIAGRAM_COLORS.utility.flush,
    gradientColors: DIAGRAM_COLORS.utility.gradient,
    textColor: '#0F172A',
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
    gradientColors: DIAGRAM_COLORS.process.gradient,
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
    color: '#8B5CF6',
    gradientColors: ['#8B5CF6', '#7C3AED'],
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
    gradientColors: DIAGRAM_COLORS.process.gradient,
    x: GRID.col3,
    y: GRID.row2,
    width: GRID.blockWidth,
    height: GRID.blockHeight + 8,
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
    gradientColors: ['#14B8A6', '#0D9488'],
    x: GRID.col4,
    y: GRID.row2,
    width: GRID.smallBlockWidth,
    height: GRID.smallBlockHeight,
    category: 'process',
  },
  {
    id: 'MECH-01',
    name: 'Mechanical Separation',
    shortName: 'Mech. Separation',
    color: DIAGRAM_COLORS.process.main,
    gradientColors: DIAGRAM_COLORS.process.gradient,
    x: GRID.col3,
    y: GRID.row3,
    width: GRID.blockWidth,
    height: GRID.blockHeight + 8,
    category: 'process',
  },
  {
    id: 'POLISH-01',
    name: 'Polishing Separation',
    shortName: 'Polishing Sep.',
    color: DIAGRAM_COLORS.process.main,
    gradientColors: DIAGRAM_COLORS.process.gradient,
    x: GRID.col3,
    y: GRID.row4,
    width: GRID.blockWidth,
    height: GRID.blockHeight + 8,
    category: 'process',
  },

  // ═══════════════════════════════════════════════════════════════
  // RECIRCULATION (Column 2)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'RECIRC',
    name: 'Recirculation',
    shortName: 'Recirculation',
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
    gradientColors: DIAGRAM_COLORS.process.gradient,
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
    gradientColors: DIAGRAM_COLORS.output.gradient,
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
    description: '20-35% w/w',
    color: DIAGRAM_COLORS.output.secondary,
    gradientColors: ['#94A3B8', '#64748B'],
    textColor: '#0F172A',
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
    gradientColors: DIAGRAM_COLORS.output.gradient,
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
    description: '<5% water',
    color: '#D97706',
    gradientColors: ['#F59E0B', '#D97706'],
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
    gradientColors: DIAGRAM_COLORS.output.gradient,
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
    color: DIAGRAM_COLORS.streams.water,
    gradientColors: ['#60A5FA', '#3B82F6'],
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
    gradientColors: DIAGRAM_COLORS.utility.gradient,
    textColor: '#0F172A',
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
    color: '#60A5FA',
    gradientColors: ['#93C5FD', '#60A5FA'],
    textColor: '#0F172A',
    x: GRID.col6,
    y: GRID.row5,
    width: GRID.blockWidth + 10,
    height: GRID.blockHeight,
    category: 'storage',
  },
  {
    id: 'DWER-01',
    name: 'DWER Licensed Discharge',
    shortName: 'DWER Discharge',
    color: DIAGRAM_COLORS.storage.primary,
    gradientColors: DIAGRAM_COLORS.storage.gradient,
    x: GRID.col7,
    y: GRID.row5,
    width: GRID.blockWidth + 30,
    height: GRID.blockHeight,
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
  path?: string;
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
// OUTPUT INFO BOXES
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
      { label: 'Disposal Cost' },
      { label: 'Recoverable Value' },
    ],
    x: GRID.col7,
    y: GRID.row2,
  },
  {
    id: 'cost-oil',
    parentId: 'OIL-01',
    lines: [
      { label: 'Recovery Value' },
      { label: 'Market Price' },
    ],
    x: GRID.col7,
    y: GRID.row3,
  },
  {
    id: 'evap-rate',
    parentId: 'WATER-01',
    lines: [
      { label: 'Evaporation Rate' },
      { label: '6-8 ML/yr' },
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

export const LAYOUT_CONFIG = GRID;
