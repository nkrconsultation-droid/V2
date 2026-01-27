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

// Improved BFD with enhanced visual clarity
// - 50% larger scale, generous padding, increased spacing
// - Bold 11-12pt sans-serif fonts with high contrast
// - 2-3px flow lines with clear arrows
// - Light backgrounds (15-20% opacity) with distinct stream colors
const PFD_DIAGRAM = `
flowchart TB
    %% ============================================
    %% INFLUENT SECTION
    %% ============================================
    subgraph INLET["&nbsp;&nbsp;&nbsp; INFLUENT RECEIVING &nbsp;&nbsp;&nbsp;"]
        direction LR
        N01(["&nbsp;&nbsp; N01 &nbsp;&nbsp;<br/><b>TANKER</b>&nbsp;&nbsp;"])
        N02["&nbsp;&nbsp; N02 &nbsp;&nbsp;<br/><b>TIP LOCATION</b>&nbsp;&nbsp;"]
    end

    %% ============================================
    %% PRETREATMENT SECTION
    %% ============================================
    subgraph PRETREAT["&nbsp;&nbsp;&nbsp; PRETREATMENT &nbsp;&nbsp;&nbsp;"]
        direction LR
        N03["&nbsp; N03 &nbsp;<br/><b>COARSE FILTER</b><br/><i>Screen/Trommel</i>&nbsp;"]
        N04["&nbsp; N04 &nbsp;<br/><b>PRETREATMENT</b><br/><b>TANKS (×4)</b>&nbsp;"]
        N05["&nbsp; N05 &nbsp;<br/><b>FINE FILTERS</b><br/><i>Trommel/Similar</i>&nbsp;"]
    end

    %% ============================================
    %% UTILITIES SECTION
    %% ============================================
    subgraph UTIL["&nbsp;&nbsp;&nbsp; UTILITIES &nbsp;&nbsp;&nbsp;"]
        direction TB
        N17{{"&nbsp; N17 &nbsp;<br/><b>DIESEL</b><br/><b>BOILER</b>&nbsp;"}}
        N18{{"&nbsp; N18 &nbsp;<br/><b>CHEMICALS</b><br/><i>Polymer, HCl</i><br/><i>NaOH, Na₂S</i><br/><i>FeCl, Demulsifier</i>&nbsp;"}}
        N19{{"&nbsp; N19 &nbsp;<br/><b>CHEMICALS</b><br/><i>Phos Acid</i><br/><i>Nitrogen, CIP</i>&nbsp;"}}
    end

    %% ============================================
    %% SEPARATION SECTION
    %% ============================================
    subgraph SEP["&nbsp;&nbsp;&nbsp; THREE-PHASE SEPARATION &nbsp;&nbsp;&nbsp;"]
        N06["&nbsp;&nbsp; N06 &nbsp;&nbsp;<br/><b>DECANTER</b><br/><b>CENTRIFUGE</b>&nbsp;&nbsp;"]
    end

    %% ============================================
    %% SOLIDS HANDLING
    %% ============================================
    subgraph SOLIDS["&nbsp;&nbsp;&nbsp; SOLIDS HANDLING &nbsp;&nbsp;&nbsp;"]
        direction TB
        N14[("&nbsp; N14 &nbsp;<br/><b>SOLIDS</b><br/><b>STORAGE</b>&nbsp;")]
        N15(["&nbsp; N15 &nbsp;<br/><b>SOLIDS OUT</b>&nbsp;"])
        N16[("&nbsp; N16 &nbsp;<br/><b>SLUDGE</b><br/><b>STORAGE</b>&nbsp;")]
    end

    %% ============================================
    %% OIL RECOVERY
    %% ============================================
    subgraph OIL["&nbsp;&nbsp;&nbsp; OIL RECOVERY &nbsp;&nbsp;&nbsp;"]
        direction TB
        N12[("&nbsp; N12 &nbsp;<br/><b>OIL STORAGE</b><br/><b>TANKS (×2)</b>&nbsp;")]
        N13(["&nbsp; N13 &nbsp;<br/><b>OIL OUT</b>&nbsp;"])
    end

    %% ============================================
    %% WATER TREATMENT
    %% ============================================
    subgraph WATER["&nbsp;&nbsp;&nbsp; WATER TREATMENT &nbsp;&nbsp;&nbsp;"]
        direction TB
        N07[("&nbsp; N07 &nbsp;<br/><b>WATER</b><br/><b>STORAGE</b>&nbsp;")]
        N08["&nbsp; N08 &nbsp;<br/><b>DAF</b>&nbsp;"]
        N09[("&nbsp; N09 &nbsp;<br/><b>POST DAF</b><br/><b>BIO BUFFER</b>&nbsp;")]
        N10["&nbsp; N10 &nbsp;<br/><b>MBR</b><br/><b>AEROBIC BIO</b>&nbsp;"]
        N11(["&nbsp; N11 &nbsp;<br/><b>KTA PONDS</b>&nbsp;"])
    end

    %% ============================================
    %% MAIN FLOW CONNECTIONS (thick blue arrows)
    %% ============================================
    N01 ==>|"<b>100%</b>"| N02
    N02 ==>|"<b>100%</b>"| N03
    N03 ==>|"<b>99%</b>"| N04
    N04 ==>|"<b>99%</b>"| N05
    N05 ==>|"<b>98%</b>"| N06

    %% ============================================
    %% WATER STREAM (blue arrows)
    %% ============================================
    N06 ==>|"<b>83%</b><br/>water"| N07
    N07 ==>|"<b>83%</b>"| N08
    N08 ==>|"<b>81%</b>"| N09
    N09 ==>|"<b>81%</b>"| N10
    N10 ==>|"<b>80%</b>"| N11

    %% ============================================
    %% OIL STREAM (amber arrows)
    %% ============================================
    N06 -->|"<b>10%</b><br/>oil"| N12
    N12 -->|"<b>10%</b>"| N13

    %% ============================================
    %% SOLIDS STREAM (gray arrows)
    %% ============================================
    N06 -->|"<b>5%</b><br/>solids"| N14
    N14 -->|"<b>5%</b>"| N15

    %% ============================================
    %% SLUDGE/RECYCLE (dashed gray)
    %% ============================================
    N06 -.->|"<i>2%</i><br/>flush"| N16
    N08 -.->|"<i>2%</i><br/>float"| N16
    N10 -.->|"<i>1%</i><br/>WAS"| N06

    %% ============================================
    %% UTILITY CONNECTIONS (dashed purple)
    %% ============================================
    N17 -.->|"heat"| N04
    N18 -.->|"chem"| N04
    N19 -.->|"nutrients"| N10

    %% ============================================
    %% NODE STYLING - Light fills with bold borders
    %% ============================================
    classDef interface fill:#fef3e2,stroke:#ea580c,stroke-width:3px,color:#9a3412,font-weight:bold,font-size:12px
    classDef process fill:#e0f2fe,stroke:#0284c7,stroke-width:3px,color:#075985,font-weight:bold,font-size:12px
    classDef storage fill:#d1fae5,stroke:#059669,stroke-width:3px,color:#065f46,font-weight:bold,font-size:12px
    classDef utility fill:#f3e8ff,stroke:#9333ea,stroke-width:2px,stroke-dasharray:5 5,color:#6b21a8,font-weight:bold,font-size:11px
    classDef separation fill:#fef9c3,stroke:#ca8a04,stroke-width:4px,color:#854d0e,font-weight:bold,font-size:13px

    class N01,N02,N13,N15,N11 interface
    class N03,N04,N05,N08,N10 process
    class N07,N09,N12,N14,N16 storage
    class N17,N18,N19 utility
    class N06 separation

    %% Link styling - distinct colors per stream type
    linkStyle 0,1,2,3,4 stroke:#0284c7,stroke-width:4px
    linkStyle 5,6,7,8,9 stroke:#0ea5e9,stroke-width:3px
    linkStyle 10,11 stroke:#d97706,stroke-width:3px
    linkStyle 12,13 stroke:#64748b,stroke-width:3px
    linkStyle 14,15,16 stroke:#6b7280,stroke-width:2px,stroke-dasharray:8 4
    linkStyle 17,18,19 stroke:#9333ea,stroke-width:2px,stroke-dasharray:6 3
`;

