import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { Pool } from 'mysql2/promise'
import { getPool } from './pool'

export interface HanziSeedItem {
  char: string
  radical: string
  stroke_count: number
  sino_vietnamese: string | null
  decomposition: string | null
  etymology_hint: string | null
}

/**
 * Nạp từ điển âm Hán Việt kết hợp đa nguồn (xue_hanzi, hanviet, unihan)
 */
async function loadCombinedSinoVietnameseMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  // 1. Nguồn chính: xue_hanzi_dict.json (bao quát hơn 1.900 chữ Hán giản thể)
  const xuePath = path.resolve(process.cwd(), 'resources', 'data', 'xue_hanzi_dict.json')
  if (fs.existsSync(xuePath)) {
    try {
      const raw = await fs.promises.readFile(xuePath, 'utf-8')
      const data = JSON.parse(raw)
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.s && item.sv) {
            map.set(item.s, String(item.sv).trim().toUpperCase())
          }
        }
      }
    } catch (e) {
      console.warn('[SeedHanzi] Lỗi đọc xue_hanzi_dict.json:', e)
    }
  }

  // 2. Nguồn bổ sung: hanviet.json (Kanji/Hán tự phồn thể)
  const hanvietPath = path.resolve(process.cwd(), 'resources', 'data', 'hanviet.json')
  if (fs.existsSync(hanvietPath)) {
    try {
      const raw = await fs.promises.readFile(hanvietPath, 'utf-8')
      const data = JSON.parse(raw)
      for (const [k, v] of Object.entries(data)) {
        if (!map.has(k)) {
          map.set(k, String(v).trim().toUpperCase())
        }
      }
    } catch (e) {
      console.warn('[SeedHanzi] Lỗi đọc hanviet.json:', e)
    }
  }

  // 3. Nguồn Unicode Unihan
  const unihanPath = path.resolve(process.cwd(), 'resources', 'data', 'unihan_vietnamese.txt')
  if (fs.existsSync(unihanPath)) {
    try {
      const fileStream = fs.createReadStream(unihanPath, { encoding: 'utf-8' })
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })
      for await (const line of rl) {
        if (!line || line.startsWith('#')) continue
        const parts = line.split('\t')
        if (parts.length >= 3 && parts[1] === 'kVietnamese') {
          const codePointHex = parts[0].replace(/^U\+/, '')
          const codePoint = parseInt(codePointHex, 16)
          if (!isNaN(codePoint)) {
            const char = String.fromCodePoint(codePoint)
            if (!map.has(char)) {
              map.set(char, parts[2].trim().toUpperCase())
            }
          }
        }
      }
    } catch (e) {
      console.warn('[SeedHanzi] Lỗi đọc unihan_vietnamese.txt:', e)
    }
  }

  console.info(`[SeedHanzi] Đã nạp tổng cộng ${map.size} bản ghi âm Hán Việt.`)
  return map
}

/**
 * Nạp từ điển Make Me a Hanzi dictionary.txt
 */
async function loadMakeMeAHanziMap(filePath: string): Promise<Map<string, any>> {
  const map = new Map<string, any>()
  if (!fs.existsSync(filePath)) {
    console.warn(`[SeedHanzi] Không tìm thấy MakeMeAHanzi: ${filePath}`)
    return map
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })

  for await (const line of rl) {
    if (!line || line.trim().length === 0) continue
    try {
      const obj = JSON.parse(line)
      if (obj.character) {
        map.set(obj.character, obj)
      }
    } catch {
      // Bỏ qua dòng json không hợp lệ
    }
  }

  console.info(`[SeedHanzi] Đã nạp ${map.size} ký tự từ Make Me a Hanzi.`)
  return map
}

/**
 * Lấy số nét chính xác từ gói hanzi-writer-data cài đặt cục bộ
 */
function getStrokeCountFromHanziWriter(char: string): number | null {
  try {
    const dataPath = path.resolve(process.cwd(), 'node_modules', 'hanzi-writer-data', `${char}.json`)
    if (fs.existsSync(dataPath)) {
      const content = fs.readFileSync(dataPath, 'utf-8')
      const json = JSON.parse(content)
      if (Array.isArray(json.strokes)) {
        return json.strokes.length
      }
    }
  } catch {
    // Không ném lỗi
  }
  return null
}

/**
 * Trích xuất toàn bộ chữ Hán đơn độc lập từ 5.003 từ vựng HSK trong cơ sở dữ liệu
 */
