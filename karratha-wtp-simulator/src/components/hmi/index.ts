/**
 * HP-HMI COMPONENT LIBRARY
 * =========================
 * Industry-standard HMI components following:
 * - ISA-101: HMI Design Standards
 * - ISA-18.2: Alarm Management
 * - ISA-88: Batch Control
 * - High Performance HMI Principles
 */

export { AnalogIndicator } from './AnalogIndicator';
export { AlarmBanner, type Alarm } from './AlarmBanner';
export { KPICard, KPIPanel } from './KPIPanel';
export { EquipmentStatus } from './EquipmentStatus';
export { NavigationBar } from './NavigationBar';

// Re-export standards configuration
export {
  HP_HMI_COLORS,
  HP_HMI_CLASSES,
  ISA101_LEVELS,
  ISA_18_2_ALARM,
  ISA_88_BATCH,
  HP_HMI_VISUALIZATION,
  NAVIGATION_STRUCTURE,
  createAlarmDefinition,
  getProcessValueStyle,
} from '@/lib/hmi-standards';
