import React from 'react'
import { SynonymMemberDTO } from '@shared/schemas'

export interface SynonymNodeSVGProps {
  member: SynonymMemberDTO
  x: number
  y: number
  isSelected?: boolean
  isRevealed?: boolean // Dùng trong Recall mode
  onSelect?: (member: SynonymMemberDTO) => void
  onPlayTTS?: (text: string) => void
  onHover?: (member: SynonymMemberDTO, e: React.MouseEvent) => void
  onLeave?: () => void
}

export const HSK_COLOR_MAP: Record<number, { border: string; bg: string; text: string; fill: string }> = {
  1: { border: '#10b981', bg: '#ecfdf5', text: '#065f46', fill: '#10b981' }, // Emerald
  2: { border: '#0284c7', bg: '#f0f9ff', text: '#075985', fill: '#0284c7' }, // Sky
  3: { border: '#f59e0b', bg: '#fffbeb', text: '#92400e', fill: '#f59e0b' }, // Amber
  4: { border: '#f97316', bg: '#fff7ed', text: '#9a3412', fill: '#f97316' }, // Orange
  5: { border: '#ef4444', bg: '#fef2f2', text: '#991b1b', fill: '#ef4444' }, // Red
  6: { border: '#8b5cf6', bg: '#f5f3ff', text: '#5b21b6', fill: '#8b5cf6' }  // Purple
}

export const REGISTER_LABELS: Record<string, string> = {
  formal: 'Trang trọng',
  spoken: 'Khẩu ngữ',
  neutral: 'Trung tính'
}

export const SynonymNodeSVG: React.FC<SynonymNodeSVGProps> = ({
  member,
  x,
  y,
  isSelected = false,
  isRevealed = true,
  onSelect,
  onPlayTTS,
  onHover,
  onLeave
}) => {
  const colors = HSK_COLOR_MAP[member.hsk_level] || HSK_COLOR_MAP[1]
  const width = 110
  const height = 48
  const rx = 14

  const handleKeyDown = (e: React.KeyboardEvent<SVGGElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSelect?.(member)
    } else if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault()
      onPlayTTS?.(member.word)
    }
  }

  return (
    <g
      transform={`translate(${x - width / 2}, ${y - height / 2})`}
      tabIndex={0}
      role="button"
      aria-label={`Từ HSK ${member.hsk_level}: ${isRevealed ? member.word : 'ẩn'}`}
      className="cursor-pointer outline-none transition-transform duration-200 group focus:scale-105"
      onClick={() => onSelect?.(member)}
      onKeyDown={handleKeyDown}
      onMouseEnter={(e) => onHover?.(member, e)}
      onMouseLeave={onLeave}
    >
      {/* Khung nền Node */}
      <rect
        width={width}
        height={height}
        rx={rx}
        className={`transition-all duration-200 ${
          isSelected
            ? 'stroke-[3] filter drop-shadow-md'
            : 'stroke-2 hover:filter hover:drop-shadow-sm'
        }`}
        fill={isRevealed ? colors.bg : '#f8fafc'}
        stroke={isRevealed ? colors.border : '#cbd5e1'}
      />

      {/* Badge HSK nhỏ ở góc trên bên phải */}
      <rect
        x={width - 34}
        y={4}
        width={28}
        height={14}
        rx={6}
        fill={colors.fill}
        opacity={0.9}
      />
      <text
        x={width - 20}
        y={14}
        textAnchor="middle"
        className="text-[9px] font-bold fill-white pointer-events-none select-none"
      >
        H{member.hsk_level}
      </text>

      {/* Chữ Hán hoặc Dấu hỏi nếu đang ở Recall mode */}
      <text
        x={width / 2 - 8}
        y={28}
        textAnchor="middle"
        className="font-chinese text-base font-bold select-none pointer-events-none"
        fill={isRevealed ? '#0f172a' : '#64748b'}
      >
        {isRevealed ? member.word : '???'}
      </text>

      {/* Pinyin hoặc gợi ý số ký tự */}
      <text
        x={width / 2 - 8}
        y={42}
        textAnchor="middle"
        className="text-[10px] font-medium select-none pointer-events-none"
        fill={isRevealed ? colors.text : '#94a3b8'}
      >
        {isRevealed ? member.pinyin : `${member.word.length} chữ`}
      </text>

      {/* Nút Loa mini */}
      {isRevealed && onPlayTTS && (
        <g
          transform={`translate(${width - 22}, 24)`}
          className="opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            onPlayTTS(member.word)
          }}
        >
          <title>Phát âm (Space)</title>
          <circle cx="8" cy="8" r="8" fill="transparent" />
          <path
            d="M5 6 L7 6 L9.5 4 L9.5 12 L7 10 L5 10 Z"
            fill={colors.fill}
          />
          <path
            d="M11 6 C12 7 12 9 11 10"
            stroke={colors.fill}
            strokeWidth="1.2"
            fill="none"
          />
        </g>
      )}
    </g>
  )
}
