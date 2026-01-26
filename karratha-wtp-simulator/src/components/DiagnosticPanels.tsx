/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DIAGNOSTIC PANELS FOR INDUSTRIAL PROCESS CONTROL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ISA-101 compliant HMI panels for:
 * - Cascade control visualization
 * - Mass balance monitoring
 * - Alarm management
 * - Integrity reporting
 *
 * @standard ISA-101, ISA-18.2
 */

import React from 'react';
import type { CascadeState, Alarm, SlaveStates } from '../lib/control/cascade';
import type { ControlMode } from '../lib/control/pid';
import type { MassBalanceResult } from '../lib/integrity/massBalance';
import type { ConstraintResult } from '../lib/control/constraints';
import type { IntegrityReport } from '../lib/integrity/validators';
import type { LabeledValue, DataSource } from '../lib/models/physics';

// ═══════════════════════════════════════════════════════════════════════════
// CASCADE CONTROL MAP
// ═══════════════════════════════════════════════════════════════════════════

interface CascadeMapProps {
  cascadeState: CascadeState | null;
  slaveStates?: SlaveStates | null;
  oiwTarget?: number;
  compact?: boolean;
}

export function CascadeMap({ cascadeState, slaveStates, oiwTarget = 15, compact = false }: CascadeMapProps) {
  if (!cascadeState) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-gray-800 font-semibold mb-2">Cascade Control</h3>
        <p className="text-gray-500 text-sm">No cascade data available</p>
      </div>
    );
  }

  const modeColors: Record<string, string> = {
    AUTO: 'bg-green-500',
    MAN: 'bg-yellow-500',
    CAS: 'bg-blue-500',
    CASCADE: 'bg-blue-500',
    SLAVE_ONLY: 'bg-cyan-500',
    CONSTRAINT: 'bg-orange-500',
    OFF: 'bg-gray-400',
    HOLD: 'bg-yellow-600',
  };

  const sequenceColors: Record<string, string> = {
    IDLE: 'text-gray-500',
    CASCADE_ACTIVE: 'text-green-400',
    CASCADE_READY: 'text-cyan-400',
    CONSTRAINT_OVERRIDE: 'text-orange-400',
    FAULT: 'text-red-400',
    SHUTDOWN: 'text-red-400',
    HEATER_WARMUP: 'text-yellow-400',
    HEATER_STABLE: 'text-yellow-400',
    CENTRIFUGE_START: 'text-yellow-400',
    CENTRIFUGE_STABLE: 'text-yellow-400',
    CHEMISTRY_START: 'text-yellow-400',
    CHEMISTRY_STABLE: 'text-yellow-400',
    FEED_START: 'text-yellow-400',
    FEED_STABLE: 'text-yellow-400',
  };

  const masterMode = cascadeState.masterEnabled ? 'CASCADE' : 'HOLD';
  const allSlavesStable = cascadeState.slaveStability.temp.stable &&
    cascadeState.slaveStability.flow.stable &&
    cascadeState.slaveStability.speed.stable;

  if (compact) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-600 text-xs font-medium">CASCADE</span>
          <span className={`text-xs font-mono ${sequenceColors[cascadeState.sequenceState] || 'text-gray-500'}`}>
            {cascadeState.sequenceState}
          </span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 text-center">
            <div className="text-[10px] text-gray-500">MASTER</div>
            <div className={`text-xs px-2 py-0.5 rounded ${modeColors[masterMode]}`}>
              {masterMode}
            </div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-[10px] text-gray-500">TEMP</div>
            <div className={`text-xs px-2 py-0.5 rounded ${modeColors[slaveStates?.tic?.mode || 'OFF']}`}>
              {slaveStates?.tic?.mode || 'OFF'}
            </div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-[10px] text-gray-500">FLOW</div>
            <div className={`text-xs px-2 py-0.5 rounded ${modeColors[slaveStates?.fic?.mode || 'OFF']}`}>
              {slaveStates?.fic?.mode || 'OFF'}
            </div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-[10px] text-gray-500">SPEED</div>
            <div className={`text-xs px-2 py-0.5 rounded ${modeColors[slaveStates?.sic?.mode || 'OFF']}`}>
              {slaveStates?.sic?.mode || 'OFF'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-800 font-semibold">Cascade Control Map</h3>
        <span className={`px-2 py-1 rounded text-xs font-mono ${sequenceColors[cascadeState.sequenceState] || 'text-gray-500'} bg-gray-100`}>
          {cascadeState.sequenceState}
        </span>
      </div>

      {/* Master Loop */}
      <div className="border-2 border-blue-500 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-blue-400 font-medium">QIC-001 Quality Master</span>
          <span className={`px-2 py-0.5 rounded text-xs ${modeColors[masterMode]}`}>
            {masterMode}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <span className="text-gray-500 text-xs">SP</span>
            <div className="text-gray-800 font-mono">{oiwTarget.toFixed(0)} ppm</div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">PV</span>
            <div className="text-gray-800 font-mono">{cascadeState.lastOiW?.toFixed(1) || '--'} ppm</div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">OP</span>
            <div className="text-gray-800 font-mono">{cascadeState.masterDemand?.toFixed(1) || '--'}%</div>
          </div>
        </div>
      </div>

      {/* Slave Loops */}
      <div className="flex justify-center mb-2">
        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Temperature Loop */}
        <div className="border border-orange-500 rounded-lg p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-orange-400 text-xs font-medium">TIC-001</span>
            <span className={`px-1 rounded text-[10px] ${modeColors[slaveStates?.tic?.mode || 'OFF']}`}>
              {slaveStates?.tic?.mode || 'OFF'}
            </span>
          </div>
          <div className="text-[10px] text-gray-500">Temperature</div>
          <div className="text-gray-800 font-mono text-sm">
            {slaveStates?.tic?.pv?.toFixed(1) || '--'}°C
          </div>
          <div className="text-gray-500 font-mono text-xs">
            SP: {cascadeState.tempSP?.toFixed(1) || '--'}°C
          </div>
        </div>

        {/* Flow Loop */}
        <div className="border border-cyan-500 rounded-lg p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-cyan-400 text-xs font-medium">FIC-001</span>
            <span className={`px-1 rounded text-[10px] ${modeColors[slaveStates?.fic?.mode || 'OFF']}`}>
              {slaveStates?.fic?.mode || 'OFF'}
            </span>
          </div>
          <div className="text-[10px] text-gray-500">Feed Flow</div>
          <div className="text-gray-800 font-mono text-sm">
            {slaveStates?.fic?.pv?.toFixed(2) || '--'} m³/hr
          </div>
          <div className="text-gray-500 font-mono text-xs">
            SP: {cascadeState.flowSP?.toFixed(2) || '--'}
          </div>
        </div>

        {/* Speed Loop */}
        <div className="border border-purple-500 rounded-lg p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-purple-400 text-xs font-medium">SIC-001</span>
            <span className={`px-1 rounded text-[10px] ${modeColors[slaveStates?.sic?.mode || 'OFF']}`}>
              {slaveStates?.sic?.mode || 'OFF'}
            </span>
          </div>
          <div className="text-[10px] text-gray-500">Bowl Speed</div>
          <div className="text-gray-800 font-mono text-sm">
            {slaveStates?.sic?.pv?.toFixed(0) || '--'} RPM
          </div>
          <div className="text-gray-500 font-mono text-xs">
            SP: {cascadeState.speedSP?.toFixed(0) || '--'}
          </div>
        </div>
      </div>

      {/* Stability indicator */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-gray-500">Slaves Stable:</span>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${allSlavesStable ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          <span className={allSlavesStable ? 'text-green-400' : 'text-yellow-400'}>
            {allSlavesStable ? 'STABLE' : 'TUNING'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MASS BALANCE PANEL
// ═══════════════════════════════════════════════════════════════════════════

interface MassBalancePanelProps {
  result: MassBalanceResult | null;
  compact?: boolean;
}

export function MassBalancePanel({ result, compact = false }: MassBalancePanelProps) {
  if (!result) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-gray-800 font-semibold mb-2">Mass Balance</h3>
        <p className="text-gray-500 text-sm">No mass balance data</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    OK: 'text-green-400 bg-green-500/20',
    WARNING: 'text-yellow-400 bg-yellow-500/20',
    ALARM: 'text-orange-400 bg-orange-500/20',
    FAULT: 'text-red-400 bg-red-500/20',
  };

  if (compact) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-600 text-xs font-medium">MASS BALANCE</span>
          <span className={`text-xs px-2 py-0.5 rounded ${statusColors[result.status]}`}>
            {result.closure.toFixed(1)}%
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1 text-xs">
          <div className="text-center">
            <div className="text-gray-500 text-[10px]">IN</div>
            <div className="text-gray-800 font-mono">{result.totalIn.toFixed(0)}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-500 text-[10px]">OUT</div>
            <div className="text-gray-800 font-mono">{result.totalOut.toFixed(0)}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-500 text-[10px]">ERR</div>
            <div className={`font-mono ${Math.abs(result.closureErrorPct) > 2 ? 'text-orange-400' : 'text-gray-800'}`}>
              {result.closureErrorPct.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-800 font-semibold">Mass Balance Validation</h3>
        <span className={`px-2 py-1 rounded text-xs ${statusColors[result.status]}`}>
          {result.status}
        </span>
      </div>

      {/* Overall balance */}
      <div className="grid grid-cols-4 gap-2 mb-4 text-sm">
        <div className="bg-gray-100 rounded p-2">
          <div className="text-gray-500 text-xs">Total In</div>
          <div className="text-gray-800 font-mono">{result.totalIn.toFixed(1)} kg/hr</div>
        </div>
        <div className="bg-gray-100 rounded p-2">
          <div className="text-gray-500 text-xs">Total Out</div>
          <div className="text-gray-800 font-mono">{result.totalOut.toFixed(1)} kg/hr</div>
        </div>
        <div className="bg-gray-100 rounded p-2">
          <div className="text-gray-500 text-xs">Closure</div>
          <div className={`font-mono ${result.toleranceExceeded ? 'text-orange-400' : 'text-green-400'}`}>
            {result.closure.toFixed(2)}%
          </div>
        </div>
        <div className="bg-gray-100 rounded p-2">
          <div className="text-gray-500 text-xs">Error</div>
          <div className={`font-mono ${Math.abs(result.closureErrorPct) > 2 ? 'text-orange-400' : 'text-gray-800'}`}>
            {result.closureError.toFixed(1)} kg/hr
          </div>
        </div>
      </div>

      {/* Component balances */}
      <div className="text-xs mb-4">
        <div className="text-gray-500 mb-2">Component Balances</div>
        <div className="space-y-1">
          {[
            { name: 'Water', data: result.waterBalance, color: 'blue' },
            { name: 'Oil', data: result.oilBalance, color: 'yellow' },
            { name: 'Solids', data: result.solidsBalance, color: 'amber' },
          ].map(({ name, data, color }) => (
            <div key={name} className="flex items-center gap-2">
              <span className={`w-16 text-${color}-400`}>{name}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${data.valid ? `bg-${color}-500` : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, data.closure)}%` }}
                />
              </div>
              <span className={`w-16 text-right font-mono ${data.valid ? 'text-gray-800' : 'text-red-400'}`}>
                {data.closure.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quality metrics */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-gray-100 rounded p-2">
          <div className="text-gray-500">Centrate Solids</div>
          <div className={`font-mono ${result.centrateSolids > 0.5 ? 'text-orange-400' : 'text-green-400'}`}>
            {result.centrateSolids.toFixed(3)}%
          </div>
        </div>
        <div className="bg-gray-100 rounded p-2">
          <div className="text-gray-500">Cake Moisture</div>
          <div className="text-gray-800 font-mono">{result.cakeMoisture.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-100 rounded p-2">
          <div className="text-gray-500">Oil Recovery</div>
          <div className={`font-mono ${result.oilRecovery < 85 ? 'text-orange-400' : 'text-green-400'}`}>
            {result.oilRecovery.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Alerts */}
      {result.alerts.length > 0 && (
        <div className="mt-3 text-xs">
          <div className="text-gray-500 mb-1">Active Alerts ({result.alerts.length})</div>
          <div className="max-h-20 overflow-y-auto space-y-1">
            {result.alerts.slice(0, 3).map((alert, i) => (
              <div key={i} className={`px-2 py-1 rounded ${statusColors[alert.severity] || 'bg-gray-100'}`}>
                [{alert.severity}] {alert.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ALARM BANNER (ISA-18.2)
// ═══════════════════════════════════════════════════════════════════════════

interface AlarmBannerProps {
  alarms: Alarm[];
  onAcknowledge?: (alarmId: string) => void;
}

export function AlarmBanner({ alarms, onAcknowledge }: AlarmBannerProps) {
  const activeAlarms = alarms.filter(a => a.active);

  if (activeAlarms.length === 0) {
    return (
      <div className="bg-green-900/30 border border-green-500/50 rounded px-3 py-2 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500"></div>
        <span className="text-green-400 text-sm">No Active Alarms</span>
      </div>
    );
  }

  const priorityColors: Record<number, string> = {
    1: 'bg-red-600 border-red-400',     // Critical
    2: 'bg-orange-600 border-orange-400', // High
    3: 'bg-yellow-600 border-yellow-400', // Medium
    4: 'bg-blue-600 border-blue-400',     // Low
  };

  const highestPriority = Math.min(...activeAlarms.map(a => a.priority));
  const unacknowledged = activeAlarms.filter(a => !a.acknowledged).length;

  return (
    <div className={`${priorityColors[highestPriority] || 'bg-gray-200'} border rounded px-3 py-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${unacknowledged > 0 ? 'animate-pulse' : ''} bg-white/80`}></div>
          <span className="text-gray-800 font-medium text-sm">
            {activeAlarms.length} Active Alarm{activeAlarms.length !== 1 ? 's' : ''}
          </span>
          {unacknowledged > 0 && (
            <span className="text-gray-800/80 text-xs">({unacknowledged} unack)</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-800/80">
          <span>{activeAlarms[0]?.tag}: {activeAlarms[0]?.message}</span>
          {onAcknowledge && unacknowledged > 0 && (
            <button
              onClick={() => onAcknowledge(activeAlarms[0]?.id)}
              className="px-2 py-0.5 bg-white/20 rounded hover:bg-white/30"
            >
              ACK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ALARM LIST
// ═══════════════════════════════════════════════════════════════════════════

interface AlarmListProps {
  alarms: Alarm[];
  onAcknowledge?: (alarmId: string) => void;
  maxItems?: number;
}

export function AlarmList({ alarms, onAcknowledge, maxItems = 10 }: AlarmListProps) {
  const sortedAlarms = [...alarms].sort((a, b) => {
    // Active first, then by priority, then by time
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.timestamp - a.timestamp;
  });

  const displayAlarms = sortedAlarms.slice(0, maxItems);

  const priorityLabels: Record<number, string> = {
    1: 'CRIT',
    2: 'HIGH',
    3: 'MED',
    4: 'LOW',
  };

  const priorityColors: Record<number, string> = {
    1: 'text-red-400 bg-red-500/20',
    2: 'text-orange-400 bg-orange-500/20',
    3: 'text-yellow-400 bg-yellow-500/20',
    4: 'text-blue-400 bg-blue-500/20',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-gray-800 font-semibold mb-3">Alarm Summary</h3>

      {displayAlarms.length === 0 ? (
        <p className="text-gray-500 text-sm">No alarms in history</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {displayAlarms.map(alarm => (
            <div
              key={alarm.id}
              className={`flex items-center gap-2 p-2 rounded text-xs ${
                alarm.active
                  ? priorityColors[alarm.priority] || 'bg-gray-100'
                  : 'bg-gray-100/50 text-gray-500'
              }`}
            >
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                alarm.active
                  ? priorityColors[alarm.priority] || 'bg-gray-200'
                  : 'bg-gray-200'
              }`}>
                {priorityLabels[alarm.priority] || 'INFO'}
              </span>
              <span className="font-mono">{alarm.tag}</span>
              <span className="flex-1">{alarm.message}</span>
              <span className="text-gray-500">
                {new Date(alarm.timestamp).toLocaleTimeString()}
              </span>
              {alarm.active && !alarm.acknowledged && onAcknowledge && (
                <button
                  onClick={() => onAcknowledge(alarm.id)}
                  className="px-2 py-0.5 bg-white/10 rounded hover:bg-white/20"
                >
                  ACK
                </button>
              )}
              {alarm.acknowledged && (
                <span className="text-green-400 text-[10px]">✓</span>
              )}
            </div>
          ))}
        </div>
      )}

      {alarms.length > maxItems && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          Showing {maxItems} of {alarms.length} alarms
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRAINT STATUS PANEL
// ═══════════════════════════════════════════════════════════════════════════

interface ConstraintPanelProps {
  result: ConstraintResult | null;
  compact?: boolean;
}

export function ConstraintPanel({ result, compact = false }: ConstraintPanelProps) {
  if (!result) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-gray-800 font-semibold mb-2">Constraints</h3>
        <p className="text-gray-500 text-sm">No constraint data</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    NORMAL: 'text-green-400 bg-green-500/20',
    LIMITED: 'text-yellow-400 bg-yellow-500/20',
    ALARM: 'text-orange-400 bg-orange-500/20',
    TRIP: 'text-red-400 bg-red-500/20',
    LOCKOUT: 'text-red-400 bg-red-600/30',
  };

  const violatedConstraints = result.constraints.filter(c => c.violated);
  const triggeredInterlocks = result.interlocks.filter(i => i.triggered);

  if (compact) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-600 text-xs font-medium">CONSTRAINTS</span>
          <span className={`text-xs px-2 py-0.5 rounded ${statusColors[result.status]}`}>
            {result.status}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Violated:</span>
            <span className={`ml-1 font-mono ${violatedConstraints.length > 0 ? 'text-orange-400' : 'text-gray-800'}`}>
              {violatedConstraints.length}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Interlocks:</span>
            <span className={`ml-1 font-mono ${triggeredInterlocks.length > 0 ? 'text-red-400' : 'text-gray-800'}`}>
              {triggeredInterlocks.length}
            </span>
          </div>
        </div>
        {result.enforcedLimits.feedRate === 0 && (
          <div className="mt-2 text-xs text-red-400 font-bold animate-pulse">
            ⚠ FEED STOPPED
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-800 font-semibold">Equipment Constraints</h3>
        <span className={`px-2 py-1 rounded text-xs ${statusColors[result.status]}`}>
          {result.status}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-4">{result.statusMessage}</p>

      {/* Enforced limits */}
      {Object.keys(result.enforcedLimits).length > 0 && (
        <div className="mb-4 p-2 bg-yellow-500/20 border border-yellow-500/50 rounded">
          <div className="text-yellow-400 text-xs font-medium mb-1">ENFORCED LIMITS</div>
          <div className="space-y-1">
            {result.enforcedLimits.speed !== undefined && (
              <div className="text-xs text-gray-800">
                Bowl Speed: ≤ {result.enforcedLimits.speed} RPM
              </div>
            )}
            {result.enforcedLimits.feedRate !== undefined && (
              <div className={`text-xs ${result.enforcedLimits.feedRate === 0 ? 'text-red-400 font-bold' : 'text-gray-800'}`}>
                Feed Rate: {result.enforcedLimits.feedRate === 0 ? 'STOPPED' : `≤ ${result.enforcedLimits.feedRate} m³/hr`}
              </div>
            )}
            {result.enforcedLimits.differential !== undefined && (
              <div className="text-xs text-gray-800">
                Differential: ≤ {result.enforcedLimits.differential} RPM
              </div>
            )}
          </div>
        </div>
      )}

      {/* Violated constraints */}
      {violatedConstraints.length > 0 && (
        <div className="mb-4">
          <div className="text-orange-400 text-xs font-medium mb-2">VIOLATED CONSTRAINTS</div>
          <div className="space-y-1">
            {violatedConstraints.map(c => (
              <div key={c.id} className="flex items-center gap-2 text-xs bg-orange-500/10 rounded px-2 py-1">
                <span className="font-mono text-orange-400">{c.id}</span>
                <span className="text-gray-800">{c.description}</span>
                <span className="text-orange-400 font-mono ml-auto">
                  {c.currentValue.toFixed(1)} {c.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Triggered interlocks */}
      {triggeredInterlocks.length > 0 && (
        <div>
          <div className="text-red-400 text-xs font-medium mb-2">TRIGGERED INTERLOCKS</div>
          <div className="space-y-1">
            {triggeredInterlocks.map(i => (
              <div key={i.id} className="flex items-center gap-2 text-xs bg-red-500/10 rounded px-2 py-1">
                <span className="font-mono text-red-400">{i.id}</span>
                <span className="text-gray-800">{i.description}</span>
                <span className="text-red-300 text-[10px] ml-auto">
                  {i.resetRequired ? 'RESET REQUIRED' : 'AUTO-RESET'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRITY REPORT PANEL
// ═══════════════════════════════════════════════════════════════════════════

interface IntegrityPanelProps {
  report: IntegrityReport | null;
  compact?: boolean;
}

export function IntegrityPanel({ report, compact = false }: IntegrityPanelProps) {
  if (!report) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-gray-800 font-semibold mb-2">Calculation Integrity</h3>
        <p className="text-gray-500 text-sm">No integrity data</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    VALID: 'text-green-400 bg-green-500/20',
    WARNING: 'text-yellow-400 bg-yellow-500/20',
    INVALID: 'text-red-400 bg-red-500/20',
    MISSING: 'text-gray-500 bg-gray-400/20',
    STALE: 'text-orange-400 bg-orange-500/20',
  };

  const total = report.validCount + report.warningCount + report.invalidCount + report.missingCount + report.staleCount;

  if (compact) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-600 text-xs font-medium">INTEGRITY</span>
          <span className={`text-xs px-2 py-0.5 rounded ${statusColors[report.overallStatus]}`}>
            {report.overallStatus}
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
          <div className="bg-green-500 h-full" style={{ width: `${(report.validCount / total) * 100}%` }} />
          <div className="bg-yellow-500 h-full" style={{ width: `${(report.warningCount / total) * 100}%` }} />
          <div className="bg-red-500 h-full" style={{ width: `${(report.invalidCount / total) * 100}%` }} />
          <div className="bg-gray-400 h-full" style={{ width: `${(report.missingCount / total) * 100}%` }} />
          <div className="bg-orange-500 h-full" style={{ width: `${(report.staleCount / total) * 100}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-gray-500">
          <span>✓ {report.validCount}</span>
          <span>⚠ {report.warningCount}</span>
          <span>✗ {report.invalidCount}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-800 font-semibold">Calculation Integrity</h3>
        <span className={`px-2 py-1 rounded text-xs ${statusColors[report.overallStatus]}`}>
          {report.overallStatus}
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-5 gap-2 mb-4 text-center text-xs">
        <div className="bg-green-500/20 rounded p-2">
          <div className="text-green-400">Valid</div>
          <div className="text-gray-800 font-mono text-lg">{report.validCount}</div>
        </div>
        <div className="bg-yellow-500/20 rounded p-2">
          <div className="text-yellow-400">Warning</div>
          <div className="text-gray-800 font-mono text-lg">{report.warningCount}</div>
        </div>
        <div className="bg-red-500/20 rounded p-2">
          <div className="text-red-400">Invalid</div>
          <div className="text-gray-800 font-mono text-lg">{report.invalidCount}</div>
        </div>
        <div className="bg-gray-400/20 rounded p-2">
          <div className="text-gray-500">Missing</div>
          <div className="text-gray-800 font-mono text-lg">{report.missingCount}</div>
        </div>
        <div className="bg-orange-500/20 rounded p-2">
          <div className="text-orange-400">Stale</div>
          <div className="text-gray-800 font-mono text-lg">{report.staleCount}</div>
        </div>
      </div>

      {/* Messages */}
      {report.messages.length > 0 && (
        <div>
          <div className="text-gray-500 text-xs mb-2">Issues Detected</div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {report.messages.map((msg, i) => (
              <div key={i} className="text-xs p-2 bg-gray-100 rounded font-mono">
                {msg}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA SOURCE LEGEND
// ═══════════════════════════════════════════════════════════════════════════

interface DataSourceLegendProps {
  compact?: boolean;
}

export function DataSourceLegend({ compact = false }: DataSourceLegendProps) {
  const sources: { symbol: string; source: DataSource; description: string; color: string }[] = [
    { symbol: '●', source: 'MEASURED', description: 'Direct measurement', color: 'text-green-400' },
    { symbol: '◆', source: 'CALCULATED', description: 'Physics-derived', color: 'text-blue-400' },
    { symbol: '■', source: 'MODELED', description: 'Empirical model', color: 'text-purple-400' },
    { symbol: '○', source: 'ESTIMATED', description: 'Estimate only', color: 'text-yellow-400' },
    { symbol: '△', source: 'ASSUMED', description: 'Default value', color: 'text-gray-500' },
  ];

  if (compact) {
    return (
      <div className="flex gap-3 text-xs">
        {sources.map(s => (
          <span key={s.source} className={s.color} title={s.description}>
            {s.symbol} {s.source[0]}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-gray-500 text-xs mb-2">Data Source Legend</div>
      <div className="grid grid-cols-5 gap-2 text-xs">
        {sources.map(s => (
          <div key={s.source} className="text-center">
            <div className={`text-lg ${s.color}`}>{s.symbol}</div>
            <div className="text-gray-600">{s.source}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LABELED VALUE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

interface LabeledValueDisplayProps {
  label: string;
  value: LabeledValue;
  precision?: number;
}

export function LabeledValueDisplay({ label, value, precision = 2 }: LabeledValueDisplayProps) {
  const sourceColors: Record<DataSource, string> = {
    MEASURED: 'text-green-400',
    CALCULATED: 'text-blue-400',
    MODELED: 'text-purple-400',
    ESTIMATED: 'text-yellow-400',
    ASSUMED: 'text-gray-500',
    UNKNOWN: 'text-red-400',
  };

  const sourceSymbols: Record<DataSource, string> = {
    MEASURED: '●',
    CALCULATED: '◆',
    MODELED: '■',
    ESTIMATED: '○',
    ASSUMED: '△',
    UNKNOWN: '?',
  };

  const confidenceColor = value.confidence >= 90 ? 'text-green-400'
    : value.confidence >= 70 ? 'text-yellow-400'
    : value.confidence >= 50 ? 'text-orange-400'
    : 'text-red-400';

  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-gray-800 font-mono">{value.value.toFixed(precision)} {value.unit}</span>
        <span className={`${sourceColors[value.source]}`} title={value.basis}>
          {sourceSymbols[value.source]}
        </span>
        <span className={`text-xs ${confidenceColor}`}>
          {value.confidence.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
