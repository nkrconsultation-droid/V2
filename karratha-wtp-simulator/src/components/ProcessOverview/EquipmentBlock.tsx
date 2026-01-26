/**
 * EQUIPMENT BLOCK COMPONENT
 * =========================
 * Modern, refined block component with gradient fills,
 * smooth animations, and polished visual feedback.
 */

import React, { useMemo } from 'react';
import { EquipmentBlock as BlockType, DIAGRAM_COLORS } from './diagramConfig';

interface EquipmentBlockProps {
  block: BlockType;
  isSelected?: boolean;
  isHighlighted?: boolean;
  isDragging?: boolean;
  editMode?: boolean;
  data?: Record<string, number | string | boolean>;
  onClick?: (blockId: string) => void;
  onHover?: (blockId: string | null) => void;
  onDragStart?: (blockId: string, e: React.MouseEvent) => void;
}

export function EquipmentBlock({
  block,
  isSelected = false,
  isHighlighted = false,
  isDragging = false,
  editMode = false,
  data,
  onClick,
  onHover,
  onDragStart,
}: EquipmentBlockProps) {
  const handleClick = () => onClick?.(block.id);
  const handleMouseEnter = () => onHover?.(block.id);
  const handleMouseLeave = () => onHover?.(null);
  const handleMouseDown = (e: React.MouseEvent) => {
    if (editMode && onDragStart) {
      onDragStart(block.id, e);
    }
  };

  // Generate unique gradient ID for this block
  const gradientId = `gradient-${block.id}`;
  const glowId = `glow-${block.id}`;

  // Calculate dynamic font sizes based on block dimensions
  const fontSizes = useMemo(() => {
    const baseSize = Math.min(block.width, block.height);
    return {
      name: Math.max(11, Math.min(14, baseSize * 0.15)),
      description: Math.max(9, Math.min(11, baseSize * 0.12)),
      param: Math.max(10, Math.min(13, baseSize * 0.14)),
    };
  }, [block.width, block.height]);

  // Determine colors
  const hasGradient = block.gradientColors && block.gradientColors.length >= 2;
  const fillColor = block.color === 'transparent' ? 'none' : (hasGradient ? `url(#${gradientId})` : block.color);
  const strokeColor = block.borderColor || darkenColor(block.gradientColors?.[1] || block.color, 20);
  const textColor = block.textColor || '#ffffff';

  // Calculate text wrapping for long names
  const displayName = block.shortName || block.name;
  const lines = wrapText(displayName, block.width - 20, fontSizes.name);

  // Cursor style based on mode
  const cursorClass = isDragging
    ? 'cursor-grabbing'
    : editMode
    ? 'cursor-grab'
    : 'cursor-pointer';

  return (
    <g
      className={`equipment-block ${cursorClass}`}
      transform={`translate(${block.x}, ${block.y})`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      style={{ userSelect: 'none' }}
    >
      {/* Definitions for gradients and filters */}
      <defs>
        {/* Block gradient */}
        {hasGradient && (
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={block.gradientColors![0]} />
            <stop offset="100%" stopColor={block.gradientColors![1]} />
          </linearGradient>
        )}

        {/* Glow filter for highlighted/selected states */}
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer glow for selected/highlighted/dragging states */}
      {(isSelected || isHighlighted || isDragging) && (
        <rect
          x={-6}
          y={-6}
          width={block.width + 12}
          height={block.height + 12}
          rx={12}
          ry={12}
          fill="none"
          stroke={
            isDragging
              ? DIAGRAM_COLORS.ui.warning
              : isSelected
              ? DIAGRAM_COLORS.ui.accent
              : 'rgba(255,255,255,0.3)'
          }
          strokeWidth={isDragging ? 2 : isSelected ? 2 : 1.5}
          opacity={isDragging || isSelected ? 1 : 0.6}
          style={{
            filter: isDragging || isSelected ? `url(#${glowId})` : undefined,
          }}
        />
      )}

      {/* Edit mode dashed border indicator */}
      {editMode && !isDragging && (
        <rect
          x={-3}
          y={-3}
          width={block.width + 6}
          height={block.height + 6}
          rx={10}
          ry={10}
          fill="none"
          stroke={DIAGRAM_COLORS.ui.warning}
          strokeWidth={1}
          strokeDasharray="6,3"
          opacity={0.4}
        />
      )}

      {/* Shadow layer */}
      <rect
        x={2}
        y={2}
        width={block.width}
        height={block.height}
        rx={8}
        ry={8}
        fill="rgba(0,0,0,0.3)"
        style={{
          opacity: isDragging ? 0.5 : 0.2,
          transform: isDragging ? 'translate(2px, 2px)' : 'none',
          transition: isDragging ? 'none' : 'all 0.2s ease',
        }}
      />

      {/* Main block rectangle */}
      <rect
        width={block.width}
        height={block.height}
        rx={8}
        ry={8}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={block.borderColor ? 2.5 : 1.5}
        strokeDasharray={block.id === 'RECIRC' ? '8,4' : undefined}
        style={{
          transition: isDragging ? 'none' : 'all 0.2s ease',
          transform: isDragging ? 'translate(-2px, -2px)' : 'none',
          filter: isHighlighted && !isDragging ? 'brightness(1.1)' : undefined,
        }}
      />

      {/* Inner highlight line (top edge) */}
      {block.color !== 'transparent' && (
        <rect
          x={4}
          y={2}
          width={block.width - 8}
          height={1}
          rx={0.5}
          fill="rgba(255,255,255,0.25)"
        />
      )}

      {/* Block content */}
      <g>
        {/* Block name - centered, multi-line if needed */}
        {lines.map((line, i) => {
          const totalLines = lines.length;
          const hasParams = data && block.parameters && block.parameters.length > 0;
          const hasDescription = block.description && !data;
          const extraLines = hasParams ? 1 : hasDescription ? 1 : 0;
          const lineHeight = fontSizes.name * 1.25;
          const totalHeight = (totalLines + extraLines) * lineHeight;
          const startY = (block.height - totalHeight) / 2 + fontSizes.name;

          return (
            <text
              key={i}
              x={block.width / 2}
              y={startY + i * lineHeight}
              textAnchor="middle"
              fill={textColor}
              fontSize={fontSizes.name}
              fontWeight="600"
              fontFamily="Inter, system-ui, -apple-system, sans-serif"
              style={{
                textShadow: block.textColor ? 'none' : '0 1px 2px rgba(0,0,0,0.3)',
              }}
            >
              {line}
            </text>
          );
        })}

        {/* Description (if no live data) */}
        {block.description && !data && (
          <text
            x={block.width / 2}
            y={block.height / 2 + fontSizes.name + 6}
            textAnchor="middle"
            fill={textColor}
            fontSize={fontSizes.description}
            opacity={0.75}
            fontFamily="Inter, system-ui, -apple-system, sans-serif"
            fontWeight="500"
          >
            {block.description}
          </text>
        )}

        {/* Live parameter display */}
        {data && block.parameters && block.parameters.length > 0 && (
          <g>
            <rect
              x={block.width / 2 - 35}
              y={block.height / 2 + fontSizes.name - 2}
              width={70}
              height={18}
              rx={4}
              fill="rgba(0,0,0,0.25)"
            />
            <text
              x={block.width / 2}
              y={block.height / 2 + fontSizes.name + 12}
              textAnchor="middle"
              fill={textColor}
              fontSize={fontSizes.param}
              fontFamily="JetBrains Mono, monospace"
              fontWeight="600"
            >
              {block.parameters.slice(0, 1).map((param) => {
                const value = data[param.key];
                if (value === undefined) return null;
                const displayValue = typeof value === 'number' ? value.toFixed(1) : value;
                return `${displayValue} ${param.unit}`;
              })}
            </text>
          </g>
        )}
      </g>

      {/* Category indicator dot */}
      <circle
        cx={block.width - 8}
        cy={8}
        r={4}
        fill={getCategoryColor(block.category)}
        opacity={0.8}
      />
    </g>
  );
}

// Get color for category indicator
function getCategoryColor(category: BlockType['category']): string {
  switch (category) {
    case 'feed': return DIAGRAM_COLORS.feed.primary;
    case 'process': return DIAGRAM_COLORS.process.main;
    case 'output': return DIAGRAM_COLORS.output.primary;
    case 'utility': return DIAGRAM_COLORS.utility.flush;
    case 'storage': return DIAGRAM_COLORS.storage.primary;
    default: return '#ffffff';
  }
}

// Helper to darken a hex color
function darkenColor(hex: string, percent: number): string {
  if (hex === 'transparent' || !hex) return '#334155';

  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const factor = 1 - percent / 100;
  const newR = Math.round(r * factor);
  const newG = Math.round(g * factor);
  const newB = Math.round(b * factor);

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

// Helper to wrap text into multiple lines
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const avgCharWidth = fontSize * 0.55;
  const maxChars = Math.floor(maxWidth / avgCharWidth);

  if (text.length <= maxChars) {
    return [text];
  }

  const words = text.split(/[\s\/]+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxChars) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.slice(0, 3);
}

export default EquipmentBlock;
