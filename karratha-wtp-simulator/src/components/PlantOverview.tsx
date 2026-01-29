/**
 * PLANT OVERVIEW - L1 PROCESS SUMMARY DASHBOARD
 * ==============================================
 * High-level overview with real-time KPIs, process status,
 * and alarm summary. Connected to SimulationContext for live data.
 *
 * Features:
 * - Real-time KPIs from simulation engine
 * - Process status indicators
 * - Alarm summary panel
 * - Production totals
 * - Quick navigation to detailed views
 */

import { useMemo } from 'react';
import { useSimulationContext } from '@/contexts/SimulationContext';

interface PlantOverviewProps {
  onBackToHome: () => void;
  onNavigate: (page: string) => void;
}

// Status colors following ISA-101 guidelines
const STATUS_COLORS = {
  running: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  stopped: { bg: 'bg-slate-500/20', border: 'border-slate-500/50', text: 'text-slate-400', dot: 'bg-slate-500' },
  warning: { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', dot: 'bg-amber-500' },
  alarm: { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400', dot: 'bg-red-500' },
};

// KPI Card Component
function KPICard({
  label,
  value,
  unit,
  target,
  status = 'normal',
  trend,
}: {
  label: string;
  value: number | string;
  unit: string;
  target?: string;
  status?: 'normal' | 'good' | 'warning' | 'alarm';
  trend?: 'up' | 'down' | 'stable';
}) {
  const statusColors = {
    normal: 'text-white',
    good: 'text-emerald-400',
    warning: 'text-amber-400',
    alarm: 'text-red-400',
  };

  const trendIcons = {
    up: '\u2191',
    down: '\u2193',
    stable: '\u2192',
  };

  return (
    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-start justify-between mb-2">
        <span className="text-slate-400 text-sm font-medium">{label}</span>
        {trend && (
          <span className={`text-xs font-mono ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400'}`}>
            {trendIcons[trend]}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold font-mono ${statusColors[status]}`}>
          {typeof value === 'number' ? value.toFixed(1) : value}
        </span>
        <span className="text-slate-500 text-sm">{unit}</span>
      </div>
      {target && (
        <div className="mt-1 text-xs text-slate-500">
          Target: {target}
        </div>
      )}
    </div>
  );
}

// Process Area Card Component
function ProcessAreaCard({
  title,
  status,
  metrics,
  onClick,
}: {
  title: string;
  status: 'running' | 'stopped' | 'warning' | 'alarm';
  metrics: Array<{ label: string; value: string }>;
  onClick?: () => void;
}) {
  const colors = STATUS_COLORS[status];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border ${colors.bg} ${colors.border} transition-all hover:scale-[1.02] hover:shadow-lg`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} ${status === 'running' ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-medium uppercase ${colors.text}`}>{status}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m, i) => (
          <div key={i} className="bg-slate-900/50 rounded px-2 py-1.5">
            <div className="text-slate-500 text-[10px] uppercase">{m.label}</div>
            <div className="text-white text-sm font-mono">{m.value}</div>
          </div>
        ))}
      </div>
    </button>
  );
}

// Alarm Summary Component
function AlarmSummary({
  criticalCount = 0,
  highCount = 0,
  mediumCount = 0,
  lowCount = 0,
  onViewAlarms,
}: {
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  onViewAlarms: () => void;
}) {
  const total = criticalCount + highCount + mediumCount + lowCount;
  const hasAlarms = total > 0;

  return (
    <div className={`rounded-xl p-4 border ${hasAlarms ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800/80 border-slate-700/50'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Alarm Summary
        </h3>
        <span className={`text-2xl font-bold font-mono ${hasAlarms ? 'text-red-400' : 'text-emerald-400'}`}>
          {total}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="text-center">
          <div className={`text-xl font-bold font-mono ${criticalCount > 0 ? 'text-red-500' : 'text-slate-600'}`}>
            {criticalCount}
          </div>
          <div className="text-[10px] text-red-400 uppercase">Critical</div>
        </div>
        <div className="text-center">
          <div className={`text-xl font-bold font-mono ${highCount > 0 ? 'text-orange-500' : 'text-slate-600'}`}>
            {highCount}
          </div>
          <div className="text-[10px] text-orange-400 uppercase">High</div>
        </div>
        <div className="text-center">
          <div className={`text-xl font-bold font-mono ${mediumCount > 0 ? 'text-amber-500' : 'text-slate-600'}`}>
            {mediumCount}
          </div>
          <div className="text-[10px] text-amber-400 uppercase">Medium</div>
        </div>
        <div className="text-center">
          <div className={`text-xl font-bold font-mono ${lowCount > 0 ? 'text-yellow-500' : 'text-slate-600'}`}>
            {lowCount}
          </div>
          <div className="text-[10px] text-yellow-400 uppercase">Low</div>
        </div>
      </div>

      <button
        onClick={onViewAlarms}
        className="w-full py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
      >
        View All Alarms
      </button>
    </div>
  );
}

// Format time helper
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function PlantOverview({ onBackToHome, onNavigate }: PlantOverviewProps) {
  const {
    isRunning,
    simSpeed,
    simTime,
    kpis,
    state,
    totals,
    flowRates,
    equipmentStatus,
    start,
    stop,
    reset,
    setSpeed,
  } = useSimulationContext();

  // Derive alarm counts from state (types-v2 uses lowercase priority values)
  const alarmCounts = useMemo(() => {
    const alarms = state?.activeAlarms || [];
    return {
      critical: alarms.filter(a => a.priority === 'critical' || a.priority === 'emergency').length,
      high: alarms.filter(a => a.priority === 'high').length,
      medium: alarms.filter(a => a.priority === 'medium').length,
      low: alarms.filter(a => a.priority === 'low').length,
    };
  }, [state?.activeAlarms]);

  // Calculate process efficiency
  const processEfficiency = useMemo(() => {
    if (!kpis) return { oil: 0, water: 0, overall: 0 };
    const inst = kpis.instantaneous;
    return {
      oil: inst.centrifugeOilRecovery || 0,
      water: inst.treatedWaterQuality || 0,
      overall: ((inst.centrifugeOilRecovery || 0) + (100 - Math.min(inst.treatedWaterQuality || 0, 100) / 5)) / 2,
    };
  }, [kpis]);

  // Current date
  const currentDate = new Date().toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBackToHome}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all hover:bg-slate-700 text-slate-300 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Home</span>
              </button>

              <div className="h-6 w-px bg-slate-600" />

              <div>
                <h1 className="text-xl font-bold text-white">Plant Overview</h1>
                <p className="text-slate-400 text-sm">Karratha WTP - Real-time Process Summary</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Simulation Controls */}
              <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2">
                <button
                  onClick={() => isRunning ? stop() : start()}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded font-medium text-sm transition-all ${
                    isRunning ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
                  } text-white`}
                >
                  {isRunning ? (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                      Stop
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Start
                    </>
                  )}
                </button>

                <div className="w-px h-5 bg-slate-600" />

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs">Speed:</span>
                  <input
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={simSpeed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-16 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <span className="text-cyan-400 text-xs font-mono w-6">{simSpeed}x</span>
                </div>

                <div className="w-px h-5 bg-slate-600" />

                <button
                  onClick={reset}
                  className="px-2 py-1 text-xs text-slate-300 hover:bg-slate-600 rounded"
                >
                  Reset
                </button>
              </div>

              {/* Time Display */}
              <div className="bg-slate-700/50 rounded-lg px-4 py-2">
                <div className="text-slate-400 text-[10px] uppercase tracking-wider">Sim Time</div>
                <div className="text-cyan-400 font-mono text-lg font-bold">{formatTime(simTime)}</div>
              </div>

              {/* Date */}
              <div className="text-right text-sm text-slate-400">
                {currentDate}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Status Banner */}
        <div className={`mb-6 rounded-xl p-4 flex items-center justify-between ${
          isRunning ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-700/50 border border-slate-600'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
            <span className={`font-semibold ${isRunning ? 'text-emerald-400' : 'text-slate-400'}`}>
              {isRunning ? 'PLANT OPERATING' : 'PLANT STOPPED'}
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Mode:</span>
              <span className="text-cyan-400 font-medium">Simulation</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">License:</span>
              <span className="text-emerald-400 font-medium">Compliant</span>
            </div>
          </div>
        </div>

        {/* KPIs Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <KPICard
            label="Feed Rate"
            value={kpis?.instantaneous.infeedRate || 0}
            unit="m3/h"
            target="15.0 m3/h"
            status={kpis?.instantaneous.infeedRate && kpis.instantaneous.infeedRate > 10 ? 'good' : 'warning'}
            trend={isRunning ? 'stable' : undefined}
          />
          <KPICard
            label="Oil Recovery"
            value={processEfficiency.oil}
            unit="%"
            target=">95%"
            status={processEfficiency.oil >= 95 ? 'good' : processEfficiency.oil >= 90 ? 'warning' : 'alarm'}
            trend={isRunning ? 'up' : undefined}
          />
          <KPICard
            label="Water Quality"
            value={processEfficiency.water}
            unit="mg/L"
            target="<500 mg/L"
            status={processEfficiency.water <= 500 ? 'good' : processEfficiency.water <= 750 ? 'warning' : 'alarm'}
            trend={isRunning ? 'down' : undefined}
          />
          <KPICard
            label="Specific Energy"
            value={kpis?.instantaneous.specificEnergy || 0}
            unit="kWh/m3"
            target="<2.5"
            status={(kpis?.instantaneous.specificEnergy || 0) <= 2.5 ? 'good' : 'warning'}
          />
          <KPICard
            label="Power"
            value={kpis?.instantaneous.totalPowerConsumption || 0}
            unit="kW"
            status="normal"
          />
          <KPICard
            label="Efficiency"
            value={processEfficiency.overall}
            unit="%"
            status={processEfficiency.overall >= 90 ? 'good' : processEfficiency.overall >= 80 ? 'warning' : 'alarm'}
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Process Areas Column */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-white font-semibold mb-3">Process Areas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProcessAreaCard
                title="Feed & Pretreatment"
                status={isRunning ? (equipmentStatus['N02'] === 'alarm' ? 'alarm' : 'running') : 'stopped'}
                metrics={[
                  { label: 'Infeed', value: `${(flowRates['E01'] || 0).toFixed(1)} m3/h` },
                  { label: 'Screened', value: `${(flowRates['E03'] || 0).toFixed(1)} m3/h` },
                  { label: 'pH', value: `${(state?.chemicalDosing?.[0]?.setpoint || 6.8).toFixed(1)}` },
                  { label: 'Temp', value: `${(state?.heaters?.[0]?.outletTemperature || 55).toFixed(0)} C` },
                ]}
                onClick={() => onNavigate('feed')}
              />

              <ProcessAreaCard
                title="Centrifuge Separation"
                status={isRunning ? (state?.centrifuge?.status === 'fault' ? 'alarm' : 'running') : 'stopped'}
                metrics={[
                  { label: 'Speed', value: `${(state?.centrifuge?.currentSpeed || 0).toFixed(0)} RPM` },
                  { label: 'Feed', value: `${(flowRates['E05'] || 0).toFixed(1)} m3/h` },
                  { label: 'Oil Out', value: `${(flowRates['E11'] || 0).toFixed(2)} m3/h` },
                  { label: 'Water Out', value: `${(flowRates['E06'] || 0).toFixed(1)} m3/h` },
                ]}
                onClick={() => onNavigate('centrifuge')}
              />

              <ProcessAreaCard
                title="Water Treatment"
                status={isRunning ? (equipmentStatus['N08'] === 'alarm' ? 'alarm' : 'running') : 'stopped'}
                metrics={[
                  { label: 'DAF Flow', value: `${(flowRates['E07'] || 0).toFixed(1)} m3/h` },
                  { label: 'MBR Flow', value: `${(flowRates['E09'] || 0).toFixed(1)} m3/h` },
                  { label: 'Discharge', value: `${(flowRates['E10'] || 0).toFixed(1)} m3/h` },
                  { label: 'Quality', value: `${(kpis?.instantaneous.treatedWaterQuality || 0).toFixed(0)} mg/L` },
                ]}
                onClick={() => onNavigate('feed')}
              />

              <ProcessAreaCard
                title="Tank Farm"
                status={isRunning ? 'running' : 'stopped'}
                metrics={[
                  { label: 'Pre-treat', value: `${((state?.tanks?.[0]?.currentLevel || 0) + (state?.tanks?.[1]?.currentLevel || 0) + (state?.tanks?.[2]?.currentLevel || 0) + (state?.tanks?.[3]?.currentLevel || 0)) / 4}%` },
                  { label: 'Water', value: `${(state?.tanks?.[4]?.currentLevel || 50).toFixed(0)}%` },
                  { label: 'Oil', value: `${(50).toFixed(0)}%` },
                  { label: 'Buffer', value: `${(state?.tanks?.[5]?.currentLevel || 50).toFixed(0)}%` },
                ]}
                onClick={() => onNavigate('tankage')}
              />
            </div>

            {/* Production Totals */}
            <div className="mt-6">
              <h2 className="text-white font-semibold mb-3">Production Totals (This Session)</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    <span className="text-sky-400 text-sm font-medium">Water Produced</span>
                  </div>
                  <div className="text-white text-2xl font-bold font-mono">{totals.waterProduced.toFixed(1)}</div>
                  <div className="text-slate-500 text-xs">cubic metres</div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <span className="text-amber-400 text-sm font-medium">Oil Recovered</span>
                  </div>
                  <div className="text-white text-2xl font-bold font-mono">{totals.oilRecovered.toFixed(2)}</div>
                  <div className="text-slate-500 text-xs">cubic metres</div>
                </div>

                <div className="bg-slate-500/10 border border-slate-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="text-slate-400 text-sm font-medium">Solids Removed</span>
                  </div>
                  <div className="text-white text-2xl font-bold font-mono">{totals.solidsRemoved.toFixed(2)}</div>
                  <div className="text-slate-500 text-xs">cubic metres</div>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-orange-400 text-sm font-medium">Energy Used</span>
                  </div>
                  <div className="text-white text-2xl font-bold font-mono">{totals.energyConsumed.toFixed(1)}</div>
                  <div className="text-slate-500 text-xs">kilowatt-hours</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Alarms & Quick Actions */}
          <div className="space-y-4">
            <AlarmSummary
              criticalCount={alarmCounts.critical}
              highCount={alarmCounts.high}
              mediumCount={alarmCounts.medium}
              lowCount={alarmCounts.low}
              onViewAlarms={() => onNavigate('alarms')}
            />

            {/* Quick Actions */}
            <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50">
              <h3 className="text-white font-semibold mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => onNavigate('pfd-viewer')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-left transition-colors"
                >
                  <span className="text-xl">📐</span>
                  <div>
                    <div className="text-white font-medium text-sm">Canonical PFD</div>
                    <div className="text-slate-400 text-xs">View process topology</div>
                  </div>
                </button>

                <button
                  onClick={() => onNavigate('process-overview')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-left transition-colors"
                >
                  <span className="text-xl">🔀</span>
                  <div>
                    <div className="text-white font-medium text-sm">Block Flow Diagram</div>
                    <div className="text-slate-400 text-xs">Interactive process flow</div>
                  </div>
                </button>

                <button
                  onClick={() => onNavigate('trends')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-left transition-colors"
                >
                  <span className="text-xl">📈</span>
                  <div>
                    <div className="text-white font-medium text-sm">Trend Analysis</div>
                    <div className="text-slate-400 text-xs">Historical data & charts</div>
                  </div>
                </button>

                <button
                  onClick={() => onNavigate('report')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-left transition-colors"
                >
                  <span className="text-xl">📊</span>
                  <div>
                    <div className="text-white font-medium text-sm">Generate Report</div>
                    <div className="text-slate-400 text-xs">Export data & logs</div>
                  </div>
                </button>
              </div>
            </div>

            {/* System Health */}
            <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50">
              <h3 className="text-white font-semibold mb-3">System Health</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Centrifuge</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${state?.centrifuge?.status === 'running' ? 'bg-emerald-500' : state?.centrifuge?.status === 'fault' ? 'bg-red-500' : 'bg-slate-500'}`} />
                    <span className="text-white text-sm capitalize">{state?.centrifuge?.status || 'Standby'}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Pumps Online</span>
                  <span className="text-white text-sm font-mono">
                    {state?.pumps?.filter(p => p.status === 'running').length || 0}/{state?.pumps?.length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Heaters Active</span>
                  <span className="text-white text-sm font-mono">
                    {state?.heaters?.filter(h => h.enabled && h.currentDuty > 0).length || 0}/{state?.heaters?.length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Chem Dosing</span>
                  <span className="text-white text-sm font-mono">
                    {state?.chemicalDosing?.filter(c => c.pumpRunning).length || 0}/{state?.chemicalDosing?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 mt-8">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <div>Karratha WTP Simulator v15.0.0 | SACOR Australia Pty Ltd</div>
            <div className="flex items-center gap-4">
              <span>SimV2 Engine</span>
              <span>|</span>
              <span>ISA-101 Compliant</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
