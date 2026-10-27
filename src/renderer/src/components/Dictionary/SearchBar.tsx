import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X, Zap } from 'lucide-react'
import { normalizeChineseInput } from '@shared/string-utils'

export interface SearchBarProps {
  query: string
  onSearchChange: (value: string) => void
  totalCount: number
  responseTimeMs: number
  isLoading?: boolean
  className?: string
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onSearchChange,
  totalCount,
  responseTimeMs,
  isLoading = false,
  className = ''
}) => {
  const [localValue, setLocalValue] = useState<string>(query)
  const isComposingRef = useRef<boolean>(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Đồng bộ prop query nếu có thay đổi từ bên ngoài (ví dụ bấm từ vựng từ liên quan)
  useEffect(() => {
    setLocalValue(query)
  }, [query])

  // Lắng nghe phím tắt Ctrl+K hoặc / để focus vào ô tìm kiếm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      } else if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const triggerSearch = useCallback(
    (val: string): void => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        onSearchChange(normalizeChineseInput(val))
      }, 150)
    },
    [onSearchChange]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value
    setLocalValue(val)

    // Nếu đang trong phiên gõ IME (chưa chọn chữ Hán), không kích hoạt tìm kiếm
    if (!isComposingRef.current) {
      triggerSearch(val)
    }
  }

  const handleCompositionStart = (): void => {
    isComposingRef.current = true
  }

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>): void => {
    isComposingRef.current = false
    const val = e.currentTarget.value
    setLocalValue(val)
    triggerSearch(val)
  }

  const handleClear = (): void => {
    setLocalValue('')
    onSearchChange('')
    inputRef.current?.focus()
  }

  return (
    <div className={`relative flex flex-col sm:flex-row items-stretch sm:items-center gap-3 ${className}`}>
      {/* Khung nhập tìm kiếm */}
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          <Search className="h-4 w-4" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleChange}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder="Tìm kiếm bằng Chữ Hán, Pinyin hoặc Nghĩa tiếng Việt... (Ctrl + K)"
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
        />

        {localValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Xóa nội dung tìm kiếm"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Thông tin SLA thời gian phản hồi & Tổng số từ tìm được */}
      <div className="flex items-center gap-2 text-xs">
        <div
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-medium transition ${
            responseTimeMs <= 30
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
          }`}
          title="Thời gian phản hồi truy vấn từ Database (SLA yêu cầu < 30ms)"
        >
          <Zap className="h-3.5 w-3.5" />
          <span>
            {isLoading ? 'Đang truy vấn...' : `${responseTimeMs}ms (SLA < 30ms)`}
          </span>
        </div>

        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <span>{totalCount.toLocaleString('vi-VN')} từ vựng</span>
        </div>
      </div>
    </div>
  )
}
