import React from 'react'
import { ArrowLeft, Brain, Layers, Keyboard, PenTool, Sparkles, Network } from 'lucide-react'
import { ReviewMode, SrsAlgorithm } from '@shared/schemas'
import { cn } from '../../lib/utils'

export interface ReviewHeaderProps {
  currentIndex: number
  totalCards: number
  mode: ReviewMode
  algorithm: SrsAlgorithm
  onExit: () => void
  className?: string
}

export const ReviewHeader: React.FC<ReviewHeaderProps> = ({
  currentIndex,
  totalCards,
  mode,
  algorithm,
  onExit,
  className = ''
}) => {
  const percent = totalCards > 0 ? Math.round(((currentIndex + 1) / totalCards) * 100) : 0

  const modeConfig: Record<ReviewMode, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
    flashcard: { label: 'Thẻ ghi nhớ', icon: Layers },
    typing: { label: 'Gõ chữ Hán', icon: Keyboard },
    cloze: { label: 'Đục lỗ ngữ cảnh', icon: Sparkles },
    handwriting: { label: 'Luyện viết nét', icon: PenTool },
    synonym_recall: { label: 'Nhớ chùm đồng nghĩa', icon: Network }
  }

  const currentMode = modeConfig[mode]
  const ModeIcon = currentMode.icon

  return (
    <div className={cn('flex flex-col gap-3 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-950 shrink-0 select-none', className)}>
      <div className="flex items-center justify-between">
        {/* Nút thoát */}
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title="Thoát phiên ôn tập"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Thoát</span>
        </button>

        {/* Thông tin chế độ & thuật toán */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
            <ModeIcon className="h-3.5 w-3.5" />
            <span>{currentMode.label}</span>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 font-medium text-purple-700 dark:border-purple-900 dark:bg-purple-950/60 dark:text-purple-300">
            <Brain className="h-3.5 w-3.5" />
            <span>{algorithm === 'fsrs' ? 'FSRS-4.5' : 'SuperMemo-2'}</span>
          </div>
        </div>

        {/* Chỉ số tiến độ */}
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
          <span>{currentIndex + 1}</span>
          <span className="text-slate-400"> / {totalCards}</span>
        </div>
      </div>

      {/* Thanh tiến độ phần trăm (Progress Bar) */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full bg-blue-600 transition-all duration-300 dark:bg-blue-500 rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
