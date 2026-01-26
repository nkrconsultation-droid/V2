/**
 * NETWORK TOPOLOGY COMPONENT
 * ==========================
 * Visualizes the process flow as a directed network graph
 * with nodes representing equipment and edges showing flow paths.
 * Supports drag-and-drop repositioning of nodes.
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { DIAGRAM_COLORS } from './diagramConfig';

// ═══════════════════════════════════════════════════════════════
// TOPOLOGY DATA TYPES
// ═══════════════════════════════════════════════════════════════
interface TopologyNode {
  id: string;
  label: string;
  shortLabel?: string;
  type: 'input' | 'process' | 'separation' | 'output' | 'storage' | 'utility';
  layer: number;
  position: number;
  metrics?: {
    flow?: number;
    efficiency?: number;
    status?: 'running' | 'idle' | 'warning' | 'error';
  };
}

interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  type: 'main' | 'oil' | 'water' | 'solids' | 'chemical' | 'recirculation';
  flow?: number;
  animated?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// TOPOLOGY CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const TOPOLOGY_NODES: TopologyNode[] = [
  // Layer 0 - Input
  { id: 'feed', label: 'Feed Inlet', shortLabel: 'Feed', type: 'input', layer: 0, position: 1 },
  { id: 'chemicals', label: 'Chemical Dosing', shortLabel: 'Chem', type: 'utility', layer: 0, position: 0 },
  { id: 'flush', label: 'Flush Water', shortLabel: 'Flush', type: 'utility', layer: 0, position: 2 },

  // Layer 1 - Pre-treatment
  { id: 'conditioning', label: 'Feed Conditioning', shortLabel: 'Cond', type: 'process', layer: 1, position: 1 },

  // Layer 2 - Main Processing
  { id: 'inlet-manifold', label: 'Inlet Manifold', shortLabel: 'In-Man', type: 'process', layer: 2, position: 1 },

  // Layer 3 - Separation Stage
  { id: 'primary-sep', label: 'Primary Separation', shortLabel: 'Prim', type: 'separation', layer: 3, position: 0 },
  { id: 'mech-sep', label: 'Mechanical Separation', shortLabel: 'Mech', type: 'separation', layer: 3, position: 1 },
  { id: 'polish-sep', label: 'Polishing Separation', shortLabel: 'Polish', type: 'separation', layer: 3, position: 2 },

  // Layer 4 - Outlet
  { id: 'outlet-manifold', label: 'Outlet Manifold', shortLabel: 'Out-Man', type: 'process', layer: 4, position: 1 },
  { id: 'recirculation', label: 'Recirculation Loop', shortLabel: 'Recirc', type: 'utility', layer: 4, position: 2.5 },

  // Layer 5 - Intermediate Processing
  { id: 'oil-tanks', label: 'Horizontal Tanks', shortLabel: 'H-Tank', type: 'process', layer: 5, position: 0 },
  { id: 'solid-pad', label: 'Fixation Pad', shortLabel: 'Fix', type: 'process', layer: 5, position: 1 },
  { id: 'evap-pond', label: 'Evaporation Pond', shortLabel: 'Evap', type: 'process', layer: 5, position: 2 },

  // Layer 6 - Final Output
  { id: 'recovered-oil', label: 'Recovered Oil', shortLabel: 'Oil', type: 'storage', layer: 6, position: 0 },
  { id: 'dewatered-sludge', label: 'Dewatered Sludge', shortLabel: 'Sludge', type: 'storage', layer: 6, position: 1 },
  { id: 'treated-water', label: 'Treated Water', shortLabel: 'Water', type: 'storage', layer: 6, position: 2 },

  // Layer 7 - Discharge
  { id: 'discharge', label: 'DWER Discharge', shortLabel: 'Disch', type: 'output', layer: 7, position: 2 },
];

const TOPOLOGY_EDGES: TopologyEdge[] = [
  // Feed path
  { id: 'e1', source: 'feed', target: 'conditioning', type: 'main', animated: true },
  { id: 'e2', source: 'chemicals', target: 'conditioning', type: 'chemical' },
  { id: 'e3', source: 'flush', target: 'conditioning', type: 'water' },
  { id: 'e4', source: 'conditioning', target: 'inlet-manifold', type: 'main', animated: true },

  // Distribution
  { id: 'e5', source: 'inlet-manifold', target: 'primary-sep', type: 'main', animated: true },
  { id: 'e6', source: 'inlet-manifold', target: 'mech-sep', type: 'main', animated: true },
  { id: 'e7', source: 'primary-sep', target: 'mech-sep', type: 'main' },
  { id: 'e8', source: 'mech-sep', target: 'polish-sep', type: 'main', animated: true },

  // To outlet
  { id: 'e9', source: 'primary-sep', target: 'outlet-manifold', type: 'main' },
  { id: 'e10', source: 'polish-sep', target: 'outlet-manifold', type: 'main', animated: true },

  // Recirculation
  { id: 'e11', source: 'polish-sep', target: 'recirculation', type: 'recirculation' },
  { id: 'e12', source: 'recirculation', target: 'inlet-manifold', type: 'recirculation' },

  // Three-phase outputs
  { id: 'e13', source: 'outlet-manifold', target: 'oil-tanks', type: 'oil' },
  { id: 'e14', source: 'outlet-manifold', target: 'solid-pad', type: 'solids' },
  { id: 'e15', source: 'outlet-manifold', target: 'evap-pond', type: 'water' },

  // Final outputs
  { id: 'e16', source: 'oil-tanks', target: 'recovered-oil', type: 'oil' },
  { id: 'e17', source: 'solid-pad', target: 'dewatered-sludge', type: 'solids' },
  { id: 'e18', source: 'evap-pond', target: 'treated-water', type: 'water' },

  // Discharge
  { id: 'e19', source: 'treated-water', target: 'discharge', type: 'water' },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT PROPS
// ═══════════════════════════════════════════════════════════════
interface NetworkTopologyProps {
  simulationData?: {
    feedFlow?: number;
    oilEff?: number;
    isRunning?: boolean;
  };
  highlightedPath?: 'oil' | 'water' | 'solids' | null;
  animationEnabled?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT CONSTANTS (2.5x spacing)
// ═══════════════════════════════════════════════════════════════
const LAYOUT = {
  nodeWidth: 140,
  nodeHeight: 60,
  layerSpacing: 400,    // 160 * 2.5 = 400
  verticalSpacing: 200, // 80 * 2.5 = 200
  padding: 80,
};

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function getNodeColor(type: TopologyNode['type']): string {
  switch (type) {
    case 'input': return DIAGRAM_COLORS.feed.primary;
    case 'process': return DIAGRAM_COLORS.process.main;
    case 'separation': return DIAGRAM_COLORS.process.aux;
    case 'output': return DIAGRAM_COLORS.storage.primary;
    case 'storage': return DIAGRAM_COLORS.output.primary;
    case 'utility': return DIAGRAM_COLORS.utility.flush;
    default: return DIAGRAM_COLORS.ui.border;
  }
}

function getEdgeColor(type: TopologyEdge['type']): string {
  switch (type) {
    case 'oil': return DIAGRAM_COLORS.streams.oil;
    case 'water': return DIAGRAM_COLORS.streams.water;
    case 'solids': return DIAGRAM_COLORS.streams.solids;
    case 'chemical': return DIAGRAM_COLORS.streams.chemical;
    case 'recirculation': return '#EF4444';
    default: return DIAGRAM_COLORS.streams.main;
  }
}

// Calculate default positions for nodes
function getDefaultPositions(): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  TOPOLOGY_NODES.forEach(node => {
    const x = LAYOUT.padding + node.layer * LAYOUT.layerSpacing;
    const y = LAYOUT.padding + 80 + node.position * LAYOUT.verticalSpacing;
    positions[node.id] = { x, y };
  });
  return positions;
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export function NetworkTopology({
  simulationData = {},
  highlightedPath = null,
  animationEnabled = true,
}: NetworkTopologyProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Node positions state (for drag and drop)
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>(getDefaultPositions);

  // UI state
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Drag state
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Calculate SVG dimensions based on current positions
  const dimensions = useMemo(() => {
    let maxX = 0;
    let maxY = 0;
    Object.values(nodePositions).forEach(pos => {
      maxX = Math.max(maxX, pos.x + LAYOUT.nodeWidth);
      maxY = Math.max(maxY, pos.y + LAYOUT.nodeHeight);
    });
    return {
      width: Math.max(maxX + LAYOUT.padding * 2, LAYOUT.padding * 2 + 7 * LAYOUT.layerSpacing + LAYOUT.nodeWidth),
      height: Math.max(maxY + LAYOUT.padding + 80, LAYOUT.padding * 2 + 3 * LAYOUT.verticalSpacing + LAYOUT.nodeHeight + 100),
    };
  }, [nodePositions]);

  // Screen to SVG coordinate conversion
  const screenToSVG = useCallback((screenX: number, screenY: number) => {
    if (!svgRef.current) return { x: screenX, y: screenY };
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = screenX;
    pt.y = screenY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: screenX, y: screenY };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  // Drag handlers
  const handleDragStart = useCallback((nodeId: string, e: React.MouseEvent) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    const svgCoords = screenToSVG(e.clientX, e.clientY);
    const nodePos = nodePositions[nodeId];
    setDraggingNode(nodeId);
    setDragOffset({
      x: svgCoords.x - nodePos.x,
      y: svgCoords.y - nodePos.y,
    });
  }, [editMode, screenToSVG, nodePositions]);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!draggingNode) return;
    const svgCoords = screenToSVG(e.clientX, e.clientY);
    setNodePositions(prev => ({
      ...prev,
      [draggingNode]: {
        x: Math.round((svgCoords.x - dragOffset.x) / 20) * 20, // Snap to 20px grid
        y: Math.round((svgCoords.y - dragOffset.y) / 20) * 20,
      },
    }));
  }, [draggingNode, screenToSVG, dragOffset]);

  const handleDragEnd = useCallback(() => {
    setDraggingNode(null);
  }, []);

  // Reset positions
  const handleResetPositions = useCallback(() => {
    setNodePositions(getDefaultPositions());
  }, []);

  // Check if edge should be highlighted
  const isEdgeHighlighted = useCallback((edge: TopologyEdge) => {
    if (hoveredNode) {
      return edge.source === hoveredNode || edge.target === hoveredNode;
    }
    if (highlightedPath) {
      return edge.type === highlightedPath;
    }
    return false;
  }, [hoveredNode, highlightedPath]);

  // Calculate edge path (bezier curve) - uses current node positions
  const getEdgePath = useCallback((edge: TopologyEdge) => {
    const sourcePos = nodePositions[edge.source];
    const targetPos = nodePositions[edge.target];

    if (!sourcePos || !targetPos) return '';

    const sx = sourcePos.x + LAYOUT.nodeWidth;
    const sy = sourcePos.y + LAYOUT.nodeHeight / 2;
    const tx = targetPos.x;
    const ty = targetPos.y + LAYOUT.nodeHeight / 2;

    // Special handling for recirculation (loops back)
    if (edge.type === 'recirculation' && edge.source === 'recirculation') {
      const midY = Math.min(sy, ty) - 100;
      return `M ${sx} ${sy}
              C ${sx + 100} ${sy}, ${sx + 100} ${midY}, ${sourcePos.x + LAYOUT.nodeWidth / 2} ${midY}
              L ${targetPos.x + LAYOUT.nodeWidth / 2} ${midY}
              C ${tx - 100} ${midY}, ${tx - 100} ${ty}, ${tx} ${ty}`;
    }

    // Calculate control point offset based on distance
    const dx = tx - sx;
    const dy = ty - sy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const controlOffset = Math.min(distance * 0.4, 150);

    return `M ${sx} ${sy} C ${sx + controlOffset} ${sy}, ${tx - controlOffset} ${ty}, ${tx} ${ty}`;
  }, [nodePositions]);

  const isRunning = simulationData.isRunning !== false;

  return (
    <div className="relative w-full h-full">
      {/* Edit Mode Controls */}
      <div
        className="absolute top-4 right-4 z-10 flex items-center gap-2"
      >
        <button
          onClick={() => setEditMode(!editMode)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${editMode ? 'ring-2 ring-amber-500' : ''}`}
          style={{
            backgroundColor: editMode ? DIAGRAM_COLORS.ui.warning + '30' : DIAGRAM_COLORS.ui.surface,
            color: editMode ? DIAGRAM_COLORS.ui.warning : DIAGRAM_COLORS.ui.textMuted,
            border: `1px solid ${editMode ? DIAGRAM_COLORS.ui.warning : DIAGRAM_COLORS.ui.border}`,
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span>{editMode ? 'Done' : 'Edit Layout'}</span>
        </button>

        {editMode && (
          <button
            onClick={handleResetPositions}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: DIAGRAM_COLORS.ui.surface,
              color: DIAGRAM_COLORS.ui.textMuted,
              border: `1px solid ${DIAGRAM_COLORS.ui.border}`,
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Edit Mode Indicator */}
      {editMode && (
        <div
          className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: DIAGRAM_COLORS.ui.warning + '20',
            color: DIAGRAM_COLORS.ui.warning,
            border: `1px solid ${DIAGRAM_COLORS.ui.warning}`,
          }}
        >
          Drag nodes to reposition
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="w-full h-full"
        style={{
          minHeight: '600px',
          cursor: draggingNode ? 'grabbing' : 'default',
        }}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        {/* Background */}
        <defs>
          <linearGradient id="topo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={DIAGRAM_COLORS.ui.surface} />
            <stop offset="100%" stopColor={DIAGRAM_COLORS.ui.background} />
          </linearGradient>

          {/* Grid pattern for edit mode */}
          <pattern id="topo-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke={DIAGRAM_COLORS.ui.border}
              strokeWidth="0.5"
              strokeOpacity={0.3}
            />
          </pattern>

          {/* Arrow markers for each edge type */}
          {['main', 'oil', 'water', 'solids', 'chemical', 'recirculation'].map(type => (
            <marker
              key={type}
              id={`arrow-${type}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                fill={getEdgeColor(type as TopologyEdge['type'])}
              />
            </marker>
          ))}

          {/* Glow filter */}
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Drag glow filter */}
          <filter id="drag-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={dimensions.width} height={dimensions.height} fill="url(#topo-bg)" />

        {/* Grid overlay in edit mode */}
        {editMode && (
          <rect width={dimensions.width} height={dimensions.height} fill="url(#topo-grid)" />
        )}

        {/* Layer labels */}
        {[
          { layer: 0, label: 'INPUT' },
          { layer: 1, label: 'PRE-TREAT' },
          { layer: 2, label: 'DISTRIBUTE' },
          { layer: 3, label: 'SEPARATE' },
          { layer: 4, label: 'COLLECT' },
          { layer: 5, label: 'PROCESS' },
          { layer: 6, label: 'STORE' },
          { layer: 7, label: 'OUTPUT' },
        ].map(({ layer, label }) => (
          <text
            key={layer}
            x={LAYOUT.padding + layer * LAYOUT.layerSpacing + LAYOUT.nodeWidth / 2}
            y={40}
            textAnchor="middle"
            fill={DIAGRAM_COLORS.ui.textMuted}
            fontSize={12}
            fontWeight="600"
            fontFamily="Inter, system-ui, sans-serif"
            style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
          >
            {label}
          </text>
        ))}

        {/* Edges */}
        <g className="edges">
          {TOPOLOGY_EDGES.map(edge => {
            const path = getEdgePath(edge);
            const highlighted = isEdgeHighlighted(edge);
            const color = getEdgeColor(edge.type);

            return (
              <g key={edge.id}>
                {/* Edge glow for highlighted */}
                {highlighted && (
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={12}
                    strokeOpacity={0.2}
                    strokeLinecap="round"
                  />
                )}

                {/* Main edge */}
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={highlighted ? 4 : 3}
                  strokeOpacity={highlighted ? 1 : 0.7}
                  strokeLinecap="round"
                  markerEnd={`url(#arrow-${edge.type})`}
                  style={{
                    transition: 'all 0.2s ease',
                    filter: highlighted ? `drop-shadow(0 0 6px ${color})` : undefined,
                  }}
                />

                {/* Animated flow */}
                {animationEnabled && edge.animated && isRunning && !editMode && (
                  <circle r="5" fill="white" opacity="0.8">
                    <animateMotion
                      dur="3s"
                      repeatCount="indefinite"
                      path={path}
                    />
                  </circle>
                )}
              </g>
            );
          })}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {TOPOLOGY_NODES.map(node => {
            const pos = nodePositions[node.id];
            const color = getNodeColor(node.type);
            const isHovered = hoveredNode === node.id;
            const isSelected = selectedNode === node.id;
            const isDragging = draggingNode === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                className={editMode ? 'cursor-grab' : 'cursor-pointer'}
                style={{ cursor: isDragging ? 'grabbing' : editMode ? 'grab' : 'pointer' }}
                onMouseEnter={() => !draggingNode && setHoveredNode(node.id)}
                onMouseLeave={() => !draggingNode && setHoveredNode(null)}
                onClick={() => !editMode && setSelectedNode(selectedNode === node.id ? null : node.id)}
                onMouseDown={(e) => handleDragStart(node.id, e)}
              >
                {/* Edit mode indicator */}
                {editMode && !isDragging && (
                  <rect
                    x={-4}
                    y={-4}
                    width={LAYOUT.nodeWidth + 8}
                    height={LAYOUT.nodeHeight + 8}
                    rx={12}
                    fill="none"
                    stroke={DIAGRAM_COLORS.ui.warning}
                    strokeWidth={1}
                    strokeDasharray="8,4"
                    opacity={0.5}
                  />
                )}

                {/* Node glow */}
                {(isHovered || isSelected || isDragging) && (
                  <rect
                    x={-6}
                    y={-6}
                    width={LAYOUT.nodeWidth + 12}
                    height={LAYOUT.nodeHeight + 12}
                    rx={14}
                    fill="none"
                    stroke={isDragging ? DIAGRAM_COLORS.ui.warning : isSelected ? DIAGRAM_COLORS.ui.accent : 'rgba(255,255,255,0.4)'}
                    strokeWidth={isDragging ? 3 : 2}
                    style={{ filter: isDragging ? 'url(#drag-glow)' : 'url(#node-glow)' }}
                  />
                )}

                {/* Node shadow */}
                <rect
                  x={3}
                  y={3}
                  width={LAYOUT.nodeWidth}
                  height={LAYOUT.nodeHeight}
                  rx={10}
                  fill="rgba(0,0,0,0.4)"
                  style={{
                    transform: isDragging ? 'translate(2px, 2px)' : 'none',
                    transition: isDragging ? 'none' : 'transform 0.2s ease',
                  }}
                />

                {/* Node background */}
                <rect
                  width={LAYOUT.nodeWidth}
                  height={LAYOUT.nodeHeight}
                  rx={10}
                  fill={color}
                  stroke={isDragging ? DIAGRAM_COLORS.ui.warning : isHovered ? '#fff' : 'rgba(255,255,255,0.2)'}
                  strokeWidth={isDragging ? 2 : isHovered ? 2 : 1}
                  style={{
                    transition: isDragging ? 'none' : 'all 0.2s ease',
                    filter: isDragging ? 'brightness(1.15)' : isHovered ? 'brightness(1.1)' : undefined,
                    transform: isDragging ? 'translate(-2px, -2px)' : 'none',
                  }}
                />

                {/* Inner highlight */}
                <rect
                  x={6}
                  y={3}
                  width={LAYOUT.nodeWidth - 12}
                  height={2}
                  rx={1}
                  fill="rgba(255,255,255,0.3)"
                />

                {/* Node label */}
                <text
                  x={LAYOUT.nodeWidth / 2}
                  y={LAYOUT.nodeHeight / 2 - 8}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize={13}
                  fontWeight="600"
                  fontFamily="Inter, system-ui, sans-serif"
                  style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                  {node.shortLabel || node.label}
                </text>

                {/* Node type label */}
                <text
                  x={LAYOUT.nodeWidth / 2}
                  y={LAYOUT.nodeHeight / 2 + 12}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.7)"
                  fontSize={10}
                  fontFamily="Inter, system-ui, sans-serif"
                  style={{ pointerEvents: 'none', textTransform: 'uppercase' }}
                >
                  {node.type}
                </text>

                {/* Status indicator */}
                <circle
                  cx={LAYOUT.nodeWidth - 12}
                  cy={12}
                  r={5}
                  fill={isRunning ? DIAGRAM_COLORS.ui.success : DIAGRAM_COLORS.ui.warning}
                  style={{
                    filter: isRunning ? `drop-shadow(0 0 6px ${DIAGRAM_COLORS.ui.success})` : undefined,
                  }}
                />
              </g>
            );
          })}
        </g>

        {/* Legend */}
        <g transform={`translate(${LAYOUT.padding}, ${dimensions.height - 60})`}>
          <rect
            x={-15}
            y={-15}
            width={680}
            height={50}
            rx={10}
            fill={DIAGRAM_COLORS.ui.surface}
            fillOpacity={0.95}
            stroke={DIAGRAM_COLORS.ui.border}
          />
          <text
            fill={DIAGRAM_COLORS.ui.textMuted}
            fontSize={11}
            fontWeight="600"
            fontFamily="Inter, system-ui, sans-serif"
          >
            FLOW TYPES
          </text>
          {[
            { type: 'main', label: 'Main Flow' },
            { type: 'oil', label: 'Oil' },
            { type: 'water', label: 'Water' },
            { type: 'solids', label: 'Solids' },
            { type: 'chemical', label: 'Chemical' },
            { type: 'recirculation', label: 'Recirc' },
          ].map((item, i) => (
            <g key={item.type} transform={`translate(${i * 105 + 15}, 20)`}>
              <line
                x1={0} y1={0} x2={30} y2={0}
                stroke={getEdgeColor(item.type as TopologyEdge['type'])}
                strokeWidth={4}
                strokeLinecap="round"
              />
              <text
                x={36}
                y={4}
                fill={DIAGRAM_COLORS.ui.text}
                fontSize={11}
                fontFamily="Inter, system-ui, sans-serif"
              >
                {item.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

export default NetworkTopology;
