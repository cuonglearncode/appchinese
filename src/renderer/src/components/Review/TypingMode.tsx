import React, { useState, useEffect, useRef } from 'react'
import { Volume2, CheckCircle2, AlertCircle, Eye, ArrowRight } from 'lucide-react'
import { VocabWithProgress } from '@shared/schemas'
import { matchChineseAnswer, normalizeChineseInput } from '@shared/string-utils'
import { HskBadge } from '../common/Badge'

export interface TypingModeProps {
  item: VocabWithProgress
  onSubmit: (isCorrect: boolean, userInput: string) => void
  onPlayTTS: (text: string) => void
  className?: string
}

export const TypingMode: React.FC<TypingModeProps> = ({
  item,
  onSubmit,
  onPlayTTS,
  className = ''
}) => {
  const [inputValue, setInputValue] = useState<string>('')
  const [isAnswered, setIsAnswered] = useState<boolean>(false)
  const [isCorrect, setIsCorrect] = useState<boolean>(false)
  const [showPinyinHint, setShowPinyinHint] = useState<boolean>(false)

  const isComposingRef = useRef<boolean>(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset khi chuyển từ mới
  useEffect(() => {
    setInputValue('')
    setIsAnswered(false)
    setIsCorrect(false)
    setShowPinyinHint(false)
    isComposingRef.current = false
    inputRef.current?.focus()
  }, [item.id])

  const handleCompositionStart = (): void => {
    isComposingRef.current = true
  }

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>): void => {
    isComposingRef.current = false
    setInputValue(e.currentTarget.value)
  }

  const handleCheckAnswer = (): void => {
    // Không chấm điểm khi đang trong phiên gõ IME (đang chọn chữ Hán)
    if (isComposingRef.current || !inputValue.trim()) return

    const correct = matchChineseAnswer(inputValue, item.word)
    setIsCorrect(correct)
    setIsAnswered(true)

    // Phát âm từ vựng để củng cố phản xạ
    onPlayTTS(item.word)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      if (!isAnswered) {
        if (!isComposingRef.current) {
          handleCheckAnswer()
        }
      } else {
        // Nếu đã chấm điểm, nhấn Enter để sang từ tiếp theo
        onSubmit(isCorrect, normalizeChineseInput(inputValue))
      }
    }
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-6 max-w-xl mx-auto w-full p-4 ${className}`}>
      {/* Khung đề bài */}
      <div className="flex w-full flex-col items-center justify-center rounded-3xl border-2 border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900 text-center">
        <div className="flex w-full items-center justify-between mb-4">
          <HskBadge level={item.hsk_level} size="md" />

          <button
            type="button"
            onClick={() => onPlayTTS(item.word)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-blue-600 transition hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-800 dark:text-blue-400"
            title="Nghe phát âm gợi ý"
          >
            <Volume2 className="h-4 w-4" />
          </button>
        </div>

        {/* Nghĩa tiếng Việt của từ */}
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Hãy gõ chữ Hán tương ứng với nghĩa:
        </span>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white max-w-md">
          {item.meaning_vi}
        </h3>

        {/* Gợi ý Pinyin */}
        <div className="mt-4 flex items-center gap-2">
          {showPinyinHint ? (
            <span className="text-base font-semibold text-blue-600 dark:text-blue-400 animate-in fade-in">
              Pinyin: {item.pinyin}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setShowPinyinHint(true)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Xem gợi ý Pinyin</span>
            </button>
          )}
        </div>

        {/* Ô nhập chữ Hán có bảo vệ IME */}
        <div className="mt-6 w-full max-w-md">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            disabled={isAnswered}
            onChange={(e) => setInputValue(e.target.value)}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onKeyDown={handleKeyDown}
            placeholder="Gõ chữ Hán tại đây..."
            className={`w-full rounded-2xl border-2 px-5 py-3.5 text-center font-chinese text-3xl font-bold tracking-wider shadow-inner transition focus:outline-none ${
              isAnswered
                ? isCorrect
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-200'
                  : 'border-rose-500 bg-rose-50 text-rose-900 dark:border-rose-600 dark:bg-rose-950/60 dark:text-rose-200'
                : 'border-slate-300 bg-slate-50 focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus:border-blue-400 dark:focus:bg-slate-900'
            }`}
          />
        </div>

        {/* Kết quả phản hồi sau khi kiểm tra */}
        {isAnswered && (
          <div className="mt-6 flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
            {isCorrect ? (
              <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
                <span>Chính xác tuyệt đối!</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-rose-600 dark:text-rose-400">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="h-5 w-5" />
                  <span>Đáp án đúng là:</span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-chinese text-4xl font-bold text-slate-900 dark:text-white">
                    {item.word}
                  </span>
                  <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    {item.pinyin}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nút hành động */}
      <div className="w-full">
        {!isAnswered ? (
          <button
            type="button"
            onClick={handleCheckAnswer}
            disabled={!inputValue.trim()}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-blue-600 font-bold text-white shadow-md shadow-blue-500/30 transition hover:bg-blue-700 disabled:opacity-50"
          >
            Kiểm tra đáp án (Enter)
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSubmit(isCorrect, normalizeChineseInput(inputValue))}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 font-bold text-white shadow-md transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            <span>Tiếp tục từ tiếp theo</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
