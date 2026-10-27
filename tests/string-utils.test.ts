import { describe, it, expect } from 'vitest'
import {
  normalizeChineseInput,
  cleanChineseWord,
  getWordVariants,
  matchChineseAnswer,
  segmentChineseSentence
} from '../src/shared/string-utils'

describe('Kiểm thử Tiện ích Xử lý Chuỗi & Phân đoạn Tiếng Trung', () => {
  describe('1. Chuẩn hóa & Loại bỏ Chú thích Trong Ngoặc', () => {
    it('Loại bỏ chú thích ngoặc tiếng Trung （）', () => {
      expect(cleanChineseWord('得（助动词）')).toBe('得')
      expect(cleanChineseWord('地（助词）')).toBe('地')
      expect(cleanChineseWord('好（副词）')).toBe('好')
    })

    it('Loại bỏ chú thích ngoặc đơn ASCII ()', () => {
      expect(cleanChineseWord('过(动词)')).toBe('过')
      expect(cleanChineseWord('把(介词)')).toBe('把')
    })

    it('Chuẩn hóa khoảng trắng và Unicode NFC', () => {
      expect(normalizeChineseInput('  学习  ')).toBe('学习')
      expect(normalizeChineseInput('\t汉字\n')).toBe('汉字')
    })
  })

  describe('2. Xử lý Biến thể Từ & Chấm Điểm Đáp Án', () => {
    it('Tách các biến thể có dấu /', () => {
      expect(getWordVariants('这/这儿')).toEqual(['这', '这儿'])
      expect(getWordVariants('哪/哪儿')).toEqual(['哪', '哪儿'])
      expect(getWordVariants('爸爸/爸爸')).toEqual(['爸爸'])
    })

    it('Khớp đáp án đúng với từ có chú thích ngoặc', () => {
      expect(matchChineseAnswer('得', '得（助动词）')).toBe(true)
      expect(matchChineseAnswer(' 得 ', '得（助动词）')).toBe(true)
      expect(matchChineseAnswer('de', '得（助动词）')).toBe(false)
    })

    it('Khớp đáp án đúng với từ có dấu /', () => {
      expect(matchChineseAnswer('这', '这/这儿')).toBe(true)
      expect(matchChineseAnswer('这儿', '这/这儿')).toBe(true)
      expect(matchChineseAnswer('这里', '这/这儿')).toBe(false)
    })
  })

  describe('3. Tách Từ Trong Câu Bằng Intl.Segmenter', () => {
    it('Phân đoạn chính xác câu tiếng Trung thành các từ ngữ', () => {
      const sentence = '我每天在学校学习汉语。'
      const tokens = segmentChineseSentence(sentence, '学习')

      expect(tokens.length).toBeGreaterThan(0)
      const words = tokens.filter((t) => t.isWord).map((t) => t.text)
      expect(words).toContain('我')
      expect(words).toContain('每天')
      expect(words).toContain('学校')
      expect(words).toContain('学习')
      expect(words).toContain('汉语')

      // Kiểm tra đánh dấu từ mục tiêu
      const targetToken = tokens.find((t) => t.isTargetWord)
      expect(targetToken).toBeDefined()
      expect(targetToken?.text).toBe('学习')
    })

    it('Xử lý từ mục tiêu có chú thích ngoặc trong câu', () => {
      const sentence = '他跑得很快。'
      const tokens = segmentChineseSentence(sentence, '得（助动词）')

      const targetToken = tokens.find((t) => t.isTargetWord)
      expect(targetToken).toBeDefined()
      expect(targetToken?.text).toBe('得')
    })
  })
})
