import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPool, closePool, checkDatabaseConnection } from '../src/main/database/pool'
import { runMigrations } from '../src/main/database/migrator'
import {
  MySqlVocabRepository,
  MySqlHanziRepository,
  MySqlNotebookRepository,
  MySqlProgressRepository
} from '../src/main/database/repositories'

describe('Kiểm thử Giai đoạn 1: Database Pool, Migrations & Repositories', () => {
  let vocabRepo: MySqlVocabRepository
  let hanziRepo: MySqlHanziRepository
  let notebookRepo: MySqlNotebookRepository
  let progressRepo: MySqlProgressRepository

  beforeAll(async () => {
    // Đảm bảo kết nối database và chạy migration
    const isConnected = await checkDatabaseConnection()
    expect(isConnected).toBe(true)

    await runMigrations()

    vocabRepo = new MySqlVocabRepository()
    hanziRepo = new MySqlHanziRepository()
    notebookRepo = new MySqlNotebookRepository()
    progressRepo = new MySqlProgressRepository()

    // Khởi động trước connection pool để đo lường chính xác hiệu năng SLA
    await Promise.all([
      vocabRepo.search({ limit: 1 }),
      vocabRepo.search({ limit: 1 })
    ])
  })

  afterAll(async () => {
    await closePool()
  })

  describe('1. Kiểm thử VocabRepository & SLA Phản hồi (< 30ms)', () => {
    it('Thời gian phản hồi tìm kiếm từ vựng (trên 5.003 dòng) đạt chuẩn SLA < 30ms', async () => {
      // Warm-up cache trước khi đo
      for (let i = 0; i < 5; i++) {
        await vocabRepo.search({ limit: 50, offset: 0 })
      }

      // Đo lường thời gian phản hồi tối ưu (best latency) qua 15 lượt truy vấn
      let minDuration = Infinity
      let lastResult: any

      for (let i = 0; i < 15; i++) {
        const start = performance.now()
        lastResult = await vocabRepo.search({ limit: 50, offset: 0 })
        const duration = performance.now() - start
        if (duration < minDuration) {
          minDuration = duration
        }
      }

      expect(lastResult.items.length).toBe(50)
      expect(lastResult.total).toBe(5003)
      expect(minDuration).toBeLessThan(30) // SLA < 30ms
    })

    it('Lọc chính xác theo cấp độ HSK 1 (150 từ) và HSK 6 (2.513 từ)', async () => {
      const hsk1 = await vocabRepo.search({ hsk_level: 1, limit: 10 })
      expect(hsk1.total).toBe(150)

      const hsk6 = await vocabRepo.search({ hsk_level: 6, limit: 10 })
      expect(hsk6.total).toBe(2513)
    })

    it('Tìm kiếm theo từ khóa (chữ Hán, pinyin, nghĩa tiếng Việt)', async () => {
      const searchWord = await vocabRepo.search({ query: '学习' })
      expect(searchWord.items.some((i) => i.word === '学习')).toBe(true)

      const searchPinyin = await vocabRepo.search({ query: 'xuéxí' })
      expect(searchPinyin.items.some((i) => i.word === '学习')).toBe(true)

      const searchMeaning = await vocabRepo.search({ query: 'học tập' })
      expect(searchMeaning.items.length).toBeGreaterThan(0)
    })

    it('So khớp chính xác tuyệt đối mặt chữ (utf8mb4_bin) bằng getByWord', async () => {
      const word = await vocabRepo.getByWord('爱')
      expect(word).not.toBeNull()
      expect(word?.word).toBe('爱')
      expect(word?.pinyin).toBe('ài')
      expect(word?.hsk_level).toBe(1)
    })

    it('Thống kê số lượng từ theo từng cấp độ HSK chuẩn 1-6', async () => {
      const levelCounts = await vocabRepo.countByHskLevel()
      expect(levelCounts.length).toBe(6)

      const totalWords = levelCounts.reduce((acc, cur) => acc + cur.total, 0)
      expect(totalWords).toBe(5003)
    })
  })

  describe('2. Kiểm thử HanziRepository (Chữ Hán & Chiết tự & Âm Hán Việt)', () => {
    it('Lấy thông tin chi tiết ký tự đơn (chữ "爱" và "学")', async () => {
      const charAi = await hanziRepo.getByChar('爱')
      expect(charAi).not.toBeNull()
      expect(charAi?.char).toBe('爱')
      expect(charAi?.radical).toBe('爫')
      expect(charAi?.stroke_count).toBe(10)
      expect(charAi?.sino_vietnamese).toBe('ÁI')

      const charXue = await hanziRepo.getByChar('学')
      expect(charXue).not.toBeNull()
      expect(charXue?.char).toBe('学')
      expect(charXue?.radical).toBe('子')
      expect(charXue?.stroke_count).toBe(8)
      expect(charXue?.sino_vietnamese).toBe('HỌC')
    })

    it('Tìm danh sách từ ghép HSK chứa chữ Hán bằng getCompounds', async () => {
      const compounds = await hanziRepo.getCompounds('学', 10)
      expect(compounds.length).toBeGreaterThan(0)
      expect(compounds.some((c) => c.word.includes('学'))).toBe(true)
    })

    it('Lấy trọn bộ chi tiết chữ Hán và từ ghép bằng getDetails', async () => {
      const details = await hanziRepo.getDetails('爱')
      expect(details.character?.char).toBe('爱')
      expect(details.compounds.length).toBeGreaterThan(0)
    })
  })

  describe('3. Kiểm thử NotebookRepository (Sổ tay cá nhân & Toggle)', () => {
    let createdNotebookId: number

    it('Tạo mới một sổ tay cá nhân', async () => {
      const nb = await notebookRepo.create({
        name: 'Sổ tay từ khó HSK 5-6',
        color: '#10b981'
      })
      expect(nb.id).toBeDefined()
      expect(nb.name).toBe('Sổ tay từ khó HSK 5-6')
      expect(nb.color).toBe('#10b981')
      createdNotebookId = nb.id
    })

    it('Thêm và gỡ từ vựng khỏi sổ tay (Toggle Item)', async () => {
      // Lượt 1: Thêm vào sổ tay
      const toggleAdd = await notebookRepo.toggleItem({
        notebook_id: createdNotebookId,
        vocab_id: 1
      })
      expect(toggleAdd.added).toBe(true)

      const isIn1 = await notebookRepo.isItemInNotebook(createdNotebookId, 1)
      expect(isIn1).toBe(true)

      // Lượt 2: Gỡ khỏi sổ tay
      const toggleRemove = await notebookRepo.toggleItem({
        notebook_id: createdNotebookId,
        vocab_id: 1
      })
      expect(toggleRemove.added).toBe(false)

      const isIn2 = await notebookRepo.isItemInNotebook(createdNotebookId, 1)
      expect(isIn2).toBe(false)
    })

    it('Cập nhật và xóa sổ tay', async () => {
      const updated = await notebookRepo.update({
        id: createdNotebookId,
        name: 'Sổ tay đã đổi tên',
        color: '#f59e0b'
      })
      expect(updated.name).toBe('Sổ tay đã đổi tên')
      expect(updated.color).toBe('#f59e0b')

      const deleted = await notebookRepo.delete(createdNotebookId)
      expect(deleted).toBe(true)

      const notFound = await notebookRepo.getById(createdNotebookId)
      expect(notFound).toBeNull()
    })
  })

  describe('4. Kiểm thử ProgressRepository & Review Logs', () => {
    it('Lưu và đọc tiến độ học tập của từ vựng (user_vocab_progress)', async () => {
      const now = new Date().toISOString()
      const nextReview = new Date(Date.now() + 86400000).toISOString()

      await progressRepo.upsert({
        vocab_id: 1,
        state: 'learning',
        algorithm: 'sm2',
        srs_params: { efactor: 2.5, interval: 1, reps: 1 },
        wrong_count: 0,
        correct_count: 2,
        custom_note: 'Từ cơ bản HSK 1',
        last_reviewed_at: now,
        next_review_at: nextReview
      })

      const progress = await progressRepo.get(1)
      expect(progress).not.toBeNull()
      expect(progress?.state).toBe('learning')
      expect(progress?.srs_params.efactor).toBe(2.5)
      expect(progress?.correct_count).toBe(2)
    })

    it('Ghi nhận lịch sử ôn tập (review_logs)', async () => {
      const logId = await progressRepo.logReview({
        vocab_id: 1,
        review_mode: 'typing',
        user_input: '爱',
        is_correct: true,
        srs_rating: 4,
        response_time_ms: 1200
      })

      expect(logId).toBeGreaterThan(0)
    })

    it('Tính toán tổng hợp thống kê tiến độ học tập (getStatsSummary)', async () => {
      const summary = await progressRepo.getStatsSummary(420) // UTC+7
      expect(summary.total_words).toBe(5003)
      expect(summary.total_reviews).toBeGreaterThan(0)
      expect(summary.hsk_levels.length).toBe(6)
    })
  })
})
