import Database from 'better-sqlite3'
import {
  VocabSearchFilter,
  VocabSearchResult,
  VocabWithProgress,
  GetDueVocabRequest,
  WrongWordsFilter,
  HskLevelCount,
  UserVocabProgress
} from '@shared/schemas'
import { IVocabRepository } from './interfaces'
import { getSqliteDb } from '../sqlite-db'

export class SqliteVocabRepository implements IVocabRepository {
  private db: Database.Database

  constructor(customDb?: Database.Database) {
    this.db = customDb || getSqliteDb()
  }

  private mapRowToVocab(row: any): VocabWithProgress {
    let progress: UserVocabProgress | null = null

    if (row.progress_state || row.srs_params) {
      let srsParamsObj = row.srs_params
      if (typeof srsParamsObj === 'string') {
        try {
          srsParamsObj = JSON.parse(srsParamsObj)
        } catch {
          srsParamsObj = { efactor: 2.5, interval: 0, reps: 0 }
        }
      }

      progress = {
        vocab_id: row.id,
        state: row.progress_state || 'new',
        algorithm: row.progress_algorithm || 'sm2',
        srs_params: srsParamsObj || { efactor: 2.5, interval: 0, reps: 0 },
        wrong_count: Number(row.progress_wrong_count || 0),
        correct_count: Number(row.progress_correct_count || 0),
        custom_note: row.progress_custom_note || null,
        last_reviewed_at: row.progress_last_reviewed_at
          ? new Date(row.progress_last_reviewed_at).toISOString()
          : null,
        next_review_at: row.progress_next_review_at
          ? new Date(row.progress_next_review_at).toISOString()
          : null,
        updated_at: row.progress_updated_at
          ? new Date(row.progress_updated_at).toISOString()
          : undefined
      }
    }

    return {
      id: Number(row.id),
      standard_version: row.standard_version || 'HSK2.0',
      hsk_level: Number(row.hsk_level),
      word: String(row.word),
      pinyin: String(row.pinyin),
      meaning_vi: String(row.meaning_vi || row.meaning || ''),
      example_zh: row.example_zh || null,
      example_pinyin: row.example_pinyin || null,
      example_vi: row.example_vi || null,
      progress,
      is_in_notebook: Boolean(row.is_in_notebook)
    }
  }

