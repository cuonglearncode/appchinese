import { UserVocabProgress, SrsRating, SrsAlgorithm } from '../schemas'
import { SrsCalculationResult } from './types'
import { sm2 } from './sm2'
import { fsrs } from './fsrs'

export * from './types'
export * from './sm2'
export * from './fsrs'
export * from './cloze'

/**
 * Tính toán lần ôn tập tiếp theo sử dụng bộ máy thuật toán tương ứng (SM-2 hoặc FSRS)
 */
export function calculateNextReview(
  currentProgress: UserVocabProgress | null,
  rating: SrsRating,
  algorithm: SrsAlgorithm = 'sm2',
  now: Date = new Date()
): SrsCalculationResult {
  const calculator = algorithm === 'fsrs' ? fsrs : sm2
  return calculator.calculateNextReview(currentProgress, rating, now)
}

/**
 * Quy tắc ánh xạ điểm ôn tập tự động sang SRS Rating theo Quy định kỹ thuật 3:
 * - is_correct === false -> Rating 1 (Again)
 * - is_correct === true && response_time_ms <= 3000ms -> Rating 4 (Easy)
 * - is_correct === true && response_time_ms <= 5000ms -> Rating 3 (Good)
 * - is_correct === true && response_time_ms > 5000ms -> Rating 2 (Hard)
 */
export function mapReviewScore(isCorrect: boolean, responseTimeMs: number): SrsRating {
  if (!isCorrect) {
    return 1 // Again
  }
  if (responseTimeMs <= 3000) {
    return 4 // Easy
  }
  if (responseTimeMs <= 5000) {
    return 3 // Good
  }
  return 2 // Hard
}
