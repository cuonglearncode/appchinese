import { ExtractedGlossPiece } from './interfaces'
import { SynonymRegister } from '@shared/schemas'

export const STANDALONE_POS_LABELS = new Set([
  'danh từ',
  'động từ',
  'tính từ',
  'phó từ',
  'trợ từ',
  'lượng từ',
  'thán từ',
  'giới từ',
  'liên từ',
  'đại từ',
  'số từ',
  'vv',
  'vân vân'
])

export interface RootScoreWeights {
  w1: number
  w2: number
  w3: number
  w4: number
}

export const DEFAULT_ROOT_SCORE_WEIGHTS: RootScoreWeights = {
  w1: 2.0,
  w2: 1.5,
  w3: 3.0,
  w4: 2.0
}

/**
 * Chuẩn hóa chuỗi nghĩa và trích xuất các mảnh nghĩa đơn (Glosses)
 */
export function normalizeMeaningString(meaningRaw: string): ExtractedGlossPiece[] {
  if (!meaningRaw || typeof meaningRaw !== 'string') {
    return []
  }

  // 1. Chuẩn hóa chuỗi về Unicode NFC
  const nfcText = meaningRaw.normalize('NFC').trim()
  if (!nfcText) return []

  // 2. Bảo vệ các cụm trong ngoặc (...) hoặc （...） trước khi tách dấu phẩy
  const parenRegex = /[(\uFF08]([^)\uFF09]*)[)\uFF09]/g
  const placeholders: string[] = []
  const textWithPlaceholders = nfcText.replace(parenRegex, (_, content) => {
    const idx = placeholders.length
    placeholders.push(content.trim())
    return `__PAREN_${idx}__`
  })

  // 3. Tách theo các ký tự phân tách: phẩy, chấm phẩy, gạch chéo
  const rawPieces = textWithPlaceholders.split(/[,;/，；、]/)
  const results: ExtractedGlossPiece[] = []
  let positionCounter = 1

  for (const rawPiece of rawPieces) {
    if (!rawPiece || !rawPiece.trim()) continue

    // Khôi phục lại nội dung trong ngoặc cho từng mảnh nghĩa
    const noteParts: string[] = []
    const pieceClean = rawPiece.replace(/__PAREN_(\d+)__/g, (_, idxStr) => {
      const idx = parseInt(idxStr, 10)
      if (!isNaN(idx) && placeholders[idx] !== undefined) {
        noteParts.push(placeholders[idx])
      }
      return ''
    })
    const extractedNote: string | null = noteParts.length > 0 ? noteParts.join('; ') : null

    // Xử lý chuỗi nghĩa gốc và nghĩa chuẩn hóa
    const glossRaw = pieceClean.trim().replace(/\s+/g, ' ')
    if (!glossRaw) continue

    let gloss = glossRaw.toLowerCase().replace(/\s+/g, ' ')

    // Bỏ nhãn từ loại đứng độc lập
    if (STANDALONE_POS_LABELS.has(gloss)) {
      continue
    }

    // Đếm số âm tiết (từ đơn cách nhau bằng dấu cách)
    const syllables = gloss.split(/\s+/).filter(Boolean)
    if (syllables.length === 0 || syllables.length > 3) {
      // Bỏ qua các cụm quá 3 âm tiết
      continue
    }

    // Tự động xác định register (sắc thái ngôn ngữ)
    let register: SynonymRegister = 'neutral'
    if (extractedNote) {
      const lowerNote = extractedNote.toLowerCase()
      if (lowerNote.includes('lịch sự') || lowerNote.includes('trang trọng')) {
        register = 'formal'
      } else if (lowerNote.includes('khẩu ngữ') || lowerNote.includes('nói')) {
        register = 'spoken'
      }

      // Chống nhập nhằng từ hư đơn âm tiết
      // Nếu có các từ khóa: "lượng từ", "trợ từ", "đứng cuối câu", "nghi vấn", "thán từ", "giới từ", "liên quan đến"
      if (lowerNote.includes('lượng từ')) {
        gloss = `${gloss} (lượng từ)`
      } else if (
        lowerNote.includes('trợ từ') ||
        lowerNote.includes('đứng cuối câu') ||
        lowerNote.includes('nghi vấn')
      ) {
        gloss = `${gloss} (trợ từ)`
      } else if (lowerNote.includes('giới từ')) {
        gloss = `${gloss} (giới từ)`
      } else if (lowerNote.includes('thán từ')) {
        gloss = `${gloss} (thán từ)`
      }
    }

    results.push({
      gloss,
      glossRaw,
      extractedNote: extractedNote || null,
      register,
      position: positionCounter++
    })
  }

  return results
}

/**
 * Công thức tính điểm chất lượng nhóm từ đồng nghĩa (root_score)
 * Score = w1 * (7 - min(HSK)) + w2 * (4 - syllables) + w3 * firstPosRatio + w4 * log2(memberCount)
 */
export function calculateRootScore(params: {
  minHsk: number
  syllables: number
  firstPosRatio: number
  memberCount: number
  weights?: Partial<RootScoreWeights>
}): number {
  const w = { ...DEFAULT_ROOT_SCORE_WEIGHTS, ...params.weights }
  const minHsk = Math.max(1, Math.min(6, params.minHsk))
  const syllables = Math.max(1, Math.min(4, params.syllables))
  const firstPosRatio = Math.max(0, Math.min(1, params.firstPosRatio))
  const memberCount = Math.max(1, params.memberCount)

  const term1 = w.w1 * (7 - minHsk)
  const term2 = w.w2 * (4 - syllables)
  const term3 = w.w3 * firstPosRatio
  const term4 = w.w4 * Math.log2(memberCount)

  const total = term1 + term2 + term3 + term4
  return Math.round(total * 100) / 100
}

/**
 * Quy đổi kết quả ôn tập Synonym Recall sang điểm đánh giá SRS (SM-2 / FSRS)
 * Ratio R = correctBranches / totalBranches
 * Với từ gõ đúng: R = 1.0 -> 4 (Easy); R >= 0.6 -> 3 (Good); R < 0.6 -> 2 (Hard)
 * Với từ bỏ sót / mở đáp án: rating = 1 (Again)
 */
export function convertRecallToSrsRatings(
  results: Array<{ vocab_id: number; is_correct: boolean }>
): {
  ratio: number
  items: Array<{ vocab_id: number; srs_rating: 1 | 2 | 3 | 4; is_correct: boolean }>
} {
  const total = results.length
  if (total === 0) {
    return { ratio: 0, items: [] }
  }

  const correctCount = results.filter((r) => r.is_correct).length
  const ratio = Math.round((correctCount / total) * 100) / 100

  const items = results.map((item) => {
    if (!item.is_correct) {
      return {
        vocab_id: item.vocab_id,
        srs_rating: 1 as const,
        is_correct: false
      }
    }

    let rating: 1 | 2 | 3 | 4 = 3
    if (ratio >= 1.0) {
      rating = 4
    } else if (ratio >= 0.6) {
      rating = 3
    } else {
      rating = 2
    }

    return {
      vocab_id: item.vocab_id,
      srs_rating: rating,
      is_correct: true
    }
  })

  return {
    ratio,
    items
  }
}
