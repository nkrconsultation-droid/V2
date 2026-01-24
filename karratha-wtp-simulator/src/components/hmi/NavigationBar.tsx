/**
 * HP-HMI NAVIGATION BAR
 * ======================
 * ISA-101 compliant navigation with:
 * - Display hierarchy indication (L1-L4)
 * - Breadcrumb trail
 * - Quick access to alarms
 * - Plant status overview
 */
import React from 'react';
import { HP_HMI_COLORS, ISA101_LEVELS, NAVIGATION_STRUCTURE } from '@/lib/hmi-standards';

interface NavigationBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  plantName?: string;
  alarmCount?: number;
  criticalAlarmCount?: number;
  isRunning?: boolean;
  simTime?: number;
}

export function NavigationBar({
  activeTab,
  onTabChange,
  plantName = 'Karratha WTP',
  alarmCount = 0,
  criticalAlarmCount = 0,
  isRunning = false,
  simTime = 0,
}: NavigationBarProps) {
  const tabs = NAVIGATION_STRUCTURE.tabs;
  const activeTabInfo = tabs.find(t => t.id === activeTab);
  const currentLevel = activeTabInfo?.level || 1;

  // Format simulation time
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Get level info
  const getLevelInfo = (level: number) => {
    switch (level) {
      case 1: return ISA101_LEVELS.L1_OVERVIEW;
      case 2: return ISA101_LEVELS.L2_AREA;
      case 3: return ISA101_LEVELS.L3_DETAIL;
      case 4: return ISA101_LEVELS.L4_DIAGNOSTIC;
      default: return ISA101_LEVELS.L1_OVERVIEW;
    }
  };

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: HP_HMI_COLORS.background.primary,
        borderColor: HP_HMI_COLORS.normal.border,
      }}
    >
      {/* Top bar - Plant info and status */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ backgroundColor: HP_HMI_COLORS.background.surface }}
      >
        {/* Plant name and status */}
        <div className="flex items-center gap-4">
          <h1
            className="text-lg font-semibold"
            style={{ color: HP_HMI_COLORS.text.emphasis }}
          >
            {plantName}
          </h1>

          {/* Running status */}
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${isRunning ? 'animate-pulse' : ''}`}
              style={{
                backgroundColor: isRunning
                  ? HP_HMI_COLORS.status.running
                  : HP_HMI_COLORS.status.stopped
              }}
            />
            <span
              className="text-sm"
              style={{ color: HP_HMI_COLORS.text.secondary }}
            >
              {isRunning ? 'RUNNING' : 'STOPPED'}
            </span>
          </div>

          {/* Simulation time */}
          <span
            className="font-mono text-sm"
            style={{ color: HP_HMI_COLORS.text.muted }}
          >
            {formatTime(simTime)}
          </span>
        </div>

        {/* Alarm summary - quick access */}
        <div className="flex items-center gap-4">
          {/* Display level indicator */}
          <div
            className="flex items-center gap-2 px-3 py-1 rounded"
            style={{ backgroundColor: HP_HMI_COLORS.background.secondary }}
          >
            <span
              className="text-xs"
              style={{ color: HP_HMI_COLORS.text.muted }}
            >
              Level {currentLevel}
            </span>
            <span
              className="text-xs font-medium"
              style={{ color: HP_HMI_COLORS.text.secondary }}
            >
              {getLevelInfo(currentLevel).name}
            </span>
          </div>

          {/* Alarm indicator */}
          <button
            onClick={() => onTabChange('alarms')}
            className={`flex items-center gap-2 px-3 py-1 rounded transition-colors ${
              criticalAlarmCount > 0 ? 'animate-pulse' : ''
            }`}
            style={{
              backgroundColor: criticalAlarmCount > 0
                ? HP_HMI_COLORS.abnormal.critical
                : alarmCount > 0
                  ? HP_HMI_COLORS.abnormal.medium
                  : HP_HMI_COLORS.background.secondary,
              color: criticalAlarmCount > 0 || alarmCount > 0
                ? 'white'
                : HP_HMI_COLORS.text.secondary,
            }}
          >
            <span className="text-sm font-medium">
              {alarmCount > 0 ? `${alarmCount} Alarms` : 'No Alarms'}
            </span>
            {criticalAlarmCount > 0 && (
              <span className="text-xs font-bold">
                ({criticalAlarmCount} CRIT)
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Navigation tabs grouped by level */}
      <nav className="px-4 py-1 flex items-center gap-6">
        {/* Group tabs by level */}
        {[1, 2, 3, 4].map(level => {
          const levelTabs = tabs.filter(t => t.level === level);
          if (levelTabs.length === 0) return null;

          return (
            <div key={level} className="flex items-center gap-1">
              {/* Level divider */}
              {level > 1 && (
                <div
                  className="w-px h-6 mx-2"
                  style={{ backgroundColor: HP_HMI_COLORS.normal.border }}
                />
              )}

              {/* Level tabs */}
              {levelTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className="px-4 py-2 rounded text-sm transition-colors"
                  style={{
                    backgroundColor: activeTab === tab.id
                      ? HP_HMI_COLORS.interactive.buttonActive
                      : 'transparent',
                    color: activeTab === tab.id
                      ? HP_HMI_COLORS.text.emphasis
                      : HP_HMI_COLORS.text.secondary,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          );
        })}
      </nav>
    </header>
  );
}

export default NavigationBar;
