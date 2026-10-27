import { SrsRating, UserVocabProgress, SrsParamsSm2 } from '../schemas'
import { SrsCalculationResult, ISrsCalculator } from './types'

export class Sm2Calculator implements ISrsCalculator {
  calculateNextReview(
    currentProgress: UserVocabProgress | null,
    rating: SrsRating,
    now: Date = new Date()
  ): SrsCalculationResult {
    // 1. Trích xuất hoặc khởi tạo tham số SM-2 mặc định
    let efactor = 2.5
    let interval = 0
    let reps = 0

    if (currentProgress?.srs_params) {
      const p = currentProgress.srs_params as Partial<SrsParamsSm2>
      if (typeof p.efactor === 'number') efactor = p.efactor
      if (typeof p.interval === 'number') interval = p.interval
      if (typeof p.reps === 'number') reps = p.reps
    }

    let nextIntervalDays: number
    let nextReps: number
    let nextEfactor: number
    let nextState: 'learning' | 'review' | 'relearning'

    // 2. Thuật toán phân nhánh theo Đánh giá SRS (1: Again, 2: Hard, 3: Good, 4: Easy)
    if (rating === 1) {
      // Quên hoàn toàn (Again) -> Chuyển về trạng thái học lại (relearning)
      nextReps = 0
      nextIntervalDays = 1
      nextEfactor = Math.max(1.3, Number((efactor - 0.2).toFixed(2)))
      nextState = 'relearning'
    } else if (rating === 2) {
      // Khó khăn (Hard)
      if (reps === 0) {
        nextIntervalDays = 1
        nextReps = 1
      } else if (reps === 1) {
        nextIntervalDays = 3
        nextReps = 2
      } else {
        nextIntervalDays = Math.max(interval + 1, Math.round(interval * 1.2))
        nextReps = reps + 1
      }
      nextEfactor = Math.max(1.3, Number((efactor - 0.15).toFixed(2)))
      nextState = 'review'
    } else if (rating === 3) {
      // Nhớ tốt (Good)
      if (reps === 0) {
        nextIntervalDays = 1
        nextReps = 1
      } else if (reps === 1) {
        nextIntervalDays = 6
        nextReps = 2
      } else {
        nextIntervalDays = Math.round(interval * efactor)
        nextReps = reps + 1
      }
      nextEfactor = Number(efactor.toFixed(2))
      nextState = 'review'
    } else {
      // Rất dễ (Easy)
      if (reps === 0) {
        nextIntervalDays = 3
        nextReps = 1
      } else if (reps === 1) {
        nextIntervalDays = 8
        nextReps = 2
      } else {
        nextIntervalDays = Math.round(interval * efactor * 1.3)
        nextReps = reps + 1
      }
      nextEfactor = Math.min(3.0, Number((efactor + 0.15).toFixed(2)))
      nextState = 'review'
    }

    // Đảm bảo khoảng cách ôn tập tối thiểu 1 ngày
    nextIntervalDays = Math.max(1, nextIntervalDays)

    const nextReviewTime = new Date(now.getTime() + nextIntervalDays * 86_400_000).toISOString()

    return {
      state: nextState,
      algorithm: 'sm2',
      srs_params: {
        efactor: nextEfactor,
        interval: nextIntervalDays,
        reps: nextReps
      },
      interval_days: nextIntervalDays,
      next_review_at: nextReviewTime
    }
  }
}

export const sm2 = new Sm2Calculator()
