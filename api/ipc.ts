import { createClient, Client } from '@libsql/client/web'

let clientInstance: Client | null = null

function getTursoClient(): Client {
  if (!clientInstance) {
    const url =
      process.env.TURSO_DATABASE_URL ||
      'libsql://appchinese-cuonglearncode.aws-ap-northeast-1.turso.io'
    const authToken =
      process.env.TURSO_AUTH_TOKEN ||
      'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTMxMTMxNTksImlkIjoiMDFhMTdkZGYtNGYwMS03N2UxLTg1YmUtOTZiZDVjMzEyNDQwIiwia2lkIjoiYXVPWVN2SURJaGtRZlZ0bC1OSEJXSmREVmZDSUhEQ2pTcHJCdUJBOEdkTSIsInJpZCI6IjVkYTAxZmU3LTYyOWYtNDQzZC1iMzEwLTIzNmVlNWRlMGYyOSJ9.oeAn4NfaSx57YSH0TPPSbZ3nxYdfOMzb9G6mDbwzBnwXLOsegNPngQXXWShjKARnzRzNgcAPmS-k8TC5UB10BQ'

    clientInstance = createClient({ url, authToken })
  }
  return clientInstance
}

function cleanArgs(args: any[]): any[] {
  return args.map((v) => (v === undefined ? null : v))
}

