import React, { useState, useMemo } from 'react'
import {
  Bookmark,
  Plus,
  Edit2,
  Trash2,
  Download,
  Search,
  Play
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Notebook, VocabWithProgress } from '@shared/schemas'
import { useNotebooks } from '../../hooks/useNotebooks'
import { useTTS } from '../../hooks/useTTS'
import { NotebookModal } from './NotebookModal'
import { VocabRow } from '../Dictionary/VocabRow'
import { HanziDrawer } from '../HanziDetail/HanziDrawer'
import { cn } from '../../lib/utils'

export interface NotebookViewProps {
  onStartReview?: () => void
}

export const NotebookView: React.FC<NotebookViewProps> = ({ onStartReview }) => {
  const {
    notebooks,
    createNotebook,
    updateNotebook,
    deleteNotebook,
    toggleItem: toggleNotebookItem,
    refetch: refetchNotebooks
  } = useNotebooks()

  const { speak } = useTTS()

  const [selectedNotebookId, setSelectedNotebookId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null)
  const [selectedVocab, setSelectedVocab] = useState<VocabWithProgress | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)

  // Tự động chọn sổ tay đầu tiên nếu chưa chọn
  const activeNotebook = useMemo(() => {
    if (notebooks.length === 0) return null
    if (selectedNotebookId) {
      return notebooks.find((n) => n.id === selectedNotebookId) || notebooks[0]
    }
    return notebooks[0]
  }, [notebooks, selectedNotebookId])

  // Nạp danh sách từ vựng trong sổ tay đang chọn
  const vocabQuery = useQuery<VocabWithProgress[]>({
    queryKey: ['notebook', 'items', activeNotebook?.id, searchQuery],
    queryFn: async () => {
      if (!activeNotebook) return []
      const res = await window.api.vocab.search({
        notebook_id: activeNotebook.id,
        query: searchQuery.trim() || undefined,
        limit: 1000
      })
      if (!res.success) {
        throw new Error(res.error || 'Lỗi khi nạp từ vựng trong sổ tay')
      }
      return res.data.items
    },
    enabled: Boolean(activeNotebook?.id),
    staleTime: 10_000
  })

  const items = vocabQuery.data ?? []

  const handleOpenCreateModal = (): void => {
    setEditingNotebook(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (nb: Notebook, e: React.MouseEvent): void => {
    e.stopPropagation()
    setEditingNotebook(nb)
    setIsModalOpen(true)
  }

  const handleDeleteNotebook = async (id: number, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (window.confirm('Bạn có chắc chắn muốn xóa sổ tay này không?')) {
      await deleteNotebook(id)
      if (selectedNotebookId === id) {
        setSelectedNotebookId(null)
      }
    }
  }

  const handleSaveModal = async (name: string, color: string): Promise<void> => {
    if (editingNotebook) {
      await updateNotebook({ id: editingNotebook.id, name, color })
    } else {
      const created = await createNotebook({ name, color })
      setSelectedNotebookId(created.id)
    }
  }

  const handleRemoveFromNotebook = async (vocabId: number): Promise<void> => {
    if (!activeNotebook) return
    await toggleNotebookItem({ notebookId: activeNotebook.id, vocabId })
    vocabQuery.refetch()
    refetchNotebooks()
  }

  // Xuất dữ liệu sổ tay ra JSON
  const handleExportJSON = (): void => {
    if (!activeNotebook || items.length === 0) return
    const exportData = {
      notebook: activeNotebook.name,
      exported_at: new Date().toISOString(),
      total: items.length,
      items: items.map((it) => ({
        word: it.word,
        pinyin: it.pinyin,
        meaning_vi: it.meaning_vi,
        hsk_level: it.hsk_level,
        example_zh: it.example_zh,
        example_vi: it.example_vi
      }))
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sotay_${activeNotebook.name}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-950 select-none">
      {/* 1. Cột trái: Danh sách các sổ tay cá nhân */}
      <aside className="flex w-72 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shrink-0">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Sổ Tay Của Tôi
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300"
            title="Tạo sổ tay mới"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Danh sách Sổ tay */}
        <div className="flex-1 overflow-y-auto pt-3 space-y-1.5 scrollbar-thin">
          {notebooks.map((nb) => {
            const isActive = activeNotebook?.id === nb.id
            return (
              <div
                key={nb.id}
                onClick={() => setSelectedNotebookId(nb.id)}
                className={cn(
                  'group flex items-center justify-between rounded-xl p-3 cursor-pointer transition',
                  isActive
                    ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-200 shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="h-3.5 w-3.5 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: nb.color }}
                  />
                  <span className="text-sm font-semibold truncate">
                    {nb.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {nb.item_count}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => handleOpenEditModal(nb, e)}
                    className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Chỉnh sửa sổ tay"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteNotebook(nb.id, e)}
                    className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                    title="Xóa sổ tay"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      {/* 2. Cột phải: Chi tiết và danh sách từ vựng trong sổ tay */}
      <main className="flex flex-1 flex-col overflow-hidden p-6 gap-4">
        {activeNotebook ? (
          <>
            {/* Top Toolbar của Sổ tay */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span
                  className="h-5 w-5 rounded-full shadow-sm shrink-0"
                  style={{ backgroundColor: activeNotebook.color }}
                />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {activeNotebook.name}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {items.length} từ vựng đã lưu
                  </span>
                </div>
              </div>

              {/* Nút tác vụ */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportJSON}
                  disabled={items.length === 0}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                  title="Xuất danh sách từ vựng ra file JSON"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Xuất file</span>
                </button>

                {onStartReview && (
                  <button
                    type="button"
                    onClick={onStartReview}
                    disabled={items.length === 0}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Luyện tập ngay</span>
                  </button>
                )}
              </div>
            </div>

            {/* Ô tìm kiếm từ bên trong sổ tay */}
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm từ vựng trong sổ tay này..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs text-slate-900 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Danh sách các từ vựng */}
            <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 scrollbar-thin">
              {items.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400 text-center p-6">
                  <Bookmark className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Sổ tay này chưa có từ vựng nào
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Hãy duyệt từ điển HSK và nhấn vào biểu tượng Bookmark trên bất kỳ từ nào để thêm vào sổ tay này.
                  </p>
                </div>
              ) : (
                items.map((item) => (
                  <VocabRow
                    key={item.id}
                    item={item}
                    onSelect={(it) => {
                      setSelectedVocab(it)
                      setIsDrawerOpen(true)
                    }}
                    onPlayTTS={speak}
                    onToggleBookmark={handleRemoveFromNotebook}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400 text-sm">
            Chưa có sổ tay nào. Hãy tạo một sổ tay mới ở cột bên trái!
          </div>
        )}
      </main>

      {/* Modal Tạo/Sửa Sổ tay */}
      <NotebookModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveModal}
        initialNotebook={editingNotebook}
      />

      {/* Drawer Chi tiết từ vựng */}
      <HanziDrawer
        item={selectedVocab}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onPlayTTS={speak}
        onToggleBookmark={handleRemoveFromNotebook}
      />
    </div>
  )
}
