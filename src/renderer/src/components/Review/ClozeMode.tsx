import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Volume2, CheckCircle2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react'
import { VocabWithProgress } from '@shared/schemas'
import { generateCloze, verifyClozeAnswer, ClozeItem } from '@shared/srs/cloze'
import { HskBadge } from '../common/Badge'

export interface ClozeModeProps {
  item: VocabWithProgress
  onSubmit: (isCorrect: boolean, userInput: string) => void
  onPlayTTS: (text: string) => void
  className?: string
}

export const ClozeMode: React.FC<ClozeModeProps> = ({
  item,
  onSubmit,
  onPlayTTS,
  className = ''
}) => {
  const cloze = useMemo<ClozeItem | null>(() => {
    return generateCloze(item.example_zh, item.word)
  }, [item.example_zh, item.word])

  // Nếu là từ ly hợp có 2 chỗ trống, lưu mảng string[]
  const blankCount = cloze?.blanks.length || 1
  const [inputs, setInputs] = useState<string[]>(Array(blankCount).fill(''))
  const [isAnswered, setIsAnswered] = useState<boolean>(false)
  const [isCorrect, setIsCorrect] = useState<boolean>(false)

  const isComposingRef = useRef<boolean>(false)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const count = cloze?.blanks.length || 1
    setInputs(Array(count).fill(''))
    setIsAnswered(false)
    setIsCorrect(false)
    isComposingRef.current = false
    firstInputRef.current?.focus()
  }, [item.id, cloze])

  const handleInputChange = (index: number, val: string): void => {
    setInputs((prev) => {
      const next = [...prev]
      next[index] = val
      return next
    })
  }

  const handleCheck = (): void => {
    if (isComposingRef.current || inputs.some((val) => !val.trim())) return

    let correct = false
    if (cloze) {
      correct = verifyClozeAnswer(inputs, cloze)
    } else {
      // Fallback
      correct = inputs[0].trim() === item.word
    }

    setIsCorrect(correct)
    setIsAnswered(true)

    // Phát âm câu ví dụ đầy đủ
    if (item.example_zh) {
      onPlayTTS(item.example_zh)
    } else {
      onPlayTTS(item.word)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      if (!isAnswered) {
        if (!isComposingRef.current) {
          handleCheck()
        }
      } else {
        onSubmit(isCorrect, inputs.join(' '))
      }
    }
  }

  // Tách câu đục lỗ thành các phần trước/sau các ô nhập
  const renderSentenceWithInputs = () => {
    if (!cloze) {
      return (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-slate-500">
            Từ này chưa có câu ví dụ, hãy điền từ vào ô bên dưới:
          </p>
          <input
            ref={firstInputRef}
            type="text"
            value={inputs[0] || ''}
            disabled={isAnswered}
            onChange={(e) => handleInputChange(0, e.target.value)}
            onCompositionStart={() => (isComposingRef.current = true)}
            onCompositionEnd={(e) => {
              isComposingRef.current = false
              handleInputChange(0, e.currentTarget.value)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Gõ chữ Hán..."
            className="rounded-xl border-2 border-slate-300 px-4 py-2 font-chinese text-2xl font-bold text-center focus:border-blue-500 focus:outline-none"
          />
        </div>
      )
    }

    // Tách chuỗi theo mẫu "[___]"
    const parts = cloze.clozeSentence.split('[___]')

    return (
      <div className="flex flex-wrap items-center justify-center gap-1.5 font-chinese text-2xl text-slate-800 dark:text-slate-100 leading-loose py-2">
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            <span>{part}</span>
            {index < parts.length - 1 && (
              <input
                ref={index === 0 ? firstInputRef : undefined}
                type="text"
                value={inputs[index] || ''}
                disabled={isAnswered}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onCompositionStart={() => (isComposingRef.current = true)}
                onCompositionEnd={(e) => {
                  isComposingRef.current = false
                  handleInputChange(index, e.currentTarget.value)
                }}
                onKeyDown={handleKeyDown}
                placeholder={cloze.isSeparable ? `(${cloze.blanks[index]?.length} chữ)` : '___'}
                style={{ width: `${Math.max(64, (cloze.blanks[index]?.length || 2) * 36)}px` }}
                className={`rounded-xl border-2 px-2 py-1 text-center font-chinese text-2xl font-bold transition focus:outline-none ${
                  isAnswered
                    ? isCorrect
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                      : 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200'
                    : 'border-blue-400 bg-blue-50/60 focus:border-blue-600 focus:bg-white dark:border-blue-700 dark:bg-slate-800'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-6 max-w-xl mx-auto w-full p-4 ${className}`}>
      <div className="flex w-full flex-col items-center justify-center rounded-3xl border-2 border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900 text-center">
        <div className="flex w-full items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HskBadge level={item.hsk_level} size="md" />
            {cloze?.isSeparable && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                Từ ly hợp
              </span>
            )}
          </div>

          {item.example_zh && (
            <button
              type="button"
              onClick={() => onPlayTTS(item.example_zh || '')}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-blue-600 transition hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-800 dark:text-blue-400"
              title="Phát âm câu ví dụ"
            >
              <Volume2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
          <span>Điền từ thích hợp vào chỗ trống trong câu ví dụ:</span>
        </div>

        {/* Nghĩa của từ mục tiêu */}
        <div className="mb-4">
          <span className="text-base font-bold text-blue-600 dark:text-blue-400">
            Từ cần điền: {item.meaning_vi} ({item.pinyin})
          </span>
        </div>

        {/* Khung hiển thị câu có ô đục lỗ */}
        <div className="w-full rounded-2xl bg-slate-50/80 p-5 border border-slate-200 dark:bg-slate-800/40 dark:border-slate-800 my-2">
          {renderSentenceWithInputs()}

          {item.example_vi && (
            <p className="mt-3 text-xs text-slate-500 italic">
              Dịch nghĩa: {item.example_vi}
            </p>
          )}
        </div>

        {/* Kết quả phản hồi */}
        {isAnswered && (
          <div className="mt-4 flex flex-col items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
            {isCorrect ? (
              <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <span>Chính xác! Bạn đã nắm vững ngữ cảnh sử dụng.</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-rose-600 dark:text-rose-400">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="h-5 w-5" />
                  <span>Đáp án đúng là:</span>
                </div>
                <span className="font-chinese text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {cloze?.originalSentence || item.word}
                </span>
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
            onClick={handleCheck}
            disabled={inputs.some((val) => !val.trim())}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-blue-600 font-bold text-white shadow-md shadow-blue-500/30 transition hover:bg-blue-700 disabled:opacity-50"
          >
            Kiểm tra đáp án (Enter)
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSubmit(isCorrect, inputs.join(' '))}
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
