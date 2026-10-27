import { Pool } from 'mysql2/promise'
import {
  HanziCharacter,
  HanziCompoundWord,
  HanziDetailsResponse
} from '@shared/schemas'
import { IHanziRepository } from './interfaces'
import { getPool } from '../pool'

export class MySqlHanziRepository implements IHanziRepository {
  private pool: Pool

  constructor(customPool?: Pool) {
    this.pool = customPool || getPool()
  }

  async getByChar(char: string): Promise<HanziCharacter | null> {
    const targetChar = Array.from(char)[0]
    if (!targetChar) return null

    const sql = `
      SELECT \`char\`, \`radical\`, \`stroke_count\`, \`sino_vietnamese\`, \`decomposition\`, \`etymology_hint\`
      FROM \`hanzi_characters\`
      WHERE \`char\` = ?
      LIMIT 1;
    `
    const [rows] = await this.pool.execute<any[]>(sql, [targetChar])
    if (!rows || rows.length === 0) return null

    const r = rows[0]
    return {
      char: String(r.char),
      radical: String(r.radical),
      stroke_count: Number(r.stroke_count),
      sino_vietnamese: r.sino_vietnamese || null,
      decomposition: r.decomposition || null,
      etymology_hint: r.etymology_hint || null
    }
  }

  async getCompounds(char: string, limit: number = 30): Promise<HanziCompoundWord[]> {
    const targetChar = Array.from(char)[0]
    if (!targetChar) return []

    const sql = `
      SELECT \`id\`, \`word\`, \`pinyin\`, \`meaning_vi\`, \`hsk_level\`
      FROM \`hsk_vocabulary\`
      WHERE \`word\` LIKE ?
      ORDER BY \`hsk_level\` ASC, CHAR_LENGTH(\`word\`) ASC
      LIMIT ${Number(limit)};
    `
    const pattern = `%${targetChar}%`
    const [rows] = await this.pool.execute<any[]>(sql, [pattern])

    return rows.map((r) => ({
      id: Number(r.id),
      word: String(r.word),
      pinyin: String(r.pinyin),
      meaning_vi: String(r.meaning_vi || ''),
      hsk_level: Number(r.hsk_level)
    }))
  }

  async getDetails(char: string): Promise<HanziDetailsResponse> {
    const [character, compounds] = await Promise.all([
      this.getByChar(char),
      this.getCompounds(char)
    ])

    return {
      character,
      compounds
    }
  }
}
