import React from 'react'
import {
  BookOpen,
  GraduationCap,
  Bookmark,
  BarChart3,
  Database,
  CheckCircle2,
  HardDrive,
  Layers
} from 'lucide-react'
import { cn } from '../../lib/utils'

export type NavTab = 'dictionary' | 'srs' | 'notebook' | 'stats' | 'synonyms'

export interface SidebarProps {
  currentTab: NavTab
  onSelectTab: (tab: NavTab) => void
  className?: string
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  className = ''
}) => {
  const navItems: Array<{
    id: NavTab
    label: string
    icon: React.ComponentType<{ className?: string }>
    badge?: string
    disabled?: boolean
  }> = [
    {
      id: 'dictionary',
      label: 'Từ điển HSK',
      icon: BookOpen
    },
    {
      id: 'synonyms',
      label: 'Sơ đồ Đồng nghĩa',
      icon: Layers,
      badge: 'Mới'
    },
    {
      id: 'srs',
      label: 'Ôn tập SRS',
      icon: GraduationCap,
      badge: 'SM-2 / FSRS'
    },
    {
      id: 'notebook',
      label: 'Sổ tay từ vựng',
      icon: Bookmark
    },
    {
      id: 'stats',
      label: 'Thống kê & Heatmap',
      icon: BarChart3
    }
  ]

  return (
    <aside
      className={cn(
        'flex w-64 flex-col justify-between border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 shrink-0 select-none',
        className
      )}
    >
      <div className="flex flex-col gap-6">
        {/* Logo & App Title */}
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-chinese text-xl font-bold text-white shadow-md shadow-blue-500/30">
            汉
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              HSK Master
            </h1>
            <span className="text-xs text-slate-400 font-medium">
              Từ điển HSK 1–6 Desktop
            </span>
          </div>
        </div>

        {/* Danh sách Menu Điều Hướng */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentTab === item.id

            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => onSelectTab(item.id)}
                className={cn(
                  'flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    : item.disabled
                      ? 'text-slate-400 cursor-not-allowed opacity-60 dark:text-slate-600'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn('h-5 w-5', isActive ? 'text-blue-600 dark:text-blue-400' : '')} />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Widget trạng thái hệ thống ở cuối Sidebar */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-500 dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <Database className="h-3.5 w-3.5 text-emerald-500" />
            <span>SQLite Cục bộ</span>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            <span>5.003 từ</span>
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5 text-blue-500" />
            <span>Nét viết Offline</span>
          </div>
          <span className="font-semibold text-slate-600 dark:text-slate-300">100% Cục bộ</span>
        </div>
      </div>
    </aside>
  )
}
