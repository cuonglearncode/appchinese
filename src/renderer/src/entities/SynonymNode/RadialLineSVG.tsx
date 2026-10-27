import React from 'react'

export interface RadialLineSVGProps {
  fromX: number
  fromY: number
  toX: number
  toY: number
  color?: string
  isHighlighted?: boolean
}

export const RadialLineSVG: React.FC<RadialLineSVGProps> = ({
  fromX,
  fromY,
  toX,
  toY,
  color = '#94a3b8',
  isHighlighted = false
}) => {
  return (
    <line
      x1={fromX}
      y1={fromY}
      x2={toX}
      y2={toY}
      stroke={isHighlighted ? '#3b82f6' : color}
      strokeWidth={isHighlighted ? 2.5 : 1.5}
      strokeDasharray={isHighlighted ? undefined : '3,3'}
      strokeOpacity={isHighlighted ? 0.9 : 0.6}
      className="transition-all duration-300"
    />
  )
}
