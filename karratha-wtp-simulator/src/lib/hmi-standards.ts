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
  // Background colors (light neutral grays)
  background: {
    primary: '#f3f4f6',      // Main display background (light gray)
    secondary: '#ffffff',    // Panel/card background (white)
    tertiary: '#e5e7eb',     // Elevated elements
    surface: '#f9fafb',      // Deepest background level
  },

  // Text colors
  text: {
    primary: '#1f2937',      // Primary text (dark gray)
    secondary: '#6b7280',    // Secondary/label text
    muted: '#9ca3af',        // Disabled/inactive text
    emphasis: '#111827',     // Important values
  },

  // Process values - NORMAL state (muted colors)
  normal: {
    value: '#374151',        // Normal process value text
    equipment: '#d1d5db',    // Normal equipment fill
    pipe: '#9ca3af',         // Normal piping
    border: '#e5e7eb',       // Normal borders
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
    button: '#e5e7eb',       // Button background (light gray)
    buttonHover: '#d1d5db',  // Button hover
    buttonActive: '#3b82f6', // Active/selected (blue)
    input: '#ffffff',        // Input field background
    inputBorder: '#d1d5db',  // Input border
    inputFocus: '#3b82f6',   // Focus ring (blue)
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
  bgPrimary: 'bg-[#f3f4f6]',
  bgSecondary: 'bg-white',
  bgTertiary: 'bg-[#e5e7eb]',
  bgSurface: 'bg-[#f9fafb]',

  // Text
  textPrimary: 'text-[#1f2937]',
  textSecondary: 'text-[#6b7280]',
  textMuted: 'text-[#9ca3af]',
  textEmphasis: 'text-[#111827] font-medium',

  // Cards/Panels
  card: 'bg-white border border-[#e5e7eb] rounded-lg shadow-sm',
  cardHeader: 'px-4 py-2 border-b border-[#e5e7eb]',
  cardContent: 'p-4',

  // Process values
  valueNormal: 'text-[#374151] font-mono',
  valueWarning: 'text-[#d97706] font-mono font-bold',
  valueAlarm: 'text-[#dc2626] font-mono font-bold animate-pulse',

  // Equipment
  equipmentNormal: 'fill-[#d1d5db] stroke-[#9ca3af]',
  equipmentRunning: 'fill-[#d1d5db] stroke-[#22c55e]',
  equipmentFaulted: 'fill-[#fecaca] stroke-[#dc2626]',

  // Inputs
  input: 'bg-white border border-[#d1d5db] rounded px-3 py-2 text-[#1f2937] focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] focus:outline-none',

  // Buttons
  buttonPrimary: 'bg-[#e5e7eb] hover:bg-[#d1d5db] active:bg-[#3b82f6] text-[#1f2937] px-4 py-2 rounded transition-colors',
  buttonDanger: 'bg-[#dc2626] hover:bg-[#b91c1c] text-white px-4 py-2 rounded transition-colors',

  // Alarm badges
  alarmCritical: 'bg-[#dc2626] text-white px-2 py-1 rounded text-xs font-bold animate-pulse',
  alarmHigh: 'bg-[#ea580c] text-white px-2 py-1 rounded text-xs font-bold',
  alarmMedium: 'bg-[#d97706] text-white px-2 py-1 rounded text-xs font-medium',
  alarmLow: 'bg-[#0ea5e9] text-white px-2 py-1 rounded text-xs',

  // Status indicators
  statusRunning: 'text-[#22c55e]',
  statusStopped: 'text-[#6b7280]',
  statusFaulted: 'text-[#dc2626]',

  // Analog bars
  barContainer: 'bg-[#e5e7eb] rounded overflow-hidden',
  barFillNormal: 'bg-[#6b7280]',
  barFillWarning: 'bg-[#d97706]',
  barFillAlarm: 'bg-[#dc2626]',

  // Tab navigation
  tabList: 'flex gap-1 bg-[#e5e7eb] p-1 rounded-lg',
  tabItem: 'px-4 py-2 rounded text-[#6b7280] hover:bg-[#d1d5db] transition-colors',
  tabItemActive: 'px-4 py-2 rounded bg-white text-[#1f2937] shadow-sm',
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
