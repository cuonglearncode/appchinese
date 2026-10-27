import { describe, it, expect } from 'vitest'
import { sm2, fsrs, calculateNextReview, mapReviewScore } from '../src/shared/srs'
import { generateCloze, verifyClozeAnswer } from '../src/shared/srs/cloze'
import { UserVocabProgress, SrsRating } from '../src/shared/schemas'

describe('Kiểm thử Giai đoạn 3: Thuật toán SRS (SM-2 & FSRS) và Cloze Test', () => {
  const mockNow = new Date('2026-10-26T12:00:00Z')

  describe('1. Thuật toán SuperMemo-2 (SM-2)', () => {
    it('Lần đầu học từ mới (Reps = 0)', () => {
      // Rating = 3 (Good) -> interval = 1, reps = 1, efactor = 2.5
      const resGood = sm2.calculateNextReview(null, 3, mockNow)
      expect(resGood.interval_days).toBe(1)
      expect(resGood.state).toBe('review')
      expect((resGood.srs_params as any).reps).toBe(1)
      expect((resGood.srs_params as any).efactor).toBe(2.5)

      // Rating = 4 (Easy) -> interval = 3, reps = 1, efactor = 2.65
      const resEasy = sm2.calculateNextReview(null, 4, mockNow)
      expect(resEasy.interval_days).toBe(3)
      expect((resEasy.srs_params as any).efactor).toBe(2.65)

      // Rating = 1 (Again) -> interval = 1, reps = 0, state = relearning, efactor = 2.3
      const resAgain = sm2.calculateNextReview(null, 1, mockNow)
      expect(resAgain.interval_days).toBe(1)
      expect(resAgain.state).toBe('relearning')
      expect((resAgain.srs_params as any).reps).toBe(0)
      expect((resAgain.srs_params as any).efactor).toBe(2.3)
    })

    it('Lần thứ 2 ôn tập (Reps = 1)', () => {
      const prevProgress: UserVocabProgress = {
        vocab_id: 1,
        state: 'review',
        algorithm: 'sm2',
        srs_params: { efactor: 2.5, interval: 1, reps: 1 },
        wrong_count: 0,
        correct_count: 1,
        last_reviewed_at: mockNow.toISOString()
      }

      // Rating = 3 (Good) -> interval = 6, reps = 2
      const res = sm2.calculateNextReview(prevProgress, 3, mockNow)
      expect(res.interval_days).toBe(6)
      expect((res.srs_params as any).reps).toBe(2)
    })

    it('Lần thứ 3 trở đi ôn tập (Reps >= 2)', () => {
      const prevProgress: UserVocabProgress = {
        vocab_id: 1,
        state: 'review',
        algorithm: 'sm2',
        srs_params: { efactor: 2.5, interval: 6, reps: 2 },
        wrong_count: 0,
        correct_count: 2,
        last_reviewed_at: mockNow.toISOString()
      }

      // Rating = 3 (Good) -> interval = 6 * 2.5 = 15, reps = 3
      const res = sm2.calculateNextReview(prevProgress, 3, mockNow)
      expect(res.interval_days).toBe(15)
      expect((res.srs_params as any).reps).toBe(3)
    })

    it('Khi quên từ (Rating = 1 Again), reset reps và trừ efactor nhưng không nhỏ hơn 1.3', () => {
      const lowEfProgress: UserVocabProgress = {
        vocab_id: 1,
        state: 'review',
        algorithm: 'sm2',
        srs_params: { efactor: 1.4, interval: 10, reps: 3 },
        wrong_count: 0,
        correct_count: 3,
        last_reviewed_at: mockNow.toISOString()
      }

      const res = sm2.calculateNextReview(lowEfProgress, 1, mockNow)
      expect(res.state).toBe('relearning')
      expect((res.srs_params as any).reps).toBe(0)
      expect((res.srs_params as any).interval).toBe(1)
      expect((res.srs_params as any).efactor).toBe(1.3) // Math.max(1.3, 1.4 - 0.2)
    })
  })

  describe('2. Thuật toán FSRS-4.5', () => {
    it('Lần đầu học từ mới với FSRS', () => {
      // Good (3)
      const resGood = fsrs.calculateNextReview(null, 3, mockNow)
      expect(resGood.algorithm).toBe('fsrs')
      expect((resGood.srs_params as any).stability).toBe(2.4)
      expect((resGood.srs_params as any).difficulty).toBe(5.0)
      expect(resGood.interval_days).toBe(2)

      // Easy (4)
      const resEasy = fsrs.calculateNextReview(null, 4, mockNow)
      expect((resEasy.srs_params as any).stability).toBe(5.8)
      expect((resEasy.srs_params as any).difficulty).toBe(3.5)
      expect(resEasy.interval_days).toBe(6)

      // Again (1)
      const resAgain = fsrs.calculateNextReview(null, 1, mockNow)
      expect((resAgain.srs_params as any).stability).toBe(0.4)
      expect((resAgain.srs_params as any).lapses).toBe(1)
      expect(resAgain.state).toBe('relearning')
    })

    it('Ôn tập tiếp theo với FSRS', () => {
      const twoDaysAgo = new Date(mockNow.getTime() - 2 * 86_400_000)
      const prevProgress: UserVocabProgress = {
        vocab_id: 1,
        state: 'review',
        algorithm: 'fsrs',
        srs_params: { stability: 2.4, difficulty: 5.0, lapses: 0 },
        wrong_count: 0,
        correct_count: 1,
        last_reviewed_at: twoDaysAgo.toISOString()
      }

      const res = fsrs.calculateNextReview(prevProgress, 3, mockNow)
      expect(res.state).toBe('review')
      expect((res.srs_params as any).stability).toBeGreaterThan(2.4)
      expect(res.interval_days).toBeGreaterThanOrEqual(3)
    })
  })

  describe('3. Ánh xạ Điểm Ôn tập sang SRS Rating (Technical Rule 3)', () => {
    it('is_correct === false -> Rating 1 (Again)', () => {
      expect(mapReviewScore(false, 1200)).toBe(1)
      expect(mapReviewScore(false, 8000)).toBe(1)
    })

    it('is_correct === true && response_time <= 3000ms -> Rating 4 (Easy)', () => {
      expect(mapReviewScore(true, 1500)).toBe(4)
      expect(mapReviewScore(true, 3000)).toBe(4)
    })

    it('is_correct === true && 3000ms < response_time <= 5000ms -> Rating 3 (Good)', () => {
      expect(mapReviewScore(true, 3500)).toBe(3)
      expect(mapReviewScore(true, 5000)).toBe(3)
    })

    it('is_correct === true && response_time > 5000ms -> Rating 2 (Hard)', () => {
      expect(mapReviewScore(true, 5100)).toBe(2)
      expect(mapReviewScore(true, 12000)).toBe(2)
    })
  })

  describe('4. Đục Lỗ Câu Ví Dụ (Cloze) & Xử Lý Từ Ly Hợp', () => {
    it('Đục lỗ từ thông thường trong câu', () => {
      const cloze = generateCloze('我们明天在学校见面。', '学校')
      expect(cloze).not.toBeNull()
      expect(cloze?.isSeparable).toBe(false)
      expect(cloze?.clozeSentence).toBe('我们明天在[___]见面。')
      expect(cloze?.blanks).toEqual(['学校'])

      expect(verifyClozeAnswer('学校', cloze!)).toBe(true)
      expect(verifyClozeAnswer(' 学校 ', cloze!)).toBe(true)
      expect(verifyClozeAnswer('学生', cloze!)).toBe(false)
    })

    it('Tự động đục lỗ Từ ly hợp (Separable Verb) 2 chữ Hán: 刷牙', () => {
      const cloze = generateCloze('我每天刷两次牙。', '刷牙')
      expect(cloze).not.toBeNull()
      expect(cloze?.isSeparable).toBe(true)
      expect(cloze?.clozeSentence).toBe('我每天[___]两次[___]。')
      expect(cloze?.blanks).toEqual(['刷', '牙'])

      // Người dùng nhập gộp nguyên từ
      expect(verifyClozeAnswer('刷牙', cloze!)).toBe(true)
      // Người dùng nhập theo mảng 2 ô đục lỗ
      expect(verifyClozeAnswer(['刷', '牙'], cloze!)).toBe(true)
      expect(verifyClozeAnswer(['洗', '牙'], cloze!)).toBe(false)
    })

    it('Tự động đục lỗ Từ ly hợp 3 chữ Hán: 打喷嚏', () => {
      const cloze = generateCloze('她打了一个喷嚏。', '打喷嚏')
      expect(cloze).not.toBeNull()
      expect(cloze?.isSeparable).toBe(true)
      expect(cloze?.clozeSentence).toBe('她[___]了一个[___]。')
      expect(cloze?.blanks).toEqual(['打', '喷嚏'])

      expect(verifyClozeAnswer('打喷嚏', cloze!)).toBe(true)
      expect(verifyClozeAnswer(['打', '喷嚏'], cloze!)).toBe(true)
    })
  })
})
