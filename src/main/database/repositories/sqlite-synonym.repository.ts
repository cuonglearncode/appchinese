import Database from 'better-sqlite3'
import {
  SynonymMapDTO,
  SynonymMemberDTO,
  SynonymRegister,
  SynonymSource,
  SynonymStatus
} from '@shared/schemas'
import { ISynonymRepository } from './interfaces'
import { getSqliteDb } from '../sqlite-db'
import { SynonymGroupCandidate, RawMeaningGloss } from '../../modules/synonym-map/interfaces'

export class SqliteSynonymRepository implements ISynonymRepository {
  private db: Database.Database

  // In-Memory Caches để đạt SLA < 20ms truy vấn sơ đồ
  private cacheByVocabId = new Map<number, SynonymMapDTO[]>()
  private cacheByRootGloss = new Map<string, SynonymMapDTO>()
  private cacheAllGroups: SynonymMapDTO[] = []
  private isCacheLoaded = false

  constructor(customDb?: Database.Database) {
    this.db = customDb || getSqliteDb()
  }

  /**
   * Tải toàn bộ sơ đồ đồng nghĩa vào RAM (Preload In-Memory Cache)
   */
  async loadCache(): Promise<void> {
    try {
      // 1. Lấy tất cả các nhóm
      const groupRows = this.db.prepare(`
        SELECT id, root_gloss, root_score, source, status, updated_at
        FROM synonym_groups
        WHERE status != 'hidden'
        ORDER BY root_score DESC, id ASC;
      `).all() as any[]

      if (!groupRows || groupRows.length === 0) {
        this.cacheByVocabId.clear()
        this.cacheByRootGloss.clear()
        this.cacheAllGroups = []
        this.isCacheLoaded = true
        return
      }

      // 2. Lấy tất cả thành viên kèm thông tin từ vựng HSK
      const memberRows = this.db.prepare(`
        SELECT 
          m.group_id, m.vocab_id, m.rank_order, m.register, m.nuance_note,
          v.word, v.pinyin, v.hsk_level, v.meaning_vi, v.example_zh, v.example_pinyin, v.example_vi
        FROM synonym_group_members m
        JOIN hsk_vocabulary v ON m.vocab_id = v.id
        ORDER BY m.group_id ASC, m.rank_order ASC;
      `).all() as any[]

      const groupMembersMap = new Map<number, SynonymMemberDTO[]>()
      for (const r of memberRows) {
        const gid = Number(r.group_id)
        if (!groupMembersMap.has(gid)) {
          groupMembersMap.set(gid, [])
        }
        groupMembersMap.get(gid)!.push({
          vocab_id: Number(r.vocab_id),
          word: String(r.word),
          pinyin: String(r.pinyin),
          hsk_level: Number(r.hsk_level),
          meaning_vi: String(r.meaning_vi || ''),
          example_zh: r.example_zh || null,
          example_pinyin: r.example_pinyin || null,
          example_vi: r.example_vi || null,
          rank_order: Number(r.rank_order),
          register: (r.register || 'neutral') as SynonymRegister,
          nuance_note: r.nuance_note || null
        })
      }

      const newByVocab = new Map<number, SynonymMapDTO[]>()
      const newByGloss = new Map<string, SynonymMapDTO>()
      const newAll: SynonymMapDTO[] = []

      for (const g of groupRows) {
        const gid = Number(g.id)
        const allMembers = groupMembersMap.get(gid) || []
        // Chỉ lấy tối đa 8 nhánh xếp theo rank_order
        const displayedMembers = allMembers.slice(0, 8)

        const dto: SynonymMapDTO = {
          id: gid,
          root_gloss: String(g.root_gloss),
          root_score: Number(g.root_score),
          source: g.source as SynonymSource,
          status: g.status as SynonymStatus,
          members: displayedMembers,
          total_members: allMembers.length
        }

        newAll.push(dto)
        newByGloss.set(dto.root_gloss.toLowerCase(), dto)

        for (const m of allMembers) {
          if (!newByVocab.has(m.vocab_id)) {
            newByVocab.set(m.vocab_id, [])
          }
          newByVocab.get(m.vocab_id)!.push(dto)
        }
      }

      // Sắp xếp các nhóm của từng từ theo root_score DESC
      for (const list of newByVocab.values()) {
        list.sort((a, b) => b.root_score - a.root_score)
      }

      this.cacheByVocabId = newByVocab
      this.cacheByRootGloss = newByGloss
      this.cacheAllGroups = newAll
      this.isCacheLoaded = true
    } catch (err) {
      console.error('[SqliteSynonymRepository] Lỗi nạp cache sơ đồ:', err)
    }
  }

  private async ensureCache(): Promise<void> {
    if (!this.isCacheLoaded) {
      await this.loadCache()
    }
  }

  async getByVocabId(vocabId: number): Promise<SynonymMapDTO[]> {
    await this.ensureCache()
    return this.cacheByVocabId.get(vocabId) || []
  }

