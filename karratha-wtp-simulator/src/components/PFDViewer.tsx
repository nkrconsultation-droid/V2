/**
 * PFD VIEWER - CANONICAL PROCESS FLOW DIAGRAM
 * ============================================
 * Renders the Karratha WTP canonical PFD using Mermaid
 * Source of truth for process topology
 *
 * Features:
 * - Mouse wheel zoom
 * - Pinch-to-zoom (touch)
 * - Drag-to-pan
 * - A3 landscape print with CWY title block
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';

interface PFDViewerProps {
  onBackToHome: () => void;
}

// Canonical PFD Mermaid diagram with flow fractions
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

    %% MAINLINE EDGES (100% influent flow)
    N01 -->|"100%<br/>influent"| N02
    N02 -->|"100%<br/>influent"| N03
    N03 -->|"99%<br/>screened"| N04
    N04 -->|"99%<br/>conditioned"| N05
    N05 -->|"98%<br/>filtered"| N06

    %% WATER EDGES (~85% of feed becomes water phase)
    N06 -->|"83%<br/>water phase"| N07
    N07 -->|"83%<br/>to DAF"| N08
    N08 -->|"81%<br/>clarified"| N09
    N09 -->|"81%<br/>bio feed"| N10
    N10 -->|"80%<br/>treated"| N11

    %% OIL EDGES (~10% oil recovery)
    N06 -->|"10%<br/>oil"| N12
    N12 -->|"10%<br/>oil out"| N13

    %% SOLIDS EDGES (~5% solids)
    N06 -->|"5%<br/>solids"| N14
    N14 -->|"5%<br/>solids out"| N15

    %% SLUDGE/FLUSH EDGES (recycle/waste streams)
    N06 -->|"2%<br/>flush"| N16
    N08 -->|"2%<br/>DAF float"| N16
    N10 -->|"1%<br/>WAS"| N06

    %% UTILITY EDGES (dashed)
    N17 -.->|"heat"| N04
    N18 -.->|"chemicals"| N04
    N19 -.->|"nutrients"| N10
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

// Track render ID globally to avoid conflicts
let renderCounter = 0;

// Print styles for A3 landscape with CWY title block
const getPrintStyles = () => `
  @media print {
    @page {
      size: A3 landscape;
      margin: 10mm;
    }

    body * {
      visibility: hidden;
    }

    #print-container, #print-container * {
      visibility: visible;
    }

    #print-container {
      position: absolute;
      left: 0;
      top: 0;
      width: 410mm;
      height: 287mm;
      background: white !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .no-print {
      display: none !important;
    }
  }
`;

export default function PFDViewer({ onBackToHome }: PFDViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.6);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const renderIdRef = useRef<string>(`pfd-${++renderCounter}-${Date.now()}`);
  const lastTouchDistance = useRef<number | null>(null);

  // Zoom constraints
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 4;
  const ZOOM_SENSITIVITY = 0.001;

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * (1 + delta * 10))));
  }, []);

  // Handle mouse down for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left click only
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  // Handle mouse move for panning
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle touch start for pinch zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  }, [pan]);

  // Handle touch move for pinch zoom and pan
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      e.preventDefault();
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = distance / lastTouchDistance.current;
      setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * delta)));
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && isDragging) {
      setPan({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    lastTouchDistance.current = null;
    setIsDragging(false);
  }, []);

  // Zoom controls
  const handleZoomIn = () => setZoom(z => Math.min(MAX_ZOOM, z * 1.25));
  const handleZoomOut = () => setZoom(z => Math.max(MIN_ZOOM, z / 1.25));
  const handleZoomReset = () => { setZoom(0.6); setPan({ x: 0, y: 0 }); };
  const handleFitToScreen = () => { setZoom(0.35); setPan({ x: 0, y: 0 }); };

  // Print function
  const handlePrint = useCallback(() => {
    setShowPrintPreview(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setShowPrintPreview(false), 500);
    }, 100);
  }, []);

  // Initialize mermaid and render
  useEffect(() => {
    let isMounted = true;

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
      try {
        const { svg } = await mermaid.render(renderIdRef.current, PFD_DIAGRAM);
        if (isMounted) {
          setSvgContent(svg);
          setError(null);
        }
      } catch (err) {
        console.error('Mermaid render error:', err);
        if (isMounted) {
          setError('Failed to render diagram');
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
      const element = document.getElementById(renderIdRef.current);
      if (element) element.remove();
    };
  }, []);

  // Add print styles to document
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = getPrintStyles();
    document.head.appendChild(styleEl);
    return () => { document.head.removeChild(styleEl); };
  }, []);

  const currentDate = new Date().toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Print Preview Container */}
      {showPrintPreview && (
        <div id="print-container" className="fixed inset-0 bg-white z-[9999] p-4">
          {/* CWY Title Block - A3 Landscape */}
          <div className="w-full h-full border-2 border-black flex flex-col">
            {/* Main Drawing Area */}
            <div className="flex-1 p-4 overflow-hidden">
              <div
                className="w-full h-full"
                style={{ background: '#f8fafc' }}
                dangerouslySetInnerHTML={svgContent ? { __html: svgContent.replace(/style="[^"]*background[^"]*"/g, 'style="background: transparent"') } : undefined}
              />
            </div>

            {/* CWY Standard Title Block */}
            <div className="border-t-2 border-black">
              <div className="flex">
                {/* Left Section - Company Info */}
                <div className="w-64 border-r-2 border-black p-2">
                  <div className="text-center">
                    <div className="font-bold text-lg">CWY</div>
                    <div className="text-xs">WATER SOLUTIONS</div>
                    <div className="text-xs mt-1 text-gray-600">ABN: XX XXX XXX XXX</div>
                  </div>
                </div>

                {/* Center Section - Drawing Title */}
                <div className="flex-1 border-r-2 border-black">
                  <div className="border-b border-black p-2">
                    <div className="text-center">
                      <div className="font-bold text-xl">KARRATHA WATER TREATMENT PLANT</div>
                      <div className="font-semibold text-lg">PROCESS FLOW DIAGRAM - CANONICAL</div>
                    </div>
                  </div>
                  <div className="flex text-xs">
                    <div className="flex-1 border-r border-black p-1">
                      <span className="font-semibold">PROJECT:</span> Karratha WTP
                    </div>
                    <div className="flex-1 border-r border-black p-1">
                      <span className="font-semibold">CLIENT:</span> Rio Tinto
                    </div>
                    <div className="flex-1 p-1">
                      <span className="font-semibold">LOCATION:</span> Karratha, WA
                    </div>
                  </div>
                </div>

                {/* Right Section - Drawing Info */}
                <div className="w-72">
                  <div className="grid grid-cols-2 text-xs">
                    <div className="border-b border-r border-black p-1">
                      <span className="font-semibold">DWG NO:</span>
                    </div>
                    <div className="border-b border-black p-1 font-mono">
                      CWY-KAR-PFD-001
                    </div>
                    <div className="border-b border-r border-black p-1">
                      <span className="font-semibold">REV:</span>
                    </div>
                    <div className="border-b border-black p-1 font-mono">
                      A
                    </div>
                    <div className="border-b border-r border-black p-1">
                      <span className="font-semibold">DATE:</span>
                    </div>
                    <div className="border-b border-black p-1 font-mono">
                      {currentDate}
                    </div>
                    <div className="border-b border-r border-black p-1">
                      <span className="font-semibold">SCALE:</span>
                    </div>
                    <div className="border-b border-black p-1 font-mono">
                      NTS
                    </div>
                    <div className="border-b border-r border-black p-1">
                      <span className="font-semibold">DRAWN:</span>
                    </div>
                    <div className="border-b border-black p-1 font-mono">
                      CLAUDE
                    </div>
                    <div className="border-r border-black p-1">
                      <span className="font-semibold">SHEET:</span>
                    </div>
                    <div className="p-1 font-mono">
                      1 OF 1
                    </div>
                  </div>
                </div>
              </div>

              {/* Revision History */}
              <div className="border-t border-black flex text-xs">
                <div className="w-16 border-r border-black p-1 font-semibold text-center bg-gray-100">REV</div>
                <div className="w-24 border-r border-black p-1 font-semibold text-center bg-gray-100">DATE</div>
                <div className="flex-1 border-r border-black p-1 font-semibold bg-gray-100">DESCRIPTION</div>
                <div className="w-20 border-r border-black p-1 font-semibold text-center bg-gray-100">BY</div>
                <div className="w-20 p-1 font-semibold text-center bg-gray-100">CHK</div>
              </div>
              <div className="flex text-xs">
                <div className="w-16 border-r border-black p-1 text-center">A</div>
                <div className="w-24 border-r border-black p-1 text-center">{currentDate}</div>
                <div className="flex-1 border-r border-black p-1">ISSUED FOR REVIEW - CANONICAL PFD WITH FLOW FRACTIONS</div>
                <div className="w-20 border-r border-black p-1 text-center">CL</div>
                <div className="w-20 p-1 text-center">-</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50 no-print">
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
              {/* Print Button */}
              <button
                onClick={handlePrint}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg
                           flex items-center gap-2 transition-all border border-emerald-500"
                title="Print A3 Landscape"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print A3</span>
              </button>
              <span className="px-3 py-1 bg-indigo-600/20 text-indigo-400 rounded-full text-sm font-medium border border-indigo-600/30">
                19 Nodes
              </span>
              <span className="px-3 py-1 bg-purple-600/20 text-purple-400 rounded-full text-sm font-medium border border-purple-600/30">
                20 Edges
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 no-print">
        <div className="flex gap-6">
          {/* Diagram Container */}
          <div className="flex-1 bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
            <div className="bg-slate-800/80 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
              <h2 className="text-white font-semibold">Mermaid Flowchart</h2>
              <div className="flex items-center gap-4">
                {/* Zoom Controls */}
                <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg p-1">
                  <button
                    onClick={handleZoomOut}
                    className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
                    title="Zoom Out (or scroll down)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                    </svg>
                  </button>
                  <span className="text-slate-300 text-sm font-mono w-14 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
                    title="Zoom In (or scroll up)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                    </svg>
                  </button>
                  <div className="w-px h-5 bg-slate-600" />
                  <button
                    onClick={handleZoomReset}
                    className="px-2 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors text-xs"
                    title="Reset View"
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleFitToScreen}
                    className="px-2 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors text-xs"
                    title="Fit to Screen"
                  >
                    Fit
                  </button>
                </div>
                <div className="text-sm text-slate-400">
                  <span>Scroll to zoom • Drag to pan</span>
                </div>
              </div>
            </div>

            {/* Zoomable/Pannable Viewport */}
            <div
              ref={viewportRef}
              className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
              style={{ height: 'calc(100vh - 220px)' }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {error ? (
                <div className="text-red-400 text-center py-8">
                  <p className="text-xl mb-2">Render Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              ) : !svgContent ? (
                <div className="text-slate-400 text-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-slate-600 border-t-cyan-500 rounded-full mx-auto mb-4" />
                  <p>Rendering diagram...</p>
                </div>
              ) : (
                <div
                  ref={containerRef}
                  className="mermaid-container"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                    willChange: 'transform',
                  }}
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              )}
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

            {/* Flow Balance */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="bg-slate-800/80 border-b border-slate-700 px-4 py-3">
                <h3 className="text-white font-semibold">Flow Balance (Typical)</h3>
              </div>
              <div className="p-3 space-y-2 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>Influent Feed</span>
                  <span className="font-mono text-cyan-400">100%</span>
                </div>
                <div className="h-px bg-slate-700 my-2" />
                <div className="flex justify-between text-slate-400">
                  <span>Water to Ponds</span>
                  <span className="font-mono text-blue-400">~80%</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Oil Recovered</span>
                  <span className="font-mono text-amber-400">~10%</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Solids Out</span>
                  <span className="font-mono text-slate-400">~5%</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Sludge/Flush</span>
                  <span className="font-mono text-gray-400">~5%</span>
                </div>
                <div className="h-px bg-slate-700 my-2" />
                <div className="flex justify-between text-slate-300">
                  <span>Total</span>
                  <span className="font-mono text-emerald-400">100%</span>
                </div>
              </div>
            </div>

            {/* Controls Help */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
              <h3 className="text-white font-semibold mb-2">Controls</h3>
              <div className="text-slate-400 text-sm space-y-1">
                <p><span className="text-slate-300">Scroll:</span> Zoom in/out</p>
                <p><span className="text-slate-300">Drag:</span> Pan view</p>
                <p><span className="text-slate-300">Pinch:</span> Zoom (touch)</p>
                <p><span className="text-slate-300">Print:</span> A3 landscape</p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-slate-500 text-xs">
                  DWG: <code className="text-cyan-400">CWY-KAR-PFD-001</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
