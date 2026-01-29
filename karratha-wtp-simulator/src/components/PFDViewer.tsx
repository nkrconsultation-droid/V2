/**
 * PFD VIEWER V2 - DATA-DRIVEN INTERACTIVE PROCESS FLOW DIAGRAM
 * =============================================================
 * Professional P&ID-style viewer with:
 * - Data-driven rendering from graph JSON
 * - Custom SVG equipment symbols
 * - Interactive nodes with details panel
 * - Stream highlighting and filtering
 * - Orthogonal routing (no line intersections)
 * - Mass balance visualization
 */

import { useCallback, useMemo, useRef, useState } from 'react';

// ============================================
// TYPES
// ============================================
interface GraphNode {
  id: string;
  label: string;
  group: string;
  type: 'interface' | 'process' | 'storage' | 'utility';
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: 'mainline' | 'water' | 'oil' | 'solids' | 'sludge_flush' | 'utility';
}

interface PFDViewerProps {
  onBackToHome: () => void;
  graphData?: { nodes: GraphNode[]; edges: GraphEdge[] };
  liveData?: Record<string, { flow?: number; level?: number; status?: string }>;
}

// ============================================
// GRAPH DATA
// ============================================
const DEFAULT_GRAPH: { nodes: GraphNode[]; edges: GraphEdge[] } = {
  nodes: [
    { id: 'N01', label: 'TANKER', group: 'Influent', type: 'interface' },
    { id: 'N02', label: 'TIP LOCATION', group: 'Influent', type: 'process' },
    { id: 'N03', label: 'COARSE FILTER\n(Screen/Trommel)', group: 'Pretreatment', type: 'process' },
    { id: 'N04', label: 'PRETREATMENT\nTANKS (×4)', group: 'Pretreatment', type: 'process' },
    { id: 'N05', label: 'FINE FILTERS\n(Trommel/Similar)', group: 'Pretreatment', type: 'process' },
    { id: 'N06', label: 'DECANTER\nCENTRIFUGE', group: 'Separation', type: 'process' },
    { id: 'N07', label: 'WATER\nSTORAGE', group: 'Water', type: 'storage' },
    { id: 'N08', label: 'DAF', group: 'Water', type: 'process' },
    { id: 'N09', label: 'POST DAF\nBIO BUFFER', group: 'Water', type: 'storage' },
    { id: 'N10', label: 'MBR\nAEROBIC BIO', group: 'Bio', type: 'process' },
    { id: 'N11', label: 'KTA PONDS', group: 'Water', type: 'interface' },
    { id: 'N12', label: 'OIL STORAGE\nTANKS (×2)', group: 'Oil', type: 'storage' },
    { id: 'N13', label: 'OIL OUT', group: 'Oil', type: 'interface' },
    { id: 'N14', label: 'SOLIDS\nSTORAGE', group: 'Solids', type: 'storage' },
    { id: 'N15', label: 'SOLIDS OUT', group: 'Solids', type: 'interface' },
    { id: 'N16', label: 'SLUDGE\nSTORAGE', group: 'Solids', type: 'storage' },
    { id: 'N17', label: 'DIESEL\nBOILER', group: 'Utilities', type: 'utility' },
    { id: 'N18', label: 'CHEMICALS\nPolymer, HCl, NaOH\nNa₂S, FeCl, Demulsifier', group: 'Utilities', type: 'utility' },
    { id: 'N19', label: 'CHEMICALS\nPhos Acid, N-Source\nCIP', group: 'Utilities', type: 'utility' },
  ],
  edges: [
    { id: 'E01', source: 'N01', target: 'N02', label: 'influent', type: 'mainline' },
    { id: 'E02', source: 'N02', target: 'N03', label: 'influent', type: 'mainline' },
    { id: 'E03', source: 'N03', target: 'N04', label: 'screened', type: 'mainline' },
    { id: 'E04', source: 'N04', target: 'N05', label: 'conditioned', type: 'mainline' },
    { id: 'E05', source: 'N05', target: 'N06', label: 'filtered', type: 'mainline' },
    { id: 'E06', source: 'N06', target: 'N07', label: 'water 83%', type: 'water' },
    { id: 'E07', source: 'N07', target: 'N08', label: 'to DAF', type: 'water' },
    { id: 'E08', source: 'N08', target: 'N09', label: 'clarified', type: 'water' },
    { id: 'E09', source: 'N09', target: 'N10', label: 'bio feed', type: 'water' },
    { id: 'E10', source: 'N10', target: 'N11', label: 'treated 80%', type: 'water' },
    { id: 'E11', source: 'N06', target: 'N12', label: 'oil 10%', type: 'oil' },
    { id: 'E12', source: 'N12', target: 'N13', label: 'oil out', type: 'oil' },
    { id: 'E13', source: 'N06', target: 'N14', label: 'solids 5%', type: 'solids' },
    { id: 'E14', source: 'N14', target: 'N15', label: 'solids out', type: 'solids' },
    { id: 'E15', source: 'N06', target: 'N16', label: 'flush 2%', type: 'sludge_flush' },
    { id: 'E16', source: 'N08', target: 'N16', label: 'DAF float', type: 'sludge_flush' },
    { id: 'E17', source: 'N10', target: 'N06', label: 'WAS', type: 'sludge_flush' },
    { id: 'E18', source: 'N17', target: 'N04', label: 'heat', type: 'utility' },
    { id: 'E19', source: 'N18', target: 'N04', label: 'chem', type: 'utility' },
    { id: 'E20', source: 'N19', target: 'N10', label: 'nutrients', type: 'utility' },
  ],
};

