import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  segmentChineseSentence,
  normalizeChineseInput,
  cleanChineseWord,
  getWordVariants,
  matchChineseAnswer
} from '../src/shared/string-utils'
import { getPool, closePool, checkDatabaseConnection } from '../src/main/database/pool'
import { MySqlVocabRepository, MySqlHanziRepository } from '../src/main/database/repositories'
import { HanziStrokeDataSchema } from '../src/shared/schemas'

describe('Kiểm thử Giai đoạn 2: Smart Dictionary, Hanzi Analysis & Offline Handwriting', () => {
  let vocabRepo: MySqlVocabRepository
  let hanziRepo: MySqlHanziRepository

  beforeAll(async () => {
    const isConnected = await checkDatabaseConnection()
    expect(isConnected).toBe(true)

    vocabRepo = new MySqlVocabRepository()
    hanziRepo = new MySqlHanziRepository()
  })

  afterAll(async () => {
    await closePool()
  })

  describe('1. Phân tách từ ngữ trong câu ví dụ (Intl.Segmenter) & Chuẩn hóa IME', () => {
    it('Phân tách câu ví dụ phức tạp thành các từ ngữ độc lập', () => {
      const sentence = '中国有很多名胜古迹，比如长城和故宫。'
      const tokens = segmentChineseSentence(sentence, '名胜古迹')

      expect(tokens.length).toBeGreaterThan(0)
      const targetToken = tokens.find((t) => t.isTargetWord)
      expect(targetToken).toBeDefined()
      expect(targetToken?.text).toBe('名胜古迹')
      expect(targetToken?.isWord).toBe(true)
    })

    it('Xử lý chuẩn hóa chuỗi và đối sánh đáp án bộ gõ IME', () => {
      // Chuẩn hóa Unicode NFC và khoảng trắng
      expect(normalizeChineseInput('  汉语  ')).toBe('汉语')
      expect(cleanChineseWord('得（助动词）')).toBe('得')
      expect(cleanChineseWord('喂/喂')).toBe('喂/喂')

      // Đối sánh đáp án
      expect(matchChineseAnswer('得', '得（助动词）')).toBe(true)
      expect(matchChineseAnswer('这儿', '这/这儿')).toBe(true)
      expect(matchChineseAnswer('这', '这/这儿')).toBe(true)
    })
  })

  describe('2. Dữ liệu nét viết chữ Hán 100% Cục bộ Offline (HanziWriter Data)', () => {
    it('Nạp trực tiếp tệp nét viết từ gói hanzi-writer-data cài đặt cục bộ', () => {
      const testChars = ['学', '爱', '长', '字', '人']

      for (const char of testChars) {
        const filePath = path.join(process.cwd(), 'node_modules', 'hanzi-writer-data', `${char}.json`)
        expect(fs.existsSync(filePath)).toBe(true)

        const raw = fs.readFileSync(filePath, 'utf-8')
        const data = JSON.parse(raw)

        // Validate dữ liệu bằng HanziStrokeDataSchema
        const parsed = HanziStrokeDataSchema.safeParse(data)
        expect(parsed.success).toBe(true)
        if (parsed.success) {
          expect(parsed.data.strokes.length).toBeGreaterThan(0)
          expect(parsed.data.medians.length).toBe(parsed.data.strokes.length)
        }
      }
    })
  })

  describe('3. Hiệu năng nạp danh sách 2.513 từ của HSK 6 (Phục vụ Virtualizer 60 FPS)', () => {
    it('Nạp toàn bộ 2.513 từ vựng của HSK 6 với tốc độ phản hồi cao', async () => {
      // Warm up
      await vocabRepo.search({ hsk_level: 6, limit: 3000 })

      const start = performance.now()
      const result = await vocabRepo.search({
        hsk_level: 6,
        limit: 3000
      })
      const duration = performance.now() - start

      expect(result.total).toBe(2513)
      expect(result.items.length).toBe(2513)
      // Đảm bảo thời gian nạp bộ từ điển cấp cao đạt hiệu năng tốt (< 150ms)
      expect(duration).toBeLessThan(150)
    })
  })

  describe('4. Mạng lưới từ ghép HSK & Phân tích Chiết tự', () => {
    it('Tra cứu chi tiết chữ Hán đơn và danh sách từ ghép HSK liên quan', async () => {
      const details = await hanziRepo.getDetails('学')

      expect(details.character).toBeDefined()
      expect(details.character?.char).toBe('学')
      expect(details.character?.radical).toBe('子')
      expect(details.character?.sino_vietnamese).toBe('HỌC')
      expect(details.character?.stroke_count).toBe(8)

      // Kiểm tra danh sách từ ghép
      expect(details.compounds.length).toBeGreaterThan(0)
      const words = details.compounds.map((c) => c.word)
      expect(words).toContain('学习')
      expect(words).toContain('学校')
      expect(words).toContain('学生')
    })
  })
})
