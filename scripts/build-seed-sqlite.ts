import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import { normalizeMeaningString, calculateRootScore } from '../src/main/modules/synonym-map/gloss-normalizer'
import { CuratedSource } from '../src/main/modules/synonym-map/curated-source'
import { RawMeaningGloss, SynonymGroupCandidate, SynonymMemberCandidate } from '../src/main/modules/synonym-map/interfaces'

export async function buildSeedDatabase(targetPath: string): Promise<void> {
  console.info(`[BuildSeed] Đang tạo database hạt giống SQLite tại: ${targetPath}`)

  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath)
  }

  const dir = path.dirname(targetPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const db = new Database(targetPath)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')

  // 1. Tạo các bảng cơ sở dữ liệu
  db.exec(`
    -- Bảng theo dõi migrations
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Bảng từ vựng HSK 1-6
    CREATE TABLE IF NOT EXISTS hsk_vocabulary (
      id INTEGER PRIMARY KEY,
      standard_version TEXT NOT NULL DEFAULT 'HSK2.0',
      hsk_level INTEGER NOT NULL,
      stt INTEGER NOT NULL,
      word TEXT NOT NULL,
      pinyin TEXT NOT NULL,
      meaning_vi TEXT NOT NULL,
      example_zh TEXT,
      example_pinyin TEXT,
      example_vi TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_vocab_hsk_stt ON hsk_vocabulary (hsk_level, stt);
    CREATE INDEX IF NOT EXISTS idx_vocab_word ON hsk_vocabulary (word);

    -- Bảng chữ Hán đơn
    CREATE TABLE IF NOT EXISTS hanzi_characters (
      char TEXT PRIMARY KEY,
      radical TEXT NOT NULL,
      stroke_count INTEGER NOT NULL,
      sino_vietnamese TEXT,
      decomposition TEXT,
      etymology_hint TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_hanzi_radical ON hanzi_characters (radical);
    CREATE INDEX IF NOT EXISTS idx_hanzi_stroke ON hanzi_characters (stroke_count);

    -- Bảng tiến độ học tập SRS
    CREATE TABLE IF NOT EXISTS user_vocab_progress (
      vocab_id INTEGER PRIMARY KEY,
      state TEXT NOT NULL DEFAULT 'new',
      algorithm TEXT NOT NULL DEFAULT 'sm2',
      srs_params TEXT NOT NULL,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      custom_note TEXT,
      last_reviewed_at TEXT,
      next_review_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (vocab_id) REFERENCES hsk_vocabulary (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_progress_next_review ON user_vocab_progress (next_review_at, state);
    CREATE INDEX IF NOT EXISTS idx_progress_wrong_count ON user_vocab_progress (wrong_count DESC);

    -- Bảng lịch sử từng lượt trả lời (Review Logs)
    CREATE TABLE IF NOT EXISTS review_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vocab_id INTEGER NOT NULL,
      review_mode TEXT NOT NULL,
      user_input TEXT,
      is_correct INTEGER NOT NULL,
      srs_rating INTEGER NOT NULL,
      response_time_ms INTEGER NOT NULL DEFAULT 0,
      reviewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (vocab_id) REFERENCES hsk_vocabulary (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_log_vocab_reviewed ON review_logs (vocab_id, reviewed_at);
    CREATE INDEX IF NOT EXISTS idx_log_date_correct ON review_logs (reviewed_at, is_correct);

    -- Bảng sổ tay từ vựng
    CREATE TABLE IF NOT EXISTS notebooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Bảng liên kết Notebook Items
    CREATE TABLE IF NOT EXISTS notebook_items (
      notebook_id INTEGER NOT NULL,
      vocab_id INTEGER NOT NULL,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (notebook_id, vocab_id),
      FOREIGN KEY (notebook_id) REFERENCES notebooks (id) ON DELETE CASCADE,
      FOREIGN KEY (vocab_id) REFERENCES hsk_vocabulary (id) ON DELETE CASCADE
    );

    -- Bảng nghĩa đơn phân tách
    CREATE TABLE IF NOT EXISTS meaning_glosses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vocab_id INTEGER NOT NULL,
      gloss TEXT NOT NULL,
      gloss_raw TEXT NOT NULL,
      extracted_note TEXT,
      position INTEGER NOT NULL,
      UNIQUE (vocab_id, gloss),
      FOREIGN KEY (vocab_id) REFERENCES hsk_vocabulary (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_meaning_gloss ON meaning_glosses (gloss);

    -- Bảng nhóm từ đồng nghĩa
    CREATE TABLE IF NOT EXISTS synonym_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      root_gloss TEXT NOT NULL UNIQUE,
      root_score REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'auto',
      status TEXT NOT NULL DEFAULT 'draft',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_syn_status_score ON synonym_groups (status, root_score DESC);

    -- Bảng thành viên nhóm đồng nghĩa
    CREATE TABLE IF NOT EXISTS synonym_group_members (
      group_id INTEGER NOT NULL,
      vocab_id INTEGER NOT NULL,
      rank_order INTEGER NOT NULL DEFAULT 1,
      register TEXT NOT NULL DEFAULT 'neutral',
      nuance_note TEXT,
      PRIMARY KEY (group_id, vocab_id),
      FOREIGN KEY (group_id) REFERENCES synonym_groups (id) ON DELETE CASCADE,
      FOREIGN KEY (vocab_id) REFERENCES hsk_vocabulary (id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_syn_member_vocab ON synonym_group_members (vocab_id);
  `)

  // 2. Nạp dữ liệu 5.003 từ vựng HSK từ hsk_vocabulary_mysql.sql
  const sqlDumpPath = path.resolve(process.cwd(), 'hsk_vocabulary_mysql.sql')
  if (fs.existsSync(sqlDumpPath)) {
    console.info(`[BuildSeed] Đang nạp dữ liệu từ vựng từ ${sqlDumpPath}...`)
    let sql = fs.readFileSync(sqlDumpPath, 'utf-8')
    sql = sql.replace(/SET NAMES[^;]*;/gi, '')
    sql = sql.replace(/SET FOREIGN_KEY_CHECKS[^;]*;/gi, '')
    sql = sql.replace(/DROP TABLE[^;]*;/gi, '')
    sql = sql.replace(/CREATE TABLE `hsk_vocabulary`[\s\S]*?ENGINE=InnoDB[^;]*;/gi, '')
    sql = sql.replace(/`meaning`/g, '`meaning_vi`')

    db.transaction(() => {
      db.exec(sql)
    })()
    console.info('[BuildSeed] Đã nạp xong 5.003 từ vựng HSK.')
  }

  // 3. Nạp dữ liệu chữ Hán đơn từ MakeMeAHanzi + Xue + Unihan
  console.info('[BuildSeed] Đang nạp dữ liệu chữ Hán...')
  try {
    const mmahPath = path.resolve(process.cwd(), 'resources', 'data', 'makemeahanzi_dictionary.txt')
    const mmahMap = new Map<string, any>()
    if (fs.existsSync(mmahPath)) {
      const lines = fs.readFileSync(mmahPath, 'utf-8').split('\n')
      for (const line of lines) {
        if (!line || !line.trim()) continue
        try {
          const obj = JSON.parse(line)
          if (obj.character) mmahMap.set(obj.character, obj)
        } catch {}
      }
    }

    const sinoViMap = new Map<string, string>()
    const xuePath = path.resolve(process.cwd(), 'resources', 'data', 'xue_hanzi_dict.json')
    if (fs.existsSync(xuePath)) {
      const xueData = JSON.parse(fs.readFileSync(xuePath, 'utf-8'))
      for (const item of xueData) {
        if (item.s && item.sv) {
          sinoViMap.set(item.s, String(item.sv).trim().toUpperCase())
        }
      }
    }

    const unihanPath = path.resolve(process.cwd(), 'resources', 'data', 'unihan_vietnamese.txt')
    if (fs.existsSync(unihanPath)) {
      const uLines = fs.readFileSync(unihanPath, 'utf-8').split('\n')
      for (const uLine of uLines) {
        if (!uLine || uLine.startsWith('#')) continue
        const parts = uLine.split('\t')
        if (parts.length >= 3 && parts[1] === 'kVietnamese') {
          const codePoint = parseInt(parts[0].replace(/^U\+/, ''), 16)
          if (!isNaN(codePoint)) {
            const uChar = String.fromCodePoint(codePoint)
            if (!sinoViMap.has(uChar)) {
              sinoViMap.set(uChar, parts[2].trim().toUpperCase())
            }
          }
        }
      }
    }

    const vocabWords = db.prepare('SELECT word FROM hsk_vocabulary').all() as { word: string }[]
    const hskChars = new Set<string>()
    for (const row of vocabWords) {
      for (const char of row.word) {
        if (/[\u4e00-\u9fa5]/.test(char)) {
          hskChars.add(char)
        }
      }
    }

    const insertHanzi = db.prepare(`
      INSERT OR REPLACE INTO hanzi_characters (char, radical, stroke_count, sino_vietnamese, decomposition, etymology_hint)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    db.transaction(() => {
      for (const ch of hskChars) {
        const mmahData = mmahMap.get(ch)

        let strokeCount = 1
        const writerPath = path.resolve(process.cwd(), 'node_modules', 'hanzi-writer-data', `${ch}.json`)
        if (fs.existsSync(writerPath)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(writerPath, 'utf-8'))
            if (Array.isArray(parsed.strokes)) strokeCount = parsed.strokes.length
          } catch {}
        } else if (mmahData?.matches) {
          strokeCount = mmahData.matches.length
        }

        let radical = mmahData?.radical || ch
        if (radical === '？' || !radical) radical = ch

        const sinoVi = sinoViMap.get(ch) || null

        let decomposition = mmahData?.decomposition || null
        if (decomposition === '？') decomposition = null

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

        insertHanzi.run(ch, radical, strokeCount, sinoVi, decomposition, etymologyHint)
      }
    })()
    console.info(`[BuildSeed] Đã nạp thành công ${hskChars.size} chữ Hán trọng tâm HSK với đầy đủ bộ thủ và âm Hán Việt.`)
  } catch (e) {
    console.warn('[BuildSeed] Bỏ qua nạp chữ Hán do lỗi:', e)
  }

  // 4. Xây dựng sơ đồ từ đồng nghĩa tự động (BuildSynonymGroups)
  console.info('[BuildSeed] Đang phân tích nghĩa và tạo sơ đồ từ đồng nghĩa...')
  const rawRows = db.prepare(`
    SELECT id, hsk_level, stt, word, pinyin, meaning_vi, example_zh, example_pinyin, example_vi
    FROM hsk_vocabulary
    ORDER BY hsk_level ASC, id ASC
  `).all() as any[]

  const glosses: RawMeaningGloss[] = []
  const vocabMap = new Map<number, any>()

  for (const row of rawRows) {
    vocabMap.set(Number(row.id), row)
    const meaningText = String(row.meaning_vi || '')
    const pieces = normalizeMeaningString(meaningText)

    for (const p of pieces) {
      glosses.push({
        vocabId: Number(row.id),
        gloss: p.gloss,
        glossRaw: p.glossRaw,
        extractedNote: p.extractedNote,
        position: p.position
      })
    }
  }

  // Lưu meaning_glosses
  const insertGloss = db.prepare(`
    INSERT OR IGNORE INTO meaning_glosses (vocab_id, gloss, gloss_raw, extracted_note, position)
    VALUES (?, ?, ?, ?, ?)
  `)

  db.transaction(() => {
    for (const g of glosses) {
      insertGloss.run(g.vocabId, g.gloss, g.glossRaw, g.extractedNote, g.position)
    }
  })()

  // Gom theo root_gloss
  const groupedByGloss = new Map<string, Array<{ vocabId: number; gloss: RawMeaningGloss }>>()
  for (const g of glosses) {
    if (!groupedByGloss.has(g.gloss)) {
      groupedByGloss.set(g.gloss, [])
    }
    groupedByGloss.get(g.gloss)!.push({ vocabId: g.vocabId, gloss: g })
  }

  const candidates: SynonymGroupCandidate[] = []

  for (const [rootGloss, entries] of groupedByGloss.entries()) {
    const wordToBestEntry = new Map<string, { vocabRow: any; gloss: RawMeaningGloss }>()

    for (const entry of entries) {
      const vRow = vocabMap.get(entry.vocabId)
      if (!vRow) continue

      const existing = wordToBestEntry.get(vRow.word)
      if (!existing) {
        wordToBestEntry.set(vRow.word, { vocabRow: vRow, gloss: entry.gloss })
      } else {
        if (Number(vRow.hsk_level) < Number(existing.vocabRow.hsk_level)) {
          wordToBestEntry.set(vRow.word, { vocabRow: vRow, gloss: entry.gloss })
        } else if (
          Number(vRow.hsk_level) === Number(existing.vocabRow.hsk_level) &&
          entry.gloss.position < existing.gloss.position
        ) {
          wordToBestEntry.set(vRow.word, { vocabRow: vRow, gloss: entry.gloss })
        }
      }
    }

    const uniqueMembers = Array.from(wordToBestEntry.values())
    if (uniqueMembers.length < 2) continue

    uniqueMembers.sort((a, b) => {
      const hskDiff = Number(a.vocabRow.hsk_level) - Number(b.vocabRow.hsk_level)
      if (hskDiff !== 0) return hskDiff
      const posDiff = a.gloss.position - b.gloss.position
      if (posDiff !== 0) return posDiff
      return Number(a.vocabRow.stt) - Number(b.vocabRow.stt)
    })

    const minHsk = Math.min(...uniqueMembers.map((m) => Number(m.vocabRow.hsk_level)))
    const syllables = rootGloss.split(/\s+/).filter(Boolean).length
    const firstPosCount = uniqueMembers.filter((m) => m.gloss.position === 1).length
    const firstPosRatio = firstPosCount / uniqueMembers.length
    const memberCount = uniqueMembers.length

    const rootScore = calculateRootScore({
      minHsk,
      syllables,
      firstPosRatio,
      memberCount
    })

    const memberCandidates: SynonymMemberCandidate[] = uniqueMembers.map((m, idx) => {
      let register: 'formal' | 'spoken' | 'neutral' = 'neutral'
      if (m.gloss.extractedNote) {
        const lower = m.gloss.extractedNote.toLowerCase()
        if (lower.includes('lịch sự') || lower.includes('trang trọng')) {
          register = 'formal'
        } else if (lower.includes('khẩu ngữ') || lower.includes('nói')) {
          register = 'spoken'
        }
      }

      return {
        vocabId: Number(m.vocabRow.id),
        word: String(m.vocabRow.word),
        pinyin: String(m.vocabRow.pinyin),
        hskLevel: Number(m.vocabRow.hsk_level),
        meaningVi: String(m.vocabRow.meaning_vi || ''),
        exampleZh: m.vocabRow.example_zh || null,
        examplePinyin: m.vocabRow.example_pinyin || null,
        exampleVi: m.vocabRow.example_vi || null,
        rankOrder: idx + 1,
        register,
        nuanceNote: m.gloss.extractedNote || null,
        stt: Number(m.vocabRow.stt || 0),
        position: m.gloss.position
      }
    })

    candidates.push({
      rootGloss,
      rootScore,
      source: 'auto',
      status: 'draft',
      members: memberCandidates
    })
  }

  // Kết hợp Curated Source
  const curatedSource = new CuratedSource()
  const curatedCandidates = await curatedSource.buildCandidates()
  const curatedMap = new Map(curatedCandidates.map((c) => [c.rootGloss, c]))

  const finalCandidates: SynonymGroupCandidate[] = []
  for (const autoCand of candidates) {
    if (curatedMap.has(autoCand.rootGloss)) {
      const cur = curatedMap.get(autoCand.rootGloss)!
      finalCandidates.push({
        ...autoCand,
        source: 'curated',
        status: 'approved',
        members: cur.members && cur.members.length > 0 ? cur.members : autoCand.members
      })
    } else {
      finalCandidates.push(autoCand)
    }
  }

  const insertGroup = db.prepare(`
    INSERT OR REPLACE INTO synonym_groups (root_gloss, root_score, source, status, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `)
  const insertMember = db.prepare(`
    INSERT OR REPLACE INTO synonym_group_members (group_id, vocab_id, rank_order, register, nuance_note)
    VALUES (?, ?, ?, ?, ?)
  `)

  db.transaction(() => {
    for (const cand of finalCandidates) {
      const res = insertGroup.run(cand.rootGloss, cand.rootScore, cand.source, cand.status)
      const groupId = Number(res.lastInsertRowid)
      for (const m of cand.members) {
        insertMember.run(groupId, m.vocabId, m.rankOrder, m.register, m.nuanceNote)
      }
    }
  })()

  console.info(`[BuildSeed] Đã tạo thành công ${finalCandidates.length} nhóm sơ đồ từ đồng nghĩa.`)

  // Ghi nhận migration đã hoàn tất
  const insertMigration = db.prepare('INSERT OR IGNORE INTO schema_migrations (migration_name) VALUES (?)')
  insertMigration.run('001_normalize_hsk_vocabulary')
  insertMigration.run('002_create_extension_tables')
  insertMigration.run('003_synonym_map')

  db.close()
  console.info(`[BuildSeed] ✅ Hoàn tất tạo database hạt giống SQLite: ${targetPath}`)
}

if (process.argv[1] && process.argv[1].endsWith('build-seed-sqlite.ts')) {
  const seedPath = path.resolve(process.cwd(), 'resources', 'appchinese_seed.db')
  buildSeedDatabase(seedPath).catch(console.error)
}