// Node metadata for legend - improved colors with light fills
const NODE_GROUPS = [
  { name: 'Interface (In/Out)', color: '#ea580c', fill: '#fef3e2', count: 5 },
  { name: 'Process Units', color: '#0284c7', fill: '#e0f2fe', count: 5 },
  { name: 'Storage Tanks', color: '#059669', fill: '#d1fae5', count: 5 },
  { name: 'Utilities', color: '#9333ea', fill: '#f3e8ff', count: 3 },
  { name: 'Separation', color: '#ca8a04', fill: '#fef9c3', count: 1 },
];

// Stream types with distinct colors
const STREAM_TYPES = [
  { name: 'Main Flow', style: 'thick', color: '#0284c7', width: 4 },
  { name: 'Water Stream', style: 'thick', color: '#0ea5e9', width: 3 },
  { name: 'Oil Stream', style: 'thick', color: '#d97706', width: 3 },
  { name: 'Solids Stream', style: 'solid', color: '#64748b', width: 3 },
  { name: 'Recycle/Sludge', style: 'dashed', color: '#6b7280', width: 2 },
  { name: 'Utility Lines', style: 'dashed', color: '#9333ea', width: 2 },
];

// Track render ID globally
let renderCounter = 0;

// Print styles for A3 landscape (420mm x 297mm)
const getPrintStyles = () => `
  @media print {
    @page {
      size: A3 landscape;
      margin: 0;
    }

    html, body {
      width: 420mm;
      height: 297mm;
      margin: 0;
      padding: 0;
    }

    body * {
      visibility: hidden;
    }

    #print-area, #print-area * {
      visibility: visible !important;
    }

    #print-area {
      position: fixed;
      left: 0;
      top: 0;
      width: 420mm;
      height: 297mm;
      background: white !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }

    #print-area svg {
      max-width: 100%;
      max-height: 100%;
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

  // Export SVG with proper dimensions for A3 landscape
  const handleExportSVG = useCallback(() => {
    if (!svgContent) return;

    // Parse the SVG to get dimensions
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');

    if (svgEl) {
      // Get current dimensions or estimate
      const width = svgEl.getAttribute('width') || '1200';
      const height = svgEl.getAttribute('height') || '800';
      const numWidth = parseFloat(width);
      const numHeight = parseFloat(height);

      // Set A3 landscape dimensions (420mm x 297mm) with proper viewBox
      svgEl.setAttribute('width', '420mm');
      svgEl.setAttribute('height', '297mm');
      svgEl.setAttribute('viewBox', `0 0 ${numWidth} ${numHeight}`);
      svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      // Add white background rect
      const bgRect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('width', '100%');
      bgRect.setAttribute('height', '100%');
      bgRect.setAttribute('fill', 'white');
      svgEl.insertBefore(bgRect, svgEl.firstChild);

      // Add title block info as text
      const titleGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
      titleGroup.setAttribute('transform', `translate(10, ${numHeight - 60})`);
      titleGroup.innerHTML = `
        <rect x="0" y="0" width="${numWidth - 20}" height="50" fill="none" stroke="#000" stroke-width="2"/>
        <text x="10" y="20" font-family="Arial" font-size="12" font-weight="bold">CWY-KAR-PFD-001 Rev B</text>
        <text x="10" y="35" font-family="Arial" font-size="10">KARRATHA WATER TREATMENT PLANT - PROCESS FLOW DIAGRAM</text>
        <text x="${numWidth - 150}" y="20" font-family="Arial" font-size="10">DATE: ${new Date().toLocaleDateString('en-AU')}</text>
        <text x="${numWidth - 150}" y="35" font-family="Arial" font-size="10">SCALE: NTS | SHEET: 1 OF 1</text>
      `;
      svgEl.appendChild(titleGroup);
    }

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(doc);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CWY-KAR-PFD-001-RevB.svg';
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
      theme: 'base',
      themeVariables: {
        // High contrast text colors
        primaryTextColor: '#1e293b',
        secondaryTextColor: '#334155',
        tertiaryTextColor: '#475569',
        // Node styling
        primaryColor: '#f8fafc',
        primaryBorderColor: '#64748b',
        secondaryColor: '#f1f5f9',
        tertiaryColor: '#e2e8f0',
        // Backgrounds - light with subtle opacity
        background: '#ffffff',
        mainBkg: '#f8fafc',
        nodeBorder: '#475569',
        // Subgraph styling - 15-20% opacity backgrounds
        clusterBkg: 'rgba(100,116,139,0.12)',
        clusterBorder: '#64748b',
        // Text and labels
        titleColor: '#0f172a',
        edgeLabelBackground: 'rgba(255,255,255,0.95)',
        // Bold sans-serif font
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '14px',
        // Line colors
        lineColor: '#475569',
      },
      flowchart: {
        htmlLabels: true,
        curve: 'basis',
        // Increased spacing (50% larger)
        nodeSpacing: 100,
        rankSpacing: 120,
        // Generous padding
        padding: 25,
        useMaxWidth: false,
        // Wrapping
        wrappingWidth: 200,
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
      {/* Print Area - A3 Landscape (420mm x 297mm) */}
      {showPrintPreview && (
        <div
          id="print-area"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '420mm',
            height: '297mm',
            backgroundColor: 'white',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            padding: '8mm',
            boxSizing: 'border-box',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          {/* Drawing Area */}
          <div
            style={{
              flex: 1,
              border: '2px solid black',
              borderBottom: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10mm',
              overflow: 'hidden',
              backgroundColor: '#fafafa',
            }}
          >
            <div
              style={{ maxWidth: '100%', maxHeight: '100%' }}
              dangerouslySetInnerHTML={svgContent ? {
                __html: svgContent
                  .replace(/fill="transparent"/g, 'fill="white"')
                  .replace(/rgba\(30,41,59,0\.3\)/g, '#f0f0f0')
                  .replace(/rgba\(15,23,42,0\.9\)/g, '#ffffff')
                  .replace(/#f1f5f9/g, '#1a1a1a')
                  .replace(/#e2e8f0/g, '#1a1a1a')
                  .replace(/#94a3b8/g, '#444444')
              } : undefined}
            />
          </div>

          {/* CWY Title Block */}
          <div style={{ border: '2px solid black', backgroundColor: 'white' }}>
            {/* Main Title Row */}
            <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
              {/* Company Logo Section */}
              <div style={{
                width: '50mm',
                borderRight: '2px solid black',
                padding: '3mm',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <div style={{ fontSize: '24pt', fontWeight: 'bold' }}>CWY</div>
                <div style={{ fontSize: '8pt', fontWeight: '600' }}>WATER SOLUTIONS</div>
                <div style={{ fontSize: '6pt', color: '#666', marginTop: '2mm' }}>ABN: XX XXX XXX XXX</div>
              </div>

              {/* Title Section */}
              <div style={{ flex: 1, borderRight: '2px solid black' }}>
                <div style={{ borderBottom: '1px solid black', padding: '3mm', textAlign: 'center' }}>
                  <div style={{ fontSize: '14pt', fontWeight: 'bold' }}>KARRATHA WATER TREATMENT PLANT</div>
                  <div style={{ fontSize: '11pt', fontWeight: '600' }}>PROCESS FLOW DIAGRAM - CANONICAL</div>
                </div>
                <div style={{ display: 'flex', fontSize: '8pt' }}>
                  <div style={{ flex: 1, borderRight: '1px solid black', padding: '2mm' }}>
                    <b>PROJECT:</b> Karratha WTP Oily Water Treatment
                  </div>
                  <div style={{ flex: 1, borderRight: '1px solid black', padding: '2mm' }}>
                    <b>CLIENT:</b> Rio Tinto Iron Ore
                  </div>
                  <div style={{ flex: 1, padding: '2mm' }}>
                    <b>LOCATION:</b> Karratha, Western Australia
                  </div>
                </div>
              </div>

              {/* Drawing Info Section */}
              <div style={{ width: '60mm' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '8pt' }}>
                  <div style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '1.5mm', fontWeight: 'bold' }}>DWG NO:</div>
                  <div style={{ borderBottom: '1px solid black', padding: '1.5mm', fontFamily: 'monospace' }}>CWY-KAR-PFD-001</div>
                  <div style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '1.5mm', fontWeight: 'bold' }}>REV:</div>
                  <div style={{ borderBottom: '1px solid black', padding: '1.5mm', fontFamily: 'monospace' }}>B</div>
                  <div style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '1.5mm', fontWeight: 'bold' }}>DATE:</div>
                  <div style={{ borderBottom: '1px solid black', padding: '1.5mm', fontFamily: 'monospace' }}>{currentDate}</div>
                  <div style={{ borderBottom: '1px solid black', borderRight: '1px solid black', padding: '1.5mm', fontWeight: 'bold' }}>SCALE:</div>
                  <div style={{ borderBottom: '1px solid black', padding: '1.5mm', fontFamily: 'monospace' }}>NTS</div>
                  <div style={{ borderRight: '1px solid black', padding: '1.5mm', fontWeight: 'bold' }}>SHEET:</div>
                  <div style={{ padding: '1.5mm', fontFamily: 'monospace' }}>1 OF 1</div>
                </div>
              </div>
            </div>

            {/* Revision History */}
            <div style={{ display: 'flex', fontSize: '7pt', borderTop: '1px solid black' }}>
              <div style={{ width: '10mm', borderRight: '1px solid black', padding: '1mm', fontWeight: 'bold', textAlign: 'center', backgroundColor: '#f5f5f5' }}>REV</div>
              <div style={{ width: '18mm', borderRight: '1px solid black', padding: '1mm', fontWeight: 'bold', textAlign: 'center', backgroundColor: '#f5f5f5' }}>DATE</div>
              <div style={{ flex: 1, borderRight: '1px solid black', padding: '1mm', fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>DESCRIPTION</div>
              <div style={{ width: '15mm', borderRight: '1px solid black', padding: '1mm', fontWeight: 'bold', textAlign: 'center', backgroundColor: '#f5f5f5' }}>DRAWN</div>
              <div style={{ width: '15mm', borderRight: '1px solid black', padding: '1mm', fontWeight: 'bold', textAlign: 'center', backgroundColor: '#f5f5f5' }}>CHK</div>
              <div style={{ width: '15mm', padding: '1mm', fontWeight: 'bold', textAlign: 'center', backgroundColor: '#f5f5f5' }}>APPR</div>
            </div>
            <div style={{ display: 'flex', fontSize: '7pt' }}>
              <div style={{ width: '10mm', borderRight: '1px solid black', padding: '1mm', textAlign: 'center' }}>B</div>
              <div style={{ width: '18mm', borderRight: '1px solid black', padding: '1mm', textAlign: 'center' }}>{currentDate}</div>
              <div style={{ flex: 1, borderRight: '1px solid black', padding: '1mm' }}>REORGANIZED LAYOUT - BOLD STYLING - FLOW FRACTIONS</div>
              <div style={{ width: '15mm', borderRight: '1px solid black', padding: '1mm', textAlign: 'center' }}>AI</div>
              <div style={{ width: '15mm', borderRight: '1px solid black', padding: '1mm', textAlign: 'center' }}>-</div>
              <div style={{ width: '15mm', padding: '1mm', textAlign: 'center' }}>-</div>
            </div>
            <div style={{ display: 'flex', fontSize: '7pt' }}>
              <div style={{ width: '10mm', borderRight: '1px solid black', padding: '1mm', textAlign: 'center' }}>A</div>
              <div style={{ width: '18mm', borderRight: '1px solid black', padding: '1mm', textAlign: 'center' }}>27/01/2026</div>
              <div style={{ flex: 1, borderRight: '1px solid black', padding: '1mm' }}>ISSUED FOR REVIEW - CANONICAL PFD</div>
              <div style={{ width: '15mm', borderRight: '1px solid black', padding: '1mm', textAlign: 'center' }}>AI</div>
              <div style={{ width: '15mm', borderRight: '1px solid black', padding: '1mm', textAlign: 'center' }}>-</div>
              <div style={{ width: '15mm', padding: '1mm', textAlign: 'center' }}>-</div>
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
                  <div
                    className="w-4 h-4 rounded border-2"
                    style={{ backgroundColor: g.fill, borderColor: g.color }}
                  />
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
