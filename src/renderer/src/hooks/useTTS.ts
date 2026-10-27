import { useState, useEffect, useCallback, useRef } from 'react'

export interface TTSState {
  isSupported: boolean
  isSpeaking: boolean
  hasChineseVoice: boolean
  chineseVoiceName: string
  warningMessage: string | null
  speak: (text: string, rate?: number) => void
  stop: () => void
}

/**
 * Hook điều khiển phát âm tiếng Trung Web Speech API (TTS)
 * Tự động nhận diện voice tiếng Trung (zh-CN) và xử lý tương thích cho Linux/Windows/macOS
 */
export function useTTS(): TTSState {
  const [isSupported, setIsSupported] = useState<boolean>(false)
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false)
  const [hasChineseVoice, setHasChineseVoice] = useState<boolean>(false)
  const [chineseVoiceName, setChineseVoiceName] = useState<string>('Đang quét...')
  const [warningMessage, setWarningMessage] = useState<string | null>(null)

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)

  const updateVoices = useCallback((): void => {
    if (!('speechSynthesis' in window)) {
      setIsSupported(false)
      setHasChineseVoice(false)
      setChineseVoiceName('Web Speech API không được hỗ trợ')
      setWarningMessage('Trình duyệt không hỗ trợ Web Speech API.')
      return
    }

    setIsSupported(true)
    const voices = window.speechSynthesis.getVoices()
    if (!voices || voices.length === 0) return

    // Tìm giọng tiếng Trung ưu tiên zh-CN (Phổ thông / Giản thể)
    const zhVoice =
      voices.find((v) => v.lang.toLowerCase() === 'zh-cn' || v.lang.toLowerCase() === 'zh_cn') ||
      voices.find((v) => v.lang.toLowerCase().startsWith('zh')) ||
      voices.find(
        (v) =>
          v.name.toLowerCase().includes('chinese') ||
          v.name.toLowerCase().includes('mandarin') ||
          v.lang.toLowerCase().includes('cmn')
      )

    if (zhVoice) {
      voiceRef.current = zhVoice
      setHasChineseVoice(true)
      setChineseVoiceName(`${zhVoice.name} (${zhVoice.lang})`)
      setWarningMessage(null)
    } else {
      voiceRef.current = null
      setHasChineseVoice(false)
      setChineseVoiceName('Chưa phát hiện giọng tiếng Trung')
      setWarningMessage(
        'Hệ thống chưa cài giọng đọc tiếng Trung. Trên Linux, hãy chạy: sudo apt install speech-dispatcher espeak-ng'
      )
    }
  }, [])

  useEffect(() => {
    updateVoices()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [updateVoices])

  const stop = useCallback((): void => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [])

  const speak = useCallback(
    (text: string, rate: number = 0.9): void => {
      if (!('speechSynthesis' in window) || !text) return

      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = rate
      utterance.pitch = 1.0

      if (voiceRef.current) {
        utterance.voice = voiceRef.current
        utterance.lang = voiceRef.current.lang
      } else {
        utterance.lang = 'zh-CN'
      }

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = (event) => {
        setIsSpeaking(false)
        console.warn('[TTS] Lỗi phát âm:', event)
      }

      window.speechSynthesis.speak(utterance)
    },
    []
  )

  return {
    isSupported,
    isSpeaking,
    hasChineseVoice,
    chineseVoiceName,
    warningMessage,
    speak,
    stop
  }
}
