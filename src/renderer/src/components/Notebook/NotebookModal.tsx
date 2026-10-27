import React, { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import { Notebook } from '@shared/schemas'

export interface NotebookModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (name: string, color: string) => Promise<void>
  initialNotebook?: Notebook | null
}

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#64748b'  // slate
]

export const NotebookModal: React.FC<NotebookModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialNotebook = null
}) => {
  const [name, setName] = useState<string>('')
  const [color, setColor] = useState<string>('#3b82f6')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  useEffect(() => {
    if (initialNotebook) {
      setName(initialNotebook.name)
      setColor(initialNotebook.color)
    } else {
      setName('')
      setColor('#3b82f6')
    }
  }, [initialNotebook, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      await onSave(name.trim(), color)
      onClose()
    } catch (err) {
      console.error('Lỗi khi lưu sổ tay:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {initialNotebook ? 'Chỉnh sửa Sổ tay' : 'Tạo Sổ tay mới'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">
              Tên sổ tay:
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Từ vựng yêu thích, Từ dễ quên..."
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">
              Màu đại diện:
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => {
                const isSelected = color === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className="flex h-8 w-8 items-center justify-center rounded-full shadow-xs transition transform hover:scale-110"
                  >
                    {isSelected && <Check className="h-4 w-4 text-white stroke-[3]" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu sổ tay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
