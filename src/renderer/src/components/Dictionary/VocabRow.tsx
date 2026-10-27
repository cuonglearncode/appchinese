import React from 'react'
import { Volume2, Bookmark, BookmarkCheck, ChevronRight } from 'lucide-react'
import { VocabWithProgress } from '@shared/schemas'
import { HskBadge, StateBadge } from '../common/Badge'
import { cn } from '../../lib/utils'

export interface VocabRowProps {
  item: VocabWithProgress
  isSelected?: boolean
  onSelect: (item: VocabWithProgress) => void
  onPlayTTS: (text: string) => void
  onToggleBookmark?: (vocabId: number) => void
  style?: React.CSSProperties
}

export const VocabRow: React.FC<VocabRowProps> = ({
  item,
  isSelected = false,
  onSelect,
  onPlayTTS,
  onToggleBookmark,
  style
}) => {
  const handlePlayAudio = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onPlayTTS(item.word)
  }

  const handleBookmark = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (onToggleBookmark) {
      onToggleBookmark(item.id)
    }
  }

  return (
    <div
      style={style}
      onClick={() => onSelect(item)}
      className={cn(
        'group flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 cursor-pointer transition-colors',
        isSelected
          ? 'bg-blue-50/80 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900'
          : 'bg-white hover:bg-slate-50/80 dark:bg-slate-900 dark:border-slate-800/80 dark:hover:bg-slate-850'
      )}
    >
      {/* Cột trái: Từ vựng, Pinyin, Phát âm */}
      <div className="flex items-center gap-3 min-w-[200px]">
        {/* Nút phát âm nhanh */}
        <button
          type="button"
          onClick={handlePlayAudio}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-900/50 dark:hover:text-blue-300"
          title={`Phát âm từ "${item.word}"`}
        >
          <Volume2 className="h-4 w-4" />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-chinese text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {item.word}
            </span>
          </div>
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {item.pinyin}
          </span>
        </div>
      </div>

      {/* Cột giữa: Nghĩa tiếng Việt */}
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 line-clamp-1">
          {item.meaning_vi}
        </p>
        {item.example_zh && (
          <p className="text-xs text-slate-400 dark:text-slate-500 font-chinese line-clamp-1 mt-0.5">
            {item.example_zh}
          </p>
        )}
      </div>

      {/* Cột phải: HSK Level, Trạng thái, Sổ tay, Mũi tên */}
      <div className="flex items-center gap-2.5 shrink-0">
        <HskBadge level={item.hsk_level} />
        <StateBadge state={item.progress?.state} />

        {/* Nút lưu vào Sổ tay từ vựng */}
        <button
          type="button"
          onClick={handleBookmark}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md border transition',
            item.is_in_notebook
              ? 'border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
              : 'border-transparent text-slate-300 hover:text-slate-500 hover:border-slate-200 dark:text-slate-600 dark:hover:text-slate-300'
          )}
          title={item.is_in_notebook ? 'Đã lưu trong sổ tay' : 'Thêm vào sổ tay'}
        >
          {item.is_in_notebook ? (
            <BookmarkCheck className="h-4 w-4 fill-amber-500 text-amber-500" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
        </button>

        <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-slate-700 dark:group-hover:text-slate-400" />
      </div>
    </div>
  )
}
