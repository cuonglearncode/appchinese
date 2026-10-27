import { Pool } from 'mysql2/promise'
import {
  SynonymMapDTO,
  SynonymMemberDTO,
  SynonymRegister,
  SynonymSource,
  SynonymStatus
} from '@shared/schemas'
import { ISynonymRepository } from './interfaces'
import { getPool } from '../pool'
import { SynonymGroupCandidate, RawMeaningGloss } from '../../modules/synonym-map/interfaces'

export class MySqlSynonymRepository implements ISynonymRepository {
  private pool: Pool

  // In-Memory Caches để đạt SLA < 20ms truy vấn sơ đồ
  private cacheByVocabId = new Map<number, SynonymMapDTO[]>()
  private cacheByRootGloss = new Map<string, SynonymMapDTO>()
  private cacheAllGroups: SynonymMapDTO[] = []
  private isCacheLoaded = false

  constructor(customPool?: Pool) {
    this.pool = customPool || getPool()
  }

  /**
   * Tải toàn bộ sơ đồ đồng nghĩa vào RAM (Preload In-Memory Cache)
   */
  async loadCache(): Promise<void> {
    try {
      // 1. Lấy tất cả các nhóm
      const [groupRows] = await this.pool.execute<any[]>(`
        SELECT id, root_gloss, root_score, source, status, updated_at
        FROM synonym_groups
        WHERE status != 'hidden'
        ORDER BY root_score DESC, id ASC;
      `)

      if (!groupRows || groupRows.length === 0) {
        this.cacheByVocabId.clear()
        this.cacheByRootGloss.clear()
        this.cacheAllGroups = []
        this.isCacheLoaded = true
        return
      }

      // 2. Lấy tất cả thành viên kèm thông tin từ vựng HSK
      const [memberRows] = await this.pool.execute<any[]>(`
        SELECT 
          m.group_id, m.vocab_id, m.rank_order, m.register, m.nuance_note,
          v.word, v.pinyin, v.hsk_level, v.meaning_vi, v.example_zh, v.example_pinyin, v.example_vi
        FROM synonym_group_members m
        JOIN hsk_vocabulary v ON m.vocab_id = v.id
        ORDER BY m.group_id ASC, m.rank_order ASC;
      `)

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

      // Sắp xếp các nhóm theo root_score giảm dần cho từng từ vựng
      for (const [, groups] of newByVocab) {
        groups.sort((a, b) => b.root_score - a.root_score)
      }

      this.cacheByVocabId = newByVocab
      this.cacheByRootGloss = newByGloss
      this.cacheAllGroups = newAll
      this.isCacheLoaded = true
    } catch (err) {
      console.warn('[MySqlSynonymRepository] Lỗi tải In-Memory Cache:', err)
    }
  }

  /**
   * Đảm bảo cache đã nạp trước khi truy vấn
   */
  private async ensureCache(): Promise<void> {
    if (!this.isCacheLoaded) {
      await this.loadCache()
    }
  }

  /**
   * Lấy danh sách các sơ đồ đồng nghĩa mà từ vựng tham gia (< 20ms qua RAM cache)
   */
  async getByVocabId(vocabId: number): Promise<SynonymMapDTO[]> {
    await this.ensureCache()
    const cached = this.cacheByVocabId.get(Number(vocabId))
    if (cached) {
      return cached
    }

    // Fallback DB trực tiếp nếu cache rỗng
    const sql = `
      SELECT 
        g.id, g.root_gloss, g.root_score, g.source, g.status
      FROM synonym_groups g
      JOIN synonym_group_members m ON g.id = m.group_id
      WHERE m.vocab_id = ? AND g.status != 'hidden'
      ORDER BY g.root_score DESC, g.id ASC;
    `
    const [groupRows] = await this.pool.execute<any[]>(sql, [vocabId])
    if (!groupRows || groupRows.length === 0) return []

    const results: SynonymMapDTO[] = []
    for (const g of groupRows) {
      const gid = Number(g.id)
      const [members] = await this.pool.execute<any[]>(
        `
        SELECT 
          m.vocab_id, m.rank_order, m.register, m.nuance_note,
          v.word, v.pinyin, v.hsk_level, v.meaning_vi, v.example_zh, v.example_pinyin, v.example_vi
        FROM synonym_group_members m
        JOIN hsk_vocabulary v ON m.vocab_id = v.id
        WHERE m.group_id = ?
        ORDER BY m.rank_order ASC;
      `,
        [gid]
      )

      const formattedMembers: SynonymMemberDTO[] = members.map((r) => ({
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
      }))

      results.push({
        id: gid,
        root_gloss: String(g.root_gloss),
        root_score: Number(g.root_score),
        source: g.source as SynonymSource,
        status: g.status as SynonymStatus,
        members: formattedMembers.slice(0, 8),
        total_members: formattedMembers.length
      })
    }

    return results
  }

  /**
   * Lấy sơ đồ theo nghĩa gốc tiếng Việt (root_gloss)
   */
  async getByRootGloss(rootGloss: string): Promise<SynonymMapDTO | null> {
    await this.ensureCache()
    const clean = rootGloss.trim().toLowerCase()
    const cached = this.cacheByRootGloss.get(clean)
    if (cached) {
      return cached
    }

    const [rows] = await this.pool.execute<any[]>(
      `SELECT id FROM synonym_groups WHERE root_gloss = ? AND status != 'hidden' LIMIT 1;`,
      [clean]
    )
    if (!rows || rows.length === 0) return null

    const gid = Number(rows[0].id)
    const [all] = await this.getByVocabId(gid)
    return all || null
  }

  /**
   * Danh sách nhóm phân trang phục vụ trang SynonymMapPage
   */
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

