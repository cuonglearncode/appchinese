import React, { useState } from 'react'
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Volume2,
  BookOpen
} from 'lucide-react'
import { useStats } from '../../hooks/useStats'
import { useTTS } from '../../hooks/useTTS'
import { ActivityHeatmap } from './ActivityHeatmap'
import { HskBadge } from '../common/Badge'
import { HanziDrawer } from '../HanziDetail/HanziDrawer'
import { VocabWithProgress } from '@shared/schemas'

export interface StatsViewProps {
  onStartReview?: () => void
}

export const StatsView: React.FC<StatsViewProps> = ({ onStartReview }) => {
  const { summary, wrongWords, isLoading, isError, error } = useStats()
  const { speak } = useTTS()

  const [selectedVocab, setSelectedVocab] = useState<VocabWithProgress | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)

  if (isLoading && !summary) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 text-sm">
        Đang tổng hợp dữ liệu thống kê...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center text-rose-500 text-sm">
        Lỗi khi tải dữ liệu thống kê: {error?.message}
      </div>
    )
  }

  const learnedPercent = summary?.total_words
    ? Math.round((summary.total_learned / summary.total_words) * 100)
    : 0

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto p-6 gap-6 bg-slate-50 dark:bg-slate-950 scrollbar-thin select-none">
      {/* Header Thống kê */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span>Thống Kê Tiến Độ Học Tập & Đường Cong Quên</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tổng hợp dữ liệu theo múi giờ địa phương (UTC+7) trên toàn bộ kho từ vựng HSK 1–6.
          </p>
        </div>

        {onStartReview && (
          <button
            type="button"
            onClick={onStartReview}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Ôn tập từ đến hạn ({summary?.total_due_today || 0})</span>
          </button>
        )}
      </div>

      {/* Grid 4 Chỉ số KPI cốt lõi */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tổng từ */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng kho từ</span>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </div>
          <span className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            {summary?.total_words.toLocaleString('vi-VN')}
          </span>
          <span className="text-xs text-slate-400 mt-1">Từ chuẩn HSK 2.0</span>
        </div>

        {/* Đã học */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Đã học được</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
            {summary?.total_learned.toLocaleString('vi-VN')}
          </span>
          <span className="text-xs text-slate-400 mt-1">
            Đạt <strong>{learnedPercent}%</strong> toàn bộ từ điển
          </span>
        </div>

        {/* Cần ôn hôm nay */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Đến hạn ôn</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
            {summary?.total_due_today.toLocaleString('vi-VN')}
          </span>
          <span className="text-xs text-slate-400 mt-1">Từ cần củng cố hôm nay</span>
        </div>

        {/* Tổng lượt ôn tập */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng lượt ôn</span>
            <CheckCircle2 className="h-4 w-4 text-indigo-500" />
          </div>
          <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2">
            {summary?.total_reviews.toLocaleString('vi-VN')}
          </span>
          <span className="text-xs text-slate-400 mt-1">Lần trả lời được ghi log</span>
        </div>
      </div>

      {/* Biểu đồ Activity Heatmap 365 Ngày */}
      <ActivityHeatmap data={summary?.heatmap || []} />

      {/* Cột 2 phần: Tiến độ HSK & Danh sách từ sai nhiều nhất */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tiến độ theo từng cấp độ HSK 1 - 6 */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 border-b border-slate-100 pb-2 dark:border-slate-800">
            Tiến Độ Theo Cấp Độ HSK (1–6)
          </h4>

          <div className="space-y-3 pt-1">
            {summary?.hsk_levels.map((lvl) => {
              const p = lvl.total > 0 ? Math.round((lvl.learned / lvl.total) * 100) : 0
              return (
                <div key={lvl.hsk_level} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <HskBadge level={lvl.hsk_level} size="sm" />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {lvl.learned} / {lvl.total} từ
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">{p}%</span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-500"
                      style={{ width: `${p}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Danh sách Từ sai nhiều nhất (Wrong Words Tracker) */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              <span>Từ Hay Làm Sai Nhiều Nhất</span>
            </div>
            <span className="text-xs text-slate-400">{wrongWords.length} từ</span>
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {wrongWords.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center text-slate-400 text-xs text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-1" />
                <span>Tuyệt vời! Bạn chưa có từ nào bị ghi nhận trả lời sai.</span>
              </div>
            ) : (
              wrongWords.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedVocab(item)
                    setIsDrawerOpen(true)
                  }}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 cursor-pointer transition hover:border-rose-200 hover:bg-rose-50/40 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-rose-950/30"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        speak(item.word)
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-chinese font-bold text-base text-slate-900 dark:text-white">
                          {item.word}
                        </span>
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {item.pinyin}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        {item.meaning_vi}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <HskBadge level={item.hsk_level} size="sm" />
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                      {item.progress?.wrong_count || 0} lần sai
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Drawer Chi tiết từ */}
      <HanziDrawer
        item={selectedVocab}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onPlayTTS={speak}
      />
    </div>
  )
}
