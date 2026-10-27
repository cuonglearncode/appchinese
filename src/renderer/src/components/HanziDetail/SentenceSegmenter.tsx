import React, { useMemo } from 'react'
import { Volume2, Sparkles } from 'lucide-react'
import { segmentChineseSentence } from '@shared/string-utils'
import { cn } from '../../lib/utils'

export interface SentenceSegmenterProps {
  sentenceZh: string | null | undefined
  sentenceVi: string | null | undefined
  targetWord?: string
  onSelectWord?: (word: string) => void
  onPlayTTS?: (text: string) => void
  className?: string
}

export const SentenceSegmenter: React.FC<SentenceSegmenterProps> = ({
  sentenceZh,
  sentenceVi,
  targetWord,
  onSelectWord,
  onPlayTTS,
  className = ''
}) => {
  const tokens = useMemo(() => {
    if (!sentenceZh) return []
    return segmentChineseSentence(sentenceZh, targetWord)
  }, [sentenceZh, targetWord])

  if (!sentenceZh) return null

  const handlePlaySentence = (): void => {
    if (onPlayTTS && sentenceZh) {
      onPlayTTS(sentenceZh)
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-slate-50/80 p-4 transition dark:border-slate-800 dark:bg-slate-900/60',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
          <span>Câu ví dụ & Tách từ tương tác (Intl.Segmenter)</span>
        </div>

        {onPlayTTS && (
          <button
            type="button"
            onClick={handlePlaySentence}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
            title="Nghe toàn bộ câu ví dụ"
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>Nghe câu</span>
          </button>
        )}
      </div>

      {/* Hiển thị câu tiếng Trung được phân tách thành từng từ có thể click */}
      <div className="flex flex-wrap items-center gap-1 leading-relaxed font-chinese text-lg text-slate-800 dark:text-slate-200 py-1">
        {tokens.map((token, index) => {
          if (!token.isWord) {
            return (
              <span key={`${token.text}-${index}`} className="text-slate-400 px-0.5 select-none">
                {token.text}
              </span>
            )
          }

          if (token.isTargetWord) {
            return (
              <span
                key={`${token.text}-${index}`}
                className="inline-block rounded-md bg-blue-100 px-1.5 py-0.5 font-bold text-blue-900 shadow-sm border border-blue-300 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-700"
                title="Từ mục tiêu trong câu"
              >
                {token.text}
              </span>
            )
          }

          return (
            <button
              key={`${token.text}-${index}`}
              type="button"
              onClick={() => onSelectWord && onSelectWord(token.text)}
              className="inline-block rounded px-1.5 py-0.5 transition hover:bg-blue-50 hover:text-blue-600 active:scale-95 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
              title={`Nhấp để tra nhanh từ "${token.text}"`}
            >
              {token.text}
            </button>
          )
        })}
      </div>

      {/* Dịch nghĩa tiếng Việt */}
      {sentenceVi && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 italic">
          {sentenceVi}
        </p>
      )}
    </div>
  )
}
