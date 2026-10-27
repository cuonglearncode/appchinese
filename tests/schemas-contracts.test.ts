import { describe, it, expect } from 'vitest'
import {
  VocabEntrySchema,
  HanziCharacterSchema,
  SrsParamsSm2Schema,
  SrsParamsFsrsSchema,
  VocabSearchFilterSchema,
  SubmitReviewRequestSchema
} from '../src/shared/schemas'

describe('Kiểm thử Giai đoạn 0: Schemas & IPC Contracts', () => {
  it('Xác thực VocabEntrySchema thành công với từ vựng hợp lệ', () => {
    const rawVocab = {
      id: 1,
      standard_version: 'HSK2.0',
      hsk_level: 1,
      word: '爱',
      pinyin: 'ài',
      meaning_vi: 'yêu, thích',
      example_zh: '我爱学习汉语。',
      example_pinyin: 'Wǒ ài xuéxí hànyǔ.',
      example_vi: 'Tôi yêu thích việc học tiếng Trung.'
    }

    const result = VocabEntrySchema.safeParse(rawVocab)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.hsk_level).toBe(1)
      expect(result.data.word).toBe('爱')
    }
  })

  it('Từ chối VocabEntry khi hsk_level vượt quá phạm vi 1-6', () => {
    const invalidVocab = {
      id: 1,
      hsk_level: 7, // Ngoài phạm vi HSK 1-6
      word: '测试',
      pinyin: 'cèshì',
      meaning_vi: 'kiểm tra'
    }

    const result = VocabEntrySchema.safeParse(invalidVocab)
    expect(result.success).toBe(false)
  })

  it('Xác thực HanziCharacterSchema cho chữ đơn và bộ thủ', () => {
    const charData = {
      char: '爱',
      radical: '爫',
      stroke_count: 10,
      sino_vietnamese: 'ÁI',
      decomposition: '⿱爫友',
      etymology_hint: 'Gồm bộ trảo và chữ hữu'
    }

    const result = HanziCharacterSchema.safeParse(charData)
    expect(result.success).toBe(true)
  })

  it('Xác thực cấu trúc SRS tham số SM-2 và FSRS', () => {
    const sm2 = { efactor: 2.5, interval: 1, reps: 1 }
    expect(SrsParamsSm2Schema.safeParse(sm2).success).toBe(true)

    const fsrs = { stability: 2.1, difficulty: 4.8, lapses: 0 }
    expect(SrsParamsFsrsSchema.safeParse(fsrs).success).toBe(true)
  })

  it('Xác thực bộ lọc tìm kiếm VocabSearchFilterSchema với giá trị mặc định', () => {
    const filter = {
      query: '学',
      hsk_level: 1
    }

    const result = VocabSearchFilterSchema.safeParse(filter)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(50)
      expect(result.data.offset).toBe(0)
    }
  })

  it('Chuẩn hóa chuỗi IME & loại bỏ chú thích trong ngoặc', () => {
    const rawWordWithAnnotation = '得（助动词）'
    // Hàm chuẩn hóa loại bỏ dấu ngoặc chú thích
    const cleanWord = rawWordWithAnnotation.replace(/（[^）]+）|\([^)]+\)/g, '').trim().normalize('NFC')
    expect(cleanWord).toBe('得')

    // Chuẩn hóa NFC tiếng Trung
    const composed = '学习'.normalize('NFC')
    expect(composed).toBe('学习')
  })

  it('Xác thực SubmitReviewRequestSchema với đầy đủ các trường yêu cầu', () => {
    const validReview = {
      vocab_id: 123,
      review_mode: 'typing',
      user_input: '学习',
      is_correct: true,
      srs_rating: 4,
      response_time_ms: 1850
    }

    const result = SubmitReviewRequestSchema.safeParse(validReview)
    expect(result.success).toBe(true)
  })
})
