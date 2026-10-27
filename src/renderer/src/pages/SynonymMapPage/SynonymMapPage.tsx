import React, { useState } from 'react'
import {
  Search,
  Layers,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react'
import { SynonymMapDTO } from '@shared/schemas'
import { useSynonymMapList } from '../../hooks/useSynonymGroups'
import { useTTS } from '../../hooks/useTTS'
import { SynonymMapCard } from '../../widgets/SynonymMapCard/SynonymMapCard'
import { SynonymRecallModal } from '../../features/synonym-recall/SynonymRecallModal'

export interface SynonymMapPageProps {
  onSelectWord?: (word: string) => void
}

export const SynonymMapPage: React.FC<SynonymMapPageProps> = ({ onSelectWord }) => {
  const {
    items,
    total,
    page,
    limit,
    isLoading,
    filter,
    setFilter,
    refetch,
    buildGroups,
    isBuilding
  } = useSynonymMapList({ limit: 12 })

  const { speak } = useTTS()
  const [selectedRecallGroup, setSelectedRecallGroup] = useState<SynonymMapDTO | null>(null)
  const [searchInput, setSearchInput] = useState<string>('')

  const handleSearchSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    setFilter((prev) => ({
      ...prev,
      search: searchInput.trim() || undefined,
      page: 1
    }))
  }

  const handleHskFilter = (level?: number): void => {
    setFilter((prev) => ({
      ...prev,
      hskLevel: level,
      page: 1
    }))
  }

  const handleStatusFilter = (status?: 'draft' | 'approved' | 'hidden'): void => {
    setFilter((prev) => ({
      ...prev,
      status,
      page: 1
    }))
  }

  const totalPages = Math.ceil(total / limit) || 1

  return (
    <div className="flex h-full flex-col gap-5 p-6 overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* 1. Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Bản đồ Từ đồng nghĩa (Synonym Maps)
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Khám phá {total} chùm từ vựng HSK tỏa nhánh quanh các nghĩa tiếng Việt
              </p>
            </div>
          </div>
        </div>

        {/* Nút Chạy Build / Cập nhật chùm từ */}
        <button
          type="button"
          onClick={async () => {
            await buildGroups()
            refetch()
          }}
          disabled={isBuilding}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-blue-600 ${isBuilding ? 'animate-spin' : ''}`} />
          <span>{isBuilding ? 'Đang phân tích...' : 'Cập nhật từ 5.003 HSK'}</span>
        </button>
      </div>

      {/* 2. Thanh lọc & Tìm kiếm */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shrink-0 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        {/* Form tìm kiếm nghĩa / chữ Hán */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo nghĩa tiếng Việt (VD: đẹp, vui vẻ) hoặc chữ Hán..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </form>

        {/* Bộ lọc cấp độ HSK */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
          <button
            type="button"
            onClick={() => handleHskFilter(undefined)}
            className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
              filter.hskLevel === undefined
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            Tất cả HSK
          </button>
          {[1, 2, 3, 4, 5, 6].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => handleHskFilter(lvl)}
              className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
                filter.hskLevel === lvl
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              HSK {lvl}
            </button>
          ))}
        </div>

        {/* Bộ lọc trạng thái */}
        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-3">
          <button
            type="button"
            onClick={() => handleStatusFilter(undefined)}
            className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
              filter.status === undefined
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => handleStatusFilter('approved')}
            className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
              filter.status === 'approved'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Đã duyệt
          </button>
        </div>
      </div>

      {/* 3. Lưới hiển thị các thẻ sơ đồ nhánh */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-slate-400 text-xs">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-500 mr-2" />
            <span>Đang nạp các sơ đồ từ đồng nghĩa...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/50 text-slate-400 dark:border-slate-800 dark:bg-slate-900/40">
            <Layers className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Không tìm thấy sơ đồ phù hợp
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Hãy bấm &quot;Cập nhật từ 5.003 HSK&quot; để hệ thống tự động quét và tạo sơ đồ từ vựng.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {items.map((group) => (
              <SynonymMapCard
                key={group.id}
                groups={[group]}
                onSelectWord={onSelectWord}
                onPlayTTS={speak}
                onStartRecall={(g) => setSelectedRecallGroup(g)}
                width={440}
                height={330}
              />
            ))}
          </div>
        )}
      </div>

      {/* 4. Thanh phân trang */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3 shrink-0 text-xs text-slate-500">
          <span>
            Trang {page} / {totalPages} (Tổng cộng {total} sơ đồ)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setFilter((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setFilter((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 5. Modal Luyện nhớ Synonym Recall */}
      <SynonymRecallModal
        isOpen={Boolean(selectedRecallGroup)}
        group={selectedRecallGroup}
        onClose={() => setSelectedRecallGroup(null)}
        onPlayTTS={speak}
        onFinished={() => refetch()}
      />
    </div>
  )
}
