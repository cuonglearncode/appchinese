import React, { useState, useEffect } from 'react'
import { X, Volume2, Bookmark, BookmarkCheck, BookOpen } from 'lucide-react'
import { VocabWithProgress } from '@shared/schemas'
import { HskBadge, StateBadge } from '../common/Badge'
import { useHanziDetails } from '../../hooks/useHanziDetails'
import { SentenceSegmenter } from './SentenceSegmenter'
import { HanziWriterCanvas } from './HanziWriterCanvas'
import { CharacterBreakdown } from './CharacterBreakdown'
import { CompoundWordsList } from './CompoundWordsList'
import { SynonymMapCard } from '../../widgets/SynonymMapCard/SynonymMapCard'
import { useVocabSynonyms } from '../../hooks/useSynonymGroups'
import { cn } from '../../lib/utils'

export interface HanziDrawerProps {
  item: VocabWithProgress | null
  isOpen: boolean
  onClose: () => void
  onPlayTTS: (text: string) => void
  onToggleBookmark?: (vocabId: number) => void
  onSelectWord?: (word: string) => void
}

export const HanziDrawer: React.FC<HanziDrawerProps> = ({
  item,
  isOpen,
  onClose,
  onPlayTTS,
  onToggleBookmark,
  onSelectWord
}) => {
  // Lấy danh sách các chữ Hán đơn trong từ (VD: "学习" -> ["学", "习"])
  const chars = item ? Array.from(item.word.replace(/[^\p{Script=Han}]/gu, '')) : []
  const [selectedChar, setSelectedChar] = useState<string>('')

  // Cập nhật ký tự được chọn mặc định khi mở từ mới
  useEffect(() => {
    if (chars.length > 0) {
      setSelectedChar(chars[0])
    }
  }, [item?.id])

  // Lắng nghe phím Escape để đóng Drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Nạp chi tiết chữ Hán đơn và từ ghép liên quan
  const { character, compounds } = useHanziDetails(selectedChar)
  const { groups: synonymGroups } = useVocabSynonyms(item?.id)

  if (!isOpen || !item) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      {/* Nền mờ nhấp vào để đóng */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Nội dung Slide-over Drawer */}
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl transition dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
        {/* Top Header Drawer */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Chi tiết Từ vựng & Phân tích Chiết tự
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="Đóng (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nội dung cuộn chính */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {/* Header Từ vựng */}
          <div className="flex flex-col gap-2 rounded-2xl bg-gradient-to-br from-blue-50/70 to-indigo-50/40 p-5 border border-blue-100/80 dark:from-slate-900 dark:to-blue-950/30 dark:border-blue-900/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-3">
                  <h2 className="font-chinese text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {item.word}
                  </h2>
                  <span className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                    {item.pinyin}
                  </span>
                </div>
                <p className="mt-2 text-base font-medium text-slate-700 dark:text-slate-200">
                  {item.meaning_vi}
                </p>
              </div>

              {/* Nút âm thanh & bookmark */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onPlayTTS(item.word)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-200 text-blue-600 hover:bg-blue-50 dark:bg-slate-800 dark:border-slate-700 dark:text-blue-400"
                  title="Nghe phát âm từ vựng"
                >
                  <Volume2 className="h-5 w-5" />
                </button>

                {onToggleBookmark && (
                  <button
                    type="button"
                    onClick={() => onToggleBookmark(item.id)}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl shadow-sm border transition',
                      item.is_in_notebook
                        ? 'border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                        : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    )}
                    title={item.is_in_notebook ? 'Đã lưu trong sổ tay' : 'Thêm vào sổ tay'}
                  >
                    {item.is_in_notebook ? (
                      <BookmarkCheck className="h-5 w-5 fill-amber-500 text-amber-500" />
                    ) : (
                      <Bookmark className="h-5 w-5" />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-blue-200/50 dark:border-blue-900/40">
              <HskBadge level={item.hsk_level} size="md" />
              <StateBadge state={item.progress?.state} />
            </div>
          </div>

          {/* Câu ví dụ có phân tách từ tương tác */}
          {item.example_zh && (
            <SentenceSegmenter
              sentenceZh={item.example_zh}
              sentenceVi={item.example_vi}
              targetWord={item.word}
              onSelectWord={onSelectWord}
              onPlayTTS={onPlayTTS}
            />
          )}

          {/* Sơ đồ Từ đồng nghĩa liên quan */}
          {synonymGroups.length > 0 && (
            <div className="flex flex-col gap-2">
              <SynonymMapCard
                groups={synonymGroups}
                activeVocabId={item.id}
                onSelectWord={onSelectWord}
                onPlayTTS={onPlayTTS}
                width={480}
                height={330}
              />
            </div>
          )}

          {/* Chọn chữ Hán đơn nếu từ ghép có nhiều hơn 1 chữ */}
          {chars.length > 1 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Chọn chữ Hán đơn để xem chiết tự & tập viết:
              </span>
              <div className="flex items-center gap-2">
                {chars.map((char) => {
                  const isActive = selectedChar === char
                  return (
                    <button
                      key={char}
                      type="button"
                      onClick={() => setSelectedChar(char)}
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-xl font-chinese text-xl font-bold shadow-xs transition',
                        isActive
                          ? 'bg-blue-600 text-white shadow-blue-500/30'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      )}
                    >
                      {char}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Khung luyện viết chữ Hán Offline 100% */}
          {selectedChar && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span>Luyện viết chữ "{selectedChar}" (100% Offline)</span>
              </div>

              <HanziWriterCanvas char={selectedChar} size={240} />
            </div>
          )}

          {/* Phân tích Chiết tự & Nguồn gốc */}
          {selectedChar && <CharacterBreakdown character={character} />}

          {/* Mạng lưới Từ ghép HSK liên quan */}
          {selectedChar && (
            <CompoundWordsList
              compounds={compounds}
              onSelectCompound={(word) => onSelectWord && onSelectWord(word)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
