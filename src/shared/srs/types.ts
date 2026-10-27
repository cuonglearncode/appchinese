import {
  ProgressState,
  SrsAlgorithm,
  SrsRating,
  SrsParamsSm2,
  SrsParamsFsrs,
  UserVocabProgress
} from '../schemas'

export interface SrsCalculationResult {
  state: ProgressState
  algorithm: SrsAlgorithm
  srs_params: SrsParamsSm2 | SrsParamsFsrs
  interval_days: number
  next_review_at: string // UTC ISO string
}

export interface ISrsCalculator {
  calculateNextReview(
    currentProgress: UserVocabProgress | null,
    rating: SrsRating,
    now?: Date
  ): SrsCalculationResult
}
