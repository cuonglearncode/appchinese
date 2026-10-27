import React, { useEffect, useRef, useState, useCallback } from 'react'
import HanziWriter from 'hanzi-writer'
import { Play, RotateCcw, PenTool, Eye, EyeOff, Grid, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

export type GridType = 'mi' | 'tian' | 'none'

export interface HanziWriterCanvasProps {
  char: string
  size?: number
  className?: string
  onQuizComplete?: (totalMistakes: number) => void
}

export const HanziWriterCanvas: React.FC<HanziWriterCanvasProps> = ({
  char,
  size = 240,
  className = '',
  onQuizComplete
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const writerRef = useRef<HanziWriter | null>(null)

  const [isQuizMode, setIsQuizMode] = useState<boolean>(false)
  const [showOutline, setShowOutline] = useState<boolean>(true)
  const [gridType, setGridType] = useState<GridType>('mi')
  const [isAnimating, setIsAnimating] = useState<boolean>(false)
  const [quizMistakes, setQuizMistakes] = useState<number>(0)
  const [quizFinished, setQuizFinished] = useState<boolean>(false)
  const [currentStrokeIndex, setCurrentStrokeIndex] = useState<number>(0)
  const [totalStrokes, setTotalStrokes] = useState<number>(0)

  // Khởi tạo HanziWriter với custom charDataLoader nạp Offline từ IPC
  useEffect(() => {
    if (!containerRef.current || !char) return

    // Xóa nội dung cũ trong container
    containerRef.current.innerHTML = ''
    setIsQuizMode(false)
    setQuizFinished(false)
    setQuizMistakes(0)
    setCurrentStrokeIndex(0)

    try {
      const writer = HanziWriter.create(containerRef.current, char, {
        width: size,
        height: size,
        padding: 16,
        showOutline: showOutline,
        strokeAnimationSpeed: 1.2,
        delayBetweenStrokes: 150,
        strokeColor: '#1d4ed8', // blue-700
        outlineColor: '#cbd5e1', // slate-300
        highlightColor: '#f59e0b', // amber-500
        drawingColor: '#059669', // emerald-600
        drawingWidth: 10,
        showCharacter: true,
        // Bộ nạp dữ liệu nét viết 100% CỤC BỘ OFFLINE qua IPC (không CDN)
        charDataLoader: async (c) => {
          const res = await window.api.hanzi.getStrokeData(c)
          if (res.success && res.data) {
            return res.data
          }
          throw new Error(res.error || `Không tìm thấy nét viết cho chữ ${c}`)
        },
        onLoadCharDataSuccess: (data) => {
          if (data?.strokes) {
            setTotalStrokes(data.strokes.length)
          }
        }
      })

      writerRef.current = writer
    } catch (err) {
      console.error('[HanziWriter] Lỗi khởi tạo writer:', err)
    }

    return () => {
      try {
        writerRef.current?.cancelQuiz()
      } catch {}
    }
  }, [char, size])

  // Cập nhật hiển thị outline khi state thay đổi
  useEffect(() => {
    if (!writerRef.current) return
    if (showOutline) {
      writerRef.current.showOutline()
    } else {
      writerRef.current.hideOutline()
    }
  }, [showOutline])

  // Phát hoạt ảnh toàn bộ chữ Hán
  const handleAnimate = useCallback((): void => {
    if (!writerRef.current || isAnimating) return

    setIsQuizMode(false)
    setQuizFinished(false)
    setIsAnimating(true)
    writerRef.current.showCharacter()

    writerRef.current.animateCharacter({
      onComplete: () => {
        setIsAnimating(false)
      }
    })
  }, [isAnimating])

  // Hoạt ảnh từng nét một
  const handleStepStroke = useCallback((): void => {
    if (!writerRef.current || totalStrokes === 0) return

    setIsQuizMode(false)
    setQuizFinished(false)
    const nextStroke = (currentStrokeIndex + 1) % totalStrokes
    setCurrentStrokeIndex(nextStroke)

    writerRef.current.highlightStroke(nextStroke)
  }, [currentStrokeIndex, totalStrokes])

  // Bắt đầu chế độ Luyện viết tay (Quiz Mode)
  const handleStartQuiz = useCallback((): void => {
    if (!writerRef.current) return

    setIsQuizMode(true)
    setQuizFinished(false)
    setQuizMistakes(0)
    setIsAnimating(false)

    writerRef.current.quiz({
      showHintAfterMisses: 2,
      onMistake: () => {
        setQuizMistakes((prev) => prev + 1)
      },
      onCorrectStroke: () => {
        // Nét đúng được ghi nhận
      },
      onComplete: (summary) => {
        setQuizFinished(true)
        if (onQuizComplete) {
          onQuizComplete(summary.totalMistakes)
        }
      }
    })
  }, [showOutline, onQuizComplete])

  // Reset về trạng thái xem ban đầu
  const handleReset = useCallback((): void => {
    if (!writerRef.current) return

    writerRef.current.cancelQuiz()
    writerRef.current.showCharacter()
    if (showOutline) {
      writerRef.current.showOutline()
    }
    setIsQuizMode(false)
    setQuizFinished(false)
    setQuizMistakes(0)
    setIsAnimating(false)
  }, [showOutline])

  // Chuyển đổi kiểu lưới kẻ
  const handleToggleGrid = (): void => {
    const nextGrid: Record<GridType, GridType> = {
      mi: 'tian',
      tian: 'none',
      none: 'mi'
    }
    setGridType(nextGrid[gridType])
  }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {/* Khung vẽ chữ Hán & Nền lưới kẻ truyền thống */}
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-inner dark:border-slate-700 dark:bg-slate-900"
        style={{ width: size, height: size }}
      >
        {/* Lưới kẻ Mễ tự cách (米字格) hoặc Điền tự cách (田字格) */}
        {gridType !== 'none' && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full stroke-slate-200 dark:stroke-slate-800"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          >
            {/* Đường trục ngang và dọc */}
            <line x1="0" y1={size / 2} x2={size} y2={size / 2} />
            <line x1={size / 2} y1="0" x2={size / 2} y2={size} />

            {/* Hai đường chéo nếu là 米字格 */}
            {gridType === 'mi' && (
              <>
                <line x1="0" y1="0" x2={size} y2={size} />
                <line x1={size} y1="0" x2="0" y2={size} />
              </>
            )}
          </svg>
        )}

        {/* Khung chứa HanziWriter */}
        <div ref={containerRef} className="absolute inset-0 cursor-crosshair" />

        {/* Thông báo chúc mừng khi hoàn thành bài luyện viết */}
        {quizFinished && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-500/90 text-white backdrop-blur-xs transition animate-in fade-in">
            <CheckCircle2 className="h-12 w-12 text-white mb-1" />
            <span className="text-base font-bold">Viết rất tốt!</span>
            <span className="text-xs mt-0.5">Số lần nét sai: {quizMistakes}</span>
            <button
              type="button"
              onClick={handleStartQuiz}
              className="mt-3 rounded-lg bg-white px-3 py-1 text-xs font-bold text-emerald-800 shadow transition hover:bg-emerald-50"
            >
              Viết lại
            </button>
          </div>
        )}
      </div>

      {/* Thông tin trạng thái Luyện viết tay */}
      {isQuizMode && !quizFinished && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
          <AlertCircle className="h-3.5 w-3.5 text-blue-500" />
          <span>Hãy dùng chuột/bút vẽ theo thứ tự từng nét</span>
          {quizMistakes > 0 && (
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              (Lỗi: {quizMistakes})
            </span>
          )}
        </div>
      )}

      {/* Thanh công cụ điều khiển tương tác */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={handleAnimate}
          disabled={isAnimating}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-blue-600 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Xem hoạt ảnh thứ tự nét viết"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>Hoạt ảnh</span>
        </button>

        <button
          type="button"
          onClick={handleStepStroke}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Xem từng nét một"
        >
          <span>Từng nét</span>
        </button>

        <button
          type="button"
          onClick={isQuizMode ? handleReset : handleStartQuiz}
          className={cn(
            'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-xs transition',
            isQuizMode
              ? 'bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500'
              : 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500'
          )}
          title="Luyện tập viết chữ Hán trên canvas"
        >
          <PenTool className="h-3.5 w-3.5" />
          <span>{isQuizMode ? 'Dừng viết' : 'Tập viết'}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowOutline(!showOutline)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          title={showOutline ? 'Ẩn nét mẫu' : 'Hiện nét mẫu'}
        >
          {showOutline ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={handleToggleGrid}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          title={`Đổi kiểu lưới (Hiện tại: ${gridType === 'mi' ? 'Mễ tự cách' : gridType === 'tian' ? 'Điền tự cách' : 'Trống'})`}
        >
          <Grid className="h-3.5 w-3.5" />
          <span>{gridType === 'mi' ? 'Mễ' : gridType === 'tian' ? 'Điền' : 'Trống'}</span>
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Làm mới lại nét vẽ"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
