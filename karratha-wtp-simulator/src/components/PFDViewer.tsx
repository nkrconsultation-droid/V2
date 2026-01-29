/**
 * PFD VIEWER V3 - INTERACTIVE PROCESS FLOW DIAGRAM WITH SIMULATION
 * =================================================================
 * Features:
 * - Start/Stop simulation controls
 * - Adjustable simulation speed
 * - Animated flow particles on pipes
 * - Live material flow rates
 * - Real-time mass balance
 * - Interactive nodes with details panel
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

interface FlowState {
  flow: number;      // m³/hr
  velocity: number;  // animation speed factor
  active: boolean;
}

interface NodeState {
  level?: number;    // % for tanks
  status: 'running' | 'stopped' | 'alarm' | 'standby';
  throughput?: number;
}

interface PFDViewerProps {
  onBackToHome: () => void;
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
    { id: 'E06', source: 'N06', target: 'N07', label: 'water', type: 'water' },
    { id: 'E07', source: 'N07', target: 'N08', label: 'to DAF', type: 'water' },
    { id: 'E08', source: 'N08', target: 'N09', label: 'clarified', type: 'water' },
    { id: 'E09', source: 'N09', target: 'N10', label: 'bio feed', type: 'water' },
    { id: 'E10', source: 'N10', target: 'N11', label: 'treated', type: 'water' },
    { id: 'E11', source: 'N06', target: 'N12', label: 'oil', type: 'oil' },
    { id: 'E12', source: 'N12', target: 'N13', label: 'oil out', type: 'oil' },
    { id: 'E13', source: 'N06', target: 'N14', label: 'solids', type: 'solids' },
    { id: 'E14', source: 'N14', target: 'N15', label: 'solids out', type: 'solids' },
    { id: 'E15', source: 'N06', target: 'N16', label: 'flush', type: 'sludge_flush' },
    { id: 'E16', source: 'N08', target: 'N16', label: 'DAF float', type: 'sludge_flush' },
    { id: 'E17', source: 'N10', target: 'N06', label: 'WAS', type: 'sludge_flush' },
    { id: 'E18', source: 'N17', target: 'N04', label: 'heat', type: 'utility' },
    { id: 'E19', source: 'N18', target: 'N04', label: 'chem', type: 'utility' },
    { id: 'E20', source: 'N19', target: 'N10', label: 'nutrients', type: 'utility' },
  ],
};

// ============================================
// BASE FLOW RATES (m³/hr at 100% throughput)
// ============================================
const BASE_FLOWS: Record<string, number> = {
  E01: 15.0, E02: 15.0, E03: 14.85, E04: 14.85, E05: 14.7,  // Main flow
  E06: 12.0, E07: 12.0, E08: 11.7, E09: 11.7, E10: 11.5,    // Water
  E11: 1.5, E12: 1.5,                                        // Oil
  E13: 0.75, E14: 0.75,                                      // Solids
  E15: 0.3, E16: 0.3, E17: 0.15,                            // Sludge
  E18: 0, E19: 0, E20: 0,                                    // Utilities (no flow)
};

// ============================================
// LAYOUT
// ============================================
const LAYOUT = {
  positions: {
    N12: { x: 1300, y: 100 }, N13: { x: 1520, y: 100 },
    N17: { x: 580, y: 240 }, N18: { x: 800, y: 240 },
    N01: { x: 100, y: 400 }, N02: { x: 290, y: 400 }, N03: { x: 480, y: 400 },
    N04: { x: 690, y: 400 }, N05: { x: 900, y: 400 }, N06: { x: 1120, y: 400 },
    N14: { x: 1400, y: 560 }, N15: { x: 1620, y: 560 }, N16: { x: 1620, y: 400 },
    N07: { x: 1120, y: 720 }, N08: { x: 1300, y: 720 }, N09: { x: 1480, y: 720 },
    N10: { x: 1660, y: 720 }, N11: { x: 1860, y: 720 },
    N19: { x: 1660, y: 880 },
  } as Record<string, { x: number; y: number }>,
  nodeWidth: 120,
  nodeHeight: 70,
  canvasWidth: 2000,
  canvasHeight: 980,
};

// ============================================
// EDGE ROUTES
// ============================================
const EDGE_ROUTES: Record<string, { waypoints: Array<{ x: number; y: number }> }> = {
  E01: { waypoints: [] }, E02: { waypoints: [] }, E03: { waypoints: [] },
  E04: { waypoints: [] }, E05: { waypoints: [] }, E06: { waypoints: [] },
  E07: { waypoints: [] }, E08: { waypoints: [] }, E09: { waypoints: [] },
  E10: { waypoints: [] }, E11: { waypoints: [{ x: 1120, y: 100 }] },
  E12: { waypoints: [] }, E13: { waypoints: [{ x: 1400, y: 400 }] },
  E14: { waypoints: [] }, E15: { waypoints: [] },
  E16: { waypoints: [{ x: 1620, y: 720 }] },
  E17: { waypoints: [{ x: 1860, y: 720 }, { x: 1860, y: 240 }, { x: 1120, y: 240 }] },
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
    mainline: { stroke: '#0284c7', strokeWidth: 4, dash: '', particle: '#60a5fa' },
    water: { stroke: '#0ea5e9', strokeWidth: 3, dash: '', particle: '#7dd3fc' },
    oil: { stroke: '#d97706', strokeWidth: 3, dash: '', particle: '#fbbf24' },
    solids: { stroke: '#64748b', strokeWidth: 3, dash: '', particle: '#94a3b8' },
    sludge_flush: { stroke: '#78716c', strokeWidth: 2, dash: '8,4', particle: '#a8a29e' },
    utility: { stroke: '#9333ea', strokeWidth: 2, dash: '6,3', particle: '#c084fc' },
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
            d={`M${-hw},${-hh + 12} Q${-hw},${-hh} ${0},${-hh} Q${hw},${-hh} ${hw},${-hh + 12}
               L${hw},${hh - 6} Q${hw},${hh} ${0},${hh} Q${-hw},${hh} ${-hw},${hh - 6} Z`}
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
    default:
      const bevel = 8;
      return (
        <path
          d={`M${-hw + bevel},${-hh} L${hw - bevel},${-hh} L${hw},${-hh + bevel} L${hw},${hh - bevel}
             L${hw - bevel},${hh} L${-hw + bevel},${hh} L${-hw},${hh - bevel} L${-hw},${-hh + bevel} Z`}
        />
      );
  }
};

// ============================================
// PATH BUILDER
// ============================================
const buildOrthogonalPath = (
  source: { x: number; y: number },
  target: { x: number; y: number },
  waypoints: Array<{ x: number; y: number }>
): string => {
  const hw = LAYOUT.nodeWidth / 2;
  const hh = LAYOUT.nodeHeight / 2;
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  if (waypoints.length === 0) {
    let sx = source.x, sy = source.y, tx = target.x, ty = target.y;
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
    points.push({ x: source.x, y: source.y + (firstWp.y > source.y ? hh : -hh) });
  } else {
    points.push({ x: source.x + (firstWp.x > source.x ? hw : -hw), y: source.y });
  }
  points.push(...waypoints);
  const lastWp = waypoints[waypoints.length - 1];
  if (Math.abs(lastWp.x - target.x) < 10) {
    points.push({ x: target.x, y: target.y + (lastWp.y < target.y ? -hh : hh) });
  } else {
    points.push({ x: target.x + (lastWp.x < target.x ? -hw : hw), y: target.y });
  }

  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
};

// ============================================
// FLOW PARTICLE COMPONENT
// ============================================
const FlowParticles = ({
  pathId,
  color,
  speed,
  isRunning,
  flowRate
}: {
  pathId: string;
  color: string;
  speed: number;
  isRunning: boolean;
  flowRate: number;
}) => {
  if (!isRunning || flowRate <= 0) return null;

  // Number of particles based on flow rate
  const particleCount = Math.max(1, Math.min(5, Math.floor(flowRate / 3)));
  const duration = Math.max(1, 8 / speed / (flowRate / 5 + 0.5));

  return (
    <>
      {Array.from({ length: particleCount }).map((_, i) => (
        <circle key={i} r={4} fill={color} opacity={0.9}>
          <animateMotion
            dur={`${duration}s`}
            repeatCount="indefinite"
            begin={`${(i / particleCount) * duration}s`}
          >
            <mpath href={`#${pathId}`} />
          </animateMotion>
        </circle>
      ))}
    </>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function PFDViewer({ onBackToHome }: PFDViewerProps) {
  const graph = DEFAULT_GRAPH;

  // Simulation state
  const [isRunning, setIsRunning] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const [simTime, setSimTime] = useState(0);
  const [throughput, setThroughput] = useState(100); // % of design capacity

  // Flow states
  const [flowStates, setFlowStates] = useState<Record<string, FlowState>>(() => {
    const initial: Record<string, FlowState> = {};
    for (const edge of graph.edges) {
      initial[edge.id] = { flow: 0, velocity: 0, active: false };
    }
    return initial;
  });

  // Node states
  const [nodeStates, setNodeStates] = useState<Record<string, NodeState>>(() => {
    const initial: Record<string, NodeState> = {};
    for (const node of graph.nodes) {
      initial[node.id] = {
        status: 'stopped',
        level: node.type === 'storage' ? 50 : undefined,
        throughput: 0
      };
    }
    return initial;
  });

  // Totals
  const [totals, setTotals] = useState({
    waterProduced: 0,
    oilRecovered: 0,
    solidsRemoved: 0,
  });

  // View state
  const [zoom, setZoom] = useState(0.6);
  const [pan, setPan] = useState({ x: 20, y: 10 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const simIntervalRef = useRef<number | null>(null);

  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 2.5;

  // ============================================
  // SIMULATION LOOP
  // ============================================
  useEffect(() => {
    if (isRunning) {
      simIntervalRef.current = window.setInterval(() => {
        const dt = 0.1 * simSpeed; // Time step in hours

        setSimTime(t => t + dt);

        // Update flow states based on throughput
        setFlowStates(prev => {
          const next = { ...prev };
          for (const edge of graph.edges) {
            const baseFlow = BASE_FLOWS[edge.id] || 0;
            const actualFlow = baseFlow * (throughput / 100);
            // Add some random variation (±5%)
            const variation = 1 + (Math.random() - 0.5) * 0.1;
            next[edge.id] = {
              flow: actualFlow * variation,
              velocity: actualFlow > 0 ? 1 : 0,
              active: actualFlow > 0,
            };
          }
          return next;
        });

        // Update node states
        setNodeStates(prev => {
          const next = { ...prev };
          for (const node of graph.nodes) {
            next[node.id] = {
              ...prev[node.id],
              status: throughput > 0 ? 'running' : 'standby',
              throughput: throughput,
            };
            // Update tank levels
            if (node.type === 'storage' && prev[node.id].level !== undefined) {
              const levelChange = (Math.random() - 0.48) * 2 * simSpeed;
              next[node.id].level = Math.max(10, Math.min(90, (prev[node.id].level || 50) + levelChange));
            }
          }
          return next;
        });

        // Update totals
        setTotals(prev => ({
          waterProduced: prev.waterProduced + (11.5 * (throughput / 100) * dt),
          oilRecovered: prev.oilRecovered + (1.5 * (throughput / 100) * dt),
          solidsRemoved: prev.solidsRemoved + (0.75 * (throughput / 100) * dt),
        }));

      }, 100);
    } else {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    }

    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    };
  }, [isRunning, simSpeed, throughput, graph.edges, graph.nodes]);

  // Stop flows when simulation stops
  useEffect(() => {
    if (!isRunning) {
      setFlowStates(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          next[key] = { ...next[key], active: false };
        }
        return next;
      });
      setNodeStates(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          next[key] = { ...next[key], status: 'stopped' };
        }
        return next;
      });
    }
  }, [isRunning]);

  // ============================================
  // HANDLERS
  // ============================================
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * zoomFactor));
    const scale = newZoom / zoom;
    setPan(p => ({ x: mouseX - (mouseX - p.x) * scale, y: mouseY - (mouseY - p.y) * scale }));
    setZoom(newZoom);
  }, [zoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleReset = () => {
    setIsRunning(false);
    setSimTime(0);
    setThroughput(100);
    setTotals({ waterProduced: 0, oilRecovered: 0, solidsRemoved: 0 });
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

  // ============================================
  // DERIVED DATA
  // ============================================
  const massBalance = useMemo(() => {
    const influent = flowStates['E01']?.flow || 0;
    const water = flowStates['E10']?.flow || 0;
    const oil = flowStates['E12']?.flow || 0;
    const solids = flowStates['E14']?.flow || 0;
    return { influent, water, oil, solids };
  }, [flowStates]);

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
      bounds[group] = { minX: minX - 25, minY: minY - 35, maxX: maxX + 25, maxY: maxY + 25 };
    }
    return bounds;
  }, [nodesByGroup]);

  const formatTime = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const currentDate = new Date().toLocaleDateString('en-AU');

  // ============================================
  // RENDER
  // ============================================
  return (
    <div ref={containerRef} className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <header className="flex-none h-14 bg-slate-800 border-b border-slate-700 flex items-center px-4 gap-3">
        <button onClick={onBackToHome} className="flex items-center gap-2 text-slate-300 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="h-6 w-px bg-slate-600" />

        <div className="flex-1">
          <h1 className="text-white font-semibold text-sm">KARRATHA WTP — LIVE PROCESS VIEW</h1>
          <p className="text-slate-400 text-xs">CWY-KAR-PFD-001 • {currentDate}</p>
        </div>

        {/* Simulation Controls */}
        <div className="flex items-center gap-2 bg-slate-700/80 rounded-lg px-3 py-1.5">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium text-sm transition-all ${
              isRunning
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
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

          <div className="w-px h-6 bg-slate-600" />

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">Speed:</span>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={simSpeed}
              onChange={(e) => setSimSpeed(parseFloat(e.target.value))}
              className="w-20 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <span className="text-cyan-400 text-xs font-mono w-8">{simSpeed}×</span>
          </div>

          <div className="w-px h-6 bg-slate-600" />

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">Load:</span>
            <input
              type="range"
              min="0"
              max="120"
              step="5"
              value={throughput}
              onChange={(e) => setThroughput(parseInt(e.target.value))}
              className="w-20 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <span className="text-amber-400 text-xs font-mono w-10">{throughput}%</span>
          </div>

          <div className="w-px h-6 bg-slate-600" />

          <button onClick={handleReset} className="px-2 py-1 text-xs text-slate-300 hover:bg-slate-600 rounded">
            Reset
          </button>
        </div>

        <div className="h-6 w-px bg-slate-600" />

        {/* Time Display */}
        <div className="bg-slate-700/50 rounded px-3 py-1">
          <div className="text-slate-400 text-[10px]">SIM TIME</div>
          <div className="text-cyan-400 font-mono text-sm">{formatTime(simTime)}</div>
        </div>

        <div className="h-6 w-px bg-slate-600" />

        {/* View Controls */}
        <button
          onClick={() => setShowMinimap(m => !m)}
          className={`p-2 rounded-lg ${showMinimap ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </button>
        <button onClick={toggleFullscreen} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Diagram */}
        <div
          ref={viewportRef}
          className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing relative"
          style={{ background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}
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
                <marker key={type} id={`arrow-${type}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={style.stroke} />
                </marker>
              ))}
              <filter id="glow"><feGaussianBlur stdDeviation="4" result="coloredBlur" /><feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>

            {/* Grid */}
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="0.5" />
            </pattern>
            <rect width={LAYOUT.canvasWidth} height={LAYOUT.canvasHeight} fill="url(#grid)" />

            {/* Groups */}
            {Object.entries(groupBounds).map(([group, bounds]) => {
              const style = STYLES.groups[group];
              if (!style) return null;
              return (
                <g key={group}>
                  <rect x={bounds.minX} y={bounds.minY} width={bounds.maxX - bounds.minX} height={bounds.maxY - bounds.minY}
                    fill={style.bg} stroke={style.color} strokeWidth={1} strokeDasharray="6,4" rx={10} />
                  <text x={bounds.minX + 10} y={bounds.minY + 16} fill={style.color} fontSize={11} fontWeight={600}>{group.toUpperCase()}</text>
                </g>
              );
            })}

            {/* Edges with flow animation */}
            {graph.edges.map(edge => {
              const source = LAYOUT.positions[edge.source];
              const target = LAYOUT.positions[edge.target];
              if (!source || !target) return null;

              const style = STYLES.edge[edge.type];
              const route = EDGE_ROUTES[edge.id] || { waypoints: [] };
              const path = buildOrthogonalPath(source, target, route.waypoints);
              const flowState = flowStates[edge.id];
              const isHovered = hoveredEdge === edge.id;

              return (
                <g key={edge.id} onMouseEnter={() => setHoveredEdge(edge.id)} onMouseLeave={() => setHoveredEdge(null)}>
                  {/* Define path for animation */}
                  <path id={`path-${edge.id}`} d={path} fill="none" stroke="none" />

                  {/* Visible edge */}
                  <path d={path} fill="none" stroke="transparent" strokeWidth={20} style={{ cursor: 'pointer' }} />
                  <path
                    d={path}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth={isHovered ? style.strokeWidth + 2 : style.strokeWidth}
                    strokeDasharray={style.dash}
                    markerEnd={`url(#arrow-${edge.type})`}
                    opacity={flowState?.active ? 1 : 0.4}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

                  {/* Flow particles */}
                  <FlowParticles
                    pathId={`path-${edge.id}`}
                    color={style.particle}
                    speed={simSpeed}
                    isRunning={isRunning && flowState?.active}
                    flowRate={flowState?.flow || 0}
                  />

                  {/* Flow label */}
                  {isHovered && flowState?.flow > 0 && (
                    <g transform={`translate(${(source.x + target.x) / 2}, ${(source.y + target.y) / 2 - 16})`}>
                      <rect x={-45} y={-12} width={90} height={24} fill="#1e293b" stroke={style.stroke} rx={4} opacity={0.95} />
                      <text fill="white" fontSize={11} fontWeight={600} textAnchor="middle" dominantBaseline="middle">
                        {flowState.flow.toFixed(2)} m³/hr
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
              const nodeState = nodeStates[node.id];
              const isSelected = selectedNode === node.id;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={(e) => { e.stopPropagation(); setSelectedNode(isSelected ? null : node.id); }}
                  style={{ cursor: 'pointer' }}
                >
                  <g
                    fill={style.fill}
                    stroke={isSelected ? '#fbbf24' : style.stroke}
                    strokeWidth={isSelected ? 4 : 2}
                    opacity={nodeState?.status === 'running' ? 1 : 0.6}
                  >
                    <EquipmentSymbol type={node.type} width={LAYOUT.nodeWidth} height={LAYOUT.nodeHeight} />
                  </g>

                  {/* Tank level indicator */}
                  {node.type === 'storage' && nodeState?.level !== undefined && (
                    <rect
                      x={-LAYOUT.nodeWidth / 2 + 4}
                      y={LAYOUT.nodeHeight / 2 - 4 - (nodeState.level / 100) * (LAYOUT.nodeHeight - 20)}
                      width={LAYOUT.nodeWidth - 8}
                      height={(nodeState.level / 100) * (LAYOUT.nodeHeight - 20)}
                      fill={style.stroke}
                      opacity={0.3}
                      rx={2}
                    />
                  )}

                  {/* Node ID */}
                  <rect x={-LAYOUT.nodeWidth / 2} y={-LAYOUT.nodeHeight / 2 - 2} width={32} height={16} fill={style.stroke} rx={3} />
                  <text x={-LAYOUT.nodeWidth / 2 + 16} y={-LAYOUT.nodeHeight / 2 + 10} fill="white" fontSize={10} fontWeight={700} textAnchor="middle" fontFamily="monospace">
                    {node.id}
                  </text>

                  {/* Label */}
                  <text y={4} fill={style.textColor} fontSize={10} fontWeight={600} textAnchor="middle">
                    {node.label.split('\n').map((line, i, arr) => (
                      <tspan key={i} x={0} dy={i === 0 ? -((arr.length - 1) * 6) : 13}>{line}</tspan>
                    ))}
                  </text>

                  {/* Status indicator */}
                  <circle
                    cx={LAYOUT.nodeWidth / 2 - 10}
                    cy={-LAYOUT.nodeHeight / 2 + 10}
                    r={6}
                    fill={nodeState?.status === 'running' ? '#22c55e' : nodeState?.status === 'alarm' ? '#ef4444' : '#64748b'}
                    stroke="white"
                    strokeWidth={2}
                  >
                    {nodeState?.status === 'running' && (
                      <animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite" />
                    )}
                  </circle>
                </g>
              );
            })}
          </svg>

          {/* Minimap */}
          {showMinimap && (
            <div className="absolute bottom-4 right-4 w-52 h-32 bg-slate-800/95 rounded-lg border border-slate-600 p-2">
              <svg viewBox={`0 0 ${LAYOUT.canvasWidth} ${LAYOUT.canvasHeight}`} className="w-full h-full">
                {graph.edges.map(edge => {
                  const source = LAYOUT.positions[edge.source];
                  const target = LAYOUT.positions[edge.target];
                  if (!source || !target) return null;
                  return <line key={edge.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke={STYLES.edge[edge.type].stroke} strokeWidth={3} opacity={0.5} />;
                })}
                {graph.nodes.map(node => {
                  const pos = LAYOUT.positions[node.id];
                  if (!pos) return null;
                  return <rect key={node.id} x={pos.x - 18} y={pos.y - 12} width={36} height={24} fill={STYLES.node[node.type].fill} stroke={STYLES.node[node.type].stroke} strokeWidth={2} rx={3} />;
                })}
                {viewportRef.current && (
                  <rect x={-pan.x / zoom} y={-pan.y / zoom} width={viewportRef.current.clientWidth / zoom} height={viewportRef.current.clientHeight / zoom}
                    fill="none" stroke="#fbbf24" strokeWidth={6} rx={4} />
                )}
              </svg>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col">
          {/* Live Mass Balance */}
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
              Live Mass Balance
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Influent</span>
                <span className="text-cyan-400 font-mono">{massBalance.influent.toFixed(2)} m³/hr</span>
              </div>
              <div className="h-4 bg-slate-700 rounded-full overflow-hidden flex">
                <div className="h-full bg-sky-500 transition-all" style={{ width: `${massBalance.influent > 0 ? (massBalance.water / massBalance.influent) * 100 : 80}%` }} />
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${massBalance.influent > 0 ? (massBalance.oil / massBalance.influent) * 100 : 10}%` }} />
                <div className="h-full bg-slate-400 transition-all" style={{ width: `${massBalance.influent > 0 ? (massBalance.solids / massBalance.influent) * 100 : 5}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-sky-400">Water</div>
                  <div className="text-white font-mono">{massBalance.water.toFixed(2)} m³/hr</div>
                </div>
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-amber-400">Oil</div>
                  <div className="text-white font-mono">{massBalance.oil.toFixed(2)} m³/hr</div>
                </div>
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-slate-400">Solids</div>
                  <div className="text-white font-mono">{massBalance.solids.toFixed(2)} m³/hr</div>
                </div>
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-slate-500">Recovery</div>
                  <div className="text-emerald-400 font-mono">
                    {massBalance.influent > 0 ? ((massBalance.water + massBalance.oil + massBalance.solids) / massBalance.influent * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Session Totals */}
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-white font-semibold text-sm mb-3">Session Totals</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Water Produced</span>
                <span className="text-sky-400 font-mono">{totals.waterProduced.toFixed(1)} m³</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Oil Recovered</span>
                <span className="text-amber-400 font-mono">{totals.oilRecovered.toFixed(2)} m³</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Solids Removed</span>
                <span className="text-slate-300 font-mono">{totals.solidsRemoved.toFixed(2)} m³</span>
              </div>
            </div>
          </div>

          {/* Node Details */}
          <div className="flex-1 p-4 overflow-y-auto">
            {selectedNode ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-1.5 py-0.5 rounded text-xs font-mono font-bold bg-slate-600 text-white">{selectedNode}</span>
                    <h4 className="text-white font-semibold mt-2 text-sm">
                      {graph.nodes.find(n => n.id === selectedNode)?.label.replace(/\n/g, ' ')}
                    </h4>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-slate-700 rounded">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="bg-slate-700/50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Status</span>
                    <span className={`font-semibold ${nodeStates[selectedNode]?.status === 'running' ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {nodeStates[selectedNode]?.status?.toUpperCase()}
                    </span>
                  </div>
                  {nodeStates[selectedNode]?.level !== undefined && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Level</span>
                      <span className="text-cyan-400 font-mono">{nodeStates[selectedNode]?.level?.toFixed(1)}%</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Load</span>
                    <span className="text-amber-400 font-mono">{throughput}%</span>
                  </div>
                </div>

                {/* Connected flows */}
                <div>
                  <h5 className="text-slate-300 text-xs font-semibold mb-2">Connected Streams</h5>
                  <div className="space-y-1">
                    {graph.edges.filter(e => e.source === selectedNode || e.target === selectedNode).map(edge => (
                      <div key={edge.id} className="flex items-center justify-between text-xs bg-slate-700/30 rounded px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-0" style={{ borderTop: `2px solid ${STYLES.edge[edge.type].stroke}` }} />
                          <span className="text-slate-300">{edge.label}</span>
                        </div>
                        <span className="text-slate-400 font-mono">{(flowStates[edge.id]?.flow || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-slate-400 text-sm">Click a node to view details</p>
                <p className="text-slate-500 text-xs mt-1">Hover streams to see flow rates</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-700 bg-slate-800/50">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Scroll: Zoom</span>
              <span>Drag: Pan</span>
              <span>Click: Select</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
