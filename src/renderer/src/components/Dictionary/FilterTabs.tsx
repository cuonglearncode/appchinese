import React from 'react'
import { Filter } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface FilterTabsProps {
  selectedHskLevel: number | undefined
  onSelectHskLevel: (level: number | undefined) => void
  selectedState: 'all' | 'new' | 'learning' | 'review' | 'relearning'
  onSelectState: (state: 'all' | 'new' | 'learning' | 'review' | 'relearning') => void
  className?: string
}

export const FilterTabs: React.FC<FilterTabsProps> = ({
  selectedHskLevel,
  onSelectHskLevel,
  selectedState,
  onSelectState,
  className = ''
}) => {
  const hskLevels = [
    { level: undefined, label: 'Tất cả HSK', count: '5.003' },
    { level: 1, label: 'HSK 1', count: '150' },
    { level: 2, label: 'HSK 2', count: '150' },
    { level: 3, label: 'HSK 3', count: '295' },
    { level: 4, label: 'HSK 4', count: '600' },
    { level: 5, label: 'HSK 5', count: '1.295' },
    { level: 6, label: 'HSK 6', count: '2.513' }
  ]

  const learningStates: Array<{
    id: 'all' | 'new' | 'learning' | 'review' | 'relearning'
    label: string
  }> = [
    { id: 'all', label: 'Tất cả tiến độ' },
    { id: 'new', label: 'Chưa học' },
    { id: 'learning', label: 'Đang học' },
    { id: 'review', label: 'Cần ôn' },
    { id: 'relearning', label: 'Học lại' }
  ]

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Hàng 1: Tabs chọn cấp độ HSK 1 - 6 */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {hskLevels.map((item) => {
          const isActive = selectedHskLevel === item.level
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onSelectHskLevel(item.level)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 dark:bg-blue-500'
                  : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800'
              )}
            >
              <span>{item.label}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px]',
                  isActive
                    ? 'bg-blue-700/60 text-blue-100 dark:bg-blue-600'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {item.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Hàng 2: Bộ lọc theo trạng thái học tập */}
      <div className="flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1 text-slate-400 font-medium">
          <Filter className="h-3.5 w-3.5" />
          <span>Tiến độ:</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {learningStates.map((st) => {
            const isActive = selectedState === st.id
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => onSelectState(st.id)}
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium transition',
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                )}
              >
                {st.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
