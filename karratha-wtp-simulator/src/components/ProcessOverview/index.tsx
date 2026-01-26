/**
 * PROCESS OVERVIEW PAGE
 * =====================
 * Interactive block flow diagram showing the complete
 * water treatment process with live data integration.
 *
 * ISA-101 Level 1 Overview Display
 */

import React, { useState, useMemo, useCallback } from 'react';
import { EquipmentBlock } from './EquipmentBlock';
import { FlowConnection } from './FlowConnection';
import {
  EQUIPMENT_BLOCKS,
  FLOW_CONNECTIONS,
  OUTPUT_BOXES,
  DIAGRAM_COLORS,
} from './diagramConfig';
import { HP_HMI_COLORS } from '@/lib/hmi-standards';

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
  // Local state
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [highlightedStream, setHighlightedStream] = useState<'oil' | 'water' | 'solids' | null>(null);

  // Calculate SVG viewBox to fit all blocks
  const viewBox = useMemo(() => {
    const padding = 40;
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;

    EQUIPMENT_BLOCKS.forEach(block => {
      minX = Math.min(minX, block.x);
      minY = Math.min(minY, block.y);
      maxX = Math.max(maxX, block.x + block.width);
      maxY = Math.max(maxY, block.y + block.height);
    });

    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2 + 150, // Extra for output boxes
      height: maxY - minY + padding * 2,
    };
  }, []);

  // Handle block click - navigate to detail view
  const handleBlockClick = useCallback((blockId: string) => {
    setSelectedBlock(blockId);

    // Map block IDs to simulator tabs/routes
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
      // Delay navigation to show selection feedback
      setTimeout(() => onNavigate(tab), 300);
    }
  }, [onNavigate]);

  // Check if connection should be highlighted
  const isConnectionHighlighted = useCallback((conn: typeof FLOW_CONNECTIONS[0]) => {
    if (hoveredBlock) {
      return conn.from === hoveredBlock || conn.to === hoveredBlock;
    }
    if (highlightedStream) {
      return conn.type === highlightedStream;
    }
    return false;
  }, [hoveredBlock, highlightedStream]);

  // Summary metrics
  const metrics = useMemo(() => ({
    feedRate: simulationData.feedFlow?.toFixed(1) || '15.0',
    oilRecovery: simulationData.oilEff?.toFixed(1) || '95.2',
    waterQuality: simulationData.waterQuality?.toFixed(0) || '450',
    massBalance: '99.8',
    operatingCost: '$42.50',
  }), [simulationData]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: HP_HMI_COLORS.background.surface }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{
          backgroundColor: HP_HMI_COLORS.background.secondary,
          borderColor: HP_HMI_COLORS.normal.border,
        }}
      >
        <div className="flex items-center gap-4">
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
              style={{
                backgroundColor: HP_HMI_COLORS.interactive.button,
                color: HP_HMI_COLORS.text.primary,
              }}
            >
              <span>←</span>
              <span>Home</span>
            </button>
          )}
          <div>
            <h1
              className="text-xl font-bold"
              style={{ color: HP_HMI_COLORS.text.emphasis }}
            >
              Process Overview
            </h1>
            <p
              className="text-sm"
              style={{ color: HP_HMI_COLORS.text.secondary }}
            >
              Block Flow Diagram - Karratha WTP
            </p>
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-4">
          {/* Stream Highlight Buttons */}
          <div className="flex items-center gap-2">
            <span
              className="text-sm"
              style={{ color: HP_HMI_COLORS.text.muted }}
            >
              Highlight:
            </span>
            {(['oil', 'water', 'solids'] as const).map((stream) => (
              <button
                key={stream}
                onClick={() => setHighlightedStream(
                  highlightedStream === stream ? null : stream
                )}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  highlightedStream === stream ? 'ring-2 ring-white/50' : ''
                }`}
                style={{
                  backgroundColor: highlightedStream === stream
                    ? DIAGRAM_COLORS.streams[stream]
                    : HP_HMI_COLORS.interactive.button,
                  color: highlightedStream === stream ? '#fff' : HP_HMI_COLORS.text.secondary,
                }}
              >
                {stream.charAt(0).toUpperCase() + stream.slice(1)}
              </button>
            ))}
          </div>

          {/* Animation Toggle */}
          <button
            onClick={() => setAnimationEnabled(!animationEnabled)}
            className="flex items-center gap-2 px-3 py-1 rounded text-sm transition-colors"
            style={{
              backgroundColor: animationEnabled
                ? HP_HMI_COLORS.status.running
                : HP_HMI_COLORS.interactive.button,
              color: animationEnabled ? '#fff' : HP_HMI_COLORS.text.secondary,
            }}
          >
            <span>{animationEnabled ? '⏸' : '▶'}</span>
            <span>Flow Animation</span>
          </button>
        </div>
      </header>

      {/* Main Diagram Area */}
      <main className="flex-1 p-6 overflow-auto">
        <div
          className="rounded-xl border overflow-hidden"
          style={{
            backgroundColor: HP_HMI_COLORS.background.primary,
            borderColor: HP_HMI_COLORS.normal.border,
          }}
        >
          <svg
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            className="w-full h-auto min-h-[500px]"
            style={{ maxHeight: 'calc(100vh - 280px)' }}
          >
            {/* Background Grid */}
            <defs>
              <pattern
                id="grid"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke={HP_HMI_COLORS.normal.border}
                  strokeWidth="0.5"
                  strokeOpacity="0.3"
                />
              </pattern>
            </defs>
            <rect
              x={viewBox.x}
              y={viewBox.y}
              width={viewBox.width}
              height={viewBox.height}
              fill="url(#grid)"
            />

            {/* Flow Connections (render first, below blocks) */}
            <g className="connections">
              {FLOW_CONNECTIONS.map((conn) => (
                <FlowConnection
                  key={conn.id}
                  connection={conn}
                  isHighlighted={isConnectionHighlighted(conn)}
                  animationEnabled={animationEnabled && simulationData.isRunning !== false}
                  flowRate={simulationData.feedFlow ? simulationData.feedFlow / 20 : 0.5}
                />
              ))}
            </g>

            {/* Equipment Blocks */}
            <g className="blocks">
              {EQUIPMENT_BLOCKS.map((block) => (
                <EquipmentBlock
                  key={block.id}
                  block={block}
                  isSelected={selectedBlock === block.id}
                  isHighlighted={hoveredBlock === block.id}
                  data={simulationData}
                  onClick={handleBlockClick}
                  onHover={setHoveredBlock}
                />
              ))}
            </g>

            {/* Output Cost/Info Boxes */}
            <g className="output-boxes">
              {OUTPUT_BOXES.map((box) => (
                <g key={box.id} transform={`translate(${box.x}, ${box.y})`}>
                  <rect
                    width={100}
                    height={box.lines.length * 16 + 8}
                    fill="none"
                    stroke={HP_HMI_COLORS.normal.border}
                    strokeWidth={1}
                    rx={4}
                  />
                  {box.lines.map((line, i) => (
                    <text
                      key={i}
                      x={8}
                      y={16 + i * 16}
                      fill={HP_HMI_COLORS.text.secondary}
                      fontSize={10}
                    >
                      {line.label}
                    </text>
                  ))}
                </g>
              ))}
            </g>

            {/* Legend */}
            <g transform={`translate(${viewBox.x + 20}, ${viewBox.y + viewBox.height - 80})`}>
              <text
                fill={HP_HMI_COLORS.text.muted}
                fontSize={10}
                fontWeight="bold"
              >
                Flow Legend:
              </text>
              {[
                { label: 'Main Process', color: DIAGRAM_COLORS.streams.main },
                { label: 'Oil', color: DIAGRAM_COLORS.streams.oil },
                { label: 'Water', color: DIAGRAM_COLORS.streams.water },
                { label: 'Solids', color: DIAGRAM_COLORS.streams.solids },
                { label: 'Chemicals', color: DIAGRAM_COLORS.streams.chemical },
              ].map((item, i) => (
                <g key={item.label} transform={`translate(${i * 80}, 15)`}>
                  <line
                    x1={0}
                    y1={0}
                    x2={20}
                    y2={0}
                    stroke={item.color}
                    strokeWidth={3}
                  />
                  <text
                    x={25}
                    y={4}
                    fill={HP_HMI_COLORS.text.secondary}
                    fontSize={9}
                  >
                    {item.label}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>
      </main>

      {/* Summary Bar */}
      <footer
        className="px-6 py-4 border-t"
        style={{
          backgroundColor: HP_HMI_COLORS.background.secondary,
          borderColor: HP_HMI_COLORS.normal.border,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <SummaryMetric label="Feed Rate" value={metrics.feedRate} unit="m³/h" />
            <SummaryMetric label="Oil Recovery" value={metrics.oilRecovery} unit="%" status="good" />
            <SummaryMetric label="Water TPH" value={metrics.waterQuality} unit="mg/L" />
            <SummaryMetric label="Mass Balance" value={metrics.massBalance} unit="%" status="good" />
            <SummaryMetric label="Op. Cost" value={metrics.operatingCost} unit="/hr" />
          </div>

          <div className="flex items-center gap-4">
            <div
              className="flex items-center gap-2 px-3 py-1 rounded"
              style={{ backgroundColor: HP_HMI_COLORS.status.running + '20' }}
            >
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: HP_HMI_COLORS.status.running }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: HP_HMI_COLORS.status.running }}
              >
                System Running
              </span>
            </div>

            <button
              onClick={() => onNavigate?.('simulator')}
              className="px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: HP_HMI_COLORS.interactive.buttonActive,
                color: '#fff',
              }}
            >
              Open Full Simulator →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Summary metric component
function SummaryMetric({
  label,
  value,
  unit,
  status,
}: {
  label: string;
  value: string;
  unit: string;
  status?: 'good' | 'warning' | 'alarm';
}) {
  const valueColor = status === 'good'
    ? HP_HMI_COLORS.status.running
    : status === 'warning'
    ? HP_HMI_COLORS.abnormal.medium
    : status === 'alarm'
    ? HP_HMI_COLORS.abnormal.critical
    : HP_HMI_COLORS.text.emphasis;

  return (
    <div className="flex items-baseline gap-2">
      <span
        className="text-sm"
        style={{ color: HP_HMI_COLORS.text.muted }}
      >
        {label}:
      </span>
      <span
        className="font-mono font-bold"
        style={{ color: valueColor }}
      >
        {value}
      </span>
      <span
        className="text-xs"
        style={{ color: HP_HMI_COLORS.text.secondary }}
      >
        {unit}
      </span>
    </div>
  );
}

export { ProcessOverview };
