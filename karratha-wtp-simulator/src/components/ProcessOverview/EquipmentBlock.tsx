/**
 * EQUIPMENT BLOCK COMPONENT
 * =========================
 * Renders individual equipment blocks on the process diagram.
 * Supports hover states, selection, and live data display.
 * Text dynamically scales based on block dimensions.
 */

import React, { useMemo } from 'react';
import { EquipmentBlock as BlockType } from './diagramConfig';

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

  // Calculate dynamic font sizes based on block dimensions
  const fontSizes = useMemo(() => {
    const baseSize = Math.min(block.width, block.height);
    // Scale text to fit within block, with min/max constraints
    return {
      name: Math.max(10, Math.min(14, baseSize * 0.14)),
      description: Math.max(8, Math.min(11, baseSize * 0.11)),
      param: Math.max(9, Math.min(12, baseSize * 0.12)),
    };
  }, [block.width, block.height]);

  // Determine colors
  const fillColor = block.color === 'transparent' ? 'none' : block.color;
  const strokeColor = block.borderColor || adjustColor(block.color, -30);
  const textColor = block.textColor || '#ffffff';

  // Calculate text wrapping for long names
  const displayName = block.shortName || block.name;
  const lines = wrapText(displayName, block.width - 16, fontSizes.name);

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
      {/* Selection/hover/drag glow */}
      {(isSelected || isHighlighted || isDragging) && (
        <rect
          x={-4}
          y={-4}
          width={block.width + 8}
          height={block.height + 8}
          rx={10}
          ry={10}
          fill="none"
          stroke={isDragging ? '#B8860B' : isSelected ? '#4080c0' : '#ffffff50'}
          strokeWidth={isDragging ? 3 : isSelected ? 3 : 2}
          className={isSelected || isDragging ? '' : 'animate-pulse'}
        />
      )}

      {/* Edit mode indicator */}
      {editMode && !isDragging && (
        <rect
          x={-2}
          y={-2}
          width={block.width + 4}
          height={block.height + 4}
          rx={9}
          ry={9}
          fill="none"
          stroke="#B8860B"
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={0.5}
        />
      )}

      {/* Main block rectangle */}
      <rect
        width={block.width}
        height={block.height}
        rx={8}
        ry={8}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={block.borderColor ? 3 : 2}
        strokeDasharray={block.id === 'RECIRC' ? '8,4' : undefined}
        style={{
          transition: isDragging ? 'none' : 'all 0.2s ease',
          filter: isDragging
            ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.4)) brightness(1.1)'
            : isHighlighted
            ? 'brightness(1.15)'
            : undefined,
        }}
      />

      {/* Block content using SVG text for better scaling */}
      <g>
        {/* Block name - centered, multi-line if needed */}
        {lines.map((line, i) => {
          const totalLines = lines.length;
          const hasParams = data && block.parameters && block.parameters.length > 0;
          const hasDescription = block.description && !data;
          const extraLines = hasParams ? 1 : hasDescription ? 1 : 0;
          const lineHeight = fontSizes.name * 1.2;
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
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {line}
            </text>
          );
        })}

        {/* Description (if no live data) */}
        {block.description && !data && (
          <text
            x={block.width / 2}
            y={block.height / 2 + fontSizes.name + 4}
            textAnchor="middle"
            fill={textColor}
            fontSize={fontSizes.description}
            opacity={0.8}
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {block.description}
          </text>
        )}

        {/* Live parameter display */}
        {data && block.parameters && block.parameters.length > 0 && (
          <text
            x={block.width / 2}
            y={block.height / 2 + fontSizes.name + 4}
            textAnchor="middle"
            fill={textColor}
            fontSize={fontSizes.param}
            fontFamily="monospace"
            fontWeight="500"
          >
            {block.parameters.slice(0, 1).map((param) => {
              const value = data[param.key];
              if (value === undefined) return null;
              const displayValue = typeof value === 'number' ? value.toFixed(1) : value;
              return `${displayValue} ${param.unit}`;
            })}
          </text>
        )}
      </g>
    </g>
  );
}

// Helper to darken/lighten a hex color
function adjustColor(hex: string, amount: number): string {
  if (hex === 'transparent') return '#666666';

  const clamp = (val: number) => Math.min(255, Math.max(0, val));

  // Remove # if present
  hex = hex.replace('#', '');

  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Adjust
  const newR = clamp(r + amount);
  const newG = clamp(g + amount);
  const newB = clamp(b + amount);

  // Convert back to hex
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

// Helper to wrap text into multiple lines
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  // Approximate characters per line based on font size and width
  const avgCharWidth = fontSize * 0.55;
  const maxChars = Math.floor(maxWidth / avgCharWidth);

  if (text.length <= maxChars) {
    return [text];
  }

  // Split by common separators
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

  // Limit to 3 lines max
  return lines.slice(0, 3);
}

export default EquipmentBlock;
