/**
 * PROCESS OVERVIEW PAGE
 * =====================
 * Modern, refined interactive block flow diagram showing
 * the complete water treatment process with live data.
 *
 * Features:
 * - Sleek dark theme design
 * - Gradient-filled equipment blocks
 * - Smooth flow animations
 * - Drag-and-drop repositioning
 * - Stream highlighting
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { EquipmentBlock } from './EquipmentBlock';
import { FlowConnection } from './FlowConnection';
import { NetworkTopology } from './NetworkTopology';
import {
  EQUIPMENT_BLOCKS,
  FLOW_CONNECTIONS,
  OUTPUT_BOXES,
  DIAGRAM_COLORS,
  EquipmentBlock as BlockType,
} from './diagramConfig';

interface ProcessOverviewProps {
  onNavigate?: (destination: string) => void;
  onBackToHome?: () => void;
  simulationData?: {
    feedFlow?: number;
    bowlSpeed?: number;
    oilEff?: number;
    waterQuality?: number;
    oilVolume?: number;
    cakeDryness?: number;
    demulsifierRate?: number;
    isRunning?: boolean;
  };
}

export default function ProcessOverview({
  onNavigate,
  onBackToHome,
  simulationData = {},
}: ProcessOverviewProps) {
  // Block positions state
  const [blockPositions, setBlockPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    EQUIPMENT_BLOCKS.forEach(block => {
      positions[block.id] = { x: block.x, y: block.y };
    });
    return positions;
  });

  // UI state
  const [viewMode, setViewMode] = useState<'block' | 'topology'>('block');
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [highlightedStream, setHighlightedStream] = useState<'oil' | 'water' | 'solids' | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Drag state
  const [draggingBlock, setDraggingBlock] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Get blocks with current positions
  const blocksWithPositions = useMemo(() => {
    return EQUIPMENT_BLOCKS.map(block => ({
      ...block,
      x: blockPositions[block.id]?.x ?? block.x,
      y: blockPositions[block.id]?.y ?? block.y,
    }));
  }, [blockPositions]);

  // Calculate SVG viewBox
  const viewBox = useMemo(() => {
    const padding = 50;
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;

    blocksWithPositions.forEach(block => {
      minX = Math.min(minX, block.x);
      minY = Math.min(minY, block.y);
      maxX = Math.max(maxX, block.x + block.width);
      maxY = Math.max(maxY, block.y + block.height);
    });

    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2 + 200,
      height: maxY - minY + padding * 2,
    };
  }, [blocksWithPositions]);

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
  const handleDragStart = useCallback((blockId: string, e: React.MouseEvent) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    const svgCoords = screenToSVG(e.clientX, e.clientY);
    const blockPos = blockPositions[blockId];
    setDraggingBlock(blockId);
    setDragOffset({
      x: svgCoords.x - blockPos.x,
      y: svgCoords.y - blockPos.y,
    });
  }, [editMode, screenToSVG, blockPositions]);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!draggingBlock) return;
    const svgCoords = screenToSVG(e.clientX, e.clientY);
    setBlockPositions(prev => ({
      ...prev,
      [draggingBlock]: {
        x: Math.round((svgCoords.x - dragOffset.x) / 10) * 10,
        y: Math.round((svgCoords.y - dragOffset.y) / 10) * 10,
      },
    }));
  }, [draggingBlock, screenToSVG, dragOffset]);

  const handleDragEnd = useCallback(() => {
    setDraggingBlock(null);
  }, []);

  // Block click handler
  const handleBlockClick = useCallback((blockId: string) => {
    if (editMode) return;
    setSelectedBlock(blockId);

    const blockToTab: Record<string, string> = {
      'FEED-01': 'feed',
      'PRE-01': 'feed',
      'PRIM-01': 'centrifuge',
      'MECH-01': 'centrifuge',
      'POLISH-01': 'centrifuge',
      'CHEM-01': 'chemDosing',
      'HTANK-01': 'tankage',
      'EVAP-01': 'feed',
    };

    const tab = blockToTab[blockId];
    if (tab && onNavigate) {
      setTimeout(() => onNavigate(tab), 300);
    }
  }, [onNavigate, editMode]);

  // Connection highlight check
  const isConnectionHighlighted = useCallback((conn: typeof FLOW_CONNECTIONS[0]) => {
    if (hoveredBlock) {
      return conn.from === hoveredBlock || conn.to === hoveredBlock;
    }
    if (highlightedStream) {
      return conn.type === highlightedStream;
    }
    return false;
  }, [hoveredBlock, highlightedStream]);

  // Reset positions
  const handleResetPositions = useCallback(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    EQUIPMENT_BLOCKS.forEach(block => {
      positions[block.id] = { x: block.x, y: block.y };
    });
    setBlockPositions(positions);
  }, []);

  // Summary metrics
  const metrics = useMemo(() => ({
    feedRate: simulationData.feedFlow?.toFixed(1) || '15.0',
    oilRecovery: simulationData.oilEff?.toFixed(1) || '95.2',
    waterQuality: simulationData.waterQuality?.toFixed(0) || '450',
    massBalance: '99.8',
    operatingCost: '$42.50',
  }), [simulationData]);

  const isRunning = simulationData.isRunning !== false;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: DIAGRAM_COLORS.ui.background }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b backdrop-blur-sm"
        style={{
          backgroundColor: `${DIAGRAM_COLORS.ui.surface}cc`,
          borderColor: DIAGRAM_COLORS.ui.border,
        }}
      >
        <div className="flex items-center gap-4">
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all hover:scale-105"
              style={{
                backgroundColor: DIAGRAM_COLORS.ui.surface,
                color: DIAGRAM_COLORS.ui.text,
                border: `1px solid ${DIAGRAM_COLORS.ui.border}`,
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Home</span>
            </button>
          )}
          <div>
            <h1
              className="text-xl font-bold tracking-tight"
              style={{ color: DIAGRAM_COLORS.ui.text }}
            >
              Process Overview
            </h1>
            <p
              className="text-sm"
              style={{ color: DIAGRAM_COLORS.ui.textMuted }}
            >
              Karratha WTP Block Flow Diagram
              {editMode && (
                <span
                  className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                  style={{ backgroundColor: DIAGRAM_COLORS.ui.warning + '30', color: DIAGRAM_COLORS.ui.warning }}
                >
                  Edit Mode
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: `1px solid ${DIAGRAM_COLORS.ui.border}` }}
          >
            <button
              onClick={() => setViewMode('block')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all"
              style={{
                backgroundColor: viewMode === 'block' ? DIAGRAM_COLORS.ui.accent : DIAGRAM_COLORS.ui.surface,
                color: viewMode === 'block' ? '#fff' : DIAGRAM_COLORS.ui.textMuted,
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Block
            </button>
            <button
              onClick={() => setViewMode('topology')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all"
              style={{
                backgroundColor: viewMode === 'topology' ? DIAGRAM_COLORS.ui.accent : DIAGRAM_COLORS.ui.surface,
                color: viewMode === 'topology' ? '#fff' : DIAGRAM_COLORS.ui.textMuted,
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Topology
            </button>
          </div>

          <div className="w-px h-6" style={{ backgroundColor: DIAGRAM_COLORS.ui.border }} />

          {/* Edit Mode - only show for block view */}
          {viewMode === 'block' && (
          <>
          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${editMode ? 'ring-2 ring-amber-500' : ''}`}
            style={{
              backgroundColor: editMode ? DIAGRAM_COLORS.ui.warning + '20' : DIAGRAM_COLORS.ui.surface,
              color: editMode ? DIAGRAM_COLORS.ui.warning : DIAGRAM_COLORS.ui.textMuted,
              border: `1px solid ${editMode ? DIAGRAM_COLORS.ui.warning : DIAGRAM_COLORS.ui.border}`,
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>{editMode ? 'Done' : 'Edit'}</span>
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
          </>
          )}

          <div className="w-px h-6" style={{ backgroundColor: DIAGRAM_COLORS.ui.border }} />

          {/* Stream Filters */}
          <div className="flex items-center gap-1.5">
            {(['oil', 'water', 'solids'] as const).map((stream) => {
              const streamColors = {
                oil: DIAGRAM_COLORS.streams.oil,
                water: DIAGRAM_COLORS.streams.water,
                solids: DIAGRAM_COLORS.streams.solids,
              };
              const isActive = highlightedStream === stream;
              const ringClass = isActive
                ? stream === 'oil' ? 'ring-2 ring-offset-1 ring-amber-600'
                : stream === 'water' ? 'ring-2 ring-offset-1 ring-blue-500'
                : 'ring-2 ring-offset-1 ring-gray-500'
                : '';
              return (
                <button
                  key={stream}
                  onClick={() => setHighlightedStream(isActive ? null : stream)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide transition-all ${ringClass}`}
                  style={{
                    backgroundColor: isActive ? streamColors[stream] : DIAGRAM_COLORS.ui.surface,
                    color: isActive ? '#fff' : DIAGRAM_COLORS.ui.textMuted,
                    border: `1px solid ${isActive ? streamColors[stream] : DIAGRAM_COLORS.ui.border}`,
                  }}
                >
                  {stream}
                </button>
              );
            })}
          </div>

          <div className="w-px h-6" style={{ backgroundColor: DIAGRAM_COLORS.ui.border }} />

          {/* Animation Toggle */}
          <button
            onClick={() => setAnimationEnabled(!animationEnabled)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: animationEnabled ? DIAGRAM_COLORS.ui.accent + '20' : DIAGRAM_COLORS.ui.surface,
              color: animationEnabled ? DIAGRAM_COLORS.ui.accent : DIAGRAM_COLORS.ui.textMuted,
              border: `1px solid ${animationEnabled ? DIAGRAM_COLORS.ui.accent : DIAGRAM_COLORS.ui.border}`,
            }}
          >
            {animationEnabled ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
            <span>Flow</span>
          </button>
        </div>
      </header>

      {/* Main Diagram */}
      <main className="flex-1 p-4 overflow-auto">
        <div
          className="rounded-xl overflow-hidden h-full"
          style={{
            backgroundColor: DIAGRAM_COLORS.ui.surface,
            border: `1px solid ${editMode && viewMode === 'block' ? DIAGRAM_COLORS.ui.warning : DIAGRAM_COLORS.ui.border}`,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.2)',
          }}
        >
          {/* Network Topology View */}
          {viewMode === 'topology' && (
            <NetworkTopology
              simulationData={simulationData}
              highlightedPath={highlightedStream}
              animationEnabled={animationEnabled}
            />
          )}

          {/* Block Diagram View */}
          {viewMode === 'block' && (
          <svg
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            className="w-full h-full"
            style={{
              minHeight: '500px',
              maxHeight: 'calc(100vh - 260px)',
              cursor: draggingBlock ? 'grabbing' : editMode ? 'default' : 'default',
            }}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
          >
            {/* Background */}
            <defs>
              <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke={DIAGRAM_COLORS.ui.border}
                  strokeWidth="0.5"
                  strokeOpacity={editMode ? 0.4 : 0.2}
                />
              </pattern>
              <radialGradient id="bg-gradient" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor={DIAGRAM_COLORS.ui.surface} />
                <stop offset="100%" stopColor={DIAGRAM_COLORS.ui.background} />
              </radialGradient>
            </defs>

            <rect
              x={viewBox.x}
              y={viewBox.y}
              width={viewBox.width}
              height={viewBox.height}
              fill="url(#bg-gradient)"
            />
            <rect
              x={viewBox.x}
              y={viewBox.y}
              width={viewBox.width}
              height={viewBox.height}
              fill="url(#grid-pattern)"
            />

            {/* Flow Connections */}
            <g className="connections">
              {FLOW_CONNECTIONS.map((conn) => (
                <FlowConnection
                  key={conn.id}
                  connection={conn}
                  blockPositions={blockPositions}
                  isHighlighted={isConnectionHighlighted(conn)}
                  animationEnabled={animationEnabled && isRunning && !editMode}
                  flowRate={simulationData.feedFlow ? simulationData.feedFlow / 20 : 0.5}
                />
              ))}
            </g>

            {/* Equipment Blocks */}
            <g className="blocks">
              {blocksWithPositions.map((block) => (
                <EquipmentBlock
                  key={block.id}
                  block={block}
                  isSelected={selectedBlock === block.id}
                  isHighlighted={hoveredBlock === block.id}
                  isDragging={draggingBlock === block.id}
                  editMode={editMode}
                  data={simulationData}
                  onClick={handleBlockClick}
                  onHover={setHoveredBlock}
                  onDragStart={handleDragStart}
                />
              ))}
            </g>

            {/* Output Info Boxes */}
            <g className="output-boxes">
              {OUTPUT_BOXES.map((box) => (
                <g key={box.id} transform={`translate(${box.x}, ${box.y})`}>
                  <rect
                    width={130}
                    height={box.lines.length * 20 + 16}
                    rx={6}
                    fill={DIAGRAM_COLORS.ui.surface}
                    stroke={DIAGRAM_COLORS.ui.border}
                    strokeWidth={1}
                  />
                  {box.lines.map((line, i) => (
                    <text
                      key={i}
                      x={12}
                      y={22 + i * 20}
                      fill={DIAGRAM_COLORS.ui.textMuted}
                      fontSize={11}
                      fontFamily="Inter, system-ui, sans-serif"
                    >
                      {line.label}
                    </text>
                  ))}
                </g>
              ))}
            </g>

            {/* Legend */}
            <g transform={`translate(${viewBox.x + 30}, ${viewBox.y + viewBox.height - 60})`}>
              <rect
                x={-15}
                y={-15}
                width={520}
                height={50}
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
                style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                FLOW LEGEND
              </text>
              {[
                { label: 'Main', color: DIAGRAM_COLORS.streams.main },
                { label: 'Oil', color: DIAGRAM_COLORS.streams.oil },
                { label: 'Water', color: DIAGRAM_COLORS.streams.water },
                { label: 'Solids', color: DIAGRAM_COLORS.streams.solids },
                { label: 'Chemical', color: DIAGRAM_COLORS.streams.chemical },
              ].map((item, i) => (
                <g key={item.label} transform={`translate(${i * 95 + 10}, 22)`}>
                  <line x1={0} y1={0} x2={28} y2={0} stroke={item.color} strokeWidth={3} strokeLinecap="round" />
                  <text x={34} y={4} fill={DIAGRAM_COLORS.ui.text} fontSize={11} fontFamily="Inter, system-ui, sans-serif">
                    {item.label}
                  </text>
                </g>
              ))}
            </g>
          </svg>
          )}
        </div>
      </main>

      {/* Footer Metrics */}
      <footer
        className="px-6 py-4 border-t backdrop-blur-sm"
        style={{
          backgroundColor: `${DIAGRAM_COLORS.ui.surface}cc`,
          borderColor: DIAGRAM_COLORS.ui.border,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <MetricCard label="Feed Rate" value={metrics.feedRate} unit="m³/h" />
            <MetricCard label="Oil Recovery" value={metrics.oilRecovery} unit="%" status="success" />
            <MetricCard label="Water TPH" value={metrics.waterQuality} unit="mg/L" />
            <MetricCard label="Mass Balance" value={metrics.massBalance} unit="%" status="success" />
            <MetricCard label="Op. Cost" value={metrics.operatingCost} unit="/hr" />
          </div>

          <div className="flex items-center gap-4">
            {/* Status Indicator */}
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-lg"
              style={{
                backgroundColor: isRunning ? DIAGRAM_COLORS.ui.success + '15' : DIAGRAM_COLORS.ui.error + '15',
                border: `1px solid ${isRunning ? DIAGRAM_COLORS.ui.success + '40' : DIAGRAM_COLORS.ui.error + '40'}`,
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: isRunning ? DIAGRAM_COLORS.ui.success : DIAGRAM_COLORS.ui.error,
                  boxShadow: `0 0 8px ${isRunning ? DIAGRAM_COLORS.ui.success : DIAGRAM_COLORS.ui.error}`,
                  animation: isRunning ? 'pulse 2s infinite' : undefined,
                }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: isRunning ? DIAGRAM_COLORS.ui.success : DIAGRAM_COLORS.ui.error }}
              >
                {isRunning ? 'System Running' : 'System Stopped'}
              </span>
            </div>

            {/* Simulator Button */}
            <button
              onClick={() => onNavigate?.('simulator')}
              className="px-5 py-2.5 rounded-lg font-semibold transition-all hover:scale-105"
              style={{
                background: `linear-gradient(135deg, ${DIAGRAM_COLORS.ui.accent}, ${DIAGRAM_COLORS.process.main})`,
                color: '#fff',
                boxShadow: `0 4px 14px ${DIAGRAM_COLORS.ui.accent}40`,
              }}
            >
              Open Simulator
            </button>
          </div>
        </div>
      </footer>

      {/* Pulse animation style */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// Metric card component
function MetricCard({
  label,
  value,
  unit,
  status,
}: {
  label: string;
  value: string;
  unit: string;
  status?: 'success' | 'warning' | 'error';
}) {
  const valueColor = status === 'success'
    ? DIAGRAM_COLORS.ui.success
    : status === 'warning'
    ? DIAGRAM_COLORS.ui.warning
    : status === 'error'
    ? DIAGRAM_COLORS.ui.error
    : DIAGRAM_COLORS.ui.text;

  return (
    <div
      className="px-4 py-2 rounded-lg"
      style={{
        backgroundColor: DIAGRAM_COLORS.ui.surface,
        border: `1px solid ${DIAGRAM_COLORS.ui.border}`,
      }}
    >
      <div
        className="text-xs font-medium uppercase tracking-wide mb-1"
        style={{ color: DIAGRAM_COLORS.ui.textMuted }}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="text-lg font-bold font-mono"
          style={{ color: valueColor }}
        >
          {value}
        </span>
        <span
          className="text-xs"
          style={{ color: DIAGRAM_COLORS.ui.textMuted }}
        >
          {unit}
        </span>
      </div>
    </div>
  );
}

export { ProcessOverview };
