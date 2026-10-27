import React from 'react'
import { cn } from '../../lib/utils'

export interface HskBadgeProps {
  level: number
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export const HskBadge: React.FC<HskBadgeProps> = ({ level, className, size = 'sm' }) => {
  const levelStyles: Record<number, string> = {
    1: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800',
    2: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-800',
    3: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800',
    4: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800',
    5: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800',
    6: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800'
  }

  const sizeStyles: Record<string, string> = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  }

  const currentStyle = levelStyles[level] || 'bg-slate-100 text-slate-800 border-slate-300'
  const currentSize = sizeStyles[size]

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-md border tracking-wide transition-colors',
        currentStyle,
        currentSize,
        className
      )}
    >
      HSK {level}
    </span>
  )
}

export interface StateBadgeProps {
  state?: 'new' | 'learning' | 'review' | 'relearning' | string | null
  className?: string
}

export const StateBadge: React.FC<StateBadgeProps> = ({ state = 'new', className }) => {
  const stateConfigs: Record<string, { label: string; style: string }> = {
    new: {
      label: 'Chưa học',
      style:
        'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
    },
    learning: {
      label: 'Đang học',
      style:
        'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
    },
    review: {
      label: 'Cần ôn',
      style:
        'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
    },
    relearning: {
      label: 'Học lại',
      style:
        'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
    }
  }

  const config = stateConfigs[state || 'new'] || stateConfigs.new

  return (
    <span
      className={cn(
        'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border',
        config.style,
        className
      )}
    >
      {config.label}
    </span>
  )
}

export interface SinoVietnameseBadgeProps {
  reading: string | null | undefined
  className?: string
}

export const SinoVietnameseBadge: React.FC<SinoVietnameseBadgeProps> = ({ reading, className }) => {
  if (!reading) return null

  return (
    <span
      className={cn(
        'inline-flex items-center text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60',
        className
      )}
      title="Âm Hán Việt"
    >
      {reading}
    </span>
  )
}
