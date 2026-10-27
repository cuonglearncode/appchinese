import { CuratedSource } from './curated-source'
import { SynonymGroupCandidate, RawMeaningGloss, SynonymMemberCandidate } from './interfaces'
import { normalizeMeaningString, calculateRootScore } from './gloss-normalizer'
import { getSqliteDb } from '../../database/sqlite-db'
import { SqliteSynonymRepository } from '../../database/repositories/sqlite-synonym.repository'

export class BuildSynonymGroupsUseCase {
  private synonymRepo: any

  constructor(_customSource?: any, synonymRepo?: any) {
    this.synonymRepo = synonymRepo || new SqliteSynonymRepository()
  }

  /**
   * Thực thi toàn bộ pipeline trích xuất nghĩa, phân cụm và lưu trữ sơ đồ từ đồng nghĩa
   */
  async execute(): Promise<{
    totalGroups: number
    totalMembers: number
    inserted: number
    updated: number
  }> {
    console.info('[SynonymBuilder] Bắt đầu tiến trình BuildSynonymGroups...')

    const db = getSqliteDb()
    const rawRows = db.prepare(`
      SELECT id, hsk_level, stt, word, pinyin, meaning_vi, example_zh, example_pinyin, example_vi
      FROM hsk_vocabulary
      ORDER BY hsk_level ASC, id ASC;
    `).all() as any[]

    const glosses: RawMeaningGloss[] = []
    const vocabMap = new Map<number, any>()

    for (const row of rawRows) {
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

    console.info(`[SynonymBuilder] Đã trích xuất ${glosses.length} mảnh nghĩa đơn (glosses). Đang lưu vào DB...`)
    await this.synonymRepo.saveGlossEntries(glosses)

    // Gom nhóm tự động
    const groupedByGloss = new Map<string, Array<{ vocabId: number; gloss: RawMeaningGloss }>>()
    for (const g of glosses) {
      if (!groupedByGloss.has(g.gloss)) {
        groupedByGloss.set(g.gloss, [])
      }
      groupedByGloss.get(g.gloss)!.push({ vocabId: g.vocabId, gloss: g })
    }

    const autoGroups: SynonymGroupCandidate[] = []

    for (const [rootGloss, entries] of groupedByGloss.entries()) {
      const wordToBestEntry = new Map<string, { vocabRow: any; gloss: RawMeaningGloss }>()

      for (const entry of entries) {
        const vRow = vocabMap.get(entry.vocabId)
        if (!vRow) continue

        const existing = wordToBestEntry.get(vRow.word)
        if (!existing) {
          wordToBestEntry.set(vRow.word, { vocabRow: vRow, gloss: entry.gloss })
        } else {
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
      if (uniqueMembers.length < 2) continue

      uniqueMembers.sort((a, b) => {
        const hskDiff = Number(a.vocabRow.hsk_level) - Number(b.vocabRow.hsk_level)
        if (hskDiff !== 0) return hskDiff
        const posDiff = a.gloss.position - b.gloss.position
        if (posDiff !== 0) return posDiff
        return Number(a.vocabRow.stt) - Number(b.vocabRow.stt)
      })

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

      autoGroups.push({
        rootGloss,
        rootScore,
        source: 'auto',
        status: 'draft',
        members: memberCandidates
      })
    }

    console.info(`[SynonymBuilder] Đã tạo ${autoGroups.length} nhóm từ đồng nghĩa tự động.`)

    // 3. Đọc dữ liệu Curated
    const curatedSource = new CuratedSource()
    const curatedGroups = await curatedSource.buildCandidates()
    if (curatedGroups.length > 0) {
      console.info(`[SynonymBuilder] Đã nạp ${curatedGroups.length} nhóm đồng nghĩa Curated ghi đè.`)
    }

    // 4. Kết hợp dữ liệu (Curated ưu tiên hàng đầu)
    const groupMap = new Map<string, SynonymGroupCandidate>()
    for (const g of autoGroups) {
      groupMap.set(g.rootGloss.toLowerCase(), g)
    }
    for (const c of curatedGroups) {
      groupMap.set(c.rootGloss.toLowerCase(), c)
    }

    const combinedGroups = Array.from(groupMap.values())
    combinedGroups.sort((a, b) => b.rootScore - a.rootScore)

    // 5. Lưu nhóm và thành viên vào SQLite
    const saveResult = await this.synonymRepo.saveGroups(combinedGroups)

    let totalMembers = 0
    for (const g of combinedGroups) {
      totalMembers += g.members.length
    }

    console.info(
      `[SynonymBuilder] Hoàn tất BuildSynonymGroups: Tổng cộng ${combinedGroups.length} nhóm (${totalMembers} liên kết thành viên).`
    )

    return {
      totalGroups: combinedGroups.length,
      totalMembers,
      inserted: saveResult.inserted,
      updated: saveResult.updated
    }
  }
}
