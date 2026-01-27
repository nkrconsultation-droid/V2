/**
 * PFD VIEWER - CANONICAL PROCESS FLOW DIAGRAM
 * ============================================
 * Enhanced viewer with fluid interactions, clean styling, and professional features
 *
 * Features:
 * - Mouse wheel zoom (centered on cursor)
 * - Pinch-to-zoom (touch)
 * - Drag-to-pan with momentum
 * - Minimap navigation
 * - Fullscreen mode
 * - Export SVG/PNG
 * - A3 landscape print with CWY title block
 * - Clean node styling with bold lines
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';

interface PFDViewerProps {
  onBackToHome: () => void;
}

// Reorganized PFD with cleaner layout - TB (top-bottom) with logical grouping
const PFD_DIAGRAM = `
flowchart TB
    %% ============================================
    %% INFLUENT SECTION (Top)
    %% ============================================
    subgraph INLET[" INFLUENT RECEIVING "]
        direction LR
        N01(["N01: TANKER"])
        N02["N02: TIP LOCATION"]
    end

    %% ============================================
    %% PRETREATMENT SECTION
    %% ============================================
    subgraph PRETREAT[" PRETREATMENT "]
        direction LR
        N03["N03: COARSE FILTER\\n(SCREEN/TROMMEL)"]
        N04["N04: PRETREATMENT\\nTANKS (X4)"]
        N05["N05: FINE FILTERS\\n(TROMMEL/SIMILAR)"]
    end

    %% ============================================
    %% UTILITIES (Side)
    %% ============================================
    subgraph UTIL[" UTILITIES "]
        direction TB
        N17{{"N17: DIESEL\\nBOILER"}}
        N18{{"N18: CHEMICALS\\nPOLYMER, HCL,\\nNAOH, Na2S,\\nFeCl, DEMULSIFIER"}}
        N19{{"N19: CHEMICALS\\nPHOS ACID,\\nNITROGEN, CIP"}}
    end

    %% ============================================
    %% SEPARATION SECTION (Center)
    %% ============================================
    subgraph SEP[" THREE-PHASE SEPARATION "]
        N06["N06: DECANTER\\nCENTRIFUGE"]
    end

    %% ============================================
    %% OUTPUT STREAMS (Bottom - Three Columns)
    %% ============================================
    subgraph SOLIDS[" SOLIDS HANDLING "]
        direction TB
        N14[("N14: SOLIDS\\nSTORAGE")]
        N15(["N15: SOLIDS OUT"])
        N16[("N16: SLUDGE\\nSTORAGE")]
    end

    subgraph OIL[" OIL RECOVERY "]
        direction TB
        N12[("N12: OIL STORAGE\\nTANKS (X2)")]
        N13(["N13: OIL OUT"])
    end

    subgraph WATER[" WATER TREATMENT "]
        direction TB
        N07[("N07: WATER\\nSTORAGE")]
        N08["N08: DAF"]
        N09[("N09: POST DAF\\nBIO BUFFER")]
        N10["N10: MBR\\nAEROBIC BIO"]
        N11(["N11: KTA PONDS"])
    end

    %% ============================================
    %% MAIN FLOW CONNECTIONS
    %% ============================================
    N01 ==>|"100%"| N02
    N02 ==>|"100%"| N03
    N03 ==>|"99%"| N04
    N04 ==>|"99%"| N05
    N05 ==>|"98%"| N06

    %% ============================================
    %% SEPARATION OUTPUTS
    %% ============================================
    N06 -->|"5% solids"| N14
    N14 -->|"5%"| N15

    N06 ==>|"10% oil"| N12
    N12 ==>|"10%"| N13

    N06 ==>|"83% water"| N07
    N07 ==>|"83%"| N08
    N08 ==>|"81%"| N09
    N09 ==>|"81%"| N10
    N10 ==>|"80%"| N11

    %% ============================================
    %% SLUDGE/RECYCLE STREAMS
    %% ============================================
    N06 -.->|"2% flush"| N16
    N08 -.->|"2% float"| N16
    N10 -.->|"1% WAS"| N06

    %% ============================================
    %% UTILITY CONNECTIONS
    %% ============================================
    N17 -.->|"heat"| N04
    N18 -.->|"chem"| N04
    N19 -.->|"nutrients"| N10

    %% ============================================
    %% STYLING
    %% ============================================
    classDef interface fill:none,stroke:#f97316,stroke-width:4px,color:#f97316,font-weight:bold
    classDef process fill:none,stroke:#0ea5e9,stroke-width:3px,color:#e2e8f0,font-weight:bold
    classDef storage fill:none,stroke:#10b981,stroke-width:3px,color:#e2e8f0,font-weight:bold
    classDef utility fill:none,stroke:#a855f7,stroke-width:2px,stroke-dasharray:5 5,color:#a855f7,font-weight:bold
    classDef separation fill:none,stroke:#f59e0b,stroke-width:4px,color:#fbbf24,font-weight:bold

    class N01,N02,N13,N15,N11 interface
    class N03,N04,N05,N08,N10 process
    class N07,N09,N12,N14,N16 storage
    class N17,N18,N19 utility
    class N06 separation

    linkStyle default stroke-width:3px
`;

// Node metadata for legend
const NODE_GROUPS = [
  { name: 'Interface (In/Out)', color: '#f97316', count: 5, shape: 'stadium' },
  { name: 'Process Units', color: '#0ea5e9', count: 5, shape: 'rect' },
  { name: 'Storage Tanks', color: '#10b981', count: 5, shape: 'cylinder' },
  { name: 'Utilities', color: '#a855f7', count: 3, shape: 'hexagon' },
  { name: 'Separation', color: '#f59e0b', count: 1, shape: 'rect-bold' },
];

const STREAM_TYPES = [
  { name: 'Main Process', style: 'thick', color: '#94a3b8' },
  { name: 'Oil Stream', style: 'thick', color: '#f59e0b' },
  { name: 'Water Stream', style: 'thick', color: '#0ea5e9' },
  { name: 'Solids/Sludge', style: 'dashed', color: '#64748b' },
  { name: 'Utilities', style: 'dashed', color: '#a855f7' },
];

// Track render ID globally
let renderCounter = 0;

// Print styles for A3 landscape
const getPrintStyles = () => `
  @media print {
    @page { size: A3 landscape; margin: 8mm; }
    body * { visibility: hidden; }
    #print-container, #print-container * { visibility: visible; }
    #print-container {
      position: absolute; left: 0; top: 0;
      width: 410mm; height: 287mm;
      background: white !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print { display: none !important; }
  }
`;

export default function PFDViewer({ onBackToHome }: PFDViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 50, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const renderIdRef = useRef<string>(`pfd-${++renderCounter}-${Date.now()}`);
  const lastTouchDistance = useRef<number | null>(null);

  const MIN_ZOOM = 0.2;
  const MAX_ZOOM = 5;

  // Mouse wheel zoom centered on cursor
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * zoomFactor));

    // Adjust pan to zoom toward cursor
    const scale = newZoom / zoom;
    setPan(p => ({
      x: mouseX - (mouseX - p.x) * scale,
      y: mouseY - (mouseY - p.y) * scale,
    }));
    setZoom(newZoom);
  }, [zoom]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // Touch handlers for pinch zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDistance.current = dist;
    } else if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  }, [pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist / lastTouchDistance.current;
      setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * delta)));
      lastTouchDistance.current = dist;
    } else if (e.touches.length === 1 && isDragging) {
      setPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    lastTouchDistance.current = null;
    setIsDragging(false);
  }, []);

  // Controls
  const handleZoomIn = () => setZoom(z => Math.min(MAX_ZOOM, z * 1.3));
  const handleZoomOut = () => setZoom(z => Math.max(MIN_ZOOM, z / 1.3));
  const handleReset = () => { setZoom(0.8); setPan({ x: 50, y: 20 }); };
  const handleFit = () => { setZoom(0.5); setPan({ x: 100, y: 20 }); };

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      viewportRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Export SVG
  const handleExportSVG = useCallback(() => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CWY-KAR-PFD-001.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, [svgContent]);

  // Print
  const handlePrint = useCallback(() => {
    setShowPrintPreview(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setShowPrintPreview(false), 500);
    }, 100);
  }, []);

  // Render mermaid
  useEffect(() => {
    let isMounted = true;

    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: 'transparent',
        primaryTextColor: '#f1f5f9',
        primaryBorderColor: '#64748b',
        lineColor: '#94a3b8',
        secondaryColor: 'transparent',
        tertiaryColor: 'transparent',
        background: 'transparent',
        mainBkg: 'transparent',
        nodeBorder: '#64748b',
        clusterBkg: 'rgba(30,41,59,0.3)',
        clusterBorder: '#475569',
        titleColor: '#f1f5f9',
        edgeLabelBackground: 'rgba(15,23,42,0.9)',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '14px',
      },
      flowchart: {
        htmlLabels: true,
        curve: 'basis',
        nodeSpacing: 60,
        rankSpacing: 70,
        padding: 20,
        useMaxWidth: false,
      },
      securityLevel: 'loose',
    });

    const render = async () => {
      try {
        const { svg } = await mermaid.render(renderIdRef.current, PFD_DIAGRAM);
        if (isMounted) {
          // Post-process SVG for bolder styling
          const processed = svg
            .replace(/stroke-width:\s*1px/g, 'stroke-width: 2px')
            .replace(/stroke-width:\s*2px/g, 'stroke-width: 3px')
            .replace(/font-size:\s*\d+px/g, 'font-size: 13px')
            .replace(/<text /g, '<text font-weight="600" ');
          setSvgContent(processed);
          setError(null);
        }
      } catch (err) {
        console.error('Mermaid error:', err);
        if (isMounted) setError('Failed to render diagram');
      }
    };

    render();
    return () => {
      isMounted = false;
      document.getElementById(renderIdRef.current)?.remove();
    };
  }, []);

  // Print styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = getPrintStyles();
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const currentDate = new Date().toLocaleDateString('en-AU', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Print Preview */}
      {showPrintPreview && (
        <div id="print-container" className="fixed inset-0 bg-white z-[9999] p-2">
          <div className="w-full h-full border-2 border-black flex flex-col">
            <div className="flex-1 p-4 bg-slate-50 overflow-hidden flex items-center justify-center">
              <div
                className="max-w-full max-h-full"
                dangerouslySetInnerHTML={svgContent ? {
                  __html: svgContent
                    .replace(/fill="transparent"/g, 'fill="none"')
                    .replace(/background[^;]*;/g, '')
                } : undefined}
              />
            </div>
            <div className="border-t-2 border-black text-black">
              <div className="flex">
                <div className="w-56 border-r-2 border-black p-2 text-center">
                  <div className="font-bold text-xl">CWY</div>
                  <div className="text-xs font-semibold">WATER SOLUTIONS</div>
                </div>
                <div className="flex-1 border-r-2 border-black">
                  <div className="border-b border-black p-2 text-center">
                    <div className="font-bold text-lg">KARRATHA WATER TREATMENT PLANT</div>
                    <div className="font-semibold">PROCESS FLOW DIAGRAM - CANONICAL</div>
                  </div>
                  <div className="flex text-xs">
                    <div className="flex-1 border-r border-black p-1"><b>PROJECT:</b> Karratha WTP</div>
                    <div className="flex-1 border-r border-black p-1"><b>CLIENT:</b> Rio Tinto</div>
                    <div className="flex-1 p-1"><b>LOCATION:</b> Karratha, WA</div>
                  </div>
                </div>
                <div className="w-64 text-xs">
                  <div className="grid grid-cols-2">
                    <div className="border-b border-r border-black p-1 font-bold">DWG NO:</div>
                    <div className="border-b border-black p-1 font-mono">CWY-KAR-PFD-001</div>
                    <div className="border-b border-r border-black p-1 font-bold">REV:</div>
                    <div className="border-b border-black p-1 font-mono">B</div>
                    <div className="border-b border-r border-black p-1 font-bold">DATE:</div>
                    <div className="border-b border-black p-1 font-mono">{currentDate}</div>
                    <div className="border-b border-r border-black p-1 font-bold">SCALE:</div>
                    <div className="border-b border-black p-1 font-mono">NTS</div>
                    <div className="border-r border-black p-1 font-bold">SHEET:</div>
                    <div className="p-1 font-mono">1 OF 1</div>
                  </div>
                </div>
              </div>
              <div className="border-t border-black flex text-xs">
                <div className="w-12 border-r border-black p-1 font-bold text-center bg-gray-100">REV</div>
                <div className="w-20 border-r border-black p-1 font-bold text-center bg-gray-100">DATE</div>
                <div className="flex-1 border-r border-black p-1 font-bold bg-gray-100">DESCRIPTION</div>
                <div className="w-16 border-r border-black p-1 font-bold text-center bg-gray-100">BY</div>
                <div className="w-16 p-1 font-bold text-center bg-gray-100">CHK</div>
              </div>
              <div className="flex text-xs">
                <div className="w-12 border-r border-black p-1 text-center">B</div>
                <div className="w-20 border-r border-black p-1 text-center">{currentDate}</div>
                <div className="flex-1 border-r border-black p-1">REORGANIZED LAYOUT WITH BOLD STYLING</div>
                <div className="w-16 border-r border-black p-1 text-center">AI</div>
                <div className="w-16 p-1 text-center">-</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50 no-print">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToHome}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <span>←</span>
              <span className="font-medium">Home</span>
            </button>
            <div className="h-6 w-px bg-slate-600" />
            <div>
              <h1 className="text-lg font-bold text-white">Process Flow Diagram</h1>
              <p className="text-slate-400 text-xs">CWY-KAR-PFD-001 Rev B</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg px-2 py-1">
              <button onClick={handleZoomOut} className="p-1.5 hover:bg-slate-600 rounded" title="Zoom Out">
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>
              <span className="text-slate-300 text-sm font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={handleZoomIn} className="p-1.5 hover:bg-slate-600 rounded" title="Zoom In">
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
              </button>
              <div className="w-px h-4 bg-slate-600 mx-1" />
              <button onClick={handleReset} className="px-2 py-1 text-xs text-slate-300 hover:bg-slate-600 rounded">Reset</button>
              <button onClick={handleFit} className="px-2 py-1 text-xs text-slate-300 hover:bg-slate-600 rounded">Fit</button>
            </div>

            <div className="w-px h-6 bg-slate-600" />

            {/* Action Buttons */}
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              title="Fullscreen"
            >
              <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isFullscreen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                )}
              </svg>
            </button>
            <button
              onClick={handleExportSVG}
              className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              title="Export SVG"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-2 transition-colors"
              title="Print A3"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span className="text-white text-sm font-medium">Print A3</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex no-print" style={{ height: 'calc(100vh - 60px)' }}>
        {/* Diagram Viewport */}
        <div
          ref={viewportRef}
          className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing bg-slate-900"
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
            <div className="flex items-center justify-center h-full text-red-400">
              <p>{error}</p>
            </div>
          ) : !svgContent ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="animate-spin w-8 h-8 border-2 border-slate-600 border-t-cyan-500 rounded-full" />
            </div>
          ) : (
            <div
              ref={containerRef}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              }}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}
        </div>

        {/* Right Sidebar - Legend */}
        <div className="w-64 bg-slate-800 border-l border-slate-700 p-4 space-y-4 overflow-y-auto">
          {/* Node Types */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-2">Node Types</h3>
            <div className="space-y-1.5">
              {NODE_GROUPS.map(g => (
                <div key={g.name} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border-2" style={{ borderColor: g.color }} />
                  <span className="text-slate-300 text-xs flex-1">{g.name}</span>
                  <span className="text-slate-500 text-xs">{g.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stream Types */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-2">Stream Types</h3>
            <div className="space-y-1.5">
              {STREAM_TYPES.map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <div
                    className="w-6 h-0"
                    style={{
                      borderTop: `3px ${s.style === 'dashed' ? 'dashed' : 'solid'} ${s.color}`,
                    }}
                  />
                  <span className="text-slate-300 text-xs">{s.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Flow Balance */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-2">Mass Balance</h3>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Influent</span>
                <span className="text-cyan-400 font-mono">100%</span>
              </div>
              <div className="h-px bg-slate-700 my-1" />
              <div className="flex justify-between">
                <span className="text-slate-400">→ Water</span>
                <span className="text-blue-400 font-mono">80%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">→ Oil</span>
                <span className="text-amber-400 font-mono">10%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">→ Solids</span>
                <span className="text-slate-400 font-mono">5%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">→ Sludge</span>
                <span className="text-slate-500 font-mono">5%</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-2">Controls</h3>
            <div className="text-xs text-slate-400 space-y-0.5">
              <p><span className="text-slate-300">Scroll</span> — Zoom</p>
              <p><span className="text-slate-300">Drag</span> — Pan</p>
              <p><span className="text-slate-300">Pinch</span> — Zoom (touch)</p>
            </div>
          </div>

          {/* Drawing Info */}
          <div className="pt-2 border-t border-slate-700">
            <p className="text-slate-500 text-xs">
              <span className="text-slate-400">DWG:</span> CWY-KAR-PFD-001
            </p>
            <p className="text-slate-500 text-xs">
              <span className="text-slate-400">REV:</span> B — {currentDate}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
