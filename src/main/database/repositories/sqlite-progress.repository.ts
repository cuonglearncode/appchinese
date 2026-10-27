import Database from 'better-sqlite3'
import {
  UserVocabProgress,
  ReviewLog,
  StatsSummaryResponse,
  HeatmapDay
} from '@shared/schemas'
import { IProgressRepository } from './interfaces'
import { getSqliteDb } from '../sqlite-db'

export class SqliteProgressRepository implements IProgressRepository {
  private db: Database.Database

  constructor(customDb?: Database.Database) {
    this.db = customDb || getSqliteDb()
  }

  async get(vocabId: number): Promise<UserVocabProgress | null> {
    const sql = `
      SELECT vocab_id, state, algorithm, srs_params, wrong_count, correct_count,
             custom_note, last_reviewed_at, next_review_at, updated_at
      FROM user_vocab_progress
      WHERE vocab_id = ?
      LIMIT 1;
    `
    const r = this.db.prepare(sql).get(vocabId) as any
    if (!r) return null

    let srsParamsObj = r.srs_params
    if (typeof srsParamsObj === 'string') {
      try {
        srsParamsObj = JSON.parse(srsParamsObj)
      } catch {
        srsParamsObj = { efactor: 2.5, interval: 0, reps: 0 }
      }
    }

    return {
      vocab_id: Number(r.vocab_id),
      state: r.state,
      algorithm: r.algorithm,
      srs_params: srsParamsObj,
      wrong_count: Number(r.wrong_count || 0),
      correct_count: Number(r.correct_count || 0),
      custom_note: r.custom_note || null,
      last_reviewed_at: r.last_reviewed_at ? new Date(r.last_reviewed_at).toISOString() : null,
      next_review_at: r.next_review_at ? new Date(r.next_review_at).toISOString() : null,
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined
    }
  }

  async upsert(progress: UserVocabProgress, conn?: any): Promise<void> {
    const db = conn || this.db
    const sql = `
      INSERT INTO user_vocab_progress
        (vocab_id, state, algorithm, srs_params, wrong_count, correct_count, custom_note, last_reviewed_at, next_review_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(vocab_id) DO UPDATE SET
        state = excluded.state,
        algorithm = excluded.algorithm,
        srs_params = excluded.srs_params,
        wrong_count = excluded.wrong_count,
        correct_count = excluded.correct_count,
        custom_note = excluded.custom_note,
        last_reviewed_at = excluded.last_reviewed_at,
        next_review_at = excluded.next_review_at,
        updated_at = datetime('now');
    `

    const lastReviewed = progress.last_reviewed_at
      ? new Date(progress.last_reviewed_at).toISOString()
      : null
    const nextReview = progress.next_review_at
      ? new Date(progress.next_review_at).toISOString()
      : null

    db.prepare(sql).run(
      progress.vocab_id,
      progress.state,
      progress.algorithm,
      JSON.stringify(progress.srs_params),
      progress.wrong_count,
      progress.correct_count,
      progress.custom_note || null,
      lastReviewed,
      nextReview
    )
  }

  async logReview(reviewLog: ReviewLog, conn?: any): Promise<number> {
    const db = conn || this.db
    const sql = `
      INSERT INTO review_logs
        (vocab_id, review_mode, user_input, is_correct, srs_rating, response_time_ms, reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')));
    `

    const reviewedAt = reviewLog.reviewed_at
      ? new Date(reviewLog.reviewed_at).toISOString()
      : null
    const res = db.prepare(sql).run(
      reviewLog.vocab_id,
      reviewLog.review_mode,
      reviewLog.user_input || null,
      reviewLog.is_correct ? 1 : 0,
      reviewLog.srs_rating,
      reviewLog.response_time_ms || 0,
      reviewedAt
    )

    return Number(res.lastInsertRowid)
  }

  async getStatsSummary(timezoneOffsetMinutes: number = 420): Promise<StatsSummaryResponse> {
    // 1. Tính toán tổng số từ, số từ đã học, số từ cần ôn
    const totalWordsRow = this.db.prepare('SELECT COUNT(*) as total FROM hsk_vocabulary').get() as any
    const progressSummaryRow = this.db.prepare(`
      SELECT 
        COUNT(CASE WHEN state IN ('learning', 'review') THEN 1 END) as total_learned,
        COUNT(CASE WHEN state IN ('learning', 'review', 'relearning') AND next_review_at <= datetime('now') THEN 1 END) as total_due_today
      FROM user_vocab_progress;
    `).get() as any
    const totalReviewsRow = this.db.prepare('SELECT COUNT(*) as total FROM review_logs').get() as any

    // 2. Thống kê theo cấp độ HSK
    const hskLevelsRows = this.db.prepare(`
      SELECT 
        v.hsk_level,
        COUNT(v.id) as total,
        COUNT(CASE WHEN p.state IN ('learning', 'review') THEN 1 END) as learned,
        COUNT(CASE WHEN p.state IN ('learning', 'review', 'relearning') AND p.next_review_at <= datetime('now') THEN 1 END) as due_today
      FROM hsk_vocabulary v
      LEFT JOIN user_vocab_progress p ON v.id = p.vocab_id
      GROUP BY v.hsk_level
      ORDER BY v.hsk_level ASC;
    `).all() as any[]

    // 3. Quy đổi timezone offset sang SQLite modifier (VD: 420 phút = '+420 minutes' hoặc '+7 hours')
    const tzModifier = `${timezoneOffsetMinutes >= 0 ? '+' : ''}${timezoneOffsetMinutes} minutes`

    // 4. Lấy Heatmap học tập theo ngày trong 365 ngày gần nhất
    const heatmapSql = `
      SELECT 
        date(reviewed_at, ?) as review_date,
        COUNT(id) as count,
        COUNT(CASE WHEN is_correct = 1 THEN 1 END) as correct_count
      FROM review_logs
      WHERE reviewed_at >= datetime('now', '-365 days')
      GROUP BY review_date
      ORDER BY review_date ASC;
    `
    const heatmapRows = this.db.prepare(heatmapSql).all(tzModifier) as any[]

    const heatmap: HeatmapDay[] = heatmapRows.map((r) => ({
      date: String(r.review_date),
      count: Number(r.count),
      correct_count: Number(r.correct_count)
    }))

    return {
      total_words: Number(totalWordsRow?.total || 0),
      total_learned: Number(progressSummaryRow?.total_learned || 0),
      total_due_today: Number(progressSummaryRow?.total_due_today || 0),
      total_reviews: Number(totalReviewsRow?.total || 0),
      hsk_levels: hskLevelsRows.map((r) => ({
        hsk_level: Number(r.hsk_level),
        total: Number(r.total),
        learned: Number(r.learned),
        due_today: Number(r.due_today)
      })),
      heatmap
    }
  }
}
