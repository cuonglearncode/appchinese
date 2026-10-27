import { useState, useCallback, useRef } from 'react'
import {
  VocabWithProgress,
  ReviewMode,
  SrsAlgorithm,
  SrsRating
} from '@shared/schemas'
import { mapReviewScore } from '@shared/srs'

export type SessionState = 'setup' | 'active' | 'summary'

export interface SessionStats {
  totalReviewed: number
  correctCount: number
  wrongCount: number
  totalTimeMs: number
  ratings: Record<SrsRating, number>
  wrongVocabIds: number[]
}

export interface StartSessionOptions {
  hskLevel?: number
  limit: number
  mode: ReviewMode
  algorithm: SrsAlgorithm
}

export function useReviewSession() {
  const [sessionState, setSessionState] = useState<SessionState>('setup')
  const [words, setWords] = useState<VocabWithProgress[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [mode, setMode] = useState<ReviewMode>('flashcard')
  const [algorithm, setAlgorithm] = useState<SrsAlgorithm>('sm2')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<SessionStats>({
    totalReviewed: 0,
    correctCount: 0,
    wrongCount: 0,
    totalTimeMs: 0,
    ratings: { 1: 0, 2: 0, 3: 0, 4: 0 },
    wrongVocabIds: []
  })

  const cardStartTimeRef = useRef<number>(Date.now())

  // Bắt đầu một phiên ôn tập mới
  const startSession = useCallback(async (options: StartSessionOptions): Promise<void> => {
    setIsLoading(true)
    setError(null)
    setMode(options.mode)
    setAlgorithm(options.algorithm)

    try {
      const res = await window.api.progress.getDue({
        hsk_level: options.hskLevel,
        limit: options.limit
      })

      if (!res.success) {
        throw new Error(res.error || 'Không thể nạp danh sách từ ôn tập')
      }

      if (!res.data || res.data.length === 0) {
        throw new Error('Không có từ vựng nào cần ôn tập hoặc học mới trong cấp độ này.')
      }

      setWords(res.data)
      setCurrentIndex(0)
      setStats({
        totalReviewed: 0,
        correctCount: 0,
        wrongCount: 0,
        totalTimeMs: 0,
        ratings: { 1: 0, 2: 0, 3: 0, 4: 0 },
        wrongVocabIds: []
      })
      cardStartTimeRef.current = Date.now()
      setSessionState('active')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Gửi kết quả đánh giá cho thẻ hiện tại
  const submitAnswer = useCallback(
    async (
      isCorrect: boolean,
      explicitRating?: SrsRating,
      userInput?: string
    ): Promise<void> => {
      const currentWord = words[currentIndex]
      if (!currentWord) return

      const responseTimeMs = Math.max(500, Date.now() - cardStartTimeRef.current)

      // Ánh xạ rating: nếu có rating tường minh (Flashcard) dùng explicitRating, nếu không dùng mapReviewScore theo Technical Rule 3
      const rating = explicitRating ?? mapReviewScore(isCorrect, responseTimeMs)

      // Cập nhật thống kê phiên
      setStats((prev) => ({
        totalReviewed: prev.totalReviewed + 1,
        correctCount: prev.correctCount + (isCorrect ? 1 : 0),
        wrongCount: prev.wrongCount + (isCorrect ? 0 : 1),
        totalTimeMs: prev.totalTimeMs + responseTimeMs,
        ratings: {
          ...prev.ratings,
          [rating]: prev.ratings[rating] + 1
        },
        wrongVocabIds: isCorrect
          ? prev.wrongVocabIds
          : [...prev.wrongVocabIds, currentWord.id]
      }))

      // Gửi IPC cập nhật SRS bên trong transaction của Main Process
      try {
        await window.api.progress.submitReview({
          vocab_id: currentWord.id,
          review_mode: mode,
          user_input: userInput || null,
          is_correct: isCorrect,
          srs_rating: rating,
          response_time_ms: responseTimeMs
        })
      } catch (err) {
        console.error('[ReviewSession] Lỗi khi gửi kết quả ôn tập:', err)
      }

      // Chuyển thẻ tiếp theo hoặc kết thúc phiên
      if (currentIndex + 1 < words.length) {
        setCurrentIndex((prev) => prev + 1)
        cardStartTimeRef.current = Date.now()
      } else {
        setSessionState('summary')
      }
    },
    [words, currentIndex, mode]
  )

  const exitSession = useCallback((): void => {
    setSessionState('setup')
    setWords([])
    setCurrentIndex(0)
  }, [])

  return {
    sessionState,
    words,
    currentIndex,
    currentWord: words[currentIndex] || null,
    totalCards: words.length,
    mode,
    algorithm,
    stats,
    isLoading,
    error,
    startSession,
    submitAnswer,
    exitSession
  }
}
