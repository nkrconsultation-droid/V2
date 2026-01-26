/**
 * FRONT PAGE - NAVIGATION TILES
 * ==============================
 * ISA-101 Level 1 Overview with navigation to plant areas
 * Following High Performance HMI principles
 */

import React from 'react';

interface NavigationTile {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  description: string;
  status?: 'online' | 'offline' | 'warning' | 'alarm';
}

interface FrontPageProps {
  onNavigate: (page: string) => void;
  plantStatus?: {
    isRunning: boolean;
    activeAlarms: number;
    throughput: number;
    oilEfficiency: number;
  };
}

const NAVIGATION_TILES: NavigationTile[] = [
  {
    id: 'process-overview',
    title: 'Process Flow',
    subtitle: 'L1 - Block Flow Diagram',
    icon: '🔀',
    color: 'from-emerald-600 to-emerald-800',
    description: 'Interactive process overview with flow visualization',
    status: 'online',
  },
  {
    id: 'overview',
    title: 'Plant Overview',
    subtitle: 'L1 - Process Summary',
    icon: '🏭',
    color: 'from-blue-600 to-blue-800',
    description: 'Real-time KPIs, process status, and alarm summary',
    status: 'online',
  },
  {
    id: 'centrifuge',
    title: 'Centrifuge Control',
    subtitle: 'L2 - Delta-Canter 20-843A',
    icon: '⚙️',
    color: 'from-cyan-600 to-cyan-800',
    description: 'Three-phase separation, speed control, and efficiency monitoring',
    status: 'online',
  },
  {
    id: 'tankfarm',
    title: 'Tank Farm',
    subtitle: 'L2 - Feed & Oil Storage',
    icon: '🛢️',
    color: 'from-amber-600 to-amber-800',
    description: '6 feed tanks, 6 oil tanks, levels and transfers',
    status: 'online',
  },
  {
    id: 'chemical',
    title: 'Chemical Dosing',
    subtitle: 'L2 - Injection System',
    icon: '🧪',
    color: 'from-purple-600 to-purple-800',
    description: 'Demulsifier, flocculant, pH control, and dosing rates',
    status: 'online',
  },
  {
    id: 'filter',
    title: 'Polishing Filter',
    subtitle: 'L2 - SPDD1600 Waterco',
    icon: '🔬',
    color: 'from-teal-600 to-teal-800',
    description: 'Media filter status, backwash, and water quality',
    status: 'online',
  },
  {
    id: 'pond',
    title: 'Evaporation Pond',
    subtitle: 'L2 - 8ML Discharge',
    icon: '🌊',
    color: 'from-sky-600 to-sky-800',
    description: 'Water discharge, evaporation rates, and compliance',
    status: 'online',
  },
  {
    id: 'trends',
    title: 'Trend Analysis',
    subtitle: 'L3 - Historical Data',
    icon: '📈',
    color: 'from-green-600 to-green-800',
    description: 'Process trends, SPC charts, and performance history',
    status: 'online',
  },
  {
    id: 'alarms',
    title: 'Alarm Management',
    subtitle: 'L3 - ISA-18.2',
    icon: '🚨',
    color: 'from-red-600 to-red-800',
    description: 'Active alarms, history, acknowledgement, and shelving',
    status: 'online',
  },
  {
    id: 'reports',
    title: 'Reports & Export',
    subtitle: 'L3 - Documentation',
    icon: '📊',
    color: 'from-indigo-600 to-indigo-800',
    description: 'Excel reports, compliance logs, and shift handover',
    status: 'online',
  },
  {
    id: 'settings',
    title: 'Configuration',
    subtitle: 'L4 - System Setup',
    icon: '⚙️',
    color: 'from-slate-600 to-slate-800',
    description: 'Equipment parameters, setpoints, and tuning',
    status: 'online',
  },
  {
    id: 'maintenance',
    title: 'Maintenance',
    subtitle: 'L4 - Equipment Health',
    icon: '🔧',
    color: 'from-orange-600 to-orange-800',
    description: 'Run hours, bearing temps, vibration monitoring',
    status: 'online',
  },
  {
    id: 'help',
    title: 'Help & Training',
    subtitle: 'Documentation',
    icon: '📖',
    color: 'from-gray-600 to-gray-800',
    description: 'Operating procedures, training materials, and support',
    status: 'online',
  },
];

const StatusIndicator: React.FC<{ status?: string }> = ({ status }) => {
  const colors = {
    online: 'bg-green-500',
    offline: 'bg-gray-500',
    warning: 'bg-amber-500',
    alarm: 'bg-red-500 animate-pulse',
  };
  return (
    <div className={`w-3 h-3 rounded-full ${colors[status as keyof typeof colors] || colors.online}`} />
  );
};

