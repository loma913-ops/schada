import React from 'react';

export interface SchadaStarProps {
  size?: number;
  className?: string;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

/**
 * Official Schada.org geometric 5-pointed star emblem with inner circle cutout.
 */
export const SchadaStar: React.FC<SchadaStarProps> = ({
  size = 18,
  className = '',
  color = 'var(--accent-gold)',
  strokeColor = 'var(--accent-gold-hover)',
  strokeWidth = 2,
  style,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M 50 18 L 62 42 L 85 45 L 68 62 L 72 85 L 50 74 L 28 85 L 32 62 L 15 45 L 38 42 Z M 58 50 A 8 8 0 0 1 50 58 A 8 8 0 0 1 42 50 A 8 8 0 0 1 50 42 A 8 8 0 0 1 58 50 Z"
        fill={color}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
};
