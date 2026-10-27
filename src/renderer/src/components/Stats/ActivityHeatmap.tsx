import React, { useMemo } from 'react'
import { HeatmapDay } from '@shared/schemas'
import { Calendar } from 'lucide-react'

export interface ActivityHeatmapProps {
  data: HeatmapDay[]
  className?: string
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ data, className = '' }) => {
  // Ánh xạ dữ liệu { date: count } để tra cứu O(1)
  const activityMap = useMemo(() => {
    const map = new Map<string, { count: number; correct_count: number }>()
    for (const item of data) {
      map.set(item.date, {
        count: item.count,
        correct_count: item.correct_count
      })
    }
    return map
  }, [data])

  // Sinh 52 tuần gần nhất (364 ngày)
  const weeks = useMemo(() => {
    const now = new Date()
    const result: Array<Array<{ dateStr: string; date: Date }>> = []

    // Lùi về 52 tuần trước
    const startDate = new Date(now)
    startDate.setDate(now.getDate() - 52 * 7 + (7 - now.getDay()))

    let current = new Date(startDate)
    for (let w = 0; w < 52; w++) {
      const week: Array<{ dateStr: string; date: Date }> = []
      for (let d = 0; d < 7; d++) {
        const year = current.getFullYear()
        const month = String(current.getMonth() + 1).padStart(2, '0')
        const day = String(current.getDate()).padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`

        week.push({ dateStr, date: new Date(current) })
        current.setDate(current.getDate() + 1)
      }
      result.push(week)
    }
    return result
  }, [])

  const getColorClass = (count: number): string => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800'
    if (count <= 5) return 'bg-emerald-200 dark:bg-emerald-900'
    if (count <= 15) return 'bg-emerald-400 dark:bg-emerald-700'
    if (count <= 30) return 'bg-emerald-500 dark:bg-emerald-500'
    return 'bg-emerald-700 dark:bg-emerald-300'
  }

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Biểu đồ Hoạt động Ôn tập 365 Ngày (Activity Heatmap)
          </h4>
        </div>

        {/* Chú giải mức độ */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span>Ít hơn</span>
          <span className="h-2.5 w-2.5 rounded-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-200 dark:bg-emerald-900" />
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-400 dark:bg-emerald-700" />
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500 dark:bg-emerald-500" />
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-700 dark:bg-emerald-300" />
          <span>Nhiều hơn</span>
        </div>
      </div>

      {/* Grid các ô vuông nhiệt */}
      <div className="overflow-x-auto pb-1 scrollbar-thin">
        <div className="flex gap-1 min-w-[720px]">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-1">
              {week.map((day) => {
                const act = activityMap.get(day.dateStr) || { count: 0, correct_count: 0 }
                const colorClass = getColorClass(act.count)
                const tooltip = `${day.dateStr}: ${act.count} lượt ôn tập (${act.correct_count} đúng)`

                return (
                  <div
                    key={day.dateStr}
                    title={tooltip}
                    className={`h-2.5 w-2.5 rounded-xs transition-colors hover:ring-2 hover:ring-blue-500 ${colorClass}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