export async function extractUniqueCharsFromVocabulary(pool: Pool): Promise<string[]> {
  const [rows] = await pool.query<any[]>(
    'SELECT DISTINCT `word` FROM `hsk_vocabulary`;'
  )

  const charSet = new Set<string>()
  for (const row of rows) {
    const word = String(row.word || '')
    for (const ch of word) {
      if (ch >= '\u4e00' && ch <= '\u9fff') {
        charSet.add(ch)
      }
    }
  }

  const result = Array.from(charSet).sort()
  console.info(`[SeedHanzi] Tìm thấy ${result.length} chữ Hán duy nhất từ bảng từ vựng HSK.`)
  return result
}

/**
 * Pipeline nạp dữ liệu chi tiết chữ Hán đơn vào bảng hanzi_characters
 */
export async function seedHanziCharacters(
  customPool?: Pool
): Promise<{ seeded: number; total: number }> {
  const p = customPool || getPool()
  const mmahPath = path.resolve(process.cwd(), 'resources', 'data', 'makemeahanzi_dictionary.txt')

  const [vietnameseMap, mmahMap, uniqueChars] = await Promise.all([
    loadCombinedSinoVietnameseMap(),
    loadMakeMeAHanziMap(mmahPath),
    extractUniqueCharsFromVocabulary(p)
  ])

  const seedItems: HanziSeedItem[] = []

  for (const ch of uniqueChars) {
    const mmahData = mmahMap.get(ch)
    const sinoVi = vietnameseMap.get(ch) || null

    // Xác định số nét
    let strokeCount = getStrokeCountFromHanziWriter(ch)
    if (!strokeCount && mmahData?.matches) {
      strokeCount = mmahData.matches.length
    }
    if (!strokeCount) {
      strokeCount = 1
    }

    // Bộ thủ (Radical)
    let radical = mmahData?.radical || ch
    if (radical === '？' || !radical) radical = ch

    // Chiết tự IDS
    let decomposition = mmahData?.decomposition || null
    if (decomposition === '？') decomposition = null

    // Nguồn gốc / Mẹo nhớ
    let etymologyHint: string | null = null
    if (mmahData?.etymology) {
      const etym = mmahData.etymology
      const parts: string[] = []
      if (etym.type) parts.push(`[${etym.type}]`)
      if (etym.hint) parts.push(etym.hint)
      if (mmahData.definition) parts.push(`Nghĩa: ${mmahData.definition}`)
      etymologyHint = parts.join(' ')
    } else if (mmahData?.definition) {
      etymologyHint = `Nghĩa: ${mmahData.definition}`
    }

    seedItems.push({
      char: ch,
      radical,
      stroke_count: strokeCount,
      sino_vietnamese: sinoVi,
      decomposition,
      etymology_hint: etymologyHint
    })
  }

  // Chèn vào database theo từng batch 200 dòng
  const batchSize = 200
  let totalSeeded = 0
  const conn = await p.getConnection()

  try {
    for (let i = 0; i < seedItems.length; i += batchSize) {
      const batch = seedItems.slice(i, i + batchSize)
      const values: any[] = []
      const placeholders: string[] = []

      for (const item of batch) {
        placeholders.push('(?, ?, ?, ?, ?, ?)')
        values.push(
          item.char,
          item.radical,
          item.stroke_count,
          item.sino_vietnamese,
          item.decomposition,
          item.etymology_hint
        )
      }

      const sql = `
        INSERT INTO \`hanzi_characters\` (\`char\`, \`radical\`, \`stroke_count\`, \`sino_vietnamese\`, \`decomposition\`, \`etymology_hint\`)
        VALUES ${placeholders.join(', ')}
        ON DUPLICATE KEY UPDATE
          \`radical\` = VALUES(\`radical\`),
          \`stroke_count\` = VALUES(\`stroke_count\`),
          \`sino_vietnamese\` = VALUES(\`sino_vietnamese\`),
          \`decomposition\` = VALUES(\`decomposition\`),
          \`etymology_hint\` = VALUES(\`etymology_hint\`);
      `

      await conn.query(sql, values)
      totalSeeded += batch.length
    }
    console.info(`[SeedHanzi] Nạp thành công ${totalSeeded}/${uniqueChars.length} chữ Hán vào database.`)
  } finally {
    conn.release()
  }

  return {
    seeded: totalSeeded,
    total: uniqueChars.length
  }
}

// Cho phép chạy trực tiếp từ dòng lệnh CLI
const isMainScript = process.argv.some((arg) => arg.includes('seed-hanzi'))
if (isMainScript) {
  seedHanziCharacters()
    .then((res) => {
      console.log(`[SeedHanzi] Hoàn tất Seed Pipeline: ${res.seeded}/${res.total} ký tự thành công!`)
      process.exit(0)
    })
    .catch((err) => {
      console.error('[SeedHanzi] Lỗi Seed Pipeline:', err)
      process.exit(1)
    })
}
