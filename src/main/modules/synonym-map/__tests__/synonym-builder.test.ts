import { describe, it, expect } from 'vitest'
import {
  normalizeMeaningString,
  calculateRootScore,
  convertRecallToSrsRatings,
  DEFAULT_ROOT_SCORE_WEIGHTS
} from '../gloss-normalizer'

describe('Kiểm thử Giai đoạn 5: Module Sơ đồ Từ đồng nghĩa (Synonym Map & Recall)', () => {
  describe('1. Chuẩn hóa chuỗi nghĩa tiếng Việt (normalizeMeaningString)', () => {
    it('Tách đúng các ký tự phân cách [, ; /] và loại bỏ khoảng trắng thừa', () => {
      const input = 'xinh đẹp, đẹp đẽ; dễ thương / tươi đẹp'
      const result = normalizeMeaningString(input)

      expect(result.length).toBe(4)
      expect(result[0].gloss).toBe('xinh đẹp')
      expect(result[0].position).toBe(1)
      expect(result[1].gloss).toBe('đẹp đẽ')
      expect(result[1].position).toBe(2)
      expect(result[2].gloss).toBe('dễ thương')
      expect(result[3].gloss).toBe('tươi đẹp')
    })

    it('Không bị vỡ câu khi bên trong ngoặc đơn chứa dấu phẩy', () => {
      const input = 'yêu (cuộc sống, con người, thiên nhiên), thương mến'
      const result = normalizeMeaningString(input)

      expect(result.length).toBe(2)
      expect(result[0].gloss).toBe('yêu')
      expect(result[0].extractedNote).toBe('cuộc sống, con người, thiên nhiên')
      expect(result[1].gloss).toBe('thương mến')
    })

    it('Trích xuất đúng extracted_note và tự động phân loại register (formal, spoken, neutral)', () => {
      // 1. Formal / Lịch sự
      const formalInput = 'xin chào (trang trọng, lịch sự)'
      const formalResult = normalizeMeaningString(formalInput)
      expect(formalResult[0].register).toBe('formal')
      expect(formalResult[0].extractedNote).toContain('trang trọng')

      // 2. Spoken / Khẩu ngữ
      const spokenInput = 'chết rồi (khẩu ngữ)'
      const spokenResult = normalizeMeaningString(spokenInput)
      expect(spokenResult[0].register).toBe('spoken')

      // 3. Neutral / Trung tính
      const neutralInput = 'giúp đỡ (động từ li hợp)'
      const neutralResult = normalizeMeaningString(neutralInput)
      expect(neutralResult[0].register).toBe('neutral')
      expect(neutralResult[0].extractedNote).toBe('động từ li hợp')
    })

    it('Chống nhập nhằng từ hư đơn âm tiết: tự động thêm hậu tố phân loại', () => {
      // Trợ từ
      const troTu = normalizeMeaningString('đi (trợ từ đứng cuối câu)')
      expect(troTu[0].gloss).toBe('đi (trợ từ)')

      // Lượng từ
      const luongTu = normalizeMeaningString('cái (lượng từ)')
      expect(luongTu[0].gloss).toBe('cái (lượng từ)')

      // Giới từ
      const gioiTu = normalizeMeaningString('về (giới từ)')
      expect(gioiTu[0].gloss).toBe('về (giới từ)')

      // Thán từ
      const thanTu = normalizeMeaningString('a (thán từ)')
      expect(thanTu[0].gloss).toBe('a (thán từ)')
    })

    it('Bảo toàn tuyệt đối sự khác biệt dấu tiếng Việt (NFC: đẹp != dẹp)', () => {
      const depPiece = normalizeMeaningString('đẹp')[0]
      const dẹpPiece = normalizeMeaningString('dẹp')[0]

      expect(depPiece.gloss).toBe('đẹp')
      expect(dẹpPiece.gloss).toBe('dẹp')
      expect(depPiece.gloss).not.toBe(dẹpPiece.gloss)
    })

    it('Loại bỏ các nhãn từ loại đứng độc lập và các cụm quá 3 âm tiết', () => {
      const input = 'danh từ, động từ, học tập, người luôn luôn cố gắng phấn đấu trong cuộc sống'
      const result = normalizeMeaningString(input)

      // "danh từ" và "động từ" bị loại bỏ; cụm > 3 âm tiết bị loại bỏ; chỉ giữ lại "học tập"
      expect(result.length).toBe(1)
      expect(result[0].gloss).toBe('học tập')
    })
  })

  describe('2. Khử trùng lặp mặt chữ Hán giữa các cấp HSK', () => {
    it('Giữ lại bản ghi có HSK level thấp nhất khi một chữ Hán xuất hiện nhiều lần', () => {
      // Giả lập danh sách từ cùng mang nghĩa "thích"
      const candidates = [
        { word: '喜欢', hskLevel: 3, position: 2 },
        { word: '喜欢', hskLevel: 1, position: 1 }, // Cần giữ bản ghi này
        { word: '喜爱', hskLevel: 4, position: 1 }
      ]

      const wordMap = new Map<string, (typeof candidates)[0]>()
      for (const c of candidates) {
        const existing = wordMap.get(c.word)
        if (!existing || c.hskLevel < existing.hskLevel) {
          wordMap.set(c.word, c)
        }
      }

      const deduplicated = Array.from(wordMap.values())
      expect(deduplicated.length).toBe(2)

      const xiHuan = deduplicated.find((x) => x.word === '喜欢')
      expect(xiHuan).toBeDefined()
      expect(xiHuan?.hskLevel).toBe(1)
    })
  })

  describe('3. Công thức chấm điểm root_score', () => {
    it('Tính chính xác điểm chất lượng root_score theo trọng số cấu hình', () => {
      // Test với minHsk = 1, syllables = 1 ("đẹp"), firstPosRatio = 1.0, memberCount = 4
      // Score = 2.0 * (7 - 1) + 1.5 * (4 - 1) + 3.0 * 1.0 + 2.0 * log2(4)
      //       = 12.0 + 4.5 + 3.0 + 4.0 = 23.5
      const score = calculateRootScore({
        minHsk: 1,
        syllables: 1,
        firstPosRatio: 1.0,
        memberCount: 4,
        weights: DEFAULT_ROOT_SCORE_WEIGHTS
      })

      expect(score).toBe(23.5)
    })

    it('Nhóm có HSK cơ bản và nhiều thành viên hơn có điểm cao hơn', () => {
      const basicGroupScore = calculateRootScore({
        minHsk: 1,
        syllables: 1,
        firstPosRatio: 0.8,
        memberCount: 5
      })

      const advancedGroupScore = calculateRootScore({
        minHsk: 5,
        syllables: 3,
        firstPosRatio: 0.2,
        memberCount: 2
      })

      expect(basicGroupScore).toBeGreaterThan(advancedGroupScore)
    })
  })

  describe('4. Quy đổi kết quả ôn tập Synonym Recall sang điểm đánh giá SRS', () => {
    it('Quy đổi tỷ lệ 100% đúng thành SRS Rating = 4 (Easy)', () => {
      const results = [
        { vocab_id: 1, is_correct: true },
        { vocab_id: 2, is_correct: true },
        { vocab_id: 3, is_correct: true }
      ]

      const { ratio, items } = convertRecallToSrsRatings(results)
      expect(ratio).toBe(1.0)
      expect(items.every((it) => it.srs_rating === 4)).toBe(true)
    })

    it('Quy đổi tỷ lệ >= 60% đúng thành SRS Rating = 3 (Good) cho từ đúng, 1 (Again) cho từ sai', () => {
      const results = [
        { vocab_id: 1, is_correct: true },
        { vocab_id: 2, is_correct: true },
        { vocab_id: 3, is_correct: false } // 2/3 = 66.7%
      ]

      const { ratio, items } = convertRecallToSrsRatings(results)
      expect(ratio).toBeGreaterThanOrEqual(0.6)

      const correctItems = items.filter((it) => it.is_correct)
      const missedItems = items.filter((it) => !it.is_correct)

      expect(correctItems.every((it) => it.srs_rating === 3)).toBe(true)
      expect(missedItems[0].srs_rating).toBe(1)
    })

    it('Quy đổi tỷ lệ < 60% đúng thành SRS Rating = 2 (Hard) cho từ đúng, 1 (Again) cho từ sai', () => {
      const results = [
        { vocab_id: 1, is_correct: true },
        { vocab_id: 2, is_correct: false },
        { vocab_id: 3, is_correct: false } // 1/3 = 33.3%
      ]

      const { ratio, items } = convertRecallToSrsRatings(results)
      expect(ratio).toBeLessThan(0.6)

      const correctItem = items.find((it) => it.vocab_id === 1)
      const missedItem = items.find((it) => it.vocab_id === 2)

      expect(correctItem?.srs_rating).toBe(2)
      expect(missedItem?.srs_rating).toBe(1)
    })
  })
})
