import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPool, closePool, checkDatabaseConnection } from '../src/main/database/pool'
import { runMigrations } from '../src/main/database/migrator'
import {
  MySqlNotebookRepository,
  MySqlProgressRepository,
  MySqlVocabRepository
} from '../src/main/database/repositories'
import {
  NotebookCreateRequestSchema,
  NotebookUpdateRequestSchema,
  NotebookToggleItemRequestSchema,
  StatsSummaryResponseSchema,
  WrongWordsFilterSchema
} from '../src/shared/schemas'

describe('Kiểm thử Giai đoạn 4: Sổ tay cá nhân & Thống kê học tập', () => {
  let notebookRepo: MySqlNotebookRepository
  let progressRepo: MySqlProgressRepository
  let vocabRepo: MySqlVocabRepository

  beforeAll(async () => {
    const isConnected = await checkDatabaseConnection()
    expect(isConnected).toBe(true)

    await runMigrations()

    notebookRepo = new MySqlNotebookRepository()
    progressRepo = new MySqlProgressRepository()
    vocabRepo = new MySqlVocabRepository()
  })

  afterAll(async () => {
    await closePool()
  })

  describe('1. Kiểm thử Zod Schemas cho Sổ tay & Thống kê', () => {
    it('Validate NotebookCreateRequestSchema hợp lệ & không hợp lệ', () => {
      // Hợp lệ
      const valid = NotebookCreateRequestSchema.safeParse({
        name: 'Từ vựng HSK 5 quan trọng',
        color: '#f59e0b'
      })
      expect(valid.success).toBe(true)

      // Không hợp lệ: tên rỗng
      const invalidName = NotebookCreateRequestSchema.safeParse({
        name: '',
        color: '#f59e0b'
      })
      expect(invalidName.success).toBe(false)

      // Không hợp lệ: mã màu sai định dạng Hex
      const invalidColor = NotebookCreateRequestSchema.safeParse({
        name: 'Sổ tay 1',
        color: 'red'
      })
      expect(invalidColor.success).toBe(false)
    })

    it('Validate NotebookUpdateRequestSchema', () => {
      const valid = NotebookUpdateRequestSchema.safeParse({
        id: 1,
        name: 'Tên mới',
        color: '#10b981'
      })
      expect(valid.success).toBe(true)
      if (valid.success) {
        expect(valid.data.name).toBe('Tên mới')
        expect(valid.data.color).toBe('#10b981')
      }
    })

    it('Validate NotebookToggleItemRequestSchema', () => {
      const valid = NotebookToggleItemRequestSchema.safeParse({
        notebook_id: 10,
        vocab_id: 150
      })
      expect(valid.success).toBe(true)
    })

    it('Validate StatsSummaryResponseSchema & WrongWordsFilterSchema', () => {
      const mockSummary = {
        total_words: 5003,
        total_learned: 120,
        total_due_today: 15,
        total_reviews: 450,
        hsk_levels: [
          { hsk_level: 1, total: 150, learned: 150, due_today: 0 },
          { hsk_level: 2, total: 150, learned: 80, due_today: 5 },
          { hsk_level: 3, total: 300, learned: 20, due_today: 10 },
          { hsk_level: 4, total: 600, learned: 0, due_today: 0 },
          { hsk_level: 5, total: 1300, learned: 0, due_today: 0 },
          { hsk_level: 6, total: 2503, learned: 0, due_today: 0 }
        ],
        heatmap: [
          { date: '2026-10-25', count: 25, correct_count: 20 },
          { date: '2026-10-26', count: 40, correct_count: 36 }
        ]
      }
      const parsed = StatsSummaryResponseSchema.safeParse(mockSummary)
      expect(parsed.success).toBe(true)

      const filter = WrongWordsFilterSchema.safeParse({
        limit: 20
      })
      expect(filter.success).toBe(true)
    })
  })

  describe('2. Kiểm thử CRUD Sổ tay từ vựng (Notebook Repository)', () => {
    let createdNotebookId: number

    it('Tạo sổ tay mới với màu sắc tùy chọn', async () => {
      const notebook = await notebookRepo.create({
        name: 'Sổ tay Luyện thi HSK 6',
        color: '#8b5cf6'
      })
      expect(notebook).toBeDefined()
      expect(notebook.id).toBeGreaterThan(0)
      expect(notebook.name).toBe('Sổ tay Luyện thi HSK 6')
      expect(notebook.color).toBe('#8b5cf6')
      expect(notebook.item_count).toBe(0)

      createdNotebookId = notebook.id
    })

    it('Danh sách sổ tay trả về đúng và chứa sổ tay vừa tạo', async () => {
      const list = await notebookRepo.list()
      expect(Array.isArray(list)).toBe(true)
      const found = list.find((n) => n.id === createdNotebookId)
      expect(found).toBeDefined()
      expect(found?.name).toBe('Sổ tay Luyện thi HSK 6')
    })

    it('Cập nhật tên và màu sắc sổ tay', async () => {
      const updated = await notebookRepo.update({
        id: createdNotebookId,
        name: 'HSK 6 Siêu cấp',
        color: '#ec4899'
      })
      expect(updated.name).toBe('HSK 6 Siêu cấp')
      expect(updated.color).toBe('#ec4899')

      // Kiểm tra lại từ DB
      const list = await notebookRepo.list()
      const found = list.find((n) => n.id === createdNotebookId)
      expect(found?.name).toBe('HSK 6 Siêu cấp')
      expect(found?.color).toBe('#ec4899')
    })

    it('Thêm từ vựng vào sổ tay (toggleItem -> added: true)', async () => {
      // Tìm 2 từ đầu tiên trong DB
      const searchRes = await vocabRepo.search({ limit: 2 })
      expect(searchRes.items.length).toBeGreaterThanOrEqual(2)
      const word1 = searchRes.items[0].id
      const word2 = searchRes.items[1].id

      // Thêm từ 1 vào sổ tay
      const res1 = await notebookRepo.toggleItem({
        notebook_id: createdNotebookId,
        vocab_id: word1
      })
      expect(res1.added).toBe(true)

      // Thêm từ 2 vào sổ tay
      const res2 = await notebookRepo.toggleItem({
        notebook_id: createdNotebookId,
        vocab_id: word2
      })
      expect(res2.added).toBe(true)

      // Lấy danh sách từ trong sổ tay qua vocabRepo.search với notebook_id
      const notebookVocabs = await vocabRepo.search({
        notebook_id: createdNotebookId,
        limit: 10
      })
      expect(notebookVocabs.items.length).toBe(2)
      const ids = notebookVocabs.items.map((i) => i.id)
      expect(ids).toContain(word1)
      expect(ids).toContain(word2)

      // Kiểm tra số lượng item_count trong list()
      const list = await notebookRepo.list()
      const found = list.find((n) => n.id === createdNotebookId)
      expect(found?.item_count).toBe(2)
    })

    it('Xóa từ vựng khỏi sổ tay khi gọi lại toggleItem (toggleItem -> added: false)', async () => {
      const searchRes = await vocabRepo.search({ limit: 1 })
      const word1 = searchRes.items[0].id

      // Gọi lại toggleItem với word1 -> xóa khỏi sổ tay
      const toggleRes = await notebookRepo.toggleItem({
        notebook_id: createdNotebookId,
        vocab_id: word1
      })
      expect(toggleRes.added).toBe(false)

      const notebookVocabs = await vocabRepo.search({
        notebook_id: createdNotebookId,
        limit: 10
      })
      expect(notebookVocabs.items.length).toBe(1)
      expect(notebookVocabs.items[0].id).not.toBe(word1)
    })

    it('Xóa sổ tay (CASCADE dọn sạch notebook_items)', async () => {
      const deleted = await notebookRepo.delete(createdNotebookId)
      expect(deleted).toBe(true)

      const list = await notebookRepo.list()
      const found = list.find((n) => n.id === createdNotebookId)
      expect(found).toBeUndefined()

      const notebookVocabs = await vocabRepo.search({
        notebook_id: createdNotebookId,
        limit: 10
      })
      expect(notebookVocabs.items.length).toBe(0)
    })
  })

  describe('3. Kiểm thử Thống kê học tập & Activity Heatmap (Progress Repository)', () => {
    it('Lấy báo cáo tổng hợp tiến độ (getStatsSummary)', async () => {
      const summary = await progressRepo.getStatsSummary()

      expect(summary).toBeDefined()
      // Tổng số từ HSK 2.0 là 5.003
      expect(summary.total_words).toBe(5003)
      expect(summary.total_learned).toBeGreaterThanOrEqual(0)
      expect(summary.total_due_today).toBeGreaterThanOrEqual(0)
      expect(summary.total_reviews).toBeGreaterThanOrEqual(0)

      // 6 cấp độ HSK 1 - 6
      expect(summary.hsk_levels.length).toBe(6)
      expect(summary.hsk_levels.map((p) => p.hsk_level)).toEqual([1, 2, 3, 4, 5, 6])
      const sumHskWords = summary.hsk_levels.reduce((acc, p) => acc + p.total, 0)
      expect(sumHskWords).toBe(5003)

      // Heatmap trả về mảng hợp lệ
      expect(Array.isArray(summary.heatmap)).toBe(true)
    })

    it('Lấy danh sách các từ hay sai nhất (getWrongWords)', async () => {
      // Tìm 1 từ để gán sai nhiều lần
      const searchRes = await vocabRepo.search({ limit: 1 })
      const testVocab = searchRes.items[0]

      // Cập nhật progress giả lập nhiều lần trả lời sai
      await progressRepo.upsert({
        vocab_id: testVocab.id,
        state: 'relearning',
        algorithm: 'sm2',
        srs_params: { efactor: 1.7, interval: 1, reps: 0 },
        wrong_count: 15,
        correct_count: 2,
        custom_note: 'Từ kiểm thử thống kê sai',
        last_reviewed_at: new Date().toISOString(),
        next_review_at: new Date().toISOString()
      })

      const wrongWords = await vocabRepo.getWrongWords({ limit: 5 })
      expect(Array.isArray(wrongWords)).toBe(true)
      expect(wrongWords.length).toBeGreaterThanOrEqual(1)

      // Từ testVocab phải nằm ở đầu danh sách (do wrong_count = 15 cao nhất)
      const topWord = wrongWords[0]
      expect(topWord.id).toBe(testVocab.id)
      expect(topWord.word).toBe(testVocab.word)
      expect(topWord.progress?.wrong_count).toBeGreaterThanOrEqual(15)
      expect(topWord.progress?.custom_note).toBe('Từ kiểm thử thống kê sai')
    })
  })
})
