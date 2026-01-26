/**
 * FLOW CONNECTION COMPONENT
 * =========================
 * Modern, refined flow lines with smooth animations,
 * gradient strokes, and polished visual effects.
 */

import React, { useMemo } from 'react';
import {
  FlowConnection as ConnectionType,
  getBlockById,
  getConnectionColor,
  getConnectionWidth,
  DIAGRAM_COLORS,
} from './diagramConfig';

interface FlowConnectionProps {
  connection: ConnectionType;
  blockPositions?: Record<string, { x: number; y: number }>;
  isHighlighted?: boolean;
  animationEnabled?: boolean;
  flowRate?: number;
}

export function FlowConnection({
  connection,
  blockPositions,
  isHighlighted = false,
  animationEnabled = true,
  flowRate = 0.5,
}: FlowConnectionProps) {
  const baseFromBlock = getBlockById(connection.from);
  const baseToBlock = getBlockById(connection.to);

  if (!baseFromBlock || !baseToBlock) return null;

  // Apply dynamic positions if provided
  const fromBlock = blockPositions?.[connection.from]
    ? { ...baseFromBlock, x: blockPositions[connection.from].x, y: blockPositions[connection.from].y }
    : baseFromBlock;
  const toBlock = blockPositions?.[connection.to]
    ? { ...baseToBlock, x: blockPositions[connection.to].x, y: blockPositions[connection.to].y }
    : baseToBlock;

  // Calculate connection path
  const path = useMemo(() => {
    return calculatePath(fromBlock, toBlock, connection);
  }, [fromBlock, toBlock, connection]);

  const color = getConnectionColor(connection.type);
  const width = getConnectionWidth(connection.type);
  const gradientId = `flow-gradient-${connection.id}`;
  const glowId = `flow-glow-${connection.id}`;

  // Determine stroke dash pattern
  const getDashArray = () => {
    switch (connection.style) {
      case 'dashed': return '10,6';
      case 'dotted': return '4,6';
      default: return undefined;
    }
  };

  // Animation duration based on flow rate
  const animDuration = Math.max(1.5, 4 - flowRate * 3);

  return (
    <g className="flow-connection">
      {/* Definitions */}
      <defs>
        {/* Gradient for flow line */}
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="50%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.4" />
        </linearGradient>

        {/* Glow filter */}
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background glow for highlighted state */}
      {isHighlighted && (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={width + 6}
          strokeOpacity={0.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `url(#${glowId})` }}
        />
      )}

      {/* Invisible wider path for hit area */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={width + 12}
        className="cursor-pointer"
      />

      {/* Main flow line - base layer */}
      <path
        d={path}
        fill="none"
        stroke={DIAGRAM_COLORS.ui.border}
        strokeWidth={width + 2}
        strokeOpacity={0.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Main flow line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeOpacity={isHighlighted ? 1 : 0.85}
        strokeDasharray={getDashArray()}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-200"
        style={{
          filter: isHighlighted ? `drop-shadow(0 0 6px ${color})` : undefined,
        }}
      />

      {/* Animated flow effect - moving dots */}
      {animationEnabled && connection.animated && (
        <g className="flow-particles">
          {[0, 0.25, 0.5, 0.75].map((offset, i) => (
            <circle
              key={i}
              r={width * 0.6}
              fill="#ffffff"
              opacity={0}
            >
              <animateMotion
                dur={`${animDuration}s`}
                repeatCount="indefinite"
                begin={`${offset * animDuration}s`}
                path={path}
              />
              <animate
                attributeName="opacity"
                values="0;0.9;0.9;0"
                dur={`${animDuration}s`}
                repeatCount="indefinite"
                begin={`${offset * animDuration}s`}
              />
              <animate
                attributeName="r"
                values={`${width * 0.4};${width * 0.7};${width * 0.4}`}
                dur={`${animDuration}s`}
                repeatCount="indefinite"
                begin={`${offset * animDuration}s`}
              />
            </circle>
          ))}
        </g>
      )}

      {/* Dashed line animation */}
      {animationEnabled && connection.style === 'dashed' && (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={width * 0.6}
          strokeOpacity={0.5}
          strokeDasharray="10,6"
          strokeLinecap="round"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="0;32"
            dur={`${animDuration * 1.5}s`}
            repeatCount="indefinite"
          />
        </path>
      )}

      {/* Dotted line animation */}
      {animationEnabled && connection.style === 'dotted' && (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={width * 0.5}
          strokeOpacity={0.4}
          strokeDasharray="4,6"
          strokeLinecap="round"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="0;20"
            dur={`${animDuration * 2}s`}
            repeatCount="indefinite"
          />
        </path>
      )}

      {/* Flow label */}
      {connection.label && (
        <FlowLabel path={path} label={connection.label} color={color} id={connection.id} />
      )}

      {/* Arrow marker at end */}
      <ArrowMarker path={path} color={color} size={width * 2.5} />
    </g>
  );
}