  async search(filter: VocabSearchFilter): Promise<VocabSearchResult> {
    const limit = filter.limit ?? 50
    const offset = filter.offset ?? 0

    const conditions: string[] = []
    const params: any[] = []
    const needProgressFilter = Boolean(filter.state && filter.state !== 'all')
    const countJoins: string[] = []
    const selectJoins: string[] = [
      'LEFT JOIN user_vocab_progress p ON v.id = p.vocab_id'
    ]

    // 1. Lọc theo sổ tay cá nhân
    if (filter.notebook_id) {
      const nbJoin = 'INNER JOIN notebook_items ni ON v.id = ni.vocab_id AND ni.notebook_id = ?'
      countJoins.push(nbJoin)
      selectJoins.push(nbJoin)
      params.push(filter.notebook_id)
    }

    // 2. Lọc theo trạng thái học tập
    if (needProgressFilter) {
      countJoins.push('LEFT JOIN user_vocab_progress p ON v.id = p.vocab_id')
      if (filter.state === 'new') {
        conditions.push("(p.state IS NULL OR p.state = 'new')")
      } else {
        conditions.push('p.state = ?')
        params.push(filter.state)
      }
    }

    // 3. Lọc theo cấp HSK
    if (filter.hsk_level !== undefined) {
      conditions.push('v.hsk_level = ?')
      params.push(filter.hsk_level)
    }

    // 4. Tìm kiếm từ khóa (Chữ Hán, Pinyin hoặc Nghĩa tiếng Việt)
    if (filter.query && filter.query.trim()) {
      const q = `%${filter.query.trim()}%`
      conditions.push('(v.word LIKE ? OR v.pinyin LIKE ? OR v.meaning_vi LIKE ?)')
      params.push(q, q, q)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Đếm tổng số bản ghi
    const countSql = `
      SELECT COUNT(DISTINCT v.id) as total
      FROM hsk_vocabulary v
      ${countJoins.join(' ')}
      ${whereClause};
    `
    const countRow = this.db.prepare(countSql).get(...params) as { total: number }
    const total = countRow ? Number(countRow.total) : 0

    // Truy vấn dữ liệu phân trang
    const selectSql = `
      SELECT 
        v.id, v.standard_version, v.hsk_level, v.stt, v.word, v.pinyin, v.meaning_vi,
        v.example_zh, v.example_pinyin, v.example_vi,
        p.state as progress_state,
        p.algorithm as progress_algorithm,
        p.srs_params,
        p.wrong_count as progress_wrong_count,
        p.correct_count as progress_correct_count,
        p.custom_note as progress_custom_note,
        p.last_reviewed_at as progress_last_reviewed_at,
        p.next_review_at as progress_next_review_at,
        p.updated_at as progress_updated_at,
        EXISTS(SELECT 1 FROM notebook_items ni WHERE ni.vocab_id = v.id) as is_in_notebook
      FROM hsk_vocabulary v
      ${selectJoins.join(' ')}
      ${whereClause}
      ORDER BY v.hsk_level ASC, v.stt ASC
      LIMIT ? OFFSET ?;
    `
    const rows = this.db.prepare(selectSql).all(...params, limit, offset) as any[]
    const items = rows.map((r) => this.mapRowToVocab(r))

    return {
      items,
      total,
      limit,
      offset
    }
  }

  async getById(id: number): Promise<VocabWithProgress | null> {
    const sql = `
      SELECT 
        v.id, v.standard_version, v.hsk_level, v.stt, v.word, v.pinyin, v.meaning_vi,
        v.example_zh, v.example_pinyin, v.example_vi,
        p.state as progress_state,
        p.algorithm as progress_algorithm,
        p.srs_params,
        p.wrong_count as progress_wrong_count,
        p.correct_count as progress_correct_count,
        p.custom_note as progress_custom_note,
        p.last_reviewed_at as progress_last_reviewed_at,
        p.next_review_at as progress_next_review_at,
        p.updated_at as progress_updated_at,
        EXISTS(SELECT 1 FROM notebook_items ni WHERE ni.vocab_id = v.id) as is_in_notebook
      FROM hsk_vocabulary v
      LEFT JOIN user_vocab_progress p ON v.id = p.vocab_id
      WHERE v.id = ?;
    `
    const row = this.db.prepare(sql).get(id) as any
    if (!row) return null
    return this.mapRowToVocab(row)
  }

  async getByWord(word: string): Promise<VocabWithProgress | null> {
    const sql = `
      SELECT 
        v.id, v.standard_version, v.hsk_level, v.stt, v.word, v.pinyin, v.meaning_vi,
        v.example_zh, v.example_pinyin, v.example_vi,
        p.state as progress_state,
        p.algorithm as progress_algorithm,
        p.srs_params,
        p.wrong_count as progress_wrong_count,
        p.correct_count as progress_correct_count,
        p.custom_note as progress_custom_note,
        p.last_reviewed_at as progress_last_reviewed_at,
        p.next_review_at as progress_next_review_at,
        p.updated_at as progress_updated_at,
        EXISTS(SELECT 1 FROM notebook_items ni WHERE ni.vocab_id = v.id) as is_in_notebook
      FROM hsk_vocabulary v
      LEFT JOIN user_vocab_progress p ON v.id = p.vocab_id
      WHERE v.word = ?
      ORDER BY v.hsk_level ASC
      LIMIT 1;
    `
    const row = this.db.prepare(sql).get(word) as any
    if (!row) return null
    return this.mapRowToVocab(row)
  }

  async getDueWords(req: GetDueVocabRequest): Promise<VocabWithProgress[]> {
    const limit = req.limit ?? 20
    const params: any[] = []
    let levelCondition = ''

    if (req.hsk_level !== undefined) {
      levelCondition = 'AND v.hsk_level = ?'
      params.push(req.hsk_level)
    }

    // 1. Lấy các từ đến hạn ôn tập (state IN ('learning', 'review', 'relearning') và next_review_at <= now)
    const dueSql = `
      SELECT 
        v.id, v.standard_version, v.hsk_level, v.stt, v.word, v.pinyin, v.meaning_vi,
        v.example_zh, v.example_pinyin, v.example_vi,
        p.state as progress_state,
        p.algorithm as progress_algorithm,
        p.srs_params,
        p.wrong_count as progress_wrong_count,
        p.correct_count as progress_correct_count,
        p.custom_note as progress_custom_note,
        p.last_reviewed_at as progress_last_reviewed_at,
        p.next_review_at as progress_next_review_at,
        p.updated_at as progress_updated_at,
        EXISTS(SELECT 1 FROM notebook_items ni WHERE ni.vocab_id = v.id) as is_in_notebook
      FROM hsk_vocabulary v
      INNER JOIN user_vocab_progress p ON v.id = p.vocab_id
      WHERE p.state IN ('learning', 'review', 'relearning')
        AND p.next_review_at <= datetime('now')
        ${levelCondition}
      ORDER BY p.next_review_at ASC
      LIMIT ?;
    `
    const dueRows = this.db.prepare(dueSql).all(...params, limit) as any[]
    const dueItems = dueRows.map((r) => this.mapRowToVocab(r))

    // 2. Nếu số lượng từ đến hạn ít hơn limit, nạp thêm từ mới (New Cards)
    const remaining = limit - dueItems.length
    if (remaining > 0) {
      const newSql = `
        SELECT 
          v.id, v.standard_version, v.hsk_level, v.stt, v.word, v.pinyin, v.meaning_vi,
          v.example_zh, v.example_pinyin, v.example_vi,
          p.state as progress_state,
          p.algorithm as progress_algorithm,
          p.srs_params,
          p.wrong_count as progress_wrong_count,
          p.correct_count as progress_correct_count,
          p.custom_note as progress_custom_note,
          p.last_reviewed_at as progress_last_reviewed_at,
          p.next_review_at as progress_next_review_at,
          p.updated_at as progress_updated_at,
          EXISTS(SELECT 1 FROM notebook_items ni WHERE ni.vocab_id = v.id) as is_in_notebook
        FROM hsk_vocabulary v
        LEFT JOIN user_vocab_progress p ON v.id = p.vocab_id
        WHERE (p.vocab_id IS NULL OR p.state = 'new')
          ${levelCondition}
        ORDER BY v.id ASC
        LIMIT ?;
      `
      const newRows = this.db.prepare(newSql).all(...params, remaining) as any[]
      const newItems = newRows.map((r) => this.mapRowToVocab(r))
      return [...dueItems, ...newItems]
    }

    return dueItems
  }

  async getWrongWords(filter: WrongWordsFilter): Promise<VocabWithProgress[]> {
    const limit = filter.limit ?? 50
    let rows: any[]

    if (filter.date) {
      // Lọc các từ sai theo ngày (quy đổi sang UTC+7)
      const sql = `
        SELECT DISTINCT
          v.id, v.standard_version, v.hsk_level, v.stt, v.word, v.pinyin, v.meaning_vi,
          v.example_zh, v.example_pinyin, v.example_vi,
          p.state as progress_state,
          p.algorithm as progress_algorithm,
          p.srs_params,
          p.wrong_count as progress_wrong_count,
          p.correct_count as progress_correct_count,
          p.custom_note as progress_custom_note,
          p.last_reviewed_at as progress_last_reviewed_at,
          p.next_review_at as progress_next_review_at,
          p.updated_at as progress_updated_at,
          EXISTS(SELECT 1 FROM notebook_items ni WHERE ni.vocab_id = v.id) as is_in_notebook
        FROM review_logs l
        INNER JOIN hsk_vocabulary v ON l.vocab_id = v.id
        LEFT JOIN user_vocab_progress p ON v.id = p.vocab_id
        WHERE l.is_correct = 0 
          AND date(l.reviewed_at, '+7 hours') = ?
        ORDER BY l.reviewed_at DESC
        LIMIT ?;
      `
      rows = this.db.prepare(sql).all(filter.date, limit) as any[]
    } else {
      const sql = `
        SELECT 
          v.id, v.standard_version, v.hsk_level, v.stt, v.word, v.pinyin, v.meaning_vi,
          v.example_zh, v.example_pinyin, v.example_vi,
          p.state as progress_state,
          p.algorithm as progress_algorithm,
          p.srs_params,
          p.wrong_count as progress_wrong_count,
          p.correct_count as progress_correct_count,
          p.custom_note as progress_custom_note,
          p.last_reviewed_at as progress_last_reviewed_at,
          p.next_review_at as progress_next_review_at,
          p.updated_at as progress_updated_at,
          EXISTS(SELECT 1 FROM notebook_items ni WHERE ni.vocab_id = v.id) as is_in_notebook
        FROM user_vocab_progress p
        INNER JOIN hsk_vocabulary v ON p.vocab_id = v.id
        WHERE p.wrong_count > 0
        ORDER BY p.wrong_count DESC
        LIMIT ?;
      `
      rows = this.db.prepare(sql).all(limit) as any[]
    }

    return rows.map((r) => this.mapRowToVocab(r))
  }

  async countByHskLevel(): Promise<HskLevelCount[]> {
    const sql = `
      SELECT 
        v.hsk_level,
        COUNT(v.id) as total,
        COUNT(CASE WHEN p.state IN ('learning', 'review') THEN 1 END) as learned,
        COUNT(CASE WHEN p.state IN ('learning', 'review', 'relearning') AND p.next_review_at <= datetime('now') THEN 1 END) as due_today
      FROM hsk_vocabulary v
      LEFT JOIN user_vocab_progress p ON v.id = p.vocab_id
      GROUP BY v.hsk_level
      ORDER BY v.hsk_level ASC;
    `
    const rows = this.db.prepare(sql).all() as any[]
    return rows.map((r) => ({
      hsk_level: Number(r.hsk_level),
      total: Number(r.total),
      learned: Number(r.learned),
      due_today: Number(r.due_today)
    }))
  }
}