export default function FrontPage({ onNavigate, plantStatus }: FrontPageProps) {
  const currentTime = new Date().toLocaleString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-300 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center text-2xl shadow-lg">
                🏭
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Karratha Water Treatment Plant</h1>
                <p className="text-slate-500 text-sm">Delta-Canter 20-843A Three-Phase Tricanter System</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-slate-800 font-medium">{currentTime}</div>
              <div className="flex items-center gap-2 justify-end mt-1">
                <StatusIndicator status={plantStatus?.isRunning ? 'online' : 'offline'} />
                <span className="text-sm text-slate-600">
                  {plantStatus?.isRunning ? 'System Running' : 'System Stopped'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="bg-slate-100/80 border-b border-slate-300">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 text-sm">Throughput:</span>
                <span className="text-sky-700 font-mono font-bold">
                  {plantStatus?.throughput?.toFixed(1) || '15.0'} m³/h
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 text-sm">Oil Recovery:</span>
                <span className="text-emerald-700 font-mono font-bold">
                  {plantStatus?.oilEfficiency?.toFixed(1) || '95.2'}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 text-sm">Active Alarms:</span>
                <span className={`font-mono font-bold ${(plantStatus?.activeAlarms || 0) > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {plantStatus?.activeAlarms || 0}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-sm font-medium border border-emerald-300">
                License Compliant
              </span>
              <span className="px-3 py-1 bg-sky-50 text-sky-800 rounded-full text-sm font-medium border border-sky-300">
                Simulation Mode
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Start Button */}
        <div className="mb-8">
          <button
            onClick={() => onNavigate('simulator')}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500
                       text-white rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-cyan-500/20
                       hover:scale-[1.01] border border-cyan-500/30 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center text-4xl
                                group-hover:scale-110 transition-transform">
                  ▶️
                </div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold">Enter Full Simulator</h2>
                  <p className="text-cyan-100/80">Complete process control with all features</p>
                </div>
              </div>
              <div className="text-5xl group-hover:translate-x-2 transition-transform">→</div>
            </div>
          </button>
        </div>

        {/* Section Title */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Plant Areas</h2>
          <p className="text-slate-600 text-sm">Select an area to view details (ISA-101 Display Hierarchy)</p>
        </div>

        {/* Navigation Tiles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {NAVIGATION_TILES.map((tile) => (
            <button
              key={tile.id}
              onClick={() => onNavigate(tile.id)}
              className={`bg-gradient-to-br ${tile.color} rounded-xl p-5 text-left shadow-lg
                         hover:shadow-xl transition-all duration-300 hover:scale-[1.02]
                         border border-white/10 hover:border-white/20 group relative overflow-hidden`}
            >
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                  backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                  backgroundSize: '20px 20px',
                }} />
              </div>

              {/* Content */}
              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="text-3xl group-hover:scale-110 transition-transform">{tile.icon}</div>
                  <StatusIndicator status={tile.status} />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{tile.title}</h3>
                <p className="text-xs text-white/60 font-medium mb-2">{tile.subtitle}</p>
                <p className="text-sm text-white/80 leading-relaxed">{tile.description}</p>
              </div>

              {/* Hover Arrow */}
              <div className="absolute bottom-4 right-4 text-white/40 group-hover:text-white/80
                              group-hover:translate-x-1 transition-all text-xl">
                →
              </div>
            </button>
          ))}
        </div>

        {/* Equipment Info Footer */}
        <div className="mt-12 bg-white rounded-xl p-6 border border-slate-300 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-slate-900 font-semibold mb-2">Equipment</h3>
              <div className="text-slate-600 text-sm space-y-1">
                <p>SACOR Delta-Canter 20-843A</p>
                <p>Three-Phase Tricanter</p>
                <p>Bowl: 520mm × 1800mm</p>
              </div>
            </div>
            <div>
              <h3 className="text-slate-900 font-semibold mb-2">Operating Parameters</h3>
              <div className="text-slate-600 text-sm space-y-1">
                <p>Speed: 2,200 - 3,600 RPM</p>
                <p>Capacity: 10 - 30 m³/h</p>
                <p>Max G-Force: 3,000 G</p>
              </div>
            </div>
            <div>
              <h3 className="text-slate-900 font-semibold mb-2">Performance Guarantees</h3>
              <div className="text-slate-600 text-sm space-y-1">
                <p>Oil Recovery: ≥95%</p>
                <p>Centrate TPH: ≤500 mg/L</p>
                <p>Cake Moisture: ≤20%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Version Info */}
        <div className="mt-6 text-center text-slate-500 text-sm">
          <p>Karratha WTP Simulator v15.0.0 | SACOR Australia Pty Ltd | SAC-PRO-A26-003</p>
        </div>
      </main>
    </div>
  );
}