  async getByRootGloss(rootGloss: string): Promise<SynonymMapDTO | null> {
    await this.ensureCache()
    const clean = rootGloss.trim().toLowerCase()
    const cached = this.cacheByRootGloss.get(clean)
    if (cached) {
      return cached
    }

    const row = this.db.prepare(
      `SELECT id FROM synonym_groups WHERE root_gloss = ? AND status != 'hidden' LIMIT 1;`
    ).get(clean) as any
    if (!row) return null

    const gid = Number(row.id)
    const [all] = await this.getByVocabId(gid)
    return all || null
  }

  async listGroups(filter: {
    search?: string
    hskLevel?: number
    status?: string
    page: number
    limit: number
  }): Promise<{ items: SynonymMapDTO[]; total: number; page: number; limit: number }> {
    await this.ensureCache()

    let filtered = this.cacheAllGroups

    if (filter.status) {
      filtered = filtered.filter((g) => g.status === filter.status)
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase()
      filtered = filtered.filter((g) => {
        if (g.root_gloss.toLowerCase().includes(q)) return true
        return g.members.some(
          (m) =>
            m.word.includes(q) ||
            m.pinyin.toLowerCase().includes(q) ||
            m.meaning_vi.toLowerCase().includes(q)
        )
      })
    }

    if (filter.hskLevel) {
      const targetLevel = Number(filter.hskLevel)
      filtered = filtered.filter((g) => g.members.some((m) => m.hsk_level === targetLevel))
    }

    const total = filtered.length
    const page = Math.max(1, filter.page)
    const limit = Math.max(1, Math.min(100, filter.limit))
    const offset = (page - 1) * limit
    const items = filtered.slice(offset, offset + limit)

    return {
      items,
      total,
      page,
      limit
    }
  }

  async updateNuance(req: {
    groupId: number
    vocabId: number
    register: string
    nuanceNote: string
    approveGroup?: boolean
  }): Promise<void> {
    this.db.transaction(() => {
      this.db.prepare(`
        UPDATE synonym_group_members 
        SET register = ?, nuance_note = ?
        WHERE group_id = ? AND vocab_id = ?;
      `).run(req.register, req.nuanceNote.trim() || null, req.groupId, req.vocabId)

      if (req.approveGroup) {
        this.db.prepare(`
          UPDATE synonym_groups 
          SET status = 'approved'
          WHERE id = ?;
        `).run(req.groupId)
      }
    })()

    // Cập nhật lại in-memory cache
    await this.loadCache()
  }

  async saveRawGlosses(glosses: RawMeaningGloss[]): Promise<void> {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO meaning_glosses (vocab_id, gloss, gloss_raw, extracted_note, position)
      VALUES (?, ?, ?, ?, ?);
    `)

    this.db.transaction(() => {
      for (const g of glosses) {
        insert.run(g.vocabId, g.gloss, g.glossRaw, g.extractedNote, g.position)
      }
    })()
  }

  async saveCandidates(candidates: SynonymGroupCandidate[]): Promise<void> {
    const existingGroups = this.db.prepare('SELECT id, root_gloss, status FROM synonym_groups').all() as any[]
    const approvedRoots = new Set(
      existingGroups.filter((g) => g.status === 'approved').map((g) => g.root_gloss.toLowerCase())
    )

    const existingMembers = this.db.prepare('SELECT group_id, vocab_id, nuance_note FROM synonym_group_members').all() as any[]
    const customNotes = new Map<string, string>()
    for (const m of existingMembers) {
      if (m.nuance_note) {
        customNotes.set(`${m.group_id}_${m.vocab_id}`, m.nuance_note)
      }
    }

    const insertGroup = this.db.prepare(`
      INSERT OR REPLACE INTO synonym_groups (root_gloss, root_score, source, status, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'));
    `)
    const insertMember = this.db.prepare(`
      INSERT OR REPLACE INTO synonym_group_members (group_id, vocab_id, rank_order, register, nuance_note)
      VALUES (?, ?, ?, ?, ?);
    `)

    this.db.transaction(() => {
      for (const cand of candidates) {
        const rootLower = cand.rootGloss.toLowerCase()
        const isApproved = approvedRoots.has(rootLower)

        const finalStatus: SynonymStatus = isApproved ? 'approved' : cand.status
        const finalSource: SynonymSource = isApproved ? 'curated' : cand.source

        const res = insertGroup.run(cand.rootGloss, cand.rootScore, finalSource, finalStatus)
        const groupId = Number(res.lastInsertRowid)

        for (const m of cand.members) {
          const preservedNote = customNotes.get(`${groupId}_${m.vocabId}`) || m.nuanceNote
          insertMember.run(groupId, m.vocabId, m.rankOrder, m.register, preservedNote)
        }
      }
    })()

    await this.loadCache()
  }

  async saveGlossEntries(glosses: RawMeaningGloss[]): Promise<void> {
    return this.saveRawGlosses(glosses)
  }

  async saveGroups(candidates: SynonymGroupCandidate[]): Promise<{ inserted: number; updated: number }> {
    await this.saveCandidates(candidates)
    return { inserted: candidates.length, updated: 0 }
  }
}
