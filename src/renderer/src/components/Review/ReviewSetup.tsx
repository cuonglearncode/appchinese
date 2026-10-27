import React, { useState } from 'react'
import {
  Layers,
  Keyboard,
  Sparkles,
  PenTool,
  Brain,
  Play,
  Loader2,
  AlertCircle,
  GraduationCap
} from 'lucide-react'
import { ReviewMode, SrsAlgorithm } from '@shared/schemas'
import { StartSessionOptions } from '../../hooks/useReviewSession'
import { cn } from '../../lib/utils'

export interface ReviewSetupProps {
  onStart: (options: StartSessionOptions) => void
  isLoading?: boolean
  error?: string | null
  className?: string
}

export const ReviewSetup: React.FC<ReviewSetupProps> = ({
  onStart,
  isLoading = false,
  error = null,
  className = ''
}) => {
  const [selectedHskLevel, setSelectedHskLevel] = useState<number | undefined>(undefined)
  const [batchSize, setBatchSize] = useState<number>(20)
  const [selectedMode, setSelectedMode] = useState<ReviewMode>('flashcard')
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<SrsAlgorithm>('sm2')

  const hskLevels = [
    { level: undefined, label: 'Tất cả cấp độ' },
    { level: 1, label: 'HSK 1' },
    { level: 2, label: 'HSK 2' },
    { level: 3, label: 'HSK 3' },
    { level: 4, label: 'HSK 4' },
    { level: 5, label: 'HSK 5' },
    { level: 6, label: 'HSK 6' }
  ]

  const batchSizes = [10, 20, 30, 50]

  const modes: Array<{
    id: ReviewMode
    title: string
    description: string
    icon: React.ComponentType<{ className?: string }>
  }> = [
    {
      id: 'flashcard',
      title: 'Thẻ ghi nhớ (Flashcard)',
      description: 'Lật thẻ kinh điển, phát âm chuẩn và tự đánh giá theo 4 mức độ nhớ',
      icon: Layers
    },
    {
      id: 'typing',
      title: 'Gõ chữ Hán (Typing)',
      description: 'Nhìn nghĩa/pinyin và gõ chữ Hán chuẩn bộ gõ IME, đo tốc độ phản xạ',
      icon: Keyboard
    },
    {
      id: 'cloze',
      title: 'Đục lỗ ngữ cảnh (Cloze Test)',
      description: 'Điền từ vào câu ví dụ thực tế, tự động xử lý tách từ ly hợp',
      icon: Sparkles
    },
    {
      id: 'handwriting',
      title: 'Luyện viết nét (Handwriting)',
      description: 'Tập viết từng nét chữ Hán trên canvas offline, chấm điểm nét vẽ',
      icon: PenTool
    }
  ]

  const handleStart = (): void => {
    onStart({
      hskLevel: selectedHskLevel,
      limit: batchSize,
      mode: selectedMode,
      algorithm: selectedAlgorithm
    })
  }

  return (
    <div className={cn('flex flex-col gap-6 max-w-3xl mx-auto w-full p-6 select-none', className)}>
      {/* Tiêu đề & Giới thiệu */}
      <div className="flex flex-col gap-1 text-center sm:text-left">
        <div className="flex items-center gap-2 justify-center sm:justify-start">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Không Gian Ôn Tập Thông Minh (Spaced Repetition System)
          </h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Ứng dụng thuật toán ngắt quãng SM-2 và FSRS-4.5 giúp ghi nhớ chữ Hán dài hạn vào trí nhớ vĩnh viễn.
        </p>
      </div>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Chọn Cấp độ HSK */}
      <div className="flex flex-col gap-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          1. Chọn Cấp Độ HSK Mục Tiêu
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {hskLevels.map((lvl) => {
            const isActive = selectedHskLevel === lvl.level
            return (
              <button
                key={lvl.label}
                type="button"
                onClick={() => setSelectedHskLevel(lvl.level)}
                className={cn(
                  'rounded-xl px-3.5 py-2 text-xs font-semibold border transition shadow-xs',
                  isActive
                    ? 'border-blue-600 bg-blue-600 text-white shadow-blue-500/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                )}
              >
                {lvl.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Chọn Chế độ Ôn tập */}
      <div className="flex flex-col gap-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          2. Chọn Chế Độ Ôn Luyện
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {modes.map((m) => {
            const Icon = m.icon
            const isActive = selectedMode === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMode(m.id)}
                className={cn(
                  'flex items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition shadow-xs',
                  isActive
                    ? 'border-blue-600 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/40'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-850'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {m.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {m.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Tùy chọn Số lượng thẻ & Thuật toán SRS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Số lượng từ trong một lượt */}
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Số lượng từ mỗi lượt
          </label>
          <div className="flex items-center gap-2 pt-1">
            {batchSizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setBatchSize(size)}
                className={cn(
                  'flex-1 rounded-xl py-2 text-xs font-bold border transition',
                  batchSize === size
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {size} từ
              </button>
            ))}
          </div>
        </div>

        {/* Lựa chọn thuật toán SRS */}
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-purple-500" />
              <span>Thuật toán SRS</span>
            </label>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setSelectedAlgorithm('sm2')}
              className={cn(
                'flex-1 rounded-xl py-2 text-xs font-bold border transition text-center',
                selectedAlgorithm === 'sm2'
                  ? 'border-purple-600 bg-purple-50 text-purple-700 dark:border-purple-500 dark:bg-purple-950 dark:text-purple-300'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400'
              )}
            >
              SuperMemo-2 (SM-2)
            </button>

            <button
              type="button"
              onClick={() => setSelectedAlgorithm('fsrs')}
              className={cn(
                'flex-1 rounded-xl py-2 text-xs font-bold border transition text-center',
                selectedAlgorithm === 'fsrs'
                  ? 'border-purple-600 bg-purple-50 text-purple-700 dark:border-purple-500 dark:bg-purple-950 dark:text-purple-300'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400'
              )}
            >
              FSRS-4.5 (Hiện đại)
            </button>
          </div>
        </div>
      </div>

      {/* Nút Bắt đầu */}
      <button
        type="button"
        disabled={isLoading}
        onClick={handleStart}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-base font-bold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-700 active:scale-98 disabled:opacity-50 mt-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Đang chuẩn bị thẻ ôn tập...</span>
          </>
        ) : (
          <>
            <Play className="h-5 w-5 fill-current" />
            <span>Bắt đầu ôn tập ({batchSize} từ)</span>
          </>
        )}
      </button>
    </div>
  )
}
