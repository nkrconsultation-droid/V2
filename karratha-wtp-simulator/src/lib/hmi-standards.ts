/**
 * HMI INDUSTRY STANDARDS CONFIGURATION
 * =====================================
 * ISA-101: HMI Design Standards
 * ISA-18.2: Alarm Management
 * ISA-88: Batch Control
 * High Performance HMI Principles
 * IEC 62443: Security Standards
 */

// ═══════════════════════════════════════════════════════════════════════════
// ISA-101: DISPLAY HIERARCHY
// ═══════════════════════════════════════════════════════════════════════════
export const ISA101_LEVELS = {
  L1_OVERVIEW: {
    level: 1,
    name: 'Plant Overview',
    description: 'Enterprise/Site-wide view showing overall plant status',
    purpose: 'Situational awareness at highest level',
    typicalContent: ['KPIs', 'Critical alarms', 'Production summary', 'Unit status'],
  },
  L2_AREA: {
    level: 2,
    name: 'Area/Unit Overview',
    description: 'Process area showing unit operations',
    purpose: 'Monitor and control major process sections',
    typicalContent: ['Process flow', 'Key measurements', 'Equipment status', 'Area alarms'],
  },
  L3_DETAIL: {
    level: 3,
    name: 'Equipment Detail',
    description: 'Individual equipment control and monitoring',
    purpose: 'Detailed equipment operation and diagnostics',
    typicalContent: ['Control loops', 'Setpoints', 'Tuning', 'Detailed measurements'],
  },
  L4_DIAGNOSTIC: {
    level: 4,
    name: 'Diagnostic/Support',
    description: 'Troubleshooting, trends, and configuration',
    purpose: 'Deep analysis and configuration',
    typicalContent: ['Trend analysis', 'Alarm history', 'Configuration', 'Maintenance'],
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// HIGH PERFORMANCE HMI COLOR PALETTE
// Based on ASM Consortium & ISA-101 recommendations
// Gray background with color reserved for abnormal conditions
// ═══════════════════════════════════════════════════════════════════════════
export const HP_HMI_COLORS = {
  // Background colors (neutral grays)
  background: {
    primary: '#3d3d3d',      // Main display background (dark gray)
    secondary: '#4a4a4a',    // Panel/card background
    tertiary: '#5a5a5a',     // Elevated elements
    surface: '#2d2d2d',      // Deepest background level
  },

  // Text colors
  text: {
    primary: '#e0e0e0',      // Primary text (light gray)
    secondary: '#a0a0a0',    // Secondary/label text
    muted: '#707070',        // Disabled/inactive text
    emphasis: '#ffffff',     // Important values
  },

  // Process values - NORMAL state (muted colors)
  normal: {
    value: '#c0c0c0',        // Normal process value text
    equipment: '#606060',    // Normal equipment fill
    pipe: '#505050',         // Normal piping
    border: '#4a4a4a',       // Normal borders
  },

  // ABNORMAL states (color used sparingly for attention)
  abnormal: {
    // Alarms per ISA-18.2
    critical: '#ff3333',     // Priority 1 - Life/safety threat (red)
    high: '#ff6600',         // Priority 2 - Significant impact (orange)
    medium: '#ffcc00',       // Priority 3 - Moderate impact (yellow)
    low: '#66ccff',          // Priority 4 - Minor impact (cyan)

    // Process deviations
    highDeviation: '#ff6600', // Approaching limit (orange)
    atLimit: '#ff3333',       // At or beyond limit (red)

    // Equipment states
    faulted: '#ff3333',       // Equipment fault (red)
    warning: '#ffcc00',       // Equipment warning (yellow)
    maintenance: '#9966ff',   // Maintenance required (purple)
  },

  // Status indicators (minimal use)
  status: {
    running: '#33cc33',      // Running/active (green) - use sparingly
    stopped: '#808080',      // Stopped/off (gray)
    starting: '#66ff66',     // Starting up (light green)
    stopping: '#cccc00',     // Stopping (yellow-green)

    // Flow indicators
    flowActive: '#4080ff',   // Flow present (blue)
    flowNone: '#404040',     // No flow (dark gray)
  },

  // Analog bar/gauge fills (subdued when normal)
  gauge: {
    normal: '#607080',       // Normal range fill (blue-gray)
    warning: '#cc9900',      // Approaching limit (amber)
    alarm: '#cc3300',        // At/beyond limit (red)
    target: '#40a040',       // At target (muted green)
  },

  // Interactive elements
  interactive: {
    button: '#505860',       // Button background
    buttonHover: '#606870',  // Button hover
    buttonActive: '#4080c0', // Active/selected
    input: '#404040',        // Input field background
    inputBorder: '#606060',  // Input border
    inputFocus: '#4080c0',   // Focus ring
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// ISA-18.2: ALARM MANAGEMENT
// Alarm priorities, states, and rationalization
// ═══════════════════════════════════════════════════════════════════════════
export const ISA_18_2_ALARM = {
  // Alarm priorities (1 = highest)
  priorities: {
    CRITICAL: {
      level: 1,
      name: 'Critical',
      color: HP_HMI_COLORS.abnormal.critical,
      description: 'Immediate action required - safety/environmental',
      responseTime: '< 5 minutes',
      annunciation: 'Continuous audible + visual',
    },
    HIGH: {
      level: 2,
      name: 'High',
      color: HP_HMI_COLORS.abnormal.high,
      description: 'Prompt action required - major impact',
      responseTime: '< 10 minutes',
      annunciation: 'Intermittent audible + visual',
    },
    MEDIUM: {
      level: 3,
      name: 'Medium',
      color: HP_HMI_COLORS.abnormal.medium,
      description: 'Timely action required - moderate impact',
      responseTime: '< 30 minutes',
      annunciation: 'Visual only',
    },
    LOW: {
      level: 4,
      name: 'Low',
      color: HP_HMI_COLORS.abnormal.low,
      description: 'Awareness required - minor impact',
      responseTime: '< 60 minutes',
      annunciation: 'Visual only (status bar)',
    },
  },

  // Alarm states per ISA-18.2
  states: {
    NORMAL: 'Normal',                    // No alarm condition
    UNACK_ACTIVE: 'Unacknowledged',     // Active, not acknowledged
    ACK_ACTIVE: 'Acknowledged',          // Active, acknowledged
    UNACK_RTN: 'Returned Unack',         // Returned to normal, not ack'd
    SHELVED: 'Shelved',                  // Temporarily suppressed
    OUT_OF_SERVICE: 'Out of Service',    // Disabled for maintenance
    SUPPRESSED: 'Suppressed',            // Automatically suppressed
  },

  // Alarm types
  types: {
    PROCESS: 'Process',                  // Process variable deviation
    EQUIPMENT: 'Equipment',              // Equipment status/fault
    SAFETY: 'Safety',                    // Safety system
    DIAGNOSTIC: 'Diagnostic',            // System diagnostic
    ADVISORY: 'Advisory',                // Informational
  },

  // Deadband and delay settings
  settings: {
    defaultDeadband: 2,                  // % of span for hysteresis
    defaultOnDelay: 3,                   // seconds before alarm activates
    defaultOffDelay: 5,                  // seconds before alarm clears
    maxShelveTime: 480,                  // minutes (8 hours max)
    repeatInterval: 300,                 // seconds for re-annunciation
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// ISA-88: BATCH CONTROL STANDARDS
// States, modes, and recipe terminology
// ═══════════════════════════════════════════════════════════════════════════
export const ISA_88_BATCH = {
  // Unit/Equipment states
  states: {
    IDLE: 'Idle',
    RUNNING: 'Running',
    PAUSED: 'Paused',
    HELD: 'Held',
    COMPLETE: 'Complete',
    STOPPED: 'Stopped',
    ABORTED: 'Aborted',
    ABORTING: 'Aborting',
    STOPPING: 'Stopping',
    HOLDING: 'Holding',
    RESTARTING: 'Restarting',
    RESETTING: 'Resetting',
  },

  // Operating modes
  modes: {
    AUTOMATIC: 'Automatic',
    SEMI_AUTO: 'Semi-Automatic',
    MANUAL: 'Manual',
    MAINTENANCE: 'Maintenance',
  },

  // Recipe hierarchy
  hierarchy: {
    PROCEDURE: 'Procedure',      // Overall batch
    UNIT_PROCEDURE: 'Unit Procedure',
    OPERATION: 'Operation',
    PHASE: 'Phase',
    STEP: 'Step',
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// HP-HMI VISUALIZATION STANDARDS
// Analog representation, trends, and situational awareness
// ═══════════════════════════════════════════════════════════════════════════
export const HP_HMI_VISUALIZATION = {
  // Analog indicator types
  analogIndicators: {
    // Bar graph - primary for level indication
    BAR: {
      type: 'bar',
      orientation: 'vertical',
      showTarget: true,
      showLimits: true,
      fillStyle: 'gradient',
    },
    // Moving pointer - for rapid changes
    POINTER: {
      type: 'pointer',
      showHistory: true,
      showTarget: true,
    },
    // Digital value with analog context
    EMBEDDED: {
      type: 'embedded',
      showSparkline: true,
      showDeviation: true,
    },
  },

  // Trend settings
  trends: {
    defaultTimespan: 3600,         // 1 hour default view
    maxDataPoints: 1000,           // Points per trend
    updateInterval: 1000,          // ms between updates
    showOperatorActions: true,     // Mark operator interventions
    showAlarmEvents: true,         // Mark alarm occurrences
  },

  // Equipment representation
  equipment: {
    // Use subdued colors for equipment symbols
    normalFill: HP_HMI_COLORS.normal.equipment,
    normalStroke: HP_HMI_COLORS.normal.border,
    runningIndicator: HP_HMI_COLORS.status.running,
    faultedFill: HP_HMI_COLORS.abnormal.faulted,
    // Animation only for abnormal conditions
    animateOnlyWhenAbnormal: true,
  },

  // Situational awareness
  awareness: {
    // Deviation indicators
    showDeviationBand: true,
    deviationThreshold: 5,         // % from setpoint to highlight
    // Rate of change
    showRateOfChange: true,
    rateThreshold: 10,             // % per minute
    // Prediction
    showPredictedValue: true,
    predictionHorizon: 300,        // seconds ahead
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION STRUCTURE (ISA-101 Compliant)
// ═══════════════════════════════════════════════════════════════════════════
export const NAVIGATION_STRUCTURE = {
  // Primary navigation tabs
  tabs: [
    // Level 1 - Overview
    { id: 'overview', label: 'Overview', level: 1, icon: 'LayoutDashboard' },

    // Level 2 - Area views
    { id: 'process', label: 'Process', level: 2, icon: 'Activity' },
    { id: 'tankage', label: 'Tankage', level: 2, icon: 'Database' },
    { id: 'chemicals', label: 'Chemicals', level: 2, icon: 'FlaskConical' },

    // Level 3 - Equipment detail
    { id: 'centrifuge', label: 'Centrifuge', level: 3, icon: 'Cog' },
    { id: 'controls', label: 'Controls', level: 3, icon: 'SlidersHorizontal' },
    { id: 'filter', label: 'Polishing', level: 3, icon: 'Filter' },

    // Level 4 - Diagnostics
    { id: 'trends', label: 'Trends', level: 4, icon: 'TrendingUp' },
    { id: 'alarms', label: 'Alarms', level: 4, icon: 'Bell' },
    { id: 'reports', label: 'Reports', level: 4, icon: 'FileText' },
    { id: 'config', label: 'Config', level: 4, icon: 'Settings' },
  ],

  // Breadcrumb format
  breadcrumbFormat: 'Plant > {area} > {equipment} > {detail}',

  // Quick access areas
  quickAccess: ['overview', 'alarms', 'process'],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// TAILWIND CSS CLASSES FOR HP-HMI
// Pre-defined class strings for consistent styling
// ═══════════════════════════════════════════════════════════════════════════
export const HP_HMI_CLASSES = {
  // Backgrounds
  bgPrimary: 'bg-[#3d3d3d]',
  bgSecondary: 'bg-[#4a4a4a]',
  bgTertiary: 'bg-[#5a5a5a]',
  bgSurface: 'bg-[#2d2d2d]',

  // Text
  textPrimary: 'text-[#e0e0e0]',
  textSecondary: 'text-[#a0a0a0]',
  textMuted: 'text-[#707070]',
  textEmphasis: 'text-white font-medium',

  // Cards/Panels
  card: 'bg-[#4a4a4a] border border-[#5a5a5a] rounded-lg',
  cardHeader: 'px-4 py-2 border-b border-[#5a5a5a]',
  cardContent: 'p-4',

  // Process values
  valueNormal: 'text-[#c0c0c0] font-mono',
  valueWarning: 'text-[#ffcc00] font-mono font-bold',
  valueAlarm: 'text-[#ff3333] font-mono font-bold animate-pulse',

  // Equipment
  equipmentNormal: 'fill-[#606060] stroke-[#808080]',
  equipmentRunning: 'fill-[#606060] stroke-[#33cc33]',
  equipmentFaulted: 'fill-[#802020] stroke-[#ff3333]',

  // Inputs
  input: 'bg-[#404040] border border-[#606060] rounded px-3 py-2 text-[#e0e0e0] focus:border-[#4080c0] focus:ring-1 focus:ring-[#4080c0] focus:outline-none',

  // Buttons
  buttonPrimary: 'bg-[#505860] hover:bg-[#606870] active:bg-[#4080c0] text-[#e0e0e0] px-4 py-2 rounded transition-colors',
  buttonDanger: 'bg-[#803030] hover:bg-[#904040] text-white px-4 py-2 rounded transition-colors',

  // Alarm badges
  alarmCritical: 'bg-[#ff3333] text-white px-2 py-1 rounded text-xs font-bold animate-pulse',
  alarmHigh: 'bg-[#ff6600] text-white px-2 py-1 rounded text-xs font-bold',
  alarmMedium: 'bg-[#cc9900] text-black px-2 py-1 rounded text-xs font-medium',
  alarmLow: 'bg-[#66ccff] text-black px-2 py-1 rounded text-xs',

  // Status indicators
  statusRunning: 'text-[#33cc33]',
  statusStopped: 'text-[#808080]',
  statusFaulted: 'text-[#ff3333]',

  // Analog bars
  barContainer: 'bg-[#2d2d2d] rounded overflow-hidden',
  barFillNormal: 'bg-[#607080]',
  barFillWarning: 'bg-[#cc9900]',
  barFillAlarm: 'bg-[#cc3300]',

  // Tab navigation
  tabList: 'flex gap-1 bg-[#2d2d2d] p-1 rounded-lg',
  tabItem: 'px-4 py-2 rounded text-[#a0a0a0] hover:bg-[#4a4a4a] transition-colors',
  tabItemActive: 'px-4 py-2 rounded bg-[#505860] text-white',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// ALARM DEFINITION HELPER
// Creates properly rationalized alarm definitions per ISA-18.2
// ═══════════════════════════════════════════════════════════════════════════
export interface AlarmDefinition {
  id: string;
  tag: string;
  description: string;
  priority: keyof typeof ISA_18_2_ALARM.priorities;
  type: keyof typeof ISA_18_2_ALARM.types;
  setpoint: number;
  deadband: number;
  onDelay: number;
  offDelay: number;
  consequence: string;
  action: string;
  enabled: boolean;
}

export function createAlarmDefinition(
  id: string,
  tag: string,
  description: string,
  priority: keyof typeof ISA_18_2_ALARM.priorities,
  type: keyof typeof ISA_18_2_ALARM.types,
  setpoint: number,
  options: Partial<AlarmDefinition> = {}
): AlarmDefinition {
  return {
    id,
    tag,
    description,
    priority,
    type,
    setpoint,
    deadband: options.deadband ?? ISA_18_2_ALARM.settings.defaultDeadband,
    onDelay: options.onDelay ?? ISA_18_2_ALARM.settings.defaultOnDelay,
    offDelay: options.offDelay ?? ISA_18_2_ALARM.settings.defaultOffDelay,
    consequence: options.consequence ?? '',
    action: options.action ?? '',
    enabled: options.enabled ?? true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESS VALUE FORMATTER
// Determines color and format based on deviation from normal
// ═══════════════════════════════════════════════════════════════════════════
export function getProcessValueStyle(
  value: number,
  lowLimit: number,
  highLimit: number,
  lowAlarm?: number,
  highAlarm?: number
): { className: string; status: 'normal' | 'warning' | 'alarm' } {
  const low = lowAlarm ?? lowLimit;
  const high = highAlarm ?? highLimit;

  if (value <= low || value >= high) {
    return { className: HP_HMI_CLASSES.valueAlarm, status: 'alarm' };
  }

  // Warning at 80% of the way to limit
  const warningLow = lowLimit + (low - lowLimit) * 0.2;
  const warningHigh = highLimit - (highLimit - high) * 0.2;

  if (value <= warningLow || value >= warningHigh) {
    return { className: HP_HMI_CLASSES.valueWarning, status: 'warning' };
  }

  return { className: HP_HMI_CLASSES.valueNormal, status: 'normal' };
}

export default {
  ISA101_LEVELS,
  HP_HMI_COLORS,
  ISA_18_2_ALARM,
  ISA_88_BATCH,
  HP_HMI_VISUALIZATION,
  NAVIGATION_STRUCTURE,
  HP_HMI_CLASSES,
  createAlarmDefinition,
  getProcessValueStyle,
};
