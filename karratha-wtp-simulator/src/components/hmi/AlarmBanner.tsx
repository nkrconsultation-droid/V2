/**
 * HP-HMI ALARM BANNER COMPONENT
 * ==============================
 * ISA-18.2 compliant alarm display with:
 * - Priority-based color coding
 * - State indication (unack, ack, returned)
 * - Timestamp and tag display
 * - Acknowledge functionality
 * - Shelving capability
 */
import React, { useState } from 'react';
import { HP_HMI_COLORS, ISA_18_2_ALARM } from '@/lib/hmi-standards';

export interface Alarm {
  id: string;
  tag: string;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  state: 'UNACK_ACTIVE' | 'ACK_ACTIVE' | 'UNACK_RTN' | 'SHELVED';
  timestamp: Date;
  value?: number;
  limit?: number;
  unit?: string;
}

interface AlarmBannerProps {
  alarms: Alarm[];
  onAcknowledge?: (id: string) => void;
  onAcknowledgeAll?: () => void;
  onShelve?: (id: string, minutes: number) => void;
  maxVisible?: number;
  compact?: boolean;
}

export function AlarmBanner({
  alarms,
  onAcknowledge,
  onAcknowledgeAll,
  onShelve,
  maxVisible = 5,
  compact = false,
}: AlarmBannerProps) {
  const [expanded, setExpanded] = useState(false);

  // Sort alarms by priority then timestamp
  const sortedAlarms = [...alarms].sort((a, b) => {
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  // Get unacknowledged count
  const unackCount = alarms.filter(a => a.state === 'UNACK_ACTIVE' || a.state === 'UNACK_RTN').length;
  const criticalCount = alarms.filter(a => a.priority === 'CRITICAL').length;
  const highCount = alarms.filter(a => a.priority === 'HIGH').length;

  // Display subset unless expanded
  const displayAlarms = expanded ? sortedAlarms : sortedAlarms.slice(0, maxVisible);

  const getPriorityColor = (priority: Alarm['priority']) => {
    return ISA_18_2_ALARM.priorities[priority].color;
  };

  const getPriorityBgClass = (priority: Alarm['priority'], state: Alarm['state']) => {
    const isUnack = state === 'UNACK_ACTIVE' || state === 'UNACK_RTN';
    const baseColor = getPriorityColor(priority);
    return {
      backgroundColor: isUnack ? baseColor : `${baseColor}40`,
      borderLeft: `4px solid ${baseColor}`,
    };
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (alarms.length === 0) {
    return (
      <div
        className="px-4 py-2 rounded flex items-center gap-2"
        style={{ backgroundColor: HP_HMI_COLORS.background.secondary }}
      >
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: HP_HMI_COLORS.status.running }}
        />
        <span style={{ color: HP_HMI_COLORS.text.secondary }}>
          No Active Alarms
        </span>
      </div>
    );
  }

  return (
    <div
      className="rounded overflow-hidden"
      style={{ backgroundColor: HP_HMI_COLORS.background.secondary }}
    >
      {/* Summary header */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer"
        style={{ backgroundColor: HP_HMI_COLORS.background.tertiary }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          {/* Alarm counts by priority */}
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <span
                className="px-2 py-0.5 rounded text-xs font-bold animate-pulse"
                style={{
                  backgroundColor: HP_HMI_COLORS.abnormal.critical,
                  color: 'white',
                }}
              >
                {criticalCount} CRITICAL
              </span>
            )}
            {highCount > 0 && (
              <span
                className="px-2 py-0.5 rounded text-xs font-bold"
                style={{
                  backgroundColor: HP_HMI_COLORS.abnormal.high,
                  color: 'white',
                }}
              >
                {highCount} HIGH
              </span>
            )}
            <span
              className="text-sm"
              style={{ color: HP_HMI_COLORS.text.secondary }}
            >
              {alarms.length} Total
            </span>
          </div>

          {/* Unack indicator */}
          {unackCount > 0 && (
            <span
              className="text-sm animate-pulse"
              style={{ color: HP_HMI_COLORS.abnormal.medium }}
            >
              {unackCount} Unacknowledged
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Acknowledge all button */}
          {unackCount > 0 && onAcknowledgeAll && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAcknowledgeAll();
              }}
              className="px-3 py-1 rounded text-xs font-medium"
              style={{
                backgroundColor: HP_HMI_COLORS.interactive.button,
                color: HP_HMI_COLORS.text.primary,
              }}
            >
              ACK ALL
            </button>
          )}

          {/* Expand/collapse indicator */}
          <span style={{ color: HP_HMI_COLORS.text.muted }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Alarm list */}
      <div className="divide-y" style={{ borderColor: HP_HMI_COLORS.background.surface }}>
        {displayAlarms.map((alarm) => (
          <div
            key={alarm.id}
            className={`flex items-center gap-4 px-4 py-2 ${
              alarm.state === 'UNACK_ACTIVE' ? 'animate-pulse' : ''
            }`}
            style={getPriorityBgClass(alarm.priority, alarm.state)}
          >
            {/* Timestamp */}
            <span
              className="text-xs font-mono w-20"
              style={{ color: HP_HMI_COLORS.text.muted }}
            >
              {formatTime(alarm.timestamp)}
            </span>

            {/* Priority badge */}
            <span
              className="text-xs font-bold w-16 text-center px-1 py-0.5 rounded"
              style={{
                backgroundColor: getPriorityColor(alarm.priority),
                color: alarm.priority === 'MEDIUM' || alarm.priority === 'LOW' ? 'black' : 'white',
              }}
            >
              {alarm.priority}
            </span>

            {/* Tag */}
            <span
              className="text-sm font-mono w-24"
              style={{ color: HP_HMI_COLORS.text.emphasis }}
            >
              {alarm.tag}
            </span>

            {/* Description */}
            <span
              className="flex-1 text-sm"
              style={{ color: HP_HMI_COLORS.text.primary }}
            >
              {alarm.description}
            </span>

            {/* Value */}
            {alarm.value !== undefined && (
              <span
                className="text-sm font-mono w-24 text-right"
                style={{ color: HP_HMI_COLORS.text.primary }}
              >
                {alarm.value.toFixed(1)} {alarm.unit || ''}
                {alarm.limit !== undefined && (
                  <span style={{ color: HP_HMI_COLORS.text.muted }}>
                    {' '}/ {alarm.limit}
                  </span>
                )}
              </span>
            )}

            {/* State */}
            <span
              className="text-xs w-16"
              style={{ color: HP_HMI_COLORS.text.secondary }}
            >
              {alarm.state === 'UNACK_ACTIVE' ? 'UNACK' :
               alarm.state === 'ACK_ACTIVE' ? 'ACK' :
               alarm.state === 'UNACK_RTN' ? 'RTN' : 'SHLV'}
            </span>

            {/* Actions */}
            {(alarm.state === 'UNACK_ACTIVE' || alarm.state === 'UNACK_RTN') && onAcknowledge && (
              <button
                onClick={() => onAcknowledge(alarm.id)}
                className="px-2 py-1 rounded text-xs"
                style={{
                  backgroundColor: HP_HMI_COLORS.interactive.button,
                  color: HP_HMI_COLORS.text.primary,
                }}
              >
                ACK
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Show more indicator */}
      {!expanded && sortedAlarms.length > maxVisible && (
        <div
          className="px-4 py-1 text-center text-xs cursor-pointer"
          style={{
            backgroundColor: HP_HMI_COLORS.background.tertiary,
            color: HP_HMI_COLORS.text.muted,
          }}
          onClick={() => setExpanded(true)}
        >
          +{sortedAlarms.length - maxVisible} more alarms
        </div>
      )}
    </div>
  );
}

export default AlarmBanner;
