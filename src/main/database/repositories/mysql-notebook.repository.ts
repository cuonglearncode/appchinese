import { Pool } from 'mysql2/promise'
import {
  Notebook,
  NotebookCreateRequest,
  NotebookUpdateRequest,
  NotebookToggleItemRequest,
  NotebookToggleItemResponse
} from '@shared/schemas'
import { INotebookRepository } from './interfaces'
import { getPool } from '../pool'

export class MySqlNotebookRepository implements INotebookRepository {
  private pool: Pool

  constructor(customPool?: Pool) {
    this.pool = customPool || getPool()
  }

  async list(): Promise<Notebook[]> {
    const sql = `
      SELECT 
        n.\`id\`, n.\`name\`, n.\`color\`, n.\`sort_order\`, n.\`created_at\`,
        COUNT(ni.\`vocab_id\`) as item_count
      FROM \`notebooks\` n
      LEFT JOIN \`notebook_items\` ni ON n.\`id\` = ni.\`notebook_id\`
      GROUP BY n.\`id\`
      ORDER BY n.\`sort_order\` ASC, n.\`id\` ASC;
    `
    const [rows] = await this.pool.execute<any[]>(sql)
    return rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      color: String(r.color),
      sort_order: Number(r.sort_order),
      created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      item_count: Number(r.item_count || 0)
    }))
  }

  async getById(id: number): Promise<Notebook | null> {
    const sql = `
      SELECT 
        n.\`id\`, n.\`name\`, n.\`color\`, n.\`sort_order\`, n.\`created_at\`,
        COUNT(ni.\`vocab_id\`) as item_count
      FROM \`notebooks\` n
      LEFT JOIN \`notebook_items\` ni ON n.\`id\` = ni.\`notebook_id\`
      WHERE n.\`id\` = ?
      GROUP BY n.\`id\`
      LIMIT 1;
    `
    const [rows] = await this.pool.execute<any[]>(sql, [id])
    if (!rows || rows.length === 0) return null

    const r = rows[0]
    return {
      id: Number(r.id),
      name: String(r.name),
      color: String(r.color),
      sort_order: Number(r.sort_order),
      created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      item_count: Number(r.item_count || 0)
    }
  }

  async create(req: NotebookCreateRequest): Promise<Notebook> {
    const sql = `
      INSERT INTO \`notebooks\` (\`name\`, \`color\`, \`sort_order\`)
      VALUES (?, ?, (SELECT COALESCE(MAX(\`sort_order\`), 0) + 1 FROM \`notebooks\` n));
    `
    const [result] = await this.pool.execute<any>(sql, [
      req.name.trim(),
      req.color || '#3b82f6'
    ])
    const newId = Number(result.insertId)
    const created = await this.getById(newId)
    if (!created) {
      throw new Error(`Không thể lấy thông tin sổ tay sau khi tạo ID ${newId}`)
    }
    return created
  }

  async update(req: NotebookUpdateRequest): Promise<Notebook> {
    const fields: string[] = []
    const params: any[] = []

    if (req.name !== undefined) {
      fields.push('`name` = ?')
      params.push(req.name.trim())
    }
    if (req.color !== undefined) {
      fields.push('`color` = ?')
      params.push(req.color)
    }
    if (req.sort_order !== undefined) {
      fields.push('`sort_order` = ?')
      params.push(req.sort_order)
    }

    if (fields.length > 0) {
      const sql = `UPDATE \`notebooks\` SET ${fields.join(', ')} WHERE \`id\` = ?;`
      params.push(req.id)
      await this.pool.execute(sql, params)
    }

    const updated = await this.getById(req.id)
    if (!updated) {
      throw new Error(`Sổ tay với ID ${req.id} không tồn tại.`)
    }
    return updated
  }

  async delete(id: number): Promise<boolean> {
    const sql = 'DELETE FROM `notebooks` WHERE `id` = ?;'
    const [result] = await this.pool.execute<any>(sql, [id])
    return Number(result.affectedRows) > 0
  }

  async toggleItem(req: NotebookToggleItemRequest): Promise<NotebookToggleItemResponse> {
    const exists = await this.isItemInNotebook(req.notebook_id, req.vocab_id)
    if (exists) {
      await this.pool.execute(
        'DELETE FROM `notebook_items` WHERE `notebook_id` = ? AND `vocab_id` = ?;',
        [req.notebook_id, req.vocab_id]
      )
      return {
        added: false,
        notebook_id: req.notebook_id,
        vocab_id: req.vocab_id
      }
    } else {
      await this.pool.execute(
        'INSERT INTO `notebook_items` (`notebook_id`, `vocab_id`) VALUES (?, ?);',
        [req.notebook_id, req.vocab_id]
      )
      return {
        added: true,
        notebook_id: req.notebook_id,
        vocab_id: req.vocab_id
      }
    }
  }

  async isItemInNotebook(notebookId: number, vocabId: number): Promise<boolean> {
    const sql = `
      SELECT 1 FROM \`notebook_items\`
      WHERE \`notebook_id\` = ? AND \`vocab_id\` = ?
      LIMIT 1;
    `
    const [rows] = await this.pool.execute<any[]>(sql, [notebookId, vocabId])
    return Array.isArray(rows) && rows.length > 0
  }
}
