import React from 'react'
import { HanziCompoundWord } from '@shared/schemas'
import { HskBadge } from '../common/Badge'
import { Layers, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface CompoundWordsListProps {
  compounds: HanziCompoundWord[]
  onSelectCompound: (word: string) => void
  className?: string
}

export const CompoundWordsList: React.FC<CompoundWordsListProps> = ({
  compounds,
  onSelectCompound,
  className = ''
}) => {
  if (compounds.length === 0) {
    return (
      <div className={cn('rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900', className)}>
        Không có từ ghép HSK nào khác trong cơ sở dữ liệu.
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Layers className="h-3.5 w-3.5 text-blue-500" />
          <span>Mạng lưới từ ghép HSK liên quan ({compounds.length})</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
        {compounds.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectCompound(item.word)}
            className="group flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2 text-left transition hover:border-blue-200 hover:bg-blue-50/60 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-blue-900 dark:hover:bg-blue-950/40"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-chinese font-bold text-base text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                  {item.word}
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {item.pinyin}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                {item.meaning_vi}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <HskBadge level={item.hsk_level} size="sm" />
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:translate-x-0.5 group-hover:text-blue-500 transition-transform" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
