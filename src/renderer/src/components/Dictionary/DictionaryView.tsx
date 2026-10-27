import React, { useState, useCallback } from 'react'
import { SearchBar } from './SearchBar'
import { FilterTabs } from './FilterTabs'
import { VocabList } from './VocabList'
import { HanziDrawer } from '../HanziDetail/HanziDrawer'
import { useVocabSearch } from '../../hooks/useVocabSearch'
import { useNotebooks } from '../../hooks/useNotebooks'
import { useTTS } from '../../hooks/useTTS'
import { VocabWithProgress } from '@shared/schemas'
import { AlertCircle } from 'lucide-react'

export const DictionaryView: React.FC = () => {
  const {
    items,
    total,
    isLoading,
    isError,
    error,
    responseTimeMs,
    filter,
    setQuery,
    setHskLevel,
    setLearningState,
    refetch
  } = useVocabSearch({ initialLimit: 3000 })

  const { toggleItem: toggleNotebookItem } = useNotebooks()
  const { speak, warningMessage: ttsWarning } = useTTS()

  const [selectedVocab, setSelectedVocab] = useState<VocabWithProgress | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)

  const handleSelectItem = useCallback((item: VocabWithProgress): void => {
    setSelectedVocab(item)
    setIsDrawerOpen(true)
  }, [])

  const handleCloseDrawer = useCallback((): void => {
    setIsDrawerOpen(false)
  }, [])

  // Khi người dùng bấm vào một từ ghép hoặc từ trong câu ví dụ để tra cứu nhanh
  const handleSelectWord = useCallback(
    (word: string): void => {
      setQuery(word)
      // Tìm xem từ có ngay trong danh sách hiện tại không
      const matched = items.find((it) => it.word === word)
      if (matched) {
        setSelectedVocab(matched)
      } else {
        // Tra cứu ID qua IPC
        window.api.vocab.search({ query: word, limit: 1 }).then((res) => {
          if (res.success && res.data.items.length > 0) {
            setSelectedVocab(res.data.items[0])
            setIsDrawerOpen(true)
          }
        })
      }
    },
    [items, setQuery]
  )

  const handleToggleBookmark = useCallback(
    async (vocabId: number): Promise<void> => {
      // Mặc định thêm/bỏ vào Sổ tay đầu tiên
      try {
        await toggleNotebookItem({ notebookId: 1, vocabId })
        refetch()
      } catch (err) {
        console.error('Lỗi khi lưu từ vào sổ tay:', err)
      }
    },
    [toggleNotebookItem, refetch]
  )

  return (
    <div className="flex h-full flex-col gap-4 p-6 overflow-hidden">
      {/* Cảnh báo TTS nếu trên Linux chưa cài speech-dispatcher */}
      {ttsWarning && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 shrink-0">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>{ttsWarning}</span>
        </div>
      )}

      {/* Thông báo lỗi nếu truy vấn thất bại */}
      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 shrink-0">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>Lỗi khi tải dữ liệu: {error?.message}</span>
        </div>
      )}

      {/* Thanh tìm kiếm Chữ Hán, Pinyin, Nghĩa tiếng Việt */}
      <SearchBar
        query={filter.query || ''}
        onSearchChange={setQuery}
        totalCount={total}
        responseTimeMs={responseTimeMs}
        isLoading={isLoading}
      />

      {/* Bộ lọc HSK 1 - 6 và Tiến độ học tập */}
      <FilterTabs
        selectedHskLevel={filter.hskLevel}
        onSelectHskLevel={setHskLevel}
        selectedState={filter.learningState}
        onSelectState={setLearningState}
      />

      {/* Danh sách từ vựng ảo hóa Virtualized List (@tanstack/react-virtual) */}
      <div className="flex-1 min-h-0">
        <VocabList
          items={items}
          selectedItem={selectedVocab}
          onSelectItem={handleSelectItem}
          onPlayTTS={speak}
          onToggleBookmark={handleToggleBookmark}
          isLoading={isLoading}
        />
      </div>

      {/* Drawer Chi tiết từ vựng, Chiết tự & Luyện viết 100% Offline */}
      <HanziDrawer
        item={selectedVocab}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onPlayTTS={speak}
        onToggleBookmark={handleToggleBookmark}
        onSelectWord={handleSelectWord}
      />
    </div>
  )
}
