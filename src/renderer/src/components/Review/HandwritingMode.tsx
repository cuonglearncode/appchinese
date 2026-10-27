import React, { useState, useEffect } from 'react'
import { Volume2, CheckCircle2, ArrowRight } from 'lucide-react'
import { VocabWithProgress, SrsRating } from '@shared/schemas'
import { HanziWriterCanvas } from '../HanziDetail/HanziWriterCanvas'
import { HskBadge } from '../common/Badge'

export interface HandwritingModeProps {
  item: VocabWithProgress
  onSubmit: (isCorrect: boolean, rating?: SrsRating, userInput?: string) => void
  onPlayTTS: (text: string) => void
  className?: string
}

export const HandwritingMode: React.FC<HandwritingModeProps> = ({
  item,
  onSubmit,
  onPlayTTS,
  className = ''
}) => {
  const chars = Array.from(item.word.replace(/[^\p{Script=Han}]/gu, ''))
  const [currentCharIndex, setCurrentCharIndex] = useState<number>(0)
  const [totalMistakes, setTotalMistakes] = useState<number>(0)
  const [isCompleted, setIsCompleted] = useState<boolean>(false)

  const activeChar = chars[currentCharIndex] || chars[0]

  useEffect(() => {
    setCurrentCharIndex(0)
    setTotalMistakes(0)
    setIsCompleted(false)
  }, [item.id])

  const handleCharQuizComplete = (mistakes: number): void => {
    const updatedMistakes = totalMistakes + mistakes
    setTotalMistakes(updatedMistakes)

    if (currentCharIndex + 1 < chars.length) {
      setCurrentCharIndex((prev) => prev + 1)
    } else {
      setIsCompleted(true)
      onPlayTTS(item.word)
    }
  }

  const handleFinish = (): void => {
    // Đánh giá SRS theo số lỗi tập viết:
    // 0 lỗi -> Dễ (4)
    // 1-2 lỗi -> Tốt (3)
    // 3-4 lỗi -> Khó (2)
    // > 4 lỗi -> Học lại (1)
    let rating: SrsRating = 3
    let isCorrect = true

    if (totalMistakes === 0) {
      rating = 4
    } else if (totalMistakes <= 2) {
      rating = 3
    } else if (totalMistakes <= 4) {
      rating = 2
    } else {
      rating = 1
      isCorrect = false
    }

    onSubmit(isCorrect, rating, item.word)
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-6 max-w-xl mx-auto w-full p-4 ${className}`}>
      <div className="flex w-full flex-col items-center justify-center rounded-3xl border-2 border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900 text-center">
        <div className="flex w-full items-center justify-between mb-2">
          <HskBadge level={item.hsk_level} size="md" />

          <button
            type="button"
            onClick={() => onPlayTTS(item.word)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-blue-600 transition hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-800 dark:text-blue-400"
            title="Phát âm từ vựng"
          >
            <Volume2 className="h-4 w-4" />
          </button>
        </div>

        {/* Thông tin từ vựng */}
        <div className="mb-4">
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400 block">
            {item.pinyin}
          </span>
          <span className="text-base font-semibold text-slate-800 dark:text-slate-100 mt-1 block">
            {item.meaning_vi}
          </span>
        </div>

        {/* Tiến trình viết các chữ nếu từ có nhiều chữ */}
        {chars.length > 1 && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-slate-400">Đang viết chữ ({currentCharIndex + 1}/{chars.length}):</span>
            <div className="flex items-center gap-1.5">
              {chars.map((c, idx) => (
                <span
                  key={idx}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg font-chinese text-sm font-bold ${
                    idx === currentCharIndex
                      ? 'bg-blue-600 text-white'
                      : idx < currentCharIndex
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                  }`}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Khung HanziWriter Canvas */}
        {activeChar && !isCompleted && (
          <div className="my-2">
            <HanziWriterCanvas
              char={activeChar}
              size={240}
              onQuizComplete={handleCharQuizComplete}
            />
          </div>
        )}

        {/* Thông báo chúc mừng khi hoàn thành tất cả các chữ */}
        {isCompleted && (
          <div className="flex flex-col items-center gap-3 py-6 animate-in fade-in zoom-in-95 duration-200">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">
              Đã hoàn thành luyện viết từ "{item.word}"!
            </h4>
            <p className="text-sm text-slate-500">
              Tổng số lần nét viết sai: <strong className="text-rose-600">{totalMistakes}</strong>
            </p>
          </div>
        )}
      </div>

      {/* Nút hành động */}
      {isCompleted && (
        <div className="w-full">
          <button
            type="button"
            onClick={handleFinish}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 font-bold text-white shadow-md shadow-blue-500/30 transition hover:bg-blue-700"
          >
            <span>Tiếp tục từ tiếp theo</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
