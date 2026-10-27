import React from 'react'
import { HanziCharacter } from '@shared/schemas'
import { SinoVietnameseBadge } from '../common/Badge'
import { BookOpen, GitBranch, Lightbulb } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface CharacterBreakdownProps {
  character: HanziCharacter | null
  className?: string
}

export const CharacterBreakdown: React.FC<CharacterBreakdownProps> = ({
  character,
  className = ''
}) => {
  if (!character) {
    return (
      <div className={cn('rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900', className)}>
        Đang nạp thông tin chiết tự...
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-chinese text-3xl font-bold text-slate-900 dark:text-white">
            {character.char}
          </span>
          <SinoVietnameseBadge reading={character.sino_vietnamese} />
        </div>
        <div className="text-right text-xs font-medium text-slate-500">
          <span>Tổng số nét: </span>
          <strong className="text-blue-600 dark:text-blue-400">{character.stroke_count}</strong>
        </div>
      </div>

      {/* Thông tin Chi tiết: Bộ thủ & Cấu trúc chiết tự IDS */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
          <BookOpen className="h-4 w-4 text-blue-500 shrink-0" />
          <div>
            <span className="text-slate-400 block text-[10px]">Bộ thủ</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 font-chinese text-sm">
              {character.radical}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
          <GitBranch className="h-4 w-4 text-indigo-500 shrink-0" />
          <div>
            <span className="text-slate-400 block text-[10px]">Cấu trúc chiết tự (IDS)</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 font-chinese text-sm">
              {character.decomposition || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Mẹo nhớ & Nguồn gốc chữ Hán (Etymology) */}
      {character.etymology_hint && (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 p-3 text-xs dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300 mb-1">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
            <span>Nguồn gốc & Mẹo nhớ chữ Hán</span>
          </div>
          <p className="leading-relaxed text-amber-800/90 dark:text-amber-200/90">
            {character.etymology_hint}
          </p>
        </div>
      )}
    </div>
  )
}
