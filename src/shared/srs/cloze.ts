import { cleanChineseWord, normalizeChineseInput } from '../string-utils'

export interface ClozeItem {
  originalSentence: string
  clozeSentence: string
  targetWord: string
  isSeparable: boolean
  blanks: string[]
}

/**
 * Tạo câu đục lỗ từ câu ví dụ và từ vựng mục tiêu, tự động nhận diện từ ly hợp
 */
export function generateCloze(
  sentence: string | null | undefined,
  word: string | null | undefined
): ClozeItem | null {
  if (!sentence || !word) return null

  const cleanTarget = cleanChineseWord(word)
  if (!cleanTarget) return null

  // 1. Trường hợp từ xuất hiện nguyên vẹn trong câu
  if (sentence.includes(cleanTarget)) {
    return {
      originalSentence: sentence,
      clozeSentence: sentence.replace(cleanTarget, '[___]'),
      targetWord: cleanTarget,
      isSeparable: false,
      blanks: [cleanTarget]
    }
  }

  // 2. Trường hợp từ ly hợp (Separable Verb) bị chèn thành phần ở giữa
  // Ví dụ: "刷牙" trong "我每天刷两次牙。", "打喷嚏" trong "她打了一个喷嚏。"
  const chars = Array.from(cleanTarget)
  if (chars.length >= 2) {
    const verb = chars[0]
    const object = chars.slice(1).join('')
    // Regex tìm verb + [các ký tự chèn ở giữa 1-10 ký tự] + object
    const regex = new RegExp(`${verb}([^${object[0]}]{1,10})${object}`)
    const match = sentence.match(regex)

    if (match) {
      const middlePart = match[1]
      const fullMatch = match[0]
      return {
        originalSentence: sentence,
        clozeSentence: sentence.replace(fullMatch, `[___]${middlePart}[___]`),
        targetWord: cleanTarget,
        isSeparable: true,
        blanks: [verb, object]
      }
    }
  }

  return null
}

/**
 * Kiểm tra đáp án người dùng nhập cho câu đục lỗ
 * Hỗ trợ cả 1 ô input gộp toàn bộ từ, hoặc mảng các ô input tương ứng từng chỗ trống
 */
export function verifyClozeAnswer(
  userInputs: string | string[],
  cloze: ClozeItem
): boolean {
  if (!userInputs) return false

  // Nếu người dùng nhập chuỗi gộp (VD: gõ nguyên cả từ "刷牙" hoặc "打喷嚏")
  if (typeof userInputs === 'string') {
    const normalized = normalizeChineseInput(userInputs)
    const cleanTarget = cleanChineseWord(cloze.targetWord)
    if (normalized === cleanTarget) return true

    // Nếu là từ ly hợp và người dùng nhập các phần cách nhau bằng khoảng trắng (VD: "刷 牙")
    if (cloze.isSeparable) {
      const combinedBlanks = cloze.blanks.map(normalizeChineseInput).join('')
      if (normalized.replace(/\s+/g, '') === combinedBlanks) return true
    }
    return false
  }

  // Nếu người dùng nhập theo từng ô đục lỗ riêng biệt
  if (Array.isArray(userInputs)) {
    if (userInputs.length !== cloze.blanks.length) return false
    return cloze.blanks.every((expectedBlank, index) => {
      const userInput = normalizeChineseInput(userInputs[index])
      return userInput === normalizeChineseInput(expectedBlank)
    })
  }

  return false
}
