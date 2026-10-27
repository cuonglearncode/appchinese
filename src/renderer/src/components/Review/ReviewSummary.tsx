import React from 'react'
import { CheckCircle2, RotateCcw, BarChart3, BookOpen } from 'lucide-react'
import { SessionStats } from '../../hooks/useReviewSession'

export interface ReviewSummaryProps {
  stats: SessionStats
  onRestart: () => void
  onBackToDictionary: () => void
  className?: string
}

export const ReviewSummary: React.FC<ReviewSummaryProps> = ({
  stats,
  onRestart,
  onBackToDictionary,
  className = ''
}) => {
  const accuracy = stats.totalReviewed > 0
    ? Math.round((stats.correctCount / stats.totalReviewed) * 100)
    : 0

  const avgTimeSec = stats.totalReviewed > 0
    ? (stats.totalTimeMs / stats.totalReviewed / 1000).toFixed(1)
    : '0.0'

  return (
    <div className={`flex flex-col items-center justify-center gap-6 max-w-xl mx-auto w-full p-6 select-none ${className}`}>
      {/* Banner chúc mừng */}
      <div className="flex flex-col items-center text-center gap-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 shadow-md shadow-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-400">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
          Xuất sắc! Bạn đã hoàn thành phiên ôn tập
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Dữ liệu tiến độ học tập và lịch sử trả lời đã được đồng bộ vào cơ sở dữ liệu.
        </p>
      </div>

      {/* Grid thống kê phiên ôn tập */}
      <div className="grid grid-cols-3 gap-3 w-full">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs text-center">
          <span className="text-xs text-slate-400 font-medium">Đã ôn tập</span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.totalReviewed}
          </span>
          <span className="text-[10px] text-slate-400">từ vựng</span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs text-center">
          <span className="text-xs text-slate-400 font-medium">Tỷ lệ chính xác</span>
          <span className={`text-2xl font-bold mt-1 ${accuracy >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {accuracy}%
          </span>
          <span className="text-[10px] text-slate-400">{stats.correctCount} đúng / {stats.wrongCount} sai</span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs text-center">
          <span className="text-xs text-slate-400 font-medium">Thời gian TB</span>
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {avgTimeSec}s
          </span>
          <span className="text-[10px] text-slate-400">mỗi từ</span>
        </div>
      </div>

      {/* Phân bổ đánh giá SRS */}
      <div className="flex flex-col gap-2.5 w-full rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          <BarChart3 className="h-4 w-4 text-blue-500" />
          <span>Phân bổ đánh giá độ nhớ SRS</span>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-2">
          <div className="flex flex-col items-center rounded-xl bg-rose-50 p-2.5 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-center">
            <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">Quên</span>
            <span className="text-xl font-bold text-rose-900 dark:text-rose-200 mt-0.5">
              {stats.ratings[1] || 0}
            </span>
          </div>

          <div className="flex flex-col items-center rounded-xl bg-amber-50 p-2.5 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-center">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Khó</span>
            <span className="text-xl font-bold text-amber-900 dark:text-amber-200 mt-0.5">
              {stats.ratings[2] || 0}
            </span>
          </div>

          <div className="flex flex-col items-center rounded-xl bg-blue-50 p-2.5 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-center">
            <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">Nhớ</span>
            <span className="text-xl font-bold text-blue-900 dark:text-blue-200 mt-0.5">
              {stats.ratings[3] || 0}
            </span>
          </div>

          <div className="flex flex-col items-center rounded-xl bg-emerald-50 p-2.5 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-center">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Dễ</span>
            <span className="text-xl font-bold text-emerald-900 dark:text-emerald-200 mt-0.5">
              {stats.ratings[4] || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Nút điều hướng */}
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full mt-2">
        <button
          type="button"
          onClick={onRestart}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 font-bold text-white shadow-md shadow-blue-500/30 transition hover:bg-blue-700 w-full"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Ôn tập lượt mới</span>
        </button>

        <button
          type="button"
          onClick={onBackToDictionary}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 w-full"
        >
          <BookOpen className="h-4 w-4" />
          <span>Về từ điển HSK</span>
        </button>
      </div>
    </div>
  )
}
