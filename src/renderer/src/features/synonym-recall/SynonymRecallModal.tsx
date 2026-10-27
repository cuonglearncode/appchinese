import React, { useState, useMemo, useRef, useEffect } from 'react'
import { X, Sparkles, CheckCircle2, RotateCcw, Trophy } from 'lucide-react'
import { SynonymMapDTO } from '@shared/schemas'
import { RadialLineSVG } from '../../entities/SynonymNode/RadialLineSVG'
import { SynonymNodeSVG } from '../../entities/SynonymNode/SynonymNodeSVG'

export interface SynonymRecallModalProps {
  isOpen: boolean
  group: SynonymMapDTO | null
  onClose: () => void
  onPlayTTS?: (text: string) => void
  onFinished?: () => void
}

export const SynonymRecallModal: React.FC<SynonymRecallModalProps> = ({
  isOpen,
  group,
  onClose,
  onPlayTTS,
  onFinished
}) => {
  if (!isOpen || !group) return null

  const members = useMemo(() => group.members.slice(0, 8), [group])
  const [unlockedVocabIds, setUnlockedVocabIds] = useState<Set<number>>(new Set())
  const [inputValue, setInputValue] = useState<string>('')
  const [isComposing, setIsComposing] = useState<boolean>(false)
  const [isFinished, setIsFinished] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [recallRatio, setRecallRatio] = useState<number>(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset khi mở nhóm mới
  useEffect(() => {
    setUnlockedVocabIds(new Set())
    setInputValue('')
    setIsFinished(false)
    setIsSubmitting(false)
    setTimeout(() => {
      inputRef.current?.focus()
    }, 150)
  }, [group.id])

  // Tọa độ cực cho đồ thị
  const width = 500
  const height = 380
  const cx = width / 2
  const cy = height / 2 + 10
  const r = Math.min(cx - 75, cy - 50)
  const n = members.length

  const nodes = useMemo(() => {
    return members.map((m, i) => {
      const theta = (2 * Math.PI * i) / n - Math.PI / 2
      const x = cx + r * Math.cos(theta)
      const y = cy + r * Math.sin(theta)
      return { member: m, x, y }
    })
  }, [members, cx, cy, r, n])

  // Kiểm tra từ nhập vào
  const checkAnswer = (text: string): void => {
    const clean = text.trim()
    if (!clean) return

    // Tìm xem có khớp từ Hán hoặc Pinyin (không dấu/có dấu) nào chưa mở khóa không
    const matched = members.find((m) => {
      if (unlockedVocabIds.has(m.vocab_id)) return false
      return (
        m.word === clean ||
        m.pinyin.toLowerCase().replace(/\s+/g, '') === clean.toLowerCase().replace(/\s+/g, '')
      )
    })

    if (matched) {
      const nextUnlocked = new Set(unlockedVocabIds)
      nextUnlocked.add(matched.vocab_id)
      setUnlockedVocabIds(nextUnlocked)
      setInputValue('')
      onPlayTTS?.(matched.word)

      // Nếu đã đoán đúng tất cả các nhánh
      if (nextUnlocked.size === members.length) {
        completeRecall(nextUnlocked)
      }
    }
  }

  // Kết thúc vòng chơi và lưu kết quả SRS
  const completeRecall = async (finalUnlocked: Set<number>): Promise<void> => {
    setIsFinished(true)
    setIsSubmitting(true)

    const results = members.map((m) => ({
      vocab_id: m.vocab_id,
      is_correct: finalUnlocked.has(m.vocab_id)
    }))

    try {
      const res = await window.api.synonym.submitRecallResult({
        groupId: group.id,
        results
      })

      if (res.success) {
        setRecallRatio(res.data.ratio)
      }
    } catch (err) {
      console.error('Lỗi khi gửi kết quả Synonym Recall:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Đầu hàng / Xem đáp án
  const handleGiveUp = (): void => {
    completeRecall(unlockedVocabIds)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-2xl rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Ôn tập: Synonym Recall (Nhớ chùm từ đồng nghĩa)
              </h3>
              <p className="text-xs text-slate-400">
                Gõ các từ tiếng Trung mang nghĩa{' '}
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  [{group.root_gloss}]
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Vùng sơ đồ đồ thị nhánh */}
        <div className="relative flex justify-center items-center py-4 px-2">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[480px] h-auto">
            {nodes.map(({ member, x, y }) => {
              const isRevealed = unlockedVocabIds.has(member.vocab_id) || isFinished
              return (
                <RadialLineSVG
                  key={`line-${member.vocab_id}`}
                  fromX={cx}
                  fromY={cy}
                  toX={x}
                  toY={y}
                  isHighlighted={isRevealed}
                />
              )
            })}

            {/* Nút Gốc ở Tâm [ NGHĨA TIẾNG VIỆT ] */}
            <g transform={`translate(${cx - 65}, ${cy - 24})`}>
              <rect
                width={130}
                height={48}
                rx={16}
                className="fill-blue-600 stroke-blue-400 stroke-2 filter drop-shadow-md"
              />
              <text
                x={65}
                y={28}
                textAnchor="middle"
                className="text-xs font-extrabold uppercase fill-white tracking-wider select-none pointer-events-none"
              >
                [ {group.root_gloss} ]
              </text>
            </g>

            {/* Các nhánh chữ Hán */}
            {nodes.map(({ member, x, y }) => {
              const isRevealed = unlockedVocabIds.has(member.vocab_id) || isFinished
              return (
                <SynonymNodeSVG
                  key={`node-${member.vocab_id}`}
                  member={member}
                  x={x}
                  y={y}
                  isRevealed={isRevealed}
                  onPlayTTS={onPlayTTS}
                />
              )
            })}
          </svg>
        </div>

        {/* Footer: Ô nhập liệu & Điều khiển */}
        <div className="border-t border-slate-100 p-5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          {!isFinished ? (
            <div className="flex flex-col gap-3">
              <div className="relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value)
                    // Kiểm tra ngay nếu người dùng gõ xong chữ Hán
                    if (!isComposing) {
                      checkAnswer(e.target.value)
                    }
                  }}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={(e) => {
                    setIsComposing(false)
                    checkAnswer((e.target as HTMLInputElement).value)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isComposing) {
                      e.preventDefault()
                      checkAnswer(inputValue)
                    }
                  }}
                  placeholder="Gõ chữ Hán hoặc Pinyin để mở khóa nhánh..."
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-chinese text-slate-800 shadow-inner focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 pr-24"
                />

                <div className="absolute right-3 flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {unlockedVocabIds.size}
                  </span>
                  <span>/</span>
                  <span>{members.length} từ</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Mẹo: Nhấn Enter hoặc hoàn tất bộ gõ IME Pinyin để mở khóa.
                </span>
                <button
                  type="button"
                  onClick={handleGiveUp}
                  disabled={isSubmitting}
                  className="text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Đầu hàng / Xem đáp án'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-amber-500" />
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Đã hoàn thành sơ đồ [{group.root_gloss}]!
                </h4>
              </div>

              <p className="text-xs text-slate-500">
                Bạn đã nhớ đúng{' '}
                <span className="font-bold text-emerald-600 text-sm">
                  {unlockedVocabIds.size}/{members.length}
                </span>{' '}
                từ ({Math.round(recallRatio * 100)}%). Tiến độ SRS của từng từ đã được tự động cập nhật!
              </p>

              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setUnlockedVocabIds(new Set())
                    setIsFinished(false)
                    setTimeout(() => inputRef.current?.focus(), 100)
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Chơi lại</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onFinished?.()
                    onClose()
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Hoàn tất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