function mapRowToVocab(row: any): any {
  let progress: any = null

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
      vocab_id: Number(row.id),
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

// 1. TỪ VỰNG (VOCABULARY)
async function searchVocab(filter: any): Promise<any> {
  const db = getTursoClient()
  const limit = filter.limit ?? 50
  const offset = filter.offset ?? 0

  const conditions: string[] = []
  const params: any[] = []
  const countJoins: string[] = []
  const selectJoins: string[] = ['LEFT JOIN user_vocab_progress p ON v.id = p.vocab_id']

  if (filter.notebook_id) {
    const nbJoin = 'INNER JOIN notebook_items ni ON v.id = ni.vocab_id AND ni.notebook_id = ?'
    countJoins.push(nbJoin)
    selectJoins.push(nbJoin)
    params.push(filter.notebook_id)
  }

  if (filter.state && filter.state !== 'all') {
    countJoins.push('LEFT JOIN user_vocab_progress p ON v.id = p.vocab_id')
    if (filter.state === 'new') {
      conditions.push("(p.state IS NULL OR p.state = 'new')")
    } else {
      conditions.push('p.state = ?')
      params.push(filter.state)
    }
  }

  if (filter.hsk_level !== undefined) {
    conditions.push('v.hsk_level = ?')
    params.push(filter.hsk_level)
  }

  if (filter.query && filter.query.trim()) {
    const q = `%${filter.query.trim()}%`
    conditions.push('(v.word LIKE ? OR v.pinyin LIKE ? OR v.meaning_vi LIKE ?)')
    params.push(q, q, q)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countSql = `
    SELECT COUNT(DISTINCT v.id) as total
    FROM hsk_vocabulary v
    ${countJoins.join(' ')}
    ${whereClause};
  `
  const countRes = await db.execute({ sql: countSql, args: cleanArgs(params) })
  const total = Number(countRes.rows[0]?.total || 0)

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
  const selectRes = await db.execute({ sql: selectSql, args: cleanArgs([...params, limit, offset]) })
  const items = selectRes.rows.map(mapRowToVocab)

  return { items, total, limit, offset }
}

async function getVocabById(id: number): Promise<any> {
  const db = getTursoClient()
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
    WHERE v.id = ?
    LIMIT 1;
  `
  const res = await db.execute({ sql, args: [id] })
  if (res.rows.length === 0) return null
  return mapRowToVocab(res.rows[0])
}

async function getDueWords(req: any): Promise<any[]> {
  const db = getTursoClient()
  const limit = req.limit ?? 20
  const conditions = [
    "(p.state != 'new' AND (p.next_review_at IS NULL OR datetime(p.next_review_at) <= datetime('now')))"
  ]
  const params: any[] = []

  if (req.hsk_level !== undefined) {
    conditions.push('v.hsk_level = ?')
    params.push(req.hsk_level)
  }

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
    INNER JOIN user_vocab_progress p ON v.id = p.vocab_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY p.next_review_at ASC
    LIMIT ?;
  `
  const res = await db.execute({ sql, args: cleanArgs([...params, limit]) })
  return res.rows.map(mapRowToVocab)
}

async function getWrongWords(filter: any): Promise<any[]> {
  const db = getTursoClient()
  const limit = filter.limit ?? 20
  const conditions = ['p.wrong_count > 0']
  const params: any[] = []

  if (filter.date) {
    conditions.push('date(p.last_reviewed_at) = date(?)')
    params.push(filter.date)
  }

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
    INNER JOIN user_vocab_progress p ON v.id = p.vocab_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY p.wrong_count DESC
    LIMIT ?;
  `
  const res = await db.execute({ sql, args: cleanArgs([...params, limit]) })
  return res.rows.map(mapRowToVocab)
}

// 2. CHỮ HÁN & NÉT VIẾT (HANZI)
async function getHanziDetails(char: string): Promise<any> {
  const db = getTursoClient()
  const targetChar = Array.from(char || '')[0]
  if (!targetChar) {
    return { character: null, compounds: [] }
  }

  const charSql = `
    SELECT char, radical, stroke_count, sino_vietnamese, decomposition, etymology_hint
    FROM hanzi_characters
    WHERE char = ?
    LIMIT 1;
  `
  const compoundsSql = `
    SELECT id, word, pinyin, meaning_vi, hsk_level
    FROM hsk_vocabulary
    WHERE word LIKE ?
    ORDER BY hsk_level ASC, length(word) ASC
    LIMIT 30;
  `

  const [charRes, compRes] = await Promise.all([
    db.execute({ sql: charSql, args: [targetChar] }),
    db.execute({ sql: compoundsSql, args: [`%${targetChar}%`] })
  ])

  const c = charRes.rows[0]
  const character = c
    ? {
        char: String(c.char),
        radical: String(c.radical),
        stroke_count: Number(c.stroke_count),
        sino_vietnamese: c.sino_vietnamese ? String(c.sino_vietnamese) : null,
        decomposition: c.decomposition ? String(c.decomposition) : null,
        etymology_hint: c.etymology_hint ? String(c.etymology_hint) : null
      }
    : null

  const compounds = compRes.rows.map((r: any) => ({
    id: Number(r.id),
    word: String(r.word),
    pinyin: String(r.pinyin),
    meaning_vi: String(r.meaning_vi || ''),
    hsk_level: Number(r.hsk_level)
  }))

  return { character, compounds }
}

async function fetchStrokeData(char: string): Promise<any> {
  try {
    if (!char) return null
    const targetChar = Array.from(char)[0]
    const url = `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${encodeURIComponent(targetChar)}.json`
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// 3. TIẾN ĐỘ HỌC TẬP (PROGRESS & SRS)
async function getProgress(vocabId: number): Promise<any> {
  const db = getTursoClient()
  const sql = `
    SELECT vocab_id, state, algorithm, srs_params, wrong_count, correct_count,
           custom_note, last_reviewed_at, next_review_at, updated_at
    FROM user_vocab_progress
    WHERE vocab_id = ?
    LIMIT 1;
  `
  const res = await db.execute({ sql, args: [vocabId] })
  if (res.rows.length === 0) return null
  const r: any = res.rows[0]

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

function calculateSm2(currentProgress: any, rating: number, now: Date): any {
  let efactor = 2.5
  let interval = 0
  let reps = 0

  if (currentProgress?.srs_params) {
    const p = currentProgress.srs_params
    if (typeof p.efactor === 'number') efactor = p.efactor
    if (typeof p.interval === 'number') interval = p.interval
    if (typeof p.reps === 'number') reps = p.reps
  }

  let nextIntervalDays: number
  let nextReps: number
  let nextEfactor: number
  let nextState: string

  if (rating === 1) {
    nextReps = 0
    nextIntervalDays = 1
    nextEfactor = Math.max(1.3, Number((efactor - 0.2).toFixed(2)))
    nextState = 'relearning'
  } else if (rating === 2) {
    if (reps === 0) {
      nextIntervalDays = 1
      nextReps = 1
    } else if (reps === 1) {
      nextIntervalDays = 3
      nextReps = 2
    } else {
      nextIntervalDays = Math.max(interval + 1, Math.round(interval * 1.2))
      nextReps = reps + 1
    }
    nextEfactor = Math.max(1.3, Number((efactor - 0.15).toFixed(2)))
    nextState = 'review'
  } else if (rating === 3) {
    if (reps === 0) {
      nextIntervalDays = 1
      nextReps = 1
    } else if (reps === 1) {
      nextIntervalDays = 6
      nextReps = 2
    } else {
      nextIntervalDays = Math.round(interval * efactor)
      nextReps = reps + 1
    }
    nextEfactor = Number(efactor.toFixed(2))
    nextState = 'review'
  } else {
    if (reps === 0) {
      nextIntervalDays = 3
      nextReps = 1
    } else if (reps === 1) {
      nextIntervalDays = 8
      nextReps = 2
    } else {
      nextIntervalDays = Math.round(interval * efactor * 1.3)
      nextReps = reps + 1
    }
    nextEfactor = Math.min(3.0, Number((efactor + 0.15).toFixed(2)))
    nextState = 'review'
  }

  nextIntervalDays = Math.max(1, nextIntervalDays)
  const nextReviewTime = new Date(now.getTime() + nextIntervalDays * 86_400_000).toISOString()

  return {
    state: nextState,
    algorithm: 'sm2',
    srs_params: {
      efactor: nextEfactor,
      interval: nextIntervalDays,
      reps: nextReps
    },
    interval_days: nextIntervalDays,
    next_review_at: nextReviewTime
  }
}

async function submitReview(payload: any): Promise<any> {
  const db = getTursoClient()
  const currentProgress = await getProgress(payload.vocab_id)
  const nowDate = new Date()
  const now = nowDate.toISOString()
  const srsCalculation = calculateSm2(currentProgress, payload.srs_rating || 3, nowDate)

  const isCorrect = payload.is_correct
  const wrongCount = (currentProgress?.wrong_count || 0) + (isCorrect ? 0 : 1)
  const correctCount = (currentProgress?.correct_count || 0) + (isCorrect ? 1 : 0)

  const updatedProgress = {
    vocab_id: payload.vocab_id,
    state: srsCalculation.state,
    algorithm: srsCalculation.algorithm,
    srs_params: srsCalculation.srs_params,
    wrong_count: wrongCount,
    correct_count: correctCount,
    custom_note: currentProgress?.custom_note || null,
    last_reviewed_at: now,
    next_review_at: srsCalculation.next_review_at
  }

  const upsertSql = `
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
  await db.execute({
    sql: upsertSql,
    args: cleanArgs([
      updatedProgress.vocab_id,
      updatedProgress.state,
      updatedProgress.algorithm,
      JSON.stringify(updatedProgress.srs_params),
      updatedProgress.wrong_count,
      updatedProgress.correct_count,
      updatedProgress.custom_note || null,
      updatedProgress.last_reviewed_at,
      updatedProgress.next_review_at
    ])
  })

  const logSql = `
    INSERT INTO review_logs
      (vocab_id, review_mode, user_input, is_correct, srs_rating, response_time_ms, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')));
  `
  const logRes = await db.execute({
    sql: logSql,
    args: cleanArgs([
      payload.vocab_id,
      payload.review_mode,
      payload.user_input,
      payload.is_correct ? 1 : 0,
      payload.srs_rating,
      payload.response_time_ms,
      now
    ])
  })

  return {
    progress: updatedProgress,
    review_log: {
      id: Number(logRes.lastInsertRowid),
      vocab_id: payload.vocab_id,
      review_mode: payload.review_mode,
      user_input: payload.user_input,
      is_correct: payload.is_correct,
      srs_rating: payload.srs_rating,
      response_time_ms: payload.response_time_ms,
      reviewed_at: now
    }
  }
}

async function getStatsSummary(tzOffset: number = 420): Promise<any> {
  const db = getTursoClient()

  const retentionSql = `
    SELECT 
      COUNT(*) as total_reviews,
      SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_reviews
    FROM review_logs;
  `
  const vocabCountSql = `SELECT COUNT(DISTINCT vocab_id) as total_words FROM review_logs;`
  const dueCountSql = `
    SELECT COUNT(*) as due_count
    FROM user_vocab_progress
    WHERE state != 'new' AND (next_review_at IS NULL OR datetime(next_review_at) <= datetime('now'));
  `
  const levelsSql = `
    SELECT 
      v.hsk_level,
      COUNT(v.id) as total_count,
      SUM(CASE WHEN p.state IS NOT NULL AND p.state != 'new' THEN 1 ELSE 0 END) as learned_count,
      SUM(CASE WHEN p.state IS NOT NULL AND p.state != 'new' AND (p.next_review_at IS NULL OR datetime(p.next_review_at) <= datetime('now')) THEN 1 ELSE 0 END) as due_count
    FROM hsk_vocabulary v
    LEFT JOIN user_vocab_progress p ON v.id = p.vocab_id
    GROUP BY v.hsk_level
    ORDER BY v.hsk_level ASC;
  `
  const tzModifier = `${tzOffset >= 0 ? '+' : ''}${tzOffset} minutes`
  const heatmapSql = `
    SELECT 
      date(datetime(reviewed_at, '${tzModifier}')) as review_date,
      COUNT(*) as count,
      SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_count
    FROM review_logs
    WHERE reviewed_at >= datetime('now', '-90 days')
    GROUP BY date(datetime(reviewed_at, '${tzModifier}'))
    ORDER BY review_date ASC;
  `

  const [retRes, vocabRes, dueRes, levelsRes, heatRes] = await Promise.all([
    db.execute(retentionSql),
    db.execute(vocabCountSql),
    db.execute(dueCountSql),
    db.execute(levelsSql),
    db.execute(heatmapSql)
  ])

  const totalReviews = Number(retRes.rows[0]?.total_reviews || 0)
  const totalWordsLearned = Number(vocabRes.rows[0]?.total_words || 0)
  const dueCount = Number(dueRes.rows[0]?.due_count || 0)

  const hskLevels = (levelsRes.rows as any[]).map((r) => ({
    hsk_level: Number(r.hsk_level),
    total: Number(r.total_count || 0),
    learned: Number(r.learned_count || 0),
    due_today: Number(r.due_count || 0)
  }))

  const heatmap = (heatRes.rows as any[]).map((r) => ({
    date: String(r.review_date),
    count: Number(r.count || 0),
    correct_count: Number(r.correct_count || 0)
  }))

  return {
    total_words: 5003,
    total_learned: totalWordsLearned,
    total_due_today: dueCount,
    total_reviews: totalReviews,
    hsk_levels: hskLevels,
    heatmap
  }
}

// 4. SỔ TAY TỪ VỰNG (NOTEBOOK)
async function listNotebooks(): Promise<any[]> {
  const db = getTursoClient()
  const sql = `
    SELECT 
      n.id, n.name, n.color, n.sort_order, n.created_at,
      COUNT(ni.vocab_id) as item_count
    FROM notebooks n
    LEFT JOIN notebook_items ni ON n.id = ni.notebook_id
    GROUP BY n.id
    ORDER BY n.sort_order ASC, n.id ASC;
  `
  const res = await db.execute(sql)
  return res.rows.map((r: any) => ({
    id: Number(r.id),
    name: String(r.name),
    color: String(r.color),
    sort_order: Number(r.sort_order),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
    item_count: Number(r.item_count || 0)
  }))
}

async function createNotebook(req: any): Promise<any> {
  const db = getTursoClient()
  const sql = `
    INSERT INTO notebooks (name, color, sort_order)
    VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM notebooks));
  `
  const res = await db.execute({
    sql,
    args: cleanArgs([req.name.trim(), req.color || '#3b82f6'])
  })
  const id = Number(res.lastInsertRowid)
  return {
    id,
    name: req.name.trim(),
    color: req.color || '#3b82f6',
    sort_order: 1,
    item_count: 0
  }
}

async function updateNotebook(req: any): Promise<any> {
  const db = getTursoClient()
  const fields: string[] = []
  const params: any[] = []

  if (req.name !== undefined) {
    fields.push('name = ?')
    params.push(req.name.trim())
  }
  if (req.color !== undefined) {
    fields.push('color = ?')
    params.push(req.color)
  }
  if (req.sort_order !== undefined) {
    fields.push('sort_order = ?')
    params.push(req.sort_order)
  }

  if (fields.length > 0) {
    await db.execute({
      sql: `UPDATE notebooks SET ${fields.join(', ')} WHERE id = ?;`,
      args: cleanArgs([...params, req.id])
    })
  }

  const notebooks = await listNotebooks()
  return notebooks.find((n) => n.id === req.id) || null
}

async function deleteNotebook(id: number): Promise<boolean> {
  const db = getTursoClient()
  await db.execute({ sql: 'DELETE FROM notebook_items WHERE notebook_id = ?;', args: [id] })
  await db.execute({ sql: 'DELETE FROM notebooks WHERE id = ?;', args: [id] })
  return true
}

async function toggleNotebookItem(req: any): Promise<any> {
  const db = getTursoClient()
  const checkSql = `SELECT 1 FROM notebook_items WHERE notebook_id = ? AND vocab_id = ? LIMIT 1;`
  const checkRes = await db.execute({ sql: checkSql, args: [req.notebook_id, req.vocab_id] })

  if (checkRes.rows.length > 0) {
    await db.execute({
      sql: 'DELETE FROM notebook_items WHERE notebook_id = ? AND vocab_id = ?;',
      args: [req.notebook_id, req.vocab_id]
    })
    return { added: false, notebook_id: req.notebook_id, vocab_id: req.vocab_id }
  } else {
    await db.execute({
      sql: 'INSERT INTO notebook_items (notebook_id, vocab_id) VALUES (?, ?);',
      args: [req.notebook_id, req.vocab_id]
    })
    return { added: true, notebook_id: req.notebook_id, vocab_id: req.vocab_id }
  }
}

// 5. TỪ ĐỒNG NGHĨA (SYNONYM MAP)
async function getSynonymByVocabId(vocabId: number): Promise<any[]> {
  const db = getTursoClient()
  const groupSql = `
    SELECT g.id, g.root_gloss, g.root_score, g.source, g.status, g.updated_at
    FROM synonym_groups g
    JOIN synonym_group_members m ON g.id = m.group_id
    WHERE m.vocab_id = ? AND g.status != 'hidden'
    ORDER BY g.root_score DESC;
  `
  const gRes = await db.execute({ sql: groupSql, args: [vocabId] })
  if (gRes.rows.length === 0) return []

  const groupIds = gRes.rows.map((r: any) => Number(r.id))
  const placeholders = groupIds.map(() => '?').join(',')
  const membersSql = `
    SELECT 
      m.group_id, m.vocab_id, m.rank_order, m.register, m.nuance_note,
      v.word, v.pinyin, v.hsk_level, v.meaning_vi, v.example_zh, v.example_pinyin, v.example_vi
    FROM synonym_group_members m
    JOIN hsk_vocabulary v ON m.vocab_id = v.id
    WHERE m.group_id IN (${placeholders})
    ORDER BY m.group_id ASC, m.rank_order ASC;
  `
  const mRes = await db.execute({ sql: membersSql, args: cleanArgs(groupIds) })

  const membersByGroup = new Map<number, any[]>()
  for (const r of mRes.rows as any[]) {
    const gid = Number(r.group_id)
    if (!membersByGroup.has(gid)) {
      membersByGroup.set(gid, [])
    }
    membersByGroup.get(gid)!.push({
      vocab_id: Number(r.vocab_id),
      rank_order: Number(r.rank_order),
      register: r.register,
      nuance_note: r.nuance_note || null,
      word: String(r.word),
      pinyin: String(r.pinyin),
      hsk_level: Number(r.hsk_level),
      meaning_vi: String(r.meaning_vi || ''),
      example_zh: r.example_zh || null,
      example_pinyin: r.example_pinyin || null,
      example_vi: r.example_vi || null
    })
  }

  return (gRes.rows as any[]).map((g) => {
    const members = membersByGroup.get(Number(g.id)) || []
    return {
      id: Number(g.id),
      root_gloss: String(g.root_gloss),
      root_score: Number(g.root_score),
      source: g.source,
      status: g.status,
      members,
      total_members: members.length
    }
  })
}

async function listSynonymGroups(req: any): Promise<any[]> {
  const db = getTursoClient()
  const limit = req.limit ?? 20
  const sql = `
    SELECT id, root_gloss, root_score, source, status, updated_at
    FROM synonym_groups
    WHERE status != 'hidden'
    ORDER BY root_score DESC, id ASC
    LIMIT ?;
  `
  const gRes = await db.execute({ sql, args: [limit] })
  if (gRes.rows.length === 0) return []

  const groupIds = gRes.rows.map((r: any) => Number(r.id))
  const placeholders = groupIds.map(() => '?').join(',')
  const membersSql = `
    SELECT 
      m.group_id, m.vocab_id, m.rank_order, m.register, m.nuance_note,
      v.word, v.pinyin, v.hsk_level, v.meaning_vi, v.example_zh, v.example_pinyin, v.example_vi
    FROM synonym_group_members m
    JOIN hsk_vocabulary v ON m.vocab_id = v.id
    WHERE m.group_id IN (${placeholders})
    ORDER BY m.group_id ASC, m.rank_order ASC;
  `
  const mRes = await db.execute({ sql: membersSql, args: cleanArgs(groupIds) })

  const membersByGroup = new Map<number, any[]>()
  for (const r of mRes.rows as any[]) {
    const gid = Number(r.group_id)
    if (!membersByGroup.has(gid)) {
      membersByGroup.set(gid, [])
    }
    membersByGroup.get(gid)!.push({
      vocab_id: Number(r.vocab_id),
      rank_order: Number(r.rank_order),
      register: r.register,
      nuance_note: r.nuance_note || null,
      word: String(r.word),
      pinyin: String(r.pinyin),
      hsk_level: Number(r.hsk_level),
      meaning_vi: String(r.meaning_vi || ''),
      example_zh: r.example_zh || null,
      example_pinyin: r.example_pinyin || null,
      example_vi: r.example_vi || null
    })
  }

  return (gRes.rows as any[]).map((g) => {
    const members = membersByGroup.get(Number(g.id)) || []
    return {
      id: Number(g.id),
      root_gloss: String(g.root_gloss),
      root_score: Number(g.root_score),
      source: g.source,
      status: g.status,
      members,
      total_members: members.length
    }
  })
}

async function dispatchIpc(channel: string, payload: any): Promise<any> {
  switch (channel) {
    case 'vocab:search':
      return await searchVocab(payload || {})
    case 'vocab:getById':
      return await getVocabById(payload.id)
    case 'hanzi:getDetails':
      return await getHanziDetails(payload.char)
    case 'hanzi:getStrokeData':
      return await fetchStrokeData(payload.char)
    case 'progress:get':
      return await getProgress(payload.vocab_id)
    case 'progress:submitReview':
      return await submitReview(payload)
    case 'progress:getDue':
      return await getDueWords(payload || {})
    case 'notebook:list':
      return await listNotebooks()
    case 'notebook:create':
      return await createNotebook(payload)
    case 'notebook:update':
      return await updateNotebook(payload)
    case 'notebook:delete':
      return await deleteNotebook(payload.id)
    case 'notebook:toggleItem':
      return await toggleNotebookItem(payload)
    case 'stats:getSummary':
      return await getStatsSummary(payload?.timezone_offset_minutes ?? 420)
    case 'stats:getWrongWords':
      return await getWrongWords(payload || {})
    case 'synonym:getByVocabId':
      return await getSynonymByVocabId(payload.vocabId)
    case 'synonym:listGroups':
      return await listSynonymGroups(payload || {})
    case 'system:getInfo':
      return {
        mode: 'cloud-turso',
        version: '1.0.0',
        environment: 'vercel-serverless'
      }
    default:
      throw new Error(`Kênh IPC không được hỗ trợ: ${channel}`)
  }
}

async function parseBody(req: any): Promise<any> {
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body)
      } catch {
        return {}
      }
    }
    return req.body
  }

  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk: any) => {
      data += chunk
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

function sendJson(res: any, status: number, data: any) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )
  res.end(JSON.stringify(data))
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 200
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.end()
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, error: 'Method Not Allowed' })
    return
  }

  try {
    const body = await parseBody(req)
    const { channel, payload } = body || {}

    if (!channel) {
      sendJson(res, 400, { success: false, error: 'Thiếu trường channel trong body' })
      return
    }

    const data = await dispatchIpc(channel, payload)
    sendJson(res, 200, { success: true, data })
  } catch (err: any) {
    console.error('[API IPC Error]:', err)
    sendJson(res, 200, {
      success: false,
      error: err?.message || String(err)
    })
  }
}
