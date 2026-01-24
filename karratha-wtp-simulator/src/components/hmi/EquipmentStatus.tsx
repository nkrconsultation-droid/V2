/**
 * HP-HMI EQUIPMENT STATUS COMPONENT
 * ==================================
 * ISA-101 compliant equipment representation:
 * - Muted colors for normal operation
 * - Color emphasis only for abnormal conditions
 * - State-based visual indication
 * - Status bar with key parameters
 */
import React from 'react';
import { HP_HMI_COLORS, ISA_88_BATCH } from '@/lib/hmi-standards';

type EquipmentState = keyof typeof ISA_88_BATCH.states;
type EquipmentMode = keyof typeof ISA_88_BATCH.modes;

interface EquipmentStatusProps {
  tag: string;
  name: string;
  state: EquipmentState;
  mode?: EquipmentMode;
  parameters?: Array<{
    label: string;
    value: number | string;
    unit?: string;
    status?: 'normal' | 'warning' | 'alarm';
  }>;
  faults?: string[];
  compact?: boolean;
  onClick?: () => void;
}

export function EquipmentStatus({
  tag,
  name,
  state,
  mode = 'AUTOMATIC',
  parameters = [],
  faults = [],
  compact = false,
  onClick,
}: EquipmentStatusProps) {
  const hasFault = faults.length > 0;
  const isRunning = state === 'RUNNING';
  const isStopped = state === 'IDLE' || state === 'STOPPED' || state === 'COMPLETE';

  // Get state color
  const getStateColor = () => {
    if (hasFault) return HP_HMI_COLORS.abnormal.critical;
    if (state === 'HOLDING' || state === 'HELD') return HP_HMI_COLORS.abnormal.medium;
    if (state === 'ABORTING' || state === 'ABORTED') return HP_HMI_COLORS.abnormal.critical;
    if (isRunning) return HP_HMI_COLORS.status.running;
    return HP_HMI_COLORS.normal.equipment;
  };

  // Get background style
  const getBgStyle = () => {
    if (hasFault) {
      return {
        backgroundColor: `${HP_HMI_COLORS.abnormal.critical}20`,
        borderColor: HP_HMI_COLORS.abnormal.critical,
      };
    }
    return {
      backgroundColor: HP_HMI_COLORS.background.secondary,
      borderColor: HP_HMI_COLORS.normal.border,
    };
  };

  // Get mode indicator color
  const getModeColor = () => {
    switch (mode) {
      case 'MANUAL': return HP_HMI_COLORS.abnormal.medium;
      case 'MAINTENANCE': return HP_HMI_COLORS.abnormal.maintenance;
      default: return HP_HMI_COLORS.text.muted;
    }
  };

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors hover:bg-opacity-80`}
        style={getBgStyle()}
        onClick={onClick}
      >
        {/* State indicator */}
        <div
          className={`w-3 h-3 rounded-full ${isRunning && !hasFault ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: getStateColor() }}
        />

        {/* Tag */}
        <span
          className="font-mono text-sm"
          style={{ color: HP_HMI_COLORS.text.primary }}
        >
          {tag}
        </span>

        {/* State */}
        <span
          className="text-xs"
          style={{ color: HP_HMI_COLORS.text.secondary }}
        >
          {ISA_88_BATCH.states[state]}
        </span>

        {/* Fault indicator */}
        {hasFault && (
          <span
            className="text-xs font-bold animate-pulse"
            style={{ color: HP_HMI_COLORS.abnormal.critical }}
          >
            FAULT
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border overflow-hidden cursor-pointer transition-all hover:shadow-lg"
      style={getBgStyle()}
      onClick={onClick}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ backgroundColor: HP_HMI_COLORS.background.tertiary }}
      >
        <div className="flex items-center gap-3">
          {/* State indicator */}
          <div
            className={`w-4 h-4 rounded-full ${isRunning && !hasFault ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: getStateColor() }}
          />

          {/* Tag and name */}
          <div>
            <div
              className="font-mono text-sm font-medium"
              style={{ color: HP_HMI_COLORS.text.emphasis }}
            >
              {tag}
            </div>
            <div
              className="text-xs"
              style={{ color: HP_HMI_COLORS.text.secondary }}
            >
              {name}
            </div>
          </div>
        </div>

        {/* Mode and state */}
        <div className="text-right">
          <div
            className="text-xs font-medium"
            style={{ color: getModeColor() }}
          >
            {ISA_88_BATCH.modes[mode]}
          </div>
          <div
            className="text-sm"
            style={{ color: HP_HMI_COLORS.text.primary }}
          >
            {ISA_88_BATCH.states[state]}
          </div>
        </div>
      </div>

      {/* Parameters */}
      {parameters.length > 0 && (
        <div className="px-4 py-3 grid grid-cols-2 gap-3">
          {parameters.map((param, index) => (
            <div key={index} className="flex justify-between items-baseline">
              <span
                className="text-xs"
                style={{ color: HP_HMI_COLORS.text.muted }}
              >
                {param.label}
              </span>
              <span
                className={`font-mono text-sm ${param.status === 'alarm' ? 'font-bold animate-pulse' : ''}`}
                style={{
                  color: param.status === 'alarm' ? HP_HMI_COLORS.abnormal.critical :
                         param.status === 'warning' ? HP_HMI_COLORS.abnormal.medium :
                         HP_HMI_COLORS.text.primary
                }}
              >
                {param.value}
                {param.unit && (
                  <span
                    className="text-xs ml-1"
                    style={{ color: HP_HMI_COLORS.text.muted }}
                  >
                    {param.unit}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Faults */}
      {hasFault && (
        <div
          className="px-4 py-2 border-t"
          style={{
            backgroundColor: `${HP_HMI_COLORS.abnormal.critical}10`,
            borderColor: HP_HMI_COLORS.abnormal.critical,
          }}
        >
          {faults.map((fault, index) => (
            <div
              key={index}
              className="text-xs font-medium animate-pulse"
              style={{ color: HP_HMI_COLORS.abnormal.critical }}
            >
              ⚠ {fault}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EquipmentStatus;
