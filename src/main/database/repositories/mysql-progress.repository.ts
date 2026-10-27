import { Pool, PoolConnection } from 'mysql2/promise'
import {
  UserVocabProgress,
  ReviewLog,
  StatsSummaryResponse,
  HeatmapDay
} from '@shared/schemas'
import { IProgressRepository } from './interfaces'
import { getPool } from '../pool'

export class MySqlProgressRepository implements IProgressRepository {
  private pool: Pool

  constructor(customPool?: Pool) {
    this.pool = customPool || getPool()
  }

  async get(vocabId: number): Promise<UserVocabProgress | null> {
    const sql = `
      SELECT \`vocab_id\`, \`state\`, \`algorithm\`, \`srs_params\`, \`wrong_count\`, \`correct_count\`,
             \`custom_note\`, \`last_reviewed_at\`, \`next_review_at\`, \`updated_at\`
      FROM \`user_vocab_progress\`
      WHERE \`vocab_id\` = ?
      LIMIT 1;
    `
    const [rows] = await this.pool.execute<any[]>(sql, [vocabId])
    if (!rows || rows.length === 0) return null

    const r = rows[0]
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

  async upsert(progress: UserVocabProgress, conn?: PoolConnection): Promise<void> {
    const executor = conn || this.pool
    const sql = `
      INSERT INTO \`user_vocab_progress\`
        (\`vocab_id\`, \`state\`, \`algorithm\`, \`srs_params\`, \`wrong_count\`, \`correct_count\`, \`custom_note\`, \`last_reviewed_at\`, \`next_review_at\`)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        \`state\` = VALUES(\`state\`),
        \`algorithm\` = VALUES(\`algorithm\`),
        \`srs_params\` = VALUES(\`srs_params\`),
        \`wrong_count\` = VALUES(\`wrong_count\`),
        \`correct_count\` = VALUES(\`correct_count\`),
        \`custom_note\` = VALUES(\`custom_note\`),
        \`last_reviewed_at\` = VALUES(\`last_reviewed_at\`),
        \`next_review_at\` = VALUES(\`next_review_at\`);
    `

    const lastReviewed = progress.last_reviewed_at
      ? new Date(progress.last_reviewed_at)
      : null
    const nextReview = progress.next_review_at
      ? new Date(progress.next_review_at)
      : null

    await executor.execute(sql, [
      progress.vocab_id,
      progress.state,
      progress.algorithm,
      JSON.stringify(progress.srs_params),
      progress.wrong_count,
      progress.correct_count,
      progress.custom_note || null,
      lastReviewed,
      nextReview
    ])
  }

  async logReview(reviewLog: ReviewLog, conn?: PoolConnection): Promise<number> {
    const executor = conn || this.pool
    const sql = `
      INSERT INTO \`review_logs\`
        (\`vocab_id\`, \`review_mode\`, \`user_input\`, \`is_correct\`, \`srs_rating\`, \`response_time_ms\`, \`reviewed_at\`)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, UTC_TIMESTAMP()));
    `

    const reviewedAt = reviewLog.reviewed_at ? new Date(reviewLog.reviewed_at) : null
    const [result] = await executor.execute<any>(sql, [
      reviewLog.vocab_id,
      reviewLog.review_mode,
      reviewLog.user_input || null,
      reviewLog.is_correct ? 1 : 0,
      reviewLog.srs_rating,
      reviewLog.response_time_ms || 0,
      reviewedAt
    ])

    return Number(result.insertId)
  }

  async getStatsSummary(timezoneOffsetMinutes: number = 420): Promise<StatsSummaryResponse> {
    // 1. Tính toán tổng số từ, số từ đã học, số từ cần ôn
    const [totalWordsRow] = await this.pool.execute<any[]>(
      'SELECT COUNT(*) as total FROM `hsk_vocabulary`;'
    )
    const [progressSummaryRow] = await this.pool.execute<any[]>(`
      SELECT 
        COUNT(CASE WHEN \`state\` IN ('learning', 'review') THEN 1 END) as total_learned,
        COUNT(CASE WHEN \`state\` IN ('learning', 'review', 'relearning') AND \`next_review_at\` <= UTC_TIMESTAMP() THEN 1 END) as total_due_today
      FROM \`user_vocab_progress\`;
    `)
    const [totalReviewsRow] = await this.pool.execute<any[]>(
      'SELECT COUNT(*) as total FROM `review_logs`;'
    )

    // 2. Thống kê theo cấp độ HSK
    const [hskLevelsRows] = await this.pool.execute<any[]>(`
      SELECT 
        v.\`hsk_level\`,
        COUNT(v.\`id\`) as total,
        COUNT(CASE WHEN p.\`state\` IN ('learning', 'review') THEN 1 END) as learned,
        COUNT(CASE WHEN p.\`state\` IN ('learning', 'review', 'relearning') AND p.\`next_review_at\` <= UTC_TIMESTAMP() THEN 1 END) as due_today
      FROM \`hsk_vocabulary\` v
      LEFT JOIN \`user_vocab_progress\` p ON v.\`id\` = p.\`vocab_id\`
      GROUP BY v.\`hsk_level\`
      ORDER BY v.\`hsk_level\` ASC;
    `)

    // 3. Quy đổi timezone offset (VD: +420 mins = '+07:00')
    const hours = Math.floor(Math.abs(timezoneOffsetMinutes) / 60)
    const mins = Math.abs(timezoneOffsetMinutes) % 60
    const sign = timezoneOffsetMinutes >= 0 ? '+' : '-'
    const tzString = `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`

    // 4. Lấy Heatmap học tập theo ngày trong 365 ngày gần nhất
    const heatmapSql = `
      SELECT 
        DATE(CONVERT_TZ(\`reviewed_at\`, '+00:00', ?)) as review_date,
        COUNT(\`id\`) as count,
        COUNT(CASE WHEN \`is_correct\` = 1 THEN 1 END) as correct_count
      FROM \`review_logs\`
      WHERE \`reviewed_at\` >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 365 DAY)
      GROUP BY review_date
      ORDER BY review_date ASC;
    `
    const [heatmapRows] = await this.pool.execute<any[]>(heatmapSql, [tzString])

    const heatmap: HeatmapDay[] = heatmapRows.map((r) => ({
      date: String(r.review_date),
      count: Number(r.count),
      correct_count: Number(r.correct_count)
    }))

    return {
      total_words: Number(totalWordsRow[0]?.total || 0),
      total_learned: Number(progressSummaryRow[0]?.total_learned || 0),
      total_due_today: Number(progressSummaryRow[0]?.total_due_today || 0),
      total_reviews: Number(totalReviewsRow[0]?.total || 0),
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
