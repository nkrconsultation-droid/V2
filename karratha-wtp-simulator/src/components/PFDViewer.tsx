/**
 * PFD VIEWER - CANONICAL PROCESS FLOW DIAGRAM
 * ============================================
 * Renders the Karratha WTP canonical PFD using Mermaid
 * Source of truth for process topology
 */

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface PFDViewerProps {
  onBackToHome: () => void;
}

// Canonical PFD Mermaid diagram - matches docs/pfd.mmd
const PFD_DIAGRAM = `
flowchart LR

    %% INFLUENT GROUP
    subgraph Influent["Influent"]
        N01["N01: TANKER"]
        N02["N02: TIP LOCATION"]
    end

    %% PRETREATMENT GROUP
    subgraph Pretreatment["Pretreatment"]
        N03["N03: COARSE FILTER<br/>(SCREEN/TROMMEL)"]
        N04["N04: PRETREATMENT<br/>TANKS (X4)"]
        N05["N05: FINE FILTERS<br/>(TROMMEL/SIMILAR)"]
    end

    %% SEPARATION GROUP
    subgraph Separation["Separation"]
        N06["N06: DECANTER<br/>CENTRIFUGE"]
    end

    %% WATER GROUP
    subgraph Water["Water Treatment"]
        N07["N07: WATER<br/>STORAGE TANK"]
        N08["N08: DAF"]
        N09["N09: POST DAF STORAGE<br/>TANK / BIO BUFFER"]
        N11["N11: KTA PONDS"]
    end

    %% BIO GROUP
    subgraph Bio["Biological"]
        N10["N10: MBR AEROBIC<br/>BIO TANK"]
    end

    %% OIL GROUP
    subgraph Oil["Oil Recovery"]
        N12["N12: OIL STORAGE<br/>TANKS (X2)"]
        N13["N13: OIL OUT"]
    end

    %% SOLIDS GROUP
    subgraph Solids["Solids Handling"]
        N14["N14: SOLIDS<br/>STORAGE"]
        N15["N15: SOLIDS OUT"]
        N16["N16: DAF & DEC. FLUSH<br/>SLUDGE STORAGE"]
    end

    %% UTILITIES GROUP
    subgraph Utilities["Utilities"]
        N17["N17: DIESEL BOILER<br/>(HEAT)"]
        N18["N18: CHEMICALS:<br/>POLYMER, HCL, NAOH,<br/>Na2S, FeCl, DEMULSIFIER"]
        N19["N19: CHEMICALS:<br/>PHOS ACID, NITROGEN,<br/>CIP CHEM"]
    end

    %% MAINLINE EDGES
    N01 -->|"influent"| N02
    N02 -->|"influent"| N03
    N03 -->|"screened influent"| N04
    N04 -->|"conditioned feed"| N05
    N05 -->|"filtered feed"| N06

    %% WATER EDGES
    N06 -->|"water phase"| N07
    N07 -->|"to DAF"| N08
    N08 -->|"clarified water"| N09
    N09 -->|"bio feed"| N10
    N10 -->|"treated water to ponds"| N11

    %% OIL EDGES
    N06 -->|"oil"| N12
    N12 -->|"oil out"| N13

    %% SOLIDS EDGES
    N06 -->|"solids"| N14
    N14 -->|"solids out"| N15

    %% SLUDGE/FLUSH EDGES
    N06 -->|"FLUSH OUT"| N16
    N08 -->|"DAF sludge/float"| N16
    N10 -->|"WASTE BIOLOGY"| N06

    %% UTILITY EDGES (dashed)
    N17 -.->|"heat"| N04
    N18 -.->|"chemicals"| N04
    N19 -.->|"bio nutrients"| N10
`;

// Node metadata for legend
const NODE_GROUPS = [
  { name: 'Influent', color: '#f97316', nodes: ['N01', 'N02'] },
  { name: 'Pretreatment', color: '#8b5cf6', nodes: ['N03', 'N04', 'N05'] },
  { name: 'Separation', color: '#0d9488', nodes: ['N06'] },
  { name: 'Water Treatment', color: '#3b82f6', nodes: ['N07', 'N08', 'N09', 'N11'] },
  { name: 'Biological', color: '#10b981', nodes: ['N10'] },
  { name: 'Oil Recovery', color: '#d97706', nodes: ['N12', 'N13'] },
  { name: 'Solids Handling', color: '#64748b', nodes: ['N14', 'N15', 'N16'] },
  { name: 'Utilities', color: '#ec4899', nodes: ['N17', 'N18', 'N19'] },
];

const EDGE_TYPES = [
  { name: 'Mainline', style: 'solid', color: '#94a3b8' },
  { name: 'Water', style: 'solid', color: '#3b82f6' },
  { name: 'Oil', style: 'solid', color: '#d97706' },
  { name: 'Solids', style: 'solid', color: '#64748b' },
  { name: 'Sludge/Flush', style: 'solid', color: '#6b7280' },
  { name: 'Utility', style: 'dashed', color: '#ec4899' },
];

