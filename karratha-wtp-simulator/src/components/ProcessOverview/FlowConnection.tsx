/**
 * FLOW CONNECTION COMPONENT
 * =========================
 * Renders animated flow lines between equipment blocks.
 * Supports different line styles and stream types.
 */

import React, { useMemo } from 'react';
import {
  FlowConnection as ConnectionType,
  getBlockById,
  getConnectionColor,
  getConnectionWidth,
} from './diagramConfig';

interface FlowConnectionProps {
  connection: ConnectionType;
  isHighlighted?: boolean;
  animationEnabled?: boolean;
  flowRate?: number; // 0-1 for animation speed scaling
}

export function FlowConnection({
  connection,
  isHighlighted = false,
  animationEnabled = true,
  flowRate = 0.5,
}: FlowConnectionProps) {
  const fromBlock = getBlockById(connection.from);
  const toBlock = getBlockById(connection.to);

  if (!fromBlock || !toBlock) return null;

  // Calculate connection points
  const path = useMemo(() => {
    return calculatePath(fromBlock, toBlock, connection);
  }, [fromBlock, toBlock, connection]);

  const color = getConnectionColor(connection.type);
  const width = getConnectionWidth(connection.type);
  const opacity = isHighlighted ? 1 : 0.8;

  // Determine stroke dash pattern
  const getDashArray = () => {
    switch (connection.style) {
      case 'dashed': return '8,4';
      case 'dotted': return '4,4';
      default: return undefined;
    }
  };

  // Animation duration based on flow rate
  const animDuration = Math.max(1, 3 - flowRate * 2);

  return (
    <g className="flow-connection">
      {/* Background line (wider, for click area) */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={width + 8}
        className="cursor-pointer"
      />

      {/* Main flow line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeOpacity={opacity}
        strokeDasharray={getDashArray()}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-300"
        style={{
          filter: isHighlighted ? `drop-shadow(0 0 4px ${color})` : undefined,
        }}
      />

      {/* Animated flow particles */}
      {animationEnabled && connection.animated && (
        <g className="flow-animation">
          {[0, 0.33, 0.66].map((offset, i) => (
            <circle
              key={i}
              r={width * 0.8}
              fill={color}
              opacity={0.9}
            >
              <animateMotion
                dur={`${animDuration}s`}
                repeatCount="indefinite"
                begin={`${offset * animDuration}s`}
                path={path}
              />
            </circle>
          ))}
        </g>
      )}

      {/* Dashed line animation (for chemical/recirculation) */}
      {animationEnabled && connection.style === 'dashed' && (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeOpacity={0.6}
          strokeDasharray="8,4"
          strokeLinecap="round"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="0;24"
            dur={`${animDuration * 2}s`}
            repeatCount="indefinite"
          />
        </path>
      )}

      {/* Flow label */}
      {connection.label && (
        <FlowLabel path={path} label={connection.label} color={color} />
      )}

      {/* Arrow marker at the end */}
      <ArrowMarker path={path} color={color} size={width * 2} />
    </g>
  );
}

// Calculate SVG path between two blocks
function calculatePath(
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
  connection: ConnectionType
): string {
  // Get center points
  const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };

  // Determine exit/entry points based on relative positions
  let startX: number, startY: number, endX: number, endY: number;

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  // Determine which sides to connect
  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal-dominant connection
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
    // Vertical-dominant connection
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

  // Use custom path if provided
  if (connection.path) {
    return connection.path;
  }

  // Create smooth bezier curve or straight line with corners
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  // For mostly horizontal/vertical lines, use right-angle paths
  if (Math.abs(startX - endX) < 20) {
    // Nearly vertical
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  } else if (Math.abs(startY - endY) < 20) {
    // Nearly horizontal
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  } else {
    // Use L-shaped or smooth curve
    // Determine best path style
    if (Math.abs(dx) > Math.abs(dy) * 2) {
      // Go horizontal first, then vertical
      return `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
    } else if (Math.abs(dy) > Math.abs(dx) * 2) {
      // Go vertical first, then horizontal
      return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
    } else {
      // Use bezier curve for diagonal
      const cx1 = startX + dx * 0.5;
      const cy1 = startY;
      const cx2 = endX - dx * 0.5;
      const cy2 = endY;
      return `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`;
    }
  }
}

// Flow label component
function FlowLabel({ path, label, color }: { path: string; label: string; color: string }) {
  const id = `label-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <g>
      <defs>
        <path id={id} d={path} />
      </defs>
      <text
        fill={color}
        fontSize={10}
        fontWeight="bold"
        dy={-6}
      >
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {label}
        </textPath>
      </text>
    </g>
  );
}

// Arrow marker at end of path
function ArrowMarker({ path, color, size }: { path: string; color: string; size: number }) {
  // Parse path to get end point and direction
  const segments = path.split(/[ML C,]/).filter(Boolean).map(s => parseFloat(s.trim()));

  if (segments.length < 4) return null;

  const endX = segments[segments.length - 2];
  const endY = segments[segments.length - 1];
  const prevX = segments[segments.length - 4] || segments[segments.length - 2];
  const prevY = segments[segments.length - 3] || segments[segments.length - 1];

  // Calculate angle
  const angle = Math.atan2(endY - prevY, endX - prevX) * (180 / Math.PI);

  return (
    <polygon
      points={`0,-${size / 2} ${size},0 0,${size / 2}`}
      fill={color}
      transform={`translate(${endX}, ${endY}) rotate(${angle})`}
    />
  );
}

export default FlowConnection;
