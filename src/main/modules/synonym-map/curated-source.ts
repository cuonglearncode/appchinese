import * as fs from 'fs'
import * as path from 'path'
import { ISynonymSource, SynonymGroupCandidate } from './interfaces'

export class CuratedSource implements ISynonymSource {
  public name = 'curated'
  private customPath?: string

  constructor(customPath?: string) {
    this.customPath = customPath
  }

  async buildCandidates(): Promise<SynonymGroupCandidate[]> {
    const targetPath =
      this.customPath || path.resolve(process.cwd(), 'resources', 'data', 'curated_synonyms.json')

    if (!fs.existsSync(targetPath)) {
      return []
    }

    try {
      const content = await fs.promises.readFile(targetPath, 'utf-8')
      const parsed = JSON.parse(content)
      if (!Array.isArray(parsed)) return []

      return parsed.map((item: any) => ({
        rootGloss: String(item.rootGloss || item.root_gloss).trim().toLowerCase(),
        rootScore: Number(item.rootScore || item.root_score || 99),
        source: 'curated' as const,
        status: 'approved' as const,
        members: Array.isArray(item.members)
          ? item.members.map((m: any, idx: number) => ({
              vocabId: Number(m.vocabId || m.vocab_id),
              word: String(m.word),
              pinyin: String(m.pinyin),
              hskLevel: Number(m.hskLevel || m.hsk_level),
              meaningVi: String(m.meaningVi || m.meaning_vi || ''),
              exampleZh: m.exampleZh || m.example_zh || null,
              examplePinyin: m.examplePinyin || m.example_pinyin || null,
              exampleVi: m.exampleVi || m.example_vi || null,
              rankOrder: Number(m.rankOrder || m.rank_order || idx + 1),
              register: m.register || 'neutral',
              nuanceNote: m.nuanceNote || m.nuance_note || null,
              stt: Number(m.stt || 0),
              position: Number(m.position || 1)
            }))
          : []
      }))
    } catch (err) {
      console.warn('[CuratedSource] Không thể đọc curated_synonyms.json:', err)
      return []
    }
  }
}
