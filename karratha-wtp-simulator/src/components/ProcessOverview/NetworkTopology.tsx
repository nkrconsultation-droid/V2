/**
 * NETWORK TOPOLOGY COMPONENT
 * ==========================
 * Visualizes the process flow as a directed network graph
 * with nodes representing equipment and edges showing flow paths.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { DIAGRAM_COLORS } from './diagramConfig';

// ═══════════════════════════════════════════════════════════════
// TOPOLOGY DATA TYPES
// ═══════════════════════════════════════════════════════════════
interface TopologyNode {
  id: string;
  label: string;
  shortLabel?: string;
  type: 'input' | 'process' | 'separation' | 'output' | 'storage' | 'utility';
  layer: number; // Horizontal layer (0 = leftmost)
  position: number; // Vertical position within layer
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
// LAYOUT CONSTANTS
// ═══════════════════════════════════════════════════════════════
const LAYOUT = {
  nodeWidth: 120,
  nodeHeight: 50,
  layerSpacing: 160,
  verticalSpacing: 80,
  padding: 60,
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

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export function NetworkTopology({
  simulationData = {},
  highlightedPath = null,
  animationEnabled = true,
}: NetworkTopologyProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Calculate node positions
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const layerCounts: Record<number, number> = {};

    // Count nodes per layer
    TOPOLOGY_NODES.forEach(node => {
      layerCounts[node.layer] = (layerCounts[node.layer] || 0) + 1;
    });

    TOPOLOGY_NODES.forEach(node => {
      const x = LAYOUT.padding + node.layer * LAYOUT.layerSpacing;
      const layerHeight = (layerCounts[node.layer] - 1) * LAYOUT.verticalSpacing;
      const y = LAYOUT.padding + 100 + node.position * LAYOUT.verticalSpacing;
      positions[node.id] = { x, y };
    });

    return positions;
  }, []);

  // Calculate SVG dimensions
  const dimensions = useMemo(() => {
    const maxLayer = Math.max(...TOPOLOGY_NODES.map(n => n.layer));
    const maxPosition = Math.max(...TOPOLOGY_NODES.map(n => n.position));
    return {
      width: LAYOUT.padding * 2 + maxLayer * LAYOUT.layerSpacing + LAYOUT.nodeWidth,
      height: LAYOUT.padding * 2 + (maxPosition + 1) * LAYOUT.verticalSpacing + LAYOUT.nodeHeight + 100,
    };
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

  // Calculate edge path (bezier curve)
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
      const midY = Math.min(sy, ty) - 40;
      return `M ${sx} ${sy}
              C ${sx + 50} ${sy}, ${sx + 50} ${midY}, ${sourcePos.x + LAYOUT.nodeWidth / 2} ${midY}
              L ${targetPos.x + LAYOUT.nodeWidth / 2} ${midY}
              C ${tx - 50} ${midY}, ${tx - 50} ${ty}, ${tx} ${ty}`;
    }

    // Normal bezier curve
    const dx = tx - sx;
    const controlOffset = Math.min(Math.abs(dx) * 0.4, 60);

    return `M ${sx} ${sy} C ${sx + controlOffset} ${sy}, ${tx - controlOffset} ${ty}, ${tx} ${ty}`;
  }, [nodePositions]);

  const isRunning = simulationData.isRunning !== false;

  return (
    <svg
      viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    >
      {/* Background */}
      <defs>
        <linearGradient id="topo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={DIAGRAM_COLORS.ui.surface} />
          <stop offset="100%" stopColor={DIAGRAM_COLORS.ui.background} />
        </linearGradient>

        {/* Arrow markers for each edge type */}
        {['main', 'oil', 'water', 'solids', 'chemical', 'recirculation'].map(type => (
          <marker
            key={type}
            id={`arrow-${type}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
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
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Flow animation pattern */}
        <pattern id="flow-dots" patternUnits="userSpaceOnUse" width="20" height="20">
          <circle cx="10" cy="10" r="2" fill="white" opacity="0.6">
            <animate
              attributeName="opacity"
              values="0.6;0.2;0.6"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
        </pattern>
      </defs>

      <rect width={dimensions.width} height={dimensions.height} fill="url(#topo-bg)" />

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
          y={30}
          textAnchor="middle"
          fill={DIAGRAM_COLORS.ui.textMuted}
          fontSize={10}
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
                  strokeWidth={8}
                  strokeOpacity={0.2}
                  strokeLinecap="round"
                />
              )}

              {/* Main edge */}
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={highlighted ? 3 : 2}
                strokeOpacity={highlighted ? 1 : 0.7}
                strokeLinecap="round"
                markerEnd={`url(#arrow-${edge.type})`}
                style={{
                  transition: 'all 0.2s ease',
                  filter: highlighted ? `drop-shadow(0 0 4px ${color})` : undefined,
                }}
              />

              {/* Animated flow */}
              {animationEnabled && edge.animated && isRunning && (
                <circle r="3" fill="white" opacity="0.8">
                  <animateMotion
                    dur="2s"
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

          return (
            <g
              key={node.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
            >
              {/* Node glow */}
              {(isHovered || isSelected) && (
                <rect
                  x={-4}
                  y={-4}
                  width={LAYOUT.nodeWidth + 8}
                  height={LAYOUT.nodeHeight + 8}
                  rx={12}
                  fill="none"
                  stroke={isSelected ? DIAGRAM_COLORS.ui.accent : 'rgba(255,255,255,0.4)'}
                  strokeWidth={2}
                  style={{ filter: 'url(#node-glow)' }}
                />
              )}

              {/* Node shadow */}
              <rect
                x={2}
                y={2}
                width={LAYOUT.nodeWidth}
                height={LAYOUT.nodeHeight}
                rx={8}
                fill="rgba(0,0,0,0.3)"
              />

              {/* Node background */}
              <rect
                width={LAYOUT.nodeWidth}
                height={LAYOUT.nodeHeight}
                rx={8}
                fill={color}
                stroke={isHovered ? '#fff' : 'rgba(255,255,255,0.2)'}
                strokeWidth={isHovered ? 2 : 1}
                style={{
                  transition: 'all 0.2s ease',
                  filter: isHovered ? 'brightness(1.1)' : undefined,
                }}
              />

              {/* Inner highlight */}
              <rect
                x={4}
                y={2}
                width={LAYOUT.nodeWidth - 8}
                height={1}
                rx={0.5}
                fill="rgba(255,255,255,0.3)"
              />

              {/* Node label */}
              <text
                x={LAYOUT.nodeWidth / 2}
                y={LAYOUT.nodeHeight / 2 - 6}
                textAnchor="middle"
                fill="#fff"
                fontSize={11}
                fontWeight="600"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {node.shortLabel || node.label}
              </text>

              {/* Node type label */}
              <text
                x={LAYOUT.nodeWidth / 2}
                y={LAYOUT.nodeHeight / 2 + 10}
                textAnchor="middle"
                fill="rgba(255,255,255,0.7)"
                fontSize={8}
                fontFamily="Inter, system-ui, sans-serif"
                style={{ textTransform: 'uppercase' }}
              >
                {node.type}
              </text>

              {/* Status indicator */}
              <circle
                cx={LAYOUT.nodeWidth - 10}
                cy={10}
                r={4}
                fill={isRunning ? DIAGRAM_COLORS.ui.success : DIAGRAM_COLORS.ui.warning}
                style={{
                  filter: isRunning ? `drop-shadow(0 0 4px ${DIAGRAM_COLORS.ui.success})` : undefined,
                }}
              />
            </g>
          );
        })}
      </g>

      {/* Legend */}
      <g transform={`translate(${LAYOUT.padding}, ${dimensions.height - 50})`}>
        <rect
          x={-10}
          y={-15}
          width={600}
          height={45}
          rx={8}
          fill={DIAGRAM_COLORS.ui.surface}
          fillOpacity={0.9}
          stroke={DIAGRAM_COLORS.ui.border}
        />
        <text
          fill={DIAGRAM_COLORS.ui.textMuted}
          fontSize={10}
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
          <g key={item.type} transform={`translate(${i * 95 + 10}, 18)`}>
            <line
              x1={0} y1={0} x2={25} y2={0}
              stroke={getEdgeColor(item.type as TopologyEdge['type'])}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <text
              x={30}
              y={4}
              fill={DIAGRAM_COLORS.ui.text}
              fontSize={10}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {item.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

export default NetworkTopology;
