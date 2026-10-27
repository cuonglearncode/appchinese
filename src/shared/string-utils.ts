/**
 * Các tiện ích chuẩn hóa chuỗi, xử lý bộ gõ IME và đối sánh đáp án tiếng Trung
 */

/**
 * Chuẩn hóa chuỗi nhập từ bàn phím (IME / Search)
 */
export function normalizeChineseInput(text: string | null | undefined): string {
  if (!text) return ''
  return text.trim().normalize('NFC')
}

/**
 * Loại bỏ chú thích trong ngoặc đơn (cả ngoặc tròn ASCII () và ngoặc tiếng Trung （）)
 * Ví dụ: "得（助动词）" -> "得", "地(助词)" -> "地"
 */
export function cleanChineseWord(word: string | null | undefined): string {
  if (!word) return ''
  return word.replace(/[（(][^）)]*[）)]/g, '').trim().normalize('NFC')
}

/**
 * Tách các biến thể từ nếu có dấu gạch chéo '/'
 * Ví dụ: "爸爸/爸爸" -> ["爸爸"], "喂/喂" -> ["喂"], "这/这儿" -> ["这", "这儿"]
 */
export function getWordVariants(word: string | null | undefined): string[] {
  const cleaned = cleanChineseWord(word)
  if (!cleaned) return []
  const variants = cleaned
    .split('/')
    .map((v) => v.trim().normalize('NFC'))
    .filter((v) => v.length > 0)
  return Array.from(new Set(variants))
}

/**
 * Kiểm tra đáp án người dùng nhập so với từ mục tiêu:
 * - Hỗ trợ loại bỏ chú thích trong ngoặc
 * - Hỗ trợ các biến thể ngăn cách bằng dấu '/'
 * - So khớp chính xác mặt chữ Unicode NFC
 */
export function matchChineseAnswer(userInput: string, targetWord: string): boolean {
  const normalizedInput = normalizeChineseInput(userInput)
  if (!normalizedInput) return false

  const variants = getWordVariants(targetWord)
  return variants.includes(normalizedInput)
}

/**
 * Tách một chuỗi câu tiếng Trung thành các token từ ngữ bằng Intl.Segmenter
 */
export interface SegmentToken {
  text: string
  isWord: boolean
  isTargetWord?: boolean
}

export function segmentChineseSentence(sentence: string, targetWord?: string): SegmentToken[] {
  if (!sentence) return []

  const variants = targetWord ? getWordVariants(targetWord) : []

  // Kiểm tra tính khả dụng của Intl.Segmenter
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })

    const segmentChunk = (chunk: string): SegmentToken[] => {
      if (!chunk) return []
      return Array.from(segmenter.segment(chunk)).map((s) => ({
        text: s.segment,
        isWord: s.isWordLike === true,
        isTargetWord: false
      }))
    }

    // Tìm biến thể từ mục tiêu xuất hiện trong câu
    const matchedVariant = variants.find((v) => sentence.includes(v))
    if (!matchedVariant) {
      return segmentChunk(sentence)
    }

    // Tách câu theo từ mục tiêu để đảm bảo từ mục tiêu luôn được định danh độc lập
    const parts = sentence.split(matchedVariant)
    const result: SegmentToken[] = []

    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) {
        result.push(...segmentChunk(parts[i]))
      }
      if (i < parts.length - 1) {
        result.push({
          text: matchedVariant,
          isWord: true,
          isTargetWord: true
        })
      }
    }

    return result
  }

  // Fallback khi không có Intl.Segmenter
  return [
    {
      text: sentence,
      isWord: true,
      isTargetWord: false
    }
  ]
}