// Calculate SVG path between two blocks
function calculatePath(
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
  connection: ConnectionType
): string {
  // Use custom path if provided
  if (connection.path) {
    return connection.path;
  }

  // Get center points
  const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };

  // Determine exit/entry points based on relative positions
  let startX: number, startY: number, endX: number, endY: number;

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  // Determine which sides to connect
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) {
      startX = from.x + from.width;
      startY = fromCenter.y;
      endX = to.x;
      endY = toCenter.y;
    } else {
      startX = from.x;
      startY = fromCenter.y;
      endX = to.x + to.width;
      endY = toCenter.y;
    }
  } else {
    if (dy > 0) {
      startX = fromCenter.x;
      startY = from.y + from.height;
      endX = toCenter.x;
      endY = to.y;
    } else {
      startX = fromCenter.x;
      startY = from.y;
      endX = toCenter.x;
      endY = to.y + to.height;
    }
  }

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  // For mostly horizontal/vertical lines
  if (Math.abs(startX - endX) < 20) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  } else if (Math.abs(startY - endY) < 20) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  } else {
    // Use rounded corners for L-shaped paths
    const radius = 12;

    if (Math.abs(dx) > Math.abs(dy) * 1.5) {
      // Go horizontal first, then vertical
      const turnY = startY;
      const turnX = midX;

      if (Math.abs(endY - startY) > radius * 2) {
        const dir = endY > startY ? 1 : -1;
        return `M ${startX} ${startY}
                L ${turnX - radius} ${turnY}
                Q ${turnX} ${turnY} ${turnX} ${turnY + radius * dir}
                L ${turnX} ${endY - radius * dir}
                Q ${turnX} ${endY} ${turnX + radius * (endX > turnX ? 1 : -1)} ${endY}
                L ${endX} ${endY}`;
      }
      return `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
    } else if (Math.abs(dy) > Math.abs(dx) * 1.5) {
      // Go vertical first, then horizontal
      const turnX = startX;
      const turnY = midY;

      if (Math.abs(endX - startX) > radius * 2) {
        const dir = endX > startX ? 1 : -1;
        return `M ${startX} ${startY}
                L ${turnX} ${turnY - radius}
                Q ${turnX} ${turnY} ${turnX + radius * dir} ${turnY}
                L ${endX - radius * dir} ${turnY}
                Q ${endX} ${turnY} ${endX} ${turnY + radius * (endY > turnY ? 1 : -1)}
                L ${endX} ${endY}`;
      }
      return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
    } else {
      // Smooth bezier curve for diagonal connections
      const cx1 = startX + dx * 0.4;
      const cy1 = startY;
      const cx2 = endX - dx * 0.4;
      const cy2 = endY;
      return `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`;
    }
  }
}

// Flow label component
function FlowLabel({ path, label, color, id }: { path: string; label: string; color: string; id: string }) {
  const pathId = `label-path-${id}`;

  return (
    <g className="flow-label">
      <defs>
        <path id={pathId} d={path} />
      </defs>
      {/* Label background */}
      <text
        fill={DIAGRAM_COLORS.ui.background}
        fontSize={10}
        fontWeight="700"
        fontFamily="Inter, system-ui, sans-serif"
        dy={-5}
        stroke={DIAGRAM_COLORS.ui.background}
        strokeWidth={3}
        strokeLinejoin="round"
      >
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          {label}
        </textPath>
      </text>
      {/* Label text */}
      <text
        fill={color}
        fontSize={10}
        fontWeight="700"
        fontFamily="Inter, system-ui, sans-serif"
        dy={-5}
      >
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          {label}
        </textPath>
      </text>
    </g>
  );
}

// Arrow marker at end of path
function ArrowMarker({ path, color, size }: { path: string; color: string; size: number }) {
  // Parse path to get end point and direction
  const segments = path.split(/[MLCQ ,\n]/).filter(s => s && !isNaN(parseFloat(s))).map(s => parseFloat(s.trim()));

  if (segments.length < 4) return null;

  const endX = segments[segments.length - 2];
  const endY = segments[segments.length - 1];
  const prevX = segments[segments.length - 4] || segments[0];
  const prevY = segments[segments.length - 3] || segments[1];

  // Calculate angle
  const angle = Math.atan2(endY - prevY, endX - prevX) * (180 / Math.PI);

  return (
    <g transform={`translate(${endX}, ${endY}) rotate(${angle})`}>
      {/* Arrow shadow */}
      <polygon
        points={`-${size * 0.8},-${size / 2.5} 0,0 -${size * 0.8},${size / 2.5}`}
        fill="rgba(0,0,0,0.3)"
        transform="translate(1, 1)"
      />
      {/* Arrow body */}
      <polygon
        points={`-${size * 0.8},-${size / 2.5} 0,0 -${size * 0.8},${size / 2.5}`}
        fill={color}
      />
    </g>
  );
}

export default FlowConnection;
