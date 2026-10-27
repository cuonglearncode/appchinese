import React, { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { VocabWithProgress } from '@shared/schemas'
import { VocabRow } from './VocabRow'
import { BookOpen, Loader2 } from 'lucide-react'

export interface VocabListProps {
  items: VocabWithProgress[]
  selectedItem: VocabWithProgress | null
  onSelectItem: (item: VocabWithProgress) => void
  onPlayTTS: (text: string) => void
  onToggleBookmark?: (vocabId: number) => void
  isLoading?: boolean
  className?: string
}

export const VocabList: React.FC<VocabListProps> = ({
  items,
  selectedItem,
  onSelectItem,
  onPlayTTS,
  onToggleBookmark,
  isLoading = false,
  className = ''
}) => {
  const parentRef = useRef<HTMLDivElement>(null)

  // Cấu hình Virtualizer đạt chuẩn 60 FPS, không tạo quá 50 DOM rows cùng lúc
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5
  })

  const virtualItems = rowVirtualizer.getVirtualItems()

  if (isLoading && items.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium">Đang tải danh mục từ vựng...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/50 text-slate-400 dark:border-slate-800 dark:bg-slate-900/50">
        <BookOpen className="h-10 w-10 text-slate-300 dark:text-slate-600" />
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Không tìm thấy từ vựng phù hợp
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Vui lòng thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc cấp độ HSK.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className={`relative h-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm scrollbar-thin dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index]
          if (!item) return null

          const isSelected = selectedItem?.id === item.id

          return (
            <VocabRow
              key={item.id}
              item={item}
              isSelected={isSelected}
              onSelect={onSelectItem}
              onPlayTTS={onPlayTTS}
              onToggleBookmark={onToggleBookmark}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