// ============================================
// LAYOUT - ROW-BASED FOR NO INTERSECTIONS
// ============================================
// Row 1 (y=100):  Oil recovery (N12, N13)
// Row 2 (y=240):  Utilities (N17, N18)
// Row 3 (y=400):  Main flow (N01→N06) - CENTERLINE
// Row 4 (y=560):  Solids (N14, N15)
// Row 5 (y=720):  Water treatment (N07→N11)
// Row 6 (y=880):  Bio utility (N19)

const LAYOUT = {
  positions: {
    // Row 1: Oil Recovery (top)
    N12: { x: 1300, y: 100 },
    N13: { x: 1520, y: 100 },

    // Row 2: Utilities for pretreatment
    N17: { x: 580, y: 240 },
    N18: { x: 800, y: 240 },

    // Row 3: Main process flow (centerline)
    N01: { x: 100, y: 400 },
    N02: { x: 290, y: 400 },
    N03: { x: 480, y: 400 },
    N04: { x: 690, y: 400 },
    N05: { x: 900, y: 400 },
    N06: { x: 1120, y: 400 },

    // Row 4: Solids handling
    N14: { x: 1400, y: 560 },
    N15: { x: 1620, y: 560 },
    N16: { x: 1620, y: 400 }, // Sludge at same level as main, far right

    // Row 5: Water treatment (bottom)
    N07: { x: 1120, y: 720 },
    N08: { x: 1300, y: 720 },
    N09: { x: 1480, y: 720 },
    N10: { x: 1660, y: 720 },
    N11: { x: 1860, y: 720 },

    // Row 6: Bio utility
    N19: { x: 1660, y: 880 },
  } as Record<string, { x: number; y: number }>,

  nodeWidth: 120,
  nodeHeight: 70,
  canvasWidth: 2000,
  canvasHeight: 980,
};

// ============================================
// ORTHOGONAL EDGE ROUTES
// ============================================
const EDGE_ROUTES: Record<string, { waypoints: Array<{ x: number; y: number }> }> = {
  // Main flow - straight horizontal
  E01: { waypoints: [] },
  E02: { waypoints: [] },
  E03: { waypoints: [] },
  E04: { waypoints: [] },
  E05: { waypoints: [] },

  // Water stream - down then right
  E06: { waypoints: [] },
  E07: { waypoints: [] },
  E08: { waypoints: [] },
  E09: { waypoints: [] },
  E10: { waypoints: [] },

  // Oil stream - up then right
  E11: { waypoints: [{ x: 1120, y: 100 }] },
  E12: { waypoints: [] },

  // Solids stream - right then down
  E13: { waypoints: [{ x: 1400, y: 400 }] },
  E14: { waypoints: [] },

  // Sludge/flush streams
  E15: { waypoints: [] },
  E16: { waypoints: [{ x: 1620, y: 720 }] },
  E17: { waypoints: [{ x: 1860, y: 720 }, { x: 1860, y: 240 }, { x: 1120, y: 240 }] },

  // Utilities - down to targets
  E18: { waypoints: [{ x: 580, y: 340 }, { x: 690, y: 340 }] },
  E19: { waypoints: [{ x: 800, y: 340 }, { x: 690, y: 340 }] },
  E20: { waypoints: [] },
};

