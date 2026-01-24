/**
 * HP-HMI ANALOG INDICATOR COMPONENT
 * ==================================
 * ISA-101 compliant analog value display with:
 * - Analog bar representation (situational awareness)
 * - Digital value overlay
 * - Limit indicators (LL, L, H, HH)
 * - Deviation from setpoint indication
 * - Color coding only for abnormal conditions
 */
import React from 'react';
import { HP_HMI_COLORS } from '@/lib/hmi-standards';

interface AnalogIndicatorProps {
  tag: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  lowLow?: number;
  low?: number;
  high?: number;
  highHigh?: number;
  setpoint?: number;
  decimals?: number;
  label?: string;
  orientation?: 'vertical' | 'horizontal';
  showLimits?: boolean;
  compact?: boolean;
}

export function AnalogIndicator({
  tag,
  value,
  unit,
  min,
  max,
  lowLow,
  low,
  high,
  highHigh,
  setpoint,
  decimals = 1,
  label,
  orientation = 'vertical',
  showLimits = true,
  compact = false,
}: AnalogIndicatorProps) {
  // Calculate percentage position
  const range = max - min;
  const percent = Math.max(0, Math.min(100, ((value - min) / range) * 100));

  // Determine status based on limits
  const getStatus = () => {
    if (highHigh !== undefined && value >= highHigh) return 'alarm-high';
    if (lowLow !== undefined && value <= lowLow) return 'alarm-low';
    if (high !== undefined && value >= high) return 'warning-high';
    if (low !== undefined && value <= low) return 'warning-low';
    return 'normal';
  };

  const status = getStatus();
  const isAbnormal = status !== 'normal';

  // Get bar fill color based on status
  const getBarColor = () => {
    switch (status) {
      case 'alarm-high':
      case 'alarm-low':
        return HP_HMI_COLORS.abnormal.critical;
      case 'warning-high':
      case 'warning-low':
        return HP_HMI_COLORS.abnormal.medium;
      default:
        return HP_HMI_COLORS.gauge.normal;
    }
  };

  // Get value text color
  const getValueColor = () => {
    switch (status) {
      case 'alarm-high':
      case 'alarm-low':
        return HP_HMI_COLORS.abnormal.critical;
      case 'warning-high':
      case 'warning-low':
        return HP_HMI_COLORS.abnormal.medium;
      default:
        return HP_HMI_COLORS.text.primary;
    }
  };

  // Calculate limit positions
  const getLimitPosition = (limitValue: number) => ((limitValue - min) / range) * 100;

  const isVertical = orientation === 'vertical';
  const height = compact ? 80 : 120;
  const width = compact ? 40 : 60;

  if (isVertical) {
    return (
      <div className="flex flex-col items-center gap-1">
        {/* Tag and label */}
        <div className="text-center">
          <div className="text-xs font-mono" style={{ color: HP_HMI_COLORS.text.secondary }}>
            {tag}
          </div>
          {label && (
            <div className="text-[10px]" style={{ color: HP_HMI_COLORS.text.muted }}>
              {label}
            </div>
          )}
        </div>

        {/* Analog bar */}
        <div className="relative" style={{ width, height }}>
          {/* Background */}
          <div
            className="absolute inset-0 rounded"
            style={{ backgroundColor: HP_HMI_COLORS.background.surface }}
          />

          {/* Fill bar */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-b transition-all duration-300"
            style={{
              height: `${percent}%`,
              backgroundColor: getBarColor(),
              opacity: isAbnormal ? 1 : 0.7,
            }}
          />

          {/* Limit markers */}
          {showLimits && (
            <>
              {highHigh !== undefined && (
                <div
                  className="absolute left-0 right-0 h-0.5"
                  style={{
                    bottom: `${getLimitPosition(highHigh)}%`,
                    backgroundColor: HP_HMI_COLORS.abnormal.critical,
                  }}
                />
              )}
              {high !== undefined && (
                <div
                  className="absolute left-0 right-0 h-px"
                  style={{
                    bottom: `${getLimitPosition(high)}%`,
                    backgroundColor: HP_HMI_COLORS.abnormal.medium,
                  }}
                />
              )}
              {low !== undefined && (
                <div
                  className="absolute left-0 right-0 h-px"
                  style={{
                    bottom: `${getLimitPosition(low)}%`,
                    backgroundColor: HP_HMI_COLORS.abnormal.medium,
                  }}
                />
              )}
              {lowLow !== undefined && (
                <div
                  className="absolute left-0 right-0 h-0.5"
                  style={{
                    bottom: `${getLimitPosition(lowLow)}%`,
                    backgroundColor: HP_HMI_COLORS.abnormal.critical,
                  }}
                />
              )}
            </>
          )}

          {/* Setpoint marker */}
          {setpoint !== undefined && (
            <div
              className="absolute left-0 right-0 flex items-center"
              style={{ bottom: `${getLimitPosition(setpoint)}%` }}
            >
              <div
                className="w-full h-0.5"
                style={{ backgroundColor: HP_HMI_COLORS.status.running }}
              />
              <div
                className="absolute -right-1 w-2 h-2 rotate-45"
                style={{ backgroundColor: HP_HMI_COLORS.status.running }}
              />
            </div>
          )}

          {/* Current value pointer */}
          <div
            className="absolute -left-1 w-2 h-2 rotate-45 transition-all duration-300"
            style={{
              bottom: `calc(${percent}% - 4px)`,
              backgroundColor: getValueColor(),
            }}
          />
        </div>

        {/* Digital value */}
        <div
          className={`text-center font-mono ${isAbnormal ? 'font-bold' : ''}`}
          style={{ color: getValueColor() }}
        >
          <span className={compact ? 'text-sm' : 'text-base'}>
            {value.toFixed(decimals)}
          </span>
          <span className="text-xs ml-1" style={{ color: HP_HMI_COLORS.text.secondary }}>
            {unit}
          </span>
        </div>

        {/* Scale labels */}
        {!compact && (
          <div
            className="flex justify-between w-full text-[10px] font-mono"
            style={{ color: HP_HMI_COLORS.text.muted }}
          >
            <span>{min}</span>
            <span>{max}</span>
          </div>
        )}
      </div>
    );
  }

  // Horizontal orientation
  return (
    <div className="flex items-center gap-2">
      {/* Tag */}
      <div
        className="text-xs font-mono w-16 text-right"
        style={{ color: HP_HMI_COLORS.text.secondary }}
      >
        {tag}
      </div>

      {/* Analog bar */}
      <div className="relative flex-1 h-6 min-w-[100px]">
        <div
          className="absolute inset-0 rounded"
          style={{ backgroundColor: HP_HMI_COLORS.background.surface }}
        />
        <div
          className="absolute top-0 bottom-0 left-0 rounded-l transition-all duration-300"
          style={{
            width: `${percent}%`,
            backgroundColor: getBarColor(),
            opacity: isAbnormal ? 1 : 0.7,
          }}
        />

        {/* Setpoint marker */}
        {setpoint !== undefined && (
          <div
            className="absolute top-0 bottom-0 w-0.5"
            style={{
              left: `${getLimitPosition(setpoint)}%`,
              backgroundColor: HP_HMI_COLORS.status.running,
            }}
          />
        )}
      </div>

      {/* Digital value */}
      <div
        className={`font-mono w-20 text-right ${isAbnormal ? 'font-bold' : ''}`}
        style={{ color: getValueColor() }}
      >
        {value.toFixed(decimals)} {unit}
      </div>
    </div>
  );
}

export default AnalogIndicator;
