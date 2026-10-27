import React, { useState } from 'react'
import { X, Check, Tag } from 'lucide-react'
import { SynonymMemberDTO } from '@shared/schemas'

export interface NuanceEditModalProps {
  isOpen: boolean
  groupId: number
  rootGloss: string
  member: SynonymMemberDTO | null
  onClose: () => void
  onSaved: () => void
}

export const NuanceEditModal: React.FC<NuanceEditModalProps> = ({
  isOpen,
  groupId,
  rootGloss,
  member,
  onClose,
  onSaved
}) => {
  if (!isOpen || !member) return null

  const [register, setRegister] = useState<'formal' | 'spoken' | 'neutral'>(member.register)
  const [nuanceNote, setNuanceNote] = useState<string>(member.nuance_note || '')
  const [approveGroup, setApproveGroup] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await window.api.synonym.updateNuance({
        groupId,
        vocabId: member.vocab_id,
        register,
        nuanceNote: nuanceNote.trim(),
        approveGroup
      })

      if (res.success) {
        onSaved()
        onClose()
      } else {
        setError(res.error || 'Không thể lưu thay đổi.')
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi cập nhật.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Tag className="h-5 w-5 text-blue-600" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Chỉnh sửa sắc thái nghĩa
          </h3>
        </div>

        <div className="mb-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <p>
            Nhóm: <span className="font-bold text-blue-600 dark:text-blue-400">[{rootGloss}]</span>
          </p>
          <p className="mt-1">
            Từ Hán: <span className="font-chinese font-bold text-sm text-slate-800 dark:text-slate-100">{member.word}</span> ({member.pinyin}) - HSK {member.hsk_level}
          </p>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Sắc thái ngôn ngữ (Register)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['neutral', 'spoken', 'formal'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegister(r)}
                  className={`rounded-xl py-2 text-xs font-semibold border transition ${
                    register === r
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {r === 'formal' ? 'Trang trọng' : r === 'spoken' ? 'Khẩu ngữ' : 'Trung tính'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Ghi chú sắc thái nghĩa & cách dùng (Nuance note)
            </label>
            <textarea
              rows={3}
              value={nuanceNote}
              onChange={(e) => setNuanceNote(e.target.value)}
              placeholder="VD: Dùng cho người lớn tuổi; động từ li hợp; chỉ dùng trong văn viết..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              maxLength={255}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 select-none">
            <input
              type="checkbox"
              checked={approveGroup}
              onChange={(e) => setApproveGroup(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Đánh dấu đã duyệt nhóm này (Status: Approved)</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>{isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
