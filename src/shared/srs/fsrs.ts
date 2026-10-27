import { SrsRating, UserVocabProgress, SrsParamsFsrs } from '../schemas'
import { SrsCalculationResult, ISrsCalculator } from './types'

export class FsrsCalculator implements ISrsCalculator {
  calculateNextReview(
    currentProgress: UserVocabProgress | null,
    rating: SrsRating,
    now: Date = new Date()
  ): SrsCalculationResult {
    // 1. Trích xuất hoặc khởi tạo tham số FSRS
    let stability = 0
    let difficulty = 5.0
    let lapses = 0

    if (currentProgress?.srs_params) {
      const p = currentProgress.srs_params as Partial<SrsParamsFsrs>
      if (typeof p.stability === 'number') stability = p.stability
      if (typeof p.difficulty === 'number') difficulty = p.difficulty
      if (typeof p.lapses === 'number') lapses = p.lapses
    }

    const lastReviewedAt = currentProgress?.last_reviewed_at
      ? new Date(currentProgress.last_reviewed_at)
      : null

    let nextStability: number
    let nextDifficulty: number
    let nextLapses = lapses
    let nextState: 'learning' | 'review' | 'relearning'

    // Trường hợp 1: Học từ mới lần đầu (First review / stability == 0)
    if (stability <= 0 || !lastReviewedAt) {
      const initialStabilities: Record<SrsRating, number> = {
        1: 0.4,
        2: 0.9,
        3: 2.4,
        4: 5.8
      }
      const initialDifficulties: Record<SrsRating, number> = {
        1: 8.2,
        2: 6.5,
        3: 5.0,
        4: 3.5
      }

      nextStability = initialStabilities[rating]
      nextDifficulty = initialDifficulties[rating]
      nextState = rating === 1 ? 'relearning' : 'review'
      if (rating === 1) nextLapses += 1
    } else {
      // Trường hợp 2: Ôn tập từ đã học (Subsequent review)
      const elapsedDays = Math.max(
        0,
        (now.getTime() - lastReviewedAt.getTime()) / 86_400_000
      )

      // Độ khả hồi Retrievability (R)
      const factor = 0.19
      const retrievability = Math.max(
        0.01,
        Math.min(1.0, Math.pow(1 + (factor * elapsedDays) / stability, -0.5))
      )

      // Cập nhật độ khó (Difficulty Mean Reversion)
      const gradeDelta = rating - 3 // -2, -1, 0, 1
      nextDifficulty = 0.1 * 5.0 + 0.9 * (difficulty - 0.7 * gradeDelta)
      nextDifficulty = Math.max(1.0, Math.min(10.0, Number(nextDifficulty.toFixed(2))))

      if (rating === 1) {
        // Quên (Again) -> Tăng số lần quên (lapses)
        nextLapses += 1
        nextStability = Math.max(
          0.2,
          Math.min(
            stability,
            0.5 *
              Math.pow(nextDifficulty, -0.3) *
              Math.pow(stability + 1, 0.2) *
              Math.exp(0.2 * (1 - retrievability))
          )
        )
        nextState = 'relearning'
      } else {
        // Nhớ được (Hard / Good / Easy)
        const bonusMap: Record<number, number> = {
          2: 0.8, // Hard penalty
          3: 1.0, // Good
          4: 1.3  // Easy bonus
        }
        const bonus = bonusMap[rating] || 1.0

        const stabilityIncrease =
          1 +
          Math.exp(0.8) *
            (11 - nextDifficulty) *
            Math.pow(stability, -0.2) *
            (Math.exp(0.5 * (1 - retrievability)) - 1) *
            bonus

        nextStability = stability * stabilityIncrease
        nextState = 'review'
      }
    }

    nextStability = Number(nextStability.toFixed(2))

    // Tính khoảng cách ngày ôn tập theo Target Retention 90% (R = 0.9)
    let intervalDays = Math.round(nextStability)
    intervalDays = Math.max(1, intervalDays)

    const nextReviewTime = new Date(now.getTime() + intervalDays * 86_400_000).toISOString()

    return {
      state: nextState,
      algorithm: 'fsrs',
      srs_params: {
        stability: nextStability,
        difficulty: nextDifficulty,
        lapses: nextLapses
      },
      interval_days: intervalDays,
      next_review_at: nextReviewTime
    }
  }
}

export const fsrs = new FsrsCalculator()
