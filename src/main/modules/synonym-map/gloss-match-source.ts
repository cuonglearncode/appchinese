import { Pool } from 'mysql2/promise'
import {
  ISynonymSource,
  SynonymGroupCandidate,
  SynonymMemberCandidate,
  RawMeaningGloss
} from './interfaces'
import { normalizeMeaningString, calculateRootScore } from './gloss-normalizer'

export class GlossMatchSource implements ISynonymSource {
  public name = 'auto'
  private pool: Pool

  constructor(pool: Pool) {
    this.pool = pool
  }

  /**
   * Trích xuất các bản ghi nghĩa đơn lẻ để lưu vào bảng meaning_glosses
   */
  async extractAllRawGlosses(): Promise<{
    glosses: RawMeaningGloss[]
    vocabMap: Map<number, any>
  }> {
    const [rows] = await this.pool.query<any[]>(`
      SELECT id, hsk_level, stt, word, pinyin, meaning_vi, example_zh, example_pinyin, example_vi
      FROM hsk_vocabulary
      ORDER BY hsk_level ASC, id ASC;
    `)

    const glosses: RawMeaningGloss[] = []
    const vocabMap = new Map<number, any>()

    for (const row of rows) {
      vocabMap.set(Number(row.id), row)
      const meaningText = String(row.meaning_vi || '')
      const pieces = normalizeMeaningString(meaningText)

      for (const p of pieces) {
        glosses.push({
          vocabId: Number(row.id),
          gloss: p.gloss,
          glossRaw: p.glossRaw,
          extractedNote: p.extractedNote,
          position: p.position
        })
      }
    }

    return { glosses, vocabMap }
  }

  /**
   * Gom nhóm các từ đồng nghĩa từ bảng từ vựng HSK
   */
  async buildCandidates(): Promise<SynonymGroupCandidate[]> {
    const { glosses, vocabMap } = await this.extractAllRawGlosses()

    // Gom từ theo root_gloss
    const groupedByGloss = new Map<string, Array<{ vocabId: number; gloss: RawMeaningGloss }>>()

    for (const g of glosses) {
      if (!groupedByGloss.has(g.gloss)) {
        groupedByGloss.set(g.gloss, [])
      }
      groupedByGloss.get(g.gloss)!.push({ vocabId: g.vocabId, gloss: g })
    }

    const candidates: SynonymGroupCandidate[] = []

    for (const [rootGloss, entries] of groupedByGloss.entries()) {
      // 1. Khử trùng lặp mặt chữ Hán (word) trong cùng một nhóm:
      // Giữ lại bản ghi có hsk_level thấp nhất
      const wordToBestEntry = new Map<string, { vocabRow: any; gloss: RawMeaningGloss }>()

      for (const entry of entries) {
        const vRow = vocabMap.get(entry.vocabId)
        if (!vRow) continue

        const existing = wordToBestEntry.get(vRow.word)
        if (!existing) {
          wordToBestEntry.set(vRow.word, { vocabRow: vRow, gloss: entry.gloss })
        } else {
          // So sánh HSK Level, ưu tiên cấp thấp hơn
          if (Number(vRow.hsk_level) < Number(existing.vocabRow.hsk_level)) {
            wordToBestEntry.set(vRow.word, { vocabRow: vRow, gloss: entry.gloss })
          } else if (
            Number(vRow.hsk_level) === Number(existing.vocabRow.hsk_level) &&
            entry.gloss.position < existing.gloss.position
          ) {
            wordToBestEntry.set(vRow.word, { vocabRow: vRow, gloss: entry.gloss })
          }
        }
      }

      const uniqueMembers = Array.from(wordToBestEntry.values())

      // 2. Chỉ giữ lại các nhóm có từ 2 chữ Hán khác nhau trở lên
      if (uniqueMembers.length < 2) {
        continue
      }

      // 3. Sắp xếp thành viên theo hsk_level ASC, position ASC, stt ASC
      uniqueMembers.sort((a, b) => {
        const hskDiff = Number(a.vocabRow.hsk_level) - Number(b.vocabRow.hsk_level)
        if (hskDiff !== 0) return hskDiff
        const posDiff = a.gloss.position - b.gloss.position
        if (posDiff !== 0) return posDiff
        return Number(a.vocabRow.stt) - Number(b.vocabRow.stt)
      })

      // 4. Tính toán các chỉ số cho root_score
      const minHsk = Math.min(...uniqueMembers.map((m) => Number(m.vocabRow.hsk_level)))
      const syllables = rootGloss.split(/\s+/).filter(Boolean).length
      const firstPosCount = uniqueMembers.filter((m) => m.gloss.position === 1).length
      const firstPosRatio = firstPosCount / uniqueMembers.length
      const memberCount = uniqueMembers.length

      const rootScore = calculateRootScore({
        minHsk,
        syllables,
        firstPosRatio,
        memberCount
      })

      // 5. Gán rank_order từ 1..N
      const memberCandidates: SynonymMemberCandidate[] = uniqueMembers.map((m, idx) => {
        let register: 'formal' | 'spoken' | 'neutral' = 'neutral'
        if (m.gloss.extractedNote) {
          const lower = m.gloss.extractedNote.toLowerCase()
          if (lower.includes('lịch sự') || lower.includes('trang trọng')) {
            register = 'formal'
          } else if (lower.includes('khẩu ngữ') || lower.includes('nói')) {
            register = 'spoken'
          }
        }

        return {
          vocabId: Number(m.vocabRow.id),
          word: String(m.vocabRow.word),
          pinyin: String(m.vocabRow.pinyin),
          hskLevel: Number(m.vocabRow.hsk_level),
          meaningVi: String(m.vocabRow.meaning_vi || ''),
          exampleZh: m.vocabRow.example_zh || null,
          examplePinyin: m.vocabRow.example_pinyin || null,
          exampleVi: m.vocabRow.example_vi || null,
          rankOrder: idx + 1,
          register,
          nuanceNote: m.gloss.extractedNote || null,
          stt: Number(m.vocabRow.stt || 0),
          position: m.gloss.position
        }
      })

      candidates.push({
        rootGloss,
        rootScore,
        source: 'auto',
        status: 'draft',
        members: memberCandidates
      })
    }

    // Sắp xếp các nhóm theo root_score giảm dần
    candidates.sort((a, b) => b.rootScore - a.rootScore)

    return candidates
  }
}