export default function PFDViewer({ onBackToHome }: PFDViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize mermaid with dark theme
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#1e293b',
        primaryTextColor: '#f8fafc',
        primaryBorderColor: '#475569',
        lineColor: '#94a3b8',
        secondaryColor: '#334155',
        tertiaryColor: '#1e293b',
        background: '#0f172a',
        mainBkg: '#1e293b',
        nodeBorder: '#475569',
        clusterBkg: '#1e293b',
        clusterBorder: '#475569',
        titleColor: '#f8fafc',
        edgeLabelBackground: '#1e293b',
      },
      flowchart: {
        htmlLabels: true,
        curve: 'basis',
        nodeSpacing: 50,
        rankSpacing: 80,
        padding: 15,
      },
      securityLevel: 'loose',
    });

    const renderDiagram = async () => {
      if (containerRef.current) {
        try {
          containerRef.current.innerHTML = '';
          const { svg } = await mermaid.render('pfd-diagram', PFD_DIAGRAM);
          containerRef.current.innerHTML = svg;
          setIsRendered(true);
          setError(null);
        } catch (err) {
          console.error('Mermaid render error:', err);
          setError('Failed to render diagram');
        }
      }
    };

    renderDiagram();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBackToHome}
                className="bg-slate-700/80 hover:bg-slate-600 text-white px-4 py-2 rounded-lg
                           flex items-center gap-2 transition-all border border-slate-600"
              >
                <span className="text-lg">←</span>
                <span className="font-medium">Home</span>
              </button>
              <div className="h-8 w-px bg-slate-600" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-xl shadow-lg">
                  📐
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Process Flow Diagram</h1>
                  <p className="text-slate-400 text-sm">Karratha WTP - Canonical PFD</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-indigo-600/20 text-indigo-400 rounded-full text-sm font-medium border border-indigo-600/30">
                19 Nodes
              </span>
              <span className="px-3 py-1 bg-purple-600/20 text-purple-400 rounded-full text-sm font-medium border border-purple-600/30">
                20 Edges
              </span>
              <span className="px-3 py-1 bg-emerald-600/20 text-emerald-400 rounded-full text-sm font-medium border border-emerald-600/30">
                Source of Truth
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="flex gap-6">
          {/* Diagram Container */}
          <div className="flex-1 bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="bg-slate-800/80 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
              <h2 className="text-white font-semibold">Mermaid Flowchart</h2>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span>Scroll to pan</span>
                <span className="text-slate-600">|</span>
                <span>LR Layout</span>
              </div>
            </div>
            <div className="p-4 overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              {error ? (
                <div className="text-red-400 text-center py-8">
                  <p className="text-xl mb-2">Render Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              ) : !isRendered ? (
                <div className="text-slate-400 text-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-slate-600 border-t-cyan-500 rounded-full mx-auto mb-4" />
                  <p>Rendering diagram...</p>
                </div>
              ) : null}
              <div
                ref={containerRef}
                className="mermaid-container flex justify-center"
                style={{ minHeight: '500px' }}
              />
            </div>
          </div>

          {/* Legend Sidebar */}
          <div className="w-72 flex-shrink-0 space-y-4">
            {/* Node Groups */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="bg-slate-800/80 border-b border-slate-700 px-4 py-3">
                <h3 className="text-white font-semibold">Node Groups</h3>
              </div>
              <div className="p-3 space-y-2">
                {NODE_GROUPS.map((group) => (
                  <div key={group.name} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-700/50">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: group.color }}
                    />
                    <span className="text-slate-300 text-sm flex-1">{group.name}</span>
                    <span className="text-slate-500 text-xs">{group.nodes.length}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Edge Types */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="bg-slate-800/80 border-b border-slate-700 px-4 py-3">
                <h3 className="text-white font-semibold">Edge Types</h3>
              </div>
              <div className="p-3 space-y-2">
                {EDGE_TYPES.map((edge) => (
                  <div key={edge.name} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-700/50">
                    <div className="w-8 flex items-center">
                      <div
                        className="w-full h-0.5"
                        style={{
                          backgroundColor: edge.color,
                          borderStyle: edge.style === 'dashed' ? 'dashed' : 'solid',
                          borderWidth: edge.style === 'dashed' ? '2px 0 0 0' : '0',
                          borderColor: edge.color,
                          height: edge.style === 'dashed' ? '0' : '2px',
                        }}
                      />
                    </div>
                    <span className="text-slate-300 text-sm">{edge.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
              <h3 className="text-white font-semibold mb-2">About This Diagram</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                This is the canonical Process Flow Diagram for the Karratha Water Treatment Plant.
                It represents the source of truth for process topology.
              </p>
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-slate-500 text-xs">
                  Files: <code className="text-cyan-400">docs/pfd.mmd</code>, <code className="text-cyan-400">docs/pfd.graph.json</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
