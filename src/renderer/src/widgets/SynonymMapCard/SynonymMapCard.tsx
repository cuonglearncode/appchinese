import React, { useState, useMemo } from 'react'
import {
  SynonymMapDTO,
  SynonymMemberDTO
} from '@shared/schemas'
import { SynonymNodeSVG, REGISTER_LABELS } from '../../entities/SynonymNode/SynonymNodeSVG'
import { RadialLineSVG } from '../../entities/SynonymNode/RadialLineSVG'
import { NuanceEditModal } from './NuanceEditModal'
import { Sparkles, Edit3, Volume2, Layers } from 'lucide-react'

export interface SynonymMapCardProps {
  groups: SynonymMapDTO[]
  activeVocabId?: number
  onSelectWord?: (word: string) => void
  onPlayTTS?: (text: string) => void
  onStartRecall?: (group: SynonymMapDTO) => void
  className?: string
  width?: number
  height?: number
}

export const SynonymMapCard: React.FC<SynonymMapCardProps> = ({
  groups,
  activeVocabId,
  onSelectWord,
  onPlayTTS,
  onStartRecall,
  className = '',
  width = 500,
  height = 380
}) => {
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number>(0)
  const [hoveredMember, setHoveredMember] = useState<SynonymMemberDTO | null>(null)
  const [editingMember, setEditingMember] = useState<SynonymMemberDTO | null>(null)

  // Nhóm đang được chọn hiển thị
  const activeGroup = groups[selectedGroupIndex] || groups[0] || null

  // Tính toán tọa độ cực Radial Layout
  const layout = useMemo(() => {
    if (!activeGroup || !activeGroup.members || activeGroup.members.length < 2) {
      return null
    }

    const members = activeGroup.members.slice(0, 8)
    const n = members.length
    const cx = width / 2
    const cy = height / 2 + 10
    const r = Math.min(cx - 75, cy - 50)

    const nodes = members.map((m, i) => {
      const theta = (2 * Math.PI * i) / n - Math.PI / 2
      const x = cx + r * Math.cos(theta)
      const y = cy + r * Math.sin(theta)
      return { member: m, x, y }
    })

    return { cx, cy, nodes }
  }, [activeGroup, width, height])

  if (!activeGroup || !layout) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 ${className}`}>
        <Layers className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-xs font-medium">Chưa có đủ từ đồng nghĩa để tạo sơ đồ nhánh (cần tối thiểu 2 từ).</p>
      </div>
    )
  }

  const handleNodeHover = (m: SynonymMemberDTO): void => {
    setHoveredMember(m)
  }

  return (
    <div className={`relative flex flex-col rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 select-none ${className}`}>
      {/* 1. Header: Multi-sense Tabs (nếu từ vựng thuộc nhiều nhóm nghĩa) */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
          {groups.length > 1 ? (
            groups.map((g, idx) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGroupIndex(idx)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  selectedGroupIndex === idx
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <span>[{g.root_gloss}]</span>
                <span className="text-[10px] opacity-75">({g.members.length})</span>
              </button>
            ))
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Sơ đồ từ đồng nghĩa
              </span>
              <span className="rounded-lg bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900">
                [{activeGroup.root_gloss}]
              </span>
            </div>
          )}
        </div>

        {/* Nút Khởi động Ôn tập Synonym Recall */}
        {onStartRecall && (
          <button
            type="button"
            onClick={() => onStartRecall(activeGroup)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:from-amber-600 hover:to-orange-600 transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Luyện nhớ chùm từ</span>
          </button>
        )}
      </div>

      {/* 2. Vùng SVG Radial Graph */}
      <div className="relative flex justify-center items-center overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-[500px] h-auto overflow-visible"
        >
          {/* Đường nối từ tâm ra các nhánh */}
          {layout.nodes.map(({ member, x, y }) => (
            <RadialLineSVG
              key={`line-${member.vocab_id}`}
              fromX={layout.cx}
              fromY={layout.cy}
              toX={x}
              toY={y}
              isHighlighted={member.vocab_id === activeVocabId}
            />
          ))}

          {/* Nút Gốc ở Tâm [ NGHĨA TIẾNG VIỆT ] */}
          <g transform={`translate(${layout.cx - 65}, ${layout.cy - 24})`}>
            <rect
              width={130}
              height={48}
              rx={16}
              className="fill-blue-600 stroke-blue-400 stroke-2 filter drop-shadow-md"
            />
            <text
              x={65}
              y={28}
              textAnchor="middle"
              className="text-xs font-extrabold uppercase fill-white tracking-wider select-none pointer-events-none"
            >
              [ {activeGroup.root_gloss} ]
            </text>
          </g>

          {/* Các nút nhánh chữ Hán xung quanh */}
          {layout.nodes.map(({ member, x, y }) => (
            <SynonymNodeSVG
              key={`node-${member.vocab_id}`}
              member={member}
              x={x}
              y={y}
              isSelected={member.vocab_id === activeVocabId}
              onSelect={(m) => onSelectWord?.(m.word)}
              onPlayTTS={onPlayTTS}
              onHover={handleNodeHover}
              onLeave={() => setHoveredMember(null)}
            />
          ))}
        </svg>

        {/* Tooltip khi Hover vào nhánh */}
        {hoveredMember && (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 max-w-sm w-full animate-in fade-in duration-150 text-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-chinese font-bold text-lg text-slate-900 dark:text-white">
                  {hoveredMember.word}
                </span>
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {hoveredMember.pinyin}
                </span>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  HSK {hoveredMember.hsk_level}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onPlayTTS?.(hoveredMember.word)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                  title="Phát âm"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMember(hoveredMember)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-amber-600 dark:hover:bg-slate-800"
                  title="Sửa sắc thái nghĩa"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-500">Sắc thái:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {REGISTER_LABELS[hoveredMember.register] || 'Trung tính'}
              </span>
              {hoveredMember.nuance_note && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-amber-600 dark:text-amber-400 italic">
                    {hoveredMember.nuance_note}
                  </span>
                </>
              )}
            </div>

            {hoveredMember.example_zh && (
              <div className="border-t border-slate-100 pt-1.5 text-[11px] text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <p className="font-chinese font-medium">{hoveredMember.example_zh}</p>
                {hoveredMember.example_vi && (
                  <p className="text-slate-400 italic text-[10px] mt-0.5">{hoveredMember.example_vi}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Modal chỉnh sửa sắc thái nghĩa */}
      <NuanceEditModal
        isOpen={Boolean(editingMember)}
        groupId={activeGroup.id}
        rootGloss={activeGroup.root_gloss}
        member={editingMember}
        onClose={() => setEditingMember(null)}
        onSaved={() => {
          // Refresh callback nếu cần
        }}
      />
    </div>
  )
}
