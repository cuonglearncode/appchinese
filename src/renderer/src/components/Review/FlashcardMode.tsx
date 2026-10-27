import React, { useState, useEffect } from 'react'
import { Volume2, RotateCcw } from 'lucide-react'
import { VocabWithProgress, SrsRating } from '@shared/schemas'
import { HskBadge } from '../common/Badge'
import { SynonymMapCard } from '../../widgets/SynonymMapCard/SynonymMapCard'
import { useVocabSynonyms } from '../../hooks/useSynonymGroups'

export interface FlashcardModeProps {
  item: VocabWithProgress
  onRate: (rating: SrsRating) => void
  onPlayTTS: (text: string) => void
  className?: string
}

export const FlashcardMode: React.FC<FlashcardModeProps> = ({
  item,
  onRate,
  onPlayTTS,
  className = ''
}) => {
  const [isFlipped, setIsFlipped] = useState<boolean>(false)
  const { groups: synonymGroups } = useVocabSynonyms(item.id)

  // Reset trạng thái lật thẻ khi chuyển sang từ mới
  useEffect(() => {
    setIsFlipped(false)
  }, [item.id])

  // Lắng nghe phím tắt: Space để lật, 1-4 để chấm điểm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === 'Space') {
        e.preventDefault()
        setIsFlipped((prev) => !prev)
      } else if (isFlipped) {
        if (e.key === '1') onRate(1)
        else if (e.key === '2') onRate(2)
        else if (e.key === '3') onRate(3)
        else if (e.key === '4') onRate(4)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFlipped, onRate])

  return (
    <div className={`flex flex-col items-center justify-center gap-6 max-w-xl mx-auto w-full p-4 ${className}`}>
      {/* Thẻ học Card container */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="relative flex min-h-[340px] w-full cursor-pointer flex-col justify-between rounded-3xl border-2 border-slate-200 bg-white p-8 shadow-lg transition-all hover:border-blue-300 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 select-none"
      >
        {/* Top Card: Badge & Audio */}
        <div className="flex items-center justify-between">
          <HskBadge level={item.hsk_level} size="md" />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onPlayTTS(item.word)
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-blue-600 transition hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-800 dark:text-blue-400"
            title="Phát âm từ vựng"
          >
            <Volume2 className="h-5 w-5" />
          </button>
        </div>

        {/* Giữa Card: Chữ Hán lớn & Thông tin mở rộng */}
        <div className="flex flex-col items-center justify-center text-center py-6">
          <h2 className="font-chinese text-6xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
            {item.word}
          </h2>

          {!isFlipped ? (
            <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
              <RotateCcw className="h-3 w-3" />
              <span>Bấm vào thẻ hoặc nhấn Phím Cách (Space) để lật</span>
            </p>
          ) : (
            <div className="flex flex-col items-center gap-2 mt-2 animate-in fade-in zoom-in-95 duration-200">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {item.pinyin}
              </span>
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-100 max-w-md">
                {item.meaning_vi}
              </p>

              {item.example_zh && (
                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-sm text-left dark:border-slate-800 dark:bg-slate-800/60 max-w-md w-full">
                  <p className="font-chinese text-slate-800 dark:text-slate-200">
                    {item.example_zh}
                  </p>
                  {item.example_vi && (
                    <p className="text-xs text-slate-500 italic mt-1">
                      {item.example_vi}
                    </p>
                  )}
                </div>
              )}

              {/* Sơ đồ từ đồng nghĩa liên quan */}
              {synonymGroups.length > 0 && (
                <div
                  className="mt-4 w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <SynonymMapCard
                    groups={synonymGroups}
                    activeVocabId={item.id}
                    onPlayTTS={onPlayTTS}
                    width={440}
                    height={300}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Đáy Card: Gợi ý thao tác */}
        <div className="text-center text-[11px] text-slate-400">
          {isFlipped ? 'Chọn mức độ nhớ bên dưới (Phím 1, 2, 3, 4)' : 'Nhớ nghĩa tiếng Việt và cách đọc'}
        </div>
      </div>

      {/* 4 Nút đánh giá SRS (Hiển thị khi đã lật thẻ) */}
      {isFlipped ? (
        <div className="grid grid-cols-4 gap-2.5 w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            type="button"
            onClick={() => onRate(1)}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-rose-300 bg-rose-50/80 py-3 px-2 text-rose-800 font-bold transition hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300 shadow-sm"
          >
            <span className="text-sm">Quên</span>
            <span className="text-[10px] font-normal opacity-80 mt-0.5">(Phím 1)</span>
          </button>

          <button
            type="button"
            onClick={() => onRate(2)}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-amber-300 bg-amber-50/80 py-3 px-2 text-amber-800 font-bold transition hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300 shadow-sm"
          >
            <span className="text-sm">Khó</span>
            <span className="text-[10px] font-normal opacity-80 mt-0.5">(Phím 2)</span>
          </button>

          <button
            type="button"
            onClick={() => onRate(3)}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-blue-300 bg-blue-50/80 py-3 px-2 text-blue-800 font-bold transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300 shadow-sm"
          >
            <span className="text-sm">Nhớ</span>
            <span className="text-[10px] font-normal opacity-80 mt-0.5">(Phím 3)</span>
          </button>

          <button
            type="button"
            onClick={() => onRate(4)}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-emerald-300 bg-emerald-50/80 py-3 px-2 text-emerald-800 font-bold transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-sm"
          >
            <span className="text-sm">Dễ</span>
            <span className="text-[10px] font-normal opacity-80 mt-0.5">(Phím 4)</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsFlipped(true)}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-blue-600 font-bold text-white shadow-md shadow-blue-500/30 transition hover:bg-blue-700"
        >
          Xem đáp án (Phím Cách)
        </button>
      )}
    </div>
  )
}