  /**
   * Cập nhật sắc thái nghĩa và phê duyệt nhóm
   */
  async updateNuance(req: {
    groupId: number
    vocabId: number
    register: string
    nuanceNote: string
    approveGroup?: boolean
  }): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.execute(
        `
        UPDATE synonym_group_members 
        SET \`register\` = ?, \`nuance_note\` = ?
        WHERE \`group_id\` = ? AND \`vocab_id\` = ?;
      `,
        [req.register, req.nuanceNote.trim() || null, req.groupId, req.vocabId]
      )

      if (req.approveGroup) {
        await conn.execute(
          `
          UPDATE synonym_groups 
          SET \`status\` = 'approved'
          WHERE \`id\` = ?;
        `,
          [req.groupId]
        )
      }

      await conn.commit()
      // Tải lại RAM cache để phản ánh ngay
      await this.loadCache()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  /**
   * Lưu các mảnh nghĩa đơn vào bảng meaning_glosses
   */
  async saveGlossEntries(glosses: RawMeaningGloss[]): Promise<void> {
    if (glosses.length === 0) return

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query('DELETE FROM `meaning_glosses`;')

      const batchSize = 300
      for (let i = 0; i < glosses.length; i += batchSize) {
        const batch = glosses.slice(i, i + batchSize)
        const placeholders: string[] = []
        const values: any[] = []

        for (const g of batch) {
          placeholders.push('(?, ?, ?, ?, ?)')
          values.push(g.vocabId, g.gloss, g.glossRaw, g.extractedNote, g.position)
        }

        const sql = `
          INSERT INTO \`meaning_glosses\` (\`vocab_id\`, \`gloss\`, \`gloss_raw\`, \`extracted_note\`, \`position\`)
          VALUES ${placeholders.join(', ')}
          ON DUPLICATE KEY UPDATE 
            \`gloss_raw\` = VALUES(\`gloss_raw\`),
            \`extracted_note\` = VALUES(\`extracted_note\`),
            \`position\` = VALUES(\`position\`);
        `
        await conn.query(sql, values)
      }

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  /**
   * Lưu các nhóm và thành viên, bảo toàn các nhóm approved và nuance_note thủ công
   */
  async saveGroups(groups: SynonymGroupCandidate[]): Promise<{ inserted: number; updated: number }> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      // 1. Đọc các nhóm đang có trạng thái approved hoặc nuance_note đã chỉnh sửa
      const [existingApproved] = await conn.query<any[]>(`
        SELECT root_gloss FROM synonym_groups WHERE status = 'approved';
      `)
      const approvedGlossSet = new Set(existingApproved.map((r: any) => String(r.root_gloss)))

      const [existingCustomNotes] = await conn.query<any[]>(`
        SELECT m.group_id, m.vocab_id, m.register, m.nuance_note, g.root_gloss
        FROM synonym_group_members m
        JOIN synonym_groups g ON m.group_id = g.id
        WHERE m.nuance_note IS NOT NULL;
      `)
      const customNoteMap = new Map<string, { register: string; nuanceNote: string }>()
      for (const r of existingCustomNotes) {
        const key = `${r.root_gloss}#${r.vocab_id}`
        customNoteMap.set(key, { register: r.register, nuanceNote: r.nuance_note })
      }

      let insertedCount = 0
      let updatedCount = 0

      for (const group of groups) {
        const isApproved = approvedGlossSet.has(group.rootGloss)
        const statusToSet = isApproved ? 'approved' : group.status || 'draft'
        const sourceToSet = isApproved ? 'curated' : group.source || 'auto'

        // Chèn hoặc cập nhật bảng synonym_groups
        const [res] = await conn.execute<any>(
          `
          INSERT INTO synonym_groups (root_gloss, root_score, source, status)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            root_score = VALUES(root_score),
            status = IF(status = 'approved', 'approved', VALUES(status)),
            source = IF(status = 'approved', source, VALUES(source));
        `,
          [group.rootGloss, group.rootScore, sourceToSet, statusToSet]
        )

        let groupId: number = Number(res.insertId)
        if (!groupId) {
          const [findRows] = await conn.execute<any[]>(
            `SELECT id FROM synonym_groups WHERE root_gloss = ? LIMIT 1;`,
            [group.rootGloss]
          )
          if (findRows.length > 0) {
            groupId = Number(findRows[0].id)
            updatedCount++
          }
        } else {
          insertedCount++
        }

        if (!groupId) continue

        // Xóa thành viên cũ (nếu không phải nhóm approved) hoặc cập nhật
        if (!isApproved) {
          await conn.execute(`DELETE FROM synonym_group_members WHERE group_id = ?;`, [groupId])
        }

        // Chèn danh sách thành viên mới
        for (const member of group.members) {
          const customKey = `${group.rootGloss}#${member.vocabId}`
          const preserved = customNoteMap.get(customKey)

          const reg = preserved ? preserved.register : member.register
          const note = preserved ? preserved.nuanceNote : member.nuanceNote

          await conn.execute(
            `
            INSERT INTO synonym_group_members (group_id, vocab_id, rank_order, register, nuance_note)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              rank_order = VALUES(rank_order),
              register = IF(nuance_note IS NOT NULL AND nuance_note != '', register, VALUES(register)),
              nuance_note = IF(nuance_note IS NOT NULL AND nuance_note != '', nuance_note, VALUES(nuance_note));
          `,
            [groupId, member.vocabId, member.rankOrder, reg, note]
          )
        }
      }

      await conn.commit()

      // Tải lại In-Memory Cache
      await this.loadCache()

      return {
        inserted: insertedCount,
        updated: updatedCount
      }
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }
}