// ============================================
// STYLING
// ============================================
const STYLES = {
  node: {
    interface: { fill: '#fef3e2', stroke: '#ea580c', textColor: '#9a3412' },
    process: { fill: '#e0f2fe', stroke: '#0284c7', textColor: '#075985' },
    storage: { fill: '#d1fae5', stroke: '#059669', textColor: '#065f46' },
    utility: { fill: '#f3e8ff', stroke: '#9333ea', textColor: '#6b21a8' },
  },
  edge: {
    mainline: { stroke: '#0284c7', strokeWidth: 4, dash: '' },
    water: { stroke: '#0ea5e9', strokeWidth: 3, dash: '' },
    oil: { stroke: '#d97706', strokeWidth: 3, dash: '' },
    solids: { stroke: '#64748b', strokeWidth: 3, dash: '' },
    sludge_flush: { stroke: '#78716c', strokeWidth: 2, dash: '8,4' },
    utility: { stroke: '#9333ea', strokeWidth: 2, dash: '6,3' },
  },
  groups: {
    Influent: { color: '#ea580c', bg: 'rgba(234,88,12,0.06)' },
    Pretreatment: { color: '#0284c7', bg: 'rgba(2,132,199,0.06)' },
    Separation: { color: '#ca8a04', bg: 'rgba(202,138,4,0.10)' },
    Water: { color: '#0ea5e9', bg: 'rgba(14,165,233,0.06)' },
    Bio: { color: '#10b981', bg: 'rgba(16,185,129,0.06)' },
    Oil: { color: '#d97706', bg: 'rgba(217,119,6,0.06)' },
    Solids: { color: '#64748b', bg: 'rgba(100,116,139,0.06)' },
    Utilities: { color: '#9333ea', bg: 'rgba(147,51,234,0.06)' },
  } as Record<string, { color: string; bg: string }>,
};

// ============================================
// MASS BALANCE
// ============================================
const MASS_BALANCE = {
  influent: { flow: 15.0, unit: 'm³/hr', percent: 100 },
  water: { flow: 12.0, unit: 'm³/hr', percent: 80 },
  oil: { flow: 1.5, unit: 'm³/hr', percent: 10 },
  solids: { flow: 0.75, unit: 'm³/hr', percent: 5 },
  sludge: { flow: 0.75, unit: 'm³/hr', percent: 5 },
};

// ============================================
// EQUIPMENT SYMBOLS
// ============================================
const EquipmentSymbol = ({ type, width, height }: { type: string; width: number; height: number }) => {
  const hw = width / 2;
  const hh = height / 2;

  switch (type) {
    case 'interface':
      return (
        <g>
          <rect x={-hw} y={-hh} width={width} height={height} rx={height / 2} ry={height / 2} />
          <path d={`M${-hw + 10},0 L${-hw + 20},${-8} L${-hw + 20},8 Z`} fill="currentColor" opacity={0.4} />
        </g>
      );
    case 'storage':
      return (
        <g>
          <path
            d={`M${-hw},${-hh + 12}
               Q${-hw},${-hh} ${0},${-hh}
               Q${hw},${-hh} ${hw},${-hh + 12}
               L${hw},${hh - 6}
               Q${hw},${hh} ${0},${hh}
               Q${-hw},${hh} ${-hw},${hh - 6}
               Z`}
          />
          <ellipse cx={0} cy={-hh + 12} rx={hw} ry={12} fill="currentColor" opacity={0.12} />
        </g>
      );
    case 'utility':
      const hex = hw * 0.92;
      return (
        <polygon
          points={`${-hex},0 ${-hex / 2},${-hh} ${hex / 2},${-hh} ${hex},0 ${hex / 2},${hh} ${-hex / 2},${hh}`}
          strokeDasharray="4,2"
        />
      );
    case 'process':
    default:
      const bevel = 8;
      return (
        <path
          d={`M${-hw + bevel},${-hh}
             L${hw - bevel},${-hh}
             L${hw},${-hh + bevel}
             L${hw},${hh - bevel}
             L${hw - bevel},${hh}
             L${-hw + bevel},${hh}
             L${-hw},${hh - bevel}
             L${-hw},${-hh + bevel} Z`}
        />
      );
  }
};

