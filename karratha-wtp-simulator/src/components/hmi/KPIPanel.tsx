/**
 * HP-HMI KPI PANEL COMPONENT
 * ===========================
 * ISA-101 Level 1 overview display showing:
 * - Key performance indicators with analog context
 * - Deviation from target indication
 * - Color only for abnormal conditions
 * - Sparkline trend preview
 */
import React from 'react';
import { HP_HMI_COLORS } from '@/lib/hmi-standards';

interface KPIProps {
  label: string;
  value: number;
  unit: string;
  target?: number;
  min?: number;
  max?: number;
  lowAlarm?: number;
  highAlarm?: number;
  trend?: number[];  // Recent values for sparkline
  decimals?: number;
  inverted?: boolean;  // Lower is better (e.g., OiW)
}

export function KPICard({
  label,
  value,
  unit,
  target,
  min = 0,
  max = 100,
  lowAlarm,
  highAlarm,
  trend,
  decimals = 1,
  inverted = false,
}: KPIProps) {
  // Determine status
  const getStatus = () => {
    if (highAlarm !== undefined && value >= highAlarm) return 'alarm';
    if (lowAlarm !== undefined && value <= lowAlarm) return 'alarm';
    if (target !== undefined) {
      const deviation = Math.abs(value - target) / target * 100;
      if (deviation > 20) return 'warning';
    }
    return 'normal';
  };

  const status = getStatus();

  // Get colors based on status
  const getValueColor = () => {
    switch (status) {
      case 'alarm': return HP_HMI_COLORS.abnormal.critical;
      case 'warning': return HP_HMI_COLORS.abnormal.medium;
      default: return HP_HMI_COLORS.text.primary;
    }
  };

  // Calculate bar percentage
  const range = max - min;
  const percent = Math.max(0, Math.min(100, ((value - min) / range) * 100));
  const targetPercent = target !== undefined
    ? Math.max(0, Math.min(100, ((target - min) / range) * 100))
    : undefined;

  // Calculate deviation from target
  const deviation = target !== undefined
    ? ((value - target) / target * 100)
    : undefined;

  // Render sparkline
  const renderSparkline = () => {
    if (!trend || trend.length < 2) return null;

    const trendMin = Math.min(...trend);
    const trendMax = Math.max(...trend);
    const trendRange = trendMax - trendMin || 1;
    const height = 24;
    const width = 60;

    const points = trend.map((v, i) => {
      const x = (i / (trend.length - 1)) * width;
      const y = height - ((v - trendMin) / trendRange) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="opacity-60">
        <polyline
          points={points}
          fill="none"
          stroke={HP_HMI_COLORS.text.secondary}
          strokeWidth="1.5"
        />
      </svg>
    );
  };

  return (
    <div
      className="rounded-lg p-4"
      style={{ backgroundColor: HP_HMI_COLORS.background.secondary }}
    >
      {/* Label */}
      <div
        className="text-xs uppercase tracking-wider mb-2"
        style={{ color: HP_HMI_COLORS.text.muted }}
      >
        {label}
      </div>

      {/* Value row */}
      <div className="flex items-end justify-between mb-3">
        {/* Main value */}
        <div className="flex items-baseline gap-1">
          <span
            className={`text-3xl font-mono ${status !== 'normal' ? 'font-bold' : ''}`}
            style={{ color: getValueColor() }}
          >
            {value.toFixed(decimals)}
          </span>
          <span
            className="text-sm"
            style={{ color: HP_HMI_COLORS.text.secondary }}
          >
            {unit}
          </span>
        </div>

        {/* Sparkline */}
        {renderSparkline()}
      </div>

      {/* Analog bar */}
      <div className="relative h-2 rounded overflow-hidden mb-2">
        <div
          className="absolute inset-0"
          style={{ backgroundColor: HP_HMI_COLORS.background.surface }}
        />
        <div
          className="absolute top-0 bottom-0 left-0 rounded transition-all duration-500"
          style={{
            width: `${percent}%`,
            backgroundColor: status === 'alarm' ? HP_HMI_COLORS.abnormal.critical :
                           status === 'warning' ? HP_HMI_COLORS.abnormal.medium :
                           HP_HMI_COLORS.gauge.normal,
          }}
        />
        {/* Target marker */}
        {targetPercent !== undefined && (
          <div
            className="absolute top-0 bottom-0 w-0.5"
            style={{
              left: `${targetPercent}%`,
              backgroundColor: HP_HMI_COLORS.status.running,
            }}
          />
        )}
      </div>

      {/* Target/Deviation row */}
      {target !== undefined && (
        <div
          className="flex justify-between text-xs"
          style={{ color: HP_HMI_COLORS.text.muted }}
        >
          <span>Target: {target.toFixed(decimals)}</span>
          {deviation !== undefined && (
            <span
              style={{
                color: Math.abs(deviation) > 10
                  ? (inverted ? (deviation < 0 ? HP_HMI_COLORS.status.running : HP_HMI_COLORS.abnormal.medium)
                              : (deviation > 0 ? HP_HMI_COLORS.status.running : HP_HMI_COLORS.abnormal.medium))
                  : HP_HMI_COLORS.text.secondary
              }}
            >
              {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface KPIPanelProps {
  kpis: KPIProps[];
  columns?: number;
}

export function KPIPanel({ kpis, columns = 4 }: KPIPanelProps) {
  return (
    <div
      className={`grid gap-4`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {kpis.map((kpi, index) => (
        <KPICard key={index} {...kpi} />
      ))}
    </div>
  );
}

export default KPIPanel;
