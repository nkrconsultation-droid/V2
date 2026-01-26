/**
 * EQUIPMENT BLOCK COMPONENT
 * =========================
 * Renders individual equipment blocks on the process diagram.
 * Supports hover states, selection, and live data display.
 */

import React from 'react';
import { EquipmentBlock as BlockType } from './diagramConfig';

interface EquipmentBlockProps {
  block: BlockType;
  isSelected?: boolean;
  isHighlighted?: boolean;
  data?: Record<string, number | string | boolean>;
  onClick?: (blockId: string) => void;
  onHover?: (blockId: string | null) => void;
}

export function EquipmentBlock({
  block,
  isSelected = false,
  isHighlighted = false,
  data,
  onClick,
  onHover,
}: EquipmentBlockProps) {
  const handleClick = () => onClick?.(block.id);
  const handleMouseEnter = () => onHover?.(block.id);
  const handleMouseLeave = () => onHover?.(null);

  // Determine colors
  const fillColor = block.color === 'transparent' ? 'none' : block.color;
  const strokeColor = block.borderColor || adjustColor(block.color, -30);
  const textColor = block.textColor || '#ffffff';

  // Calculate font sizes based on block dimensions
  const nameFontSize = Math.min(11, block.width / 10);
  const paramFontSize = Math.min(9, block.width / 12);

  return (
    <g
      className="equipment-block cursor-pointer transition-all duration-200"
      transform={`translate(${block.x}, ${block.y})`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ filter: isHighlighted ? 'brightness(1.1)' : undefined }}
    >
      {/* Selection/hover glow */}
      {(isSelected || isHighlighted) && (
        <rect
          x={-4}
          y={-4}
          width={block.width + 8}
          height={block.height + 8}
          rx={8}
          ry={8}
          fill="none"
          stroke={isSelected ? '#4080c0' : '#ffffff40'}
          strokeWidth={isSelected ? 3 : 2}
          className={isSelected ? '' : 'animate-pulse'}
        />
      )}

      {/* Main block rectangle */}
      <rect
        width={block.width}
        height={block.height}
        rx={6}
        ry={6}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={block.borderColor ? 3 : 2}
        strokeDasharray={block.id === 'RECIRC' ? '8,4' : undefined}
        className="transition-all duration-200"
      />

      {/* Block content */}
      <foreignObject
        x={4}
        y={4}
        width={block.width - 8}
        height={block.height - 8}
      >
        <div
          className="h-full flex flex-col justify-center items-center text-center px-1"
          style={{ color: textColor }}
        >
          {/* Icon (if present) */}
          {block.icon && (
            <span className="text-sm opacity-80 mb-0.5">{block.icon}</span>
          )}

          {/* Block name */}
          <span
            className="font-semibold leading-tight"
            style={{ fontSize: `${nameFontSize}px` }}
          >
            {block.shortName || block.name}
          </span>

          {/* Description or live data */}
          {block.description && !data && (
            <span
              className="opacity-70 leading-tight mt-0.5"
              style={{ fontSize: `${paramFontSize}px` }}
            >
              {block.description}
            </span>
          )}

          {/* Live parameter display */}
          {data && block.parameters && block.parameters.length > 0 && (
            <div className="mt-0.5 space-y-0.5">
              {block.parameters.slice(0, 2).map((param) => {
                const value = data[param.key];
                if (value === undefined) return null;
                return (
                  <span
                    key={param.key}
                    className="block font-mono opacity-90"
                    style={{ fontSize: `${paramFontSize}px` }}
                  >
                    {typeof value === 'number' ? value.toFixed(1) : value} {param.unit}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </foreignObject>
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

export default EquipmentBlock;