// ============================================
// ORTHOGONAL PATH BUILDER
// ============================================
const buildOrthogonalPath = (
  source: { x: number; y: number },
  target: { x: number; y: number },
  waypoints: Array<{ x: number; y: number }>,
  _edgeId: string
): string => {
  const hw = LAYOUT.nodeWidth / 2;
  const hh = LAYOUT.nodeHeight / 2;

  const dx = target.x - source.x;
  const dy = target.y - source.y;

  let sx = source.x, sy = source.y;
  let tx = target.x, ty = target.y;

  if (waypoints.length === 0) {
    if (Math.abs(dx) > Math.abs(dy) * 0.5) {
      sx = source.x + (dx > 0 ? hw : -hw);
      tx = target.x + (dx > 0 ? -hw : hw);
    } else {
      sy = source.y + (dy > 0 ? hh : -hh);
      ty = target.y + (dy > 0 ? -hh : hh);
    }

    if (Math.abs(dx) > 50 && Math.abs(dy) > 50) {
      const midX = (sx + tx) / 2;
      return `M${sx},${sy} L${midX},${sy} L${midX},${ty} L${tx},${ty}`;
    }

    return `M${sx},${sy} L${tx},${ty}`;
  }

  const points: Array<{ x: number; y: number }> = [];

  const firstWp = waypoints[0];
  if (Math.abs(firstWp.x - source.x) < 10) {
    sy = source.y + (firstWp.y > source.y ? hh : -hh);
    points.push({ x: source.x, y: sy });
  } else {
    sx = source.x + (firstWp.x > source.x ? hw : -hw);
    points.push({ x: sx, y: source.y });
  }

  for (const wp of waypoints) {
    points.push(wp);
  }

  const lastWp = waypoints[waypoints.length - 1];
  if (Math.abs(lastWp.x - target.x) < 10) {
    ty = target.y + (lastWp.y < target.y ? -hh : hh);
    points.push({ x: target.x, y: ty });
  } else {
    tx = target.x + (lastWp.x < target.x ? -hw : hw);
    points.push({ x: tx, y: target.y });
  }

  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L${points[i].x},${points[i].y}`;
  }

  return path;
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function PFDViewer({ onBackToHome, graphData, liveData }: PFDViewerProps) {
  const graph = graphData ?? DEFAULT_GRAPH;

  const [zoom, setZoom] = useState(0.65);
  const [pan, setPan] = useState({ x: 30, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [streamFilters, setStreamFilters] = useState({
    mainline: true,
    water: true,
    oil: true,
    solids: true,
    sludge_flush: true,
    utility: true,
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 2.5;

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * zoomFactor));
    const scale = newZoom / zoom;

    setPan(p => ({
      x: mouseX - (mouseX - p.x) * scale,
      y: mouseY - (mouseY - p.y) * scale,
    }));
    setZoom(newZoom);
  }, [zoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleZoomIn = () => setZoom(z => Math.min(MAX_ZOOM, z * 1.25));
  const handleZoomOut = () => setZoom(z => Math.max(MIN_ZOOM, z / 1.25));
  const handleReset = () => { setZoom(0.65); setPan({ x: 30, y: 20 }); };
  const handleFit = () => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const scaleX = (rect.width - 60) / LAYOUT.canvasWidth;
    const scaleY = (rect.height - 60) / LAYOUT.canvasHeight;
    const newZoom = Math.min(scaleX, scaleY, 1.2);
    setZoom(newZoom);
    setPan({
      x: (rect.width - LAYOUT.canvasWidth * newZoom) / 2,
      y: (rect.height - LAYOUT.canvasHeight * newZoom) / 2,
    });
  };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const highlightedPath = useMemo(() => {
    if (!hoveredEdge) return new Set<string>();
    const edge = graph.edges.find(e => e.id === hoveredEdge);
    if (!edge) return new Set<string>();

    const visited = new Set<string>([hoveredEdge]);
    const streamType = edge.type;

    const trace = (nodeId: string, direction: 'up' | 'down') => {
      const edges = direction === 'down'
        ? graph.edges.filter(e => e.source === nodeId && e.type === streamType)
        : graph.edges.filter(e => e.target === nodeId && e.type === streamType);

      for (const e of edges) {
        if (!visited.has(e.id)) {
          visited.add(e.id);
          trace(direction === 'down' ? e.target : e.source, direction);
        }
      }
    };

    trace(edge.source, 'up');
    trace(edge.target, 'down');
    return visited;
  }, [hoveredEdge, graph.edges]);

  const nodeDetails = useMemo(() => {
    if (!selectedNode) return null;
    const node = graph.nodes.find(n => n.id === selectedNode);
    if (!node) return null;

    const inEdges = graph.edges.filter(e => e.target === selectedNode);
    const outEdges = graph.edges.filter(e => e.source === selectedNode);
    const live = liveData?.[selectedNode];

    return { node, inEdges, outEdges, live };
  }, [selectedNode, graph, liveData]);

  const nodesByGroup = useMemo(() => {
    const groups: Record<string, GraphNode[]> = {};
    for (const node of graph.nodes) {
      if (!groups[node.group]) groups[node.group] = [];
      groups[node.group].push(node);
    }
    return groups;
  }, [graph.nodes]);

  const groupBounds = useMemo(() => {
    const bounds: Record<string, { minX: number; minY: number; maxX: number; maxY: number }> = {};
    for (const [group, nodes] of Object.entries(nodesByGroup)) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of nodes) {
        const pos = LAYOUT.positions[node.id];
        if (pos) {
          minX = Math.min(minX, pos.x - LAYOUT.nodeWidth / 2);
          minY = Math.min(minY, pos.y - LAYOUT.nodeHeight / 2);
          maxX = Math.max(maxX, pos.x + LAYOUT.nodeWidth / 2);
          maxY = Math.max(maxY, pos.y + LAYOUT.nodeHeight / 2);
        }
      }
      bounds[group] = {
        minX: minX - 25,
        minY: minY - 35,
        maxX: maxX + 25,
        maxY: maxY + 25,
      };
    }
    return bounds;
  }, [nodesByGroup]);

  const currentDate = new Date().toLocaleDateString('en-AU', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  return (
    <div ref={containerRef} className="h-screen flex flex-col" style={{ background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
      {/* Header */}
      <header className="flex-none h-14 bg-slate-800/90 backdrop-blur-sm border-b border-slate-700/80 flex items-center px-4 gap-4">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="h-6 w-px bg-slate-600" />

        <div className="flex-1">
          <h1 className="text-white font-semibold text-sm tracking-wide">
            KARRATHA WTP — PROCESS FLOW DIAGRAM
          </h1>
          <p className="text-slate-400 text-xs">CWY-KAR-PFD-001 Rev C • {currentDate}</p>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-700/80 rounded-lg px-2 py-1">
          <button onClick={handleZoomOut} className="p-1.5 hover:bg-slate-600 rounded" title="Zoom Out">
            <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          <span className="text-slate-300 text-xs font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} className="p-1.5 hover:bg-slate-600 rounded" title="Zoom In">
            <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          </button>
          <div className="w-px h-4 bg-slate-600 mx-1" />
          <button onClick={handleReset} className="px-2 py-1 text-xs text-slate-300 hover:bg-slate-600 rounded">Reset</button>
          <button onClick={handleFit} className="px-2 py-1 text-xs text-slate-300 hover:bg-slate-600 rounded">Fit</button>
        </div>

        <div className="h-6 w-px bg-slate-600" />

        <button
          onClick={() => setShowMinimap(m => !m)}
          className={`p-2 rounded-lg transition-colors ${showMinimap ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          title="Toggle Minimap"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </button>
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
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Diagram Viewport */}
        <div
          ref={viewportRef}
          className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing relative"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            width="100%"
            height="100%"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
          >
            <defs>
              {Object.entries(STYLES.edge).map(([type, style]) => (
                <marker
                  key={type}
                  id={`arrow-${type}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={style.stroke} />
                </marker>
              ))}
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="3" dy="3" stdDeviation="4" floodOpacity="0.35" />
              </filter>
            </defs>

            {/* Grid */}
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="0.5" />
            </pattern>
            <rect width={LAYOUT.canvasWidth} height={LAYOUT.canvasHeight} fill="url(#grid)" />

            {/* Group backgrounds */}
            {Object.entries(groupBounds).map(([group, bounds]) => {
              const style = STYLES.groups[group];
              if (!style) return null;
              return (
                <g key={group}>
                  <rect
                    x={bounds.minX}
                    y={bounds.minY}
                    width={bounds.maxX - bounds.minX}
                    height={bounds.maxY - bounds.minY}
                    fill={style.bg}
                    stroke={style.color}
                    strokeWidth={1}
                    strokeDasharray="6,4"
                    rx={10}
                    opacity={0.9}
                  />
                  <text
                    x={bounds.minX + 10}
                    y={bounds.minY + 16}
                    fill={style.color}
                    fontSize={11}
                    fontWeight={600}
                    fontFamily="system-ui, sans-serif"
                  >
                    {group.toUpperCase()}
                  </text>
                </g>
              );
            })}

            {/* Edges */}
            {graph.edges.map(edge => {
              if (!streamFilters[edge.type]) return null;

              const source = LAYOUT.positions[edge.source];
              const target = LAYOUT.positions[edge.target];
              if (!source || !target) return null;

              const style = STYLES.edge[edge.type];
              const isHighlighted = highlightedPath.has(edge.id);
              const isHovered = hoveredEdge === edge.id;
              const isConnectedToSelected = selectedNode && (edge.source === selectedNode || edge.target === selectedNode);

              const route = EDGE_ROUTES[edge.id] || { waypoints: [] };
              const path = buildOrthogonalPath(source, target, route.waypoints, edge.id);

              const labelPos = route.waypoints.length > 0
                ? route.waypoints[Math.floor(route.waypoints.length / 2)]
                : { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };

              return (
                <g
                  key={edge.id}
                  onMouseEnter={() => setHoveredEdge(edge.id)}
                  onMouseLeave={() => setHoveredEdge(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <path d={path} fill="none" stroke="transparent" strokeWidth={20} />
                  <path
                    d={path}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth={isHighlighted || isConnectedToSelected ? style.strokeWidth + 2 : style.strokeWidth}
                    strokeDasharray={style.dash}
                    markerEnd={`url(#arrow-${edge.type})`}
                    opacity={hoveredEdge && !isHighlighted ? 0.25 : 1}
                    filter={isHighlighted ? 'url(#glow)' : undefined}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{ transition: 'opacity 0.2s, stroke-width 0.2s' }}
                  />
                  {(isHovered || isHighlighted) && (
                    <g transform={`translate(${labelPos.x}, ${labelPos.y - 12})`}>
                      <rect
                        x={-40}
                        y={-10}
                        width={80}
                        height={20}
                        fill="#1e293b"
                        stroke={style.stroke}
                        strokeWidth={1}
                        rx={4}
                        opacity={0.95}
                      />
                      <text
                        fill="white"
                        fontSize={10}
                        fontWeight={500}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontFamily="system-ui, sans-serif"
                      >
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {graph.nodes.map(node => {
              const pos = LAYOUT.positions[node.id];
              if (!pos) return null;

              const style = STYLES.node[node.type];
              const isSelected = selectedNode === node.id;
              const isHovered = hoveredNode === node.id;
              const live = liveData?.[node.id];

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(isSelected ? null : node.id);
                  }}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <g
                    fill={style.fill}
                    stroke={isSelected ? '#fbbf24' : isHovered ? '#60a5fa' : style.stroke}
                    strokeWidth={isSelected ? 4 : isHovered ? 3 : 2}
                    filter={isSelected ? 'url(#shadow)' : undefined}
                    style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }}
                  >
                    <EquipmentSymbol type={node.type} width={LAYOUT.nodeWidth} height={LAYOUT.nodeHeight} />
                  </g>

                  <rect
                    x={-LAYOUT.nodeWidth / 2}
                    y={-LAYOUT.nodeHeight / 2 - 2}
                    width={32}
                    height={16}
                    fill={style.stroke}
                    rx={3}
                  />
                  <text
                    x={-LAYOUT.nodeWidth / 2 + 16}
                    y={-LAYOUT.nodeHeight / 2 + 10}
                    fill="white"
                    fontSize={10}
                    fontWeight={700}
                    textAnchor="middle"
                    fontFamily="ui-monospace, monospace"
                  >
                    {node.id}
                  </text>

                  <text
                    y={4}
                    fill={style.textColor}
                    fontSize={10}
                    fontWeight={600}
                    textAnchor="middle"
                    fontFamily="system-ui, sans-serif"
                  >
                    {node.label.split('\n').map((line, i, arr) => (
                      <tspan key={i} x={0} dy={i === 0 ? -((arr.length - 1) * 6) : 13}>
                        {line}
                      </tspan>
                    ))}
                  </text>

                  {live?.status && (
                    <circle
                      cx={LAYOUT.nodeWidth / 2 - 10}
                      cy={-LAYOUT.nodeHeight / 2 + 10}
                      r={6}
                      fill={live.status === 'running' ? '#22c55e' : live.status === 'alarm' ? '#ef4444' : '#f59e0b'}
                      stroke="white"
                      strokeWidth={2}
                    >
                      {live.status === 'running' && (
                        <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                      )}
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Minimap */}
          {showMinimap && (
            <div className="absolute bottom-4 right-4 w-56 h-36 bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-600 p-2 shadow-xl">
              <svg viewBox={`0 0 ${LAYOUT.canvasWidth} ${LAYOUT.canvasHeight}`} className="w-full h-full">
                {graph.edges.map(edge => {
                  if (!streamFilters[edge.type]) return null;
                  const source = LAYOUT.positions[edge.source];
                  const target = LAYOUT.positions[edge.target];
                  if (!source || !target) return null;
                  const route = EDGE_ROUTES[edge.id] || { waypoints: [] };
                  const points = [source, ...route.waypoints, target];
                  return (
                    <polyline
                      key={edge.id}
                      points={points.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke={STYLES.edge[edge.type].stroke}
                      strokeWidth={4}
                      opacity={0.5}
                    />
                  );
                })}
                {graph.nodes.map(node => {
                  const pos = LAYOUT.positions[node.id];
                  if (!pos) return null;
                  return (
                    <rect
                      key={node.id}
                      x={pos.x - 20}
                      y={pos.y - 14}
                      width={40}
                      height={28}
                      fill={STYLES.node[node.type].fill}
                      stroke={STYLES.node[node.type].stroke}
                      strokeWidth={2}
                      rx={3}
                    />
                  );
                })}
                {viewportRef.current && (
                  <rect
                    x={-pan.x / zoom}
                    y={-pan.y / zoom}
                    width={viewportRef.current.clientWidth / zoom}
                    height={viewportRef.current.clientHeight / zoom}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth={6}
                    rx={4}
                  />
                )}
              </svg>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 bg-slate-800/95 backdrop-blur-sm border-l border-slate-700 flex flex-col overflow-hidden">
          {/* Stream Filters */}
          <div className="p-4 border-b border-slate-700/80">
            <h3 className="text-white font-semibold text-sm mb-3">Stream Filters</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(streamFilters).map(([type, enabled]) => {
                const style = STYLES.edge[type as keyof typeof STYLES.edge];
                const labels: Record<string, string> = {
                  mainline: 'Main Flow',
                  water: 'Water',
                  oil: 'Oil',
                  solids: 'Solids',
                  sludge_flush: 'Sludge',
                  utility: 'Utility',
                };
                return (
                  <button
                    key={type}
                    onClick={() => setStreamFilters(f => ({ ...f, [type]: !enabled }))}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all ${
                      enabled ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <div
                      className="w-5 h-0"
                      style={{
                        borderTop: `3px ${style.dash ? 'dashed' : 'solid'} ${enabled ? style.stroke : '#475569'}`,
                      }}
                    />
                    <span>{labels[type]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mass Balance */}
          <div className="p-4 border-b border-slate-700/80">
            <h3 className="text-white font-semibold text-sm mb-3">Mass Balance</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Influent</span>
                <span className="text-cyan-400 font-mono">{MASS_BALANCE.influent.flow} m³/hr</span>
              </div>
              <div className="h-4 bg-slate-700 rounded-full overflow-hidden flex">
                <div className="h-full bg-sky-500" style={{ width: '80%' }} title="Water 80%" />
                <div className="h-full bg-amber-500" style={{ width: '10%' }} title="Oil 10%" />
                <div className="h-full bg-slate-400" style={{ width: '5%' }} title="Solids 5%" />
                <div className="h-full bg-stone-500" style={{ width: '5%' }} title="Sludge 5%" />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-sky-400">● Water</span>
                  <span className="text-slate-300 font-mono">80%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-400">● Oil</span>
                  <span className="text-slate-300 font-mono">10%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">● Solids</span>
                  <span className="text-slate-300 font-mono">5%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">● Sludge</span>
                  <span className="text-slate-300 font-mono">5%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Node Details */}
          <div className="flex-1 p-4 overflow-y-auto">
            {nodeDetails ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="px-1.5 py-0.5 rounded text-xs font-mono font-bold"
                        style={{ backgroundColor: STYLES.node[nodeDetails.node.type].stroke, color: 'white' }}
                      >
                        {nodeDetails.node.id}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-xs capitalize"
                        style={{
                          backgroundColor: STYLES.node[nodeDetails.node.type].fill,
                          color: STYLES.node[nodeDetails.node.type].textColor,
                        }}
                      >
                        {nodeDetails.node.type}
                      </span>
                    </div>
                    <h4 className="text-white font-semibold mt-2 text-sm">
                      {nodeDetails.node.label.replace(/\n/g, ' ')}
                    </h4>
                    <p className="text-slate-400 text-xs mt-1">{nodeDetails.node.group}</p>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-slate-700 rounded">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {nodeDetails.live && (
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <h5 className="text-slate-300 text-xs font-semibold mb-2">LIVE DATA</h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {nodeDetails.live.flow !== undefined && (
                        <div>
                          <span className="text-slate-400">Flow</span>
                          <p className="text-cyan-400 font-mono">{nodeDetails.live.flow} m³/hr</p>
                        </div>
                      )}
                      {nodeDetails.live.level !== undefined && (
                        <div>
                          <span className="text-slate-400">Level</span>
                          <p className="text-emerald-400 font-mono">{nodeDetails.live.level}%</p>
                        </div>
                      )}
                      {nodeDetails.live.status && (
                        <div>
                          <span className="text-slate-400">Status</span>
                          <p className={`font-semibold capitalize ${
                            nodeDetails.live.status === 'running' ? 'text-emerald-400' :
                            nodeDetails.live.status === 'alarm' ? 'text-red-400' : 'text-amber-400'
                          }`}>
                            {nodeDetails.live.status}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <h5 className="text-slate-300 text-xs font-semibold mb-2">INPUTS ({nodeDetails.inEdges.length})</h5>
                  {nodeDetails.inEdges.length > 0 ? (
                    <div className="space-y-1">
                      {nodeDetails.inEdges.map(edge => {
                        const sourceNode = graph.nodes.find(n => n.id === edge.source);
                        return (
                          <div key={edge.id} className="flex items-center gap-2 text-xs bg-slate-700/30 rounded px-2 py-1.5">
                            <div className="w-4 h-0" style={{ borderTop: `2px solid ${STYLES.edge[edge.type].stroke}` }} />
                            <span className="text-slate-300 flex-1">{sourceNode?.label.split('\n')[0]}</span>
                            <span className="text-slate-500">{edge.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs italic">Source node</p>
                  )}
                </div>

                <div>
                  <h5 className="text-slate-300 text-xs font-semibold mb-2">OUTPUTS ({nodeDetails.outEdges.length})</h5>
                  {nodeDetails.outEdges.length > 0 ? (
                    <div className="space-y-1">
                      {nodeDetails.outEdges.map(edge => {
                        const targetNode = graph.nodes.find(n => n.id === edge.target);
                        return (
                          <div key={edge.id} className="flex items-center gap-2 text-xs bg-slate-700/30 rounded px-2 py-1.5">
                            <div className="w-4 h-0" style={{ borderTop: `2px solid ${STYLES.edge[edge.type].stroke}` }} />
                            <span className="text-slate-300 flex-1">{targetNode?.label.split('\n')[0]}</span>
                            <span className="text-slate-500">{edge.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs italic">Terminal node</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-slate-400 text-sm">Click a node to view details</p>
                <p className="text-slate-500 text-xs mt-1">Hover streams to trace flow</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-700/80 bg-slate-800/50">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Nodes: <span className="text-slate-300">{graph.nodes.length}</span></span>
              <span className="text-slate-500">Streams: <span className="text-slate-300">{graph.edges.length}</span></span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span>Scroll: Zoom</span>
              <span>•</span>
              <span>Drag: Pan</span>
              <span>•</span>
              <span>Click: Select</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
