import { z } from 'zod'

/**
 * 1. Schema Từ vựng HSK
 */
export const VocabEntrySchema = z.object({
  id: z.number().int().positive(),
  standard_version: z.string().default('HSK2.0'),
  hsk_level: z.number().int().min(1).max(6),
  word: z.string().min(1).max(64),
  pinyin: z.string().min(1).max(128),
  meaning_vi: z.string().min(1),
  example_zh: z.string().nullable().optional(),
  example_pinyin: z.string().nullable().optional(),
  example_vi: z.string().nullable().optional()
})

export type VocabEntry = z.infer<typeof VocabEntrySchema>

/**
 * 2. Schema Ký tự chữ Hán đơn & Nét viết
 */
export const HanziCharacterSchema = z.object({
  char: z.string().length(1),
  radical: z.string().min(1).max(16),
  stroke_count: z.number().int().min(1).max(64),
  sino_vietnamese: z.string().nullable().optional(),
  decomposition: z.string().nullable().optional(),
  etymology_hint: z.string().nullable().optional()
})

export type HanziCharacter = z.infer<typeof HanziCharacterSchema>

/**
 * 3. Schema Tham số SRS (SM-2 & FSRS)
 */
export const SrsParamsSm2Schema = z.object({
  efactor: z.number().min(1.3).max(3.0).default(2.5),
  interval: z.number().int().min(0).default(0),
  reps: z.number().int().min(0).default(0)
})

export type SrsParamsSm2 = z.infer<typeof SrsParamsSm2Schema>

export const SrsParamsFsrsSchema = z.object({
  stability: z.number().min(0).default(0),
  difficulty: z.number().min(1).max(10).default(5),
  lapses: z.number().int().min(0).default(0)
})

export type SrsParamsFsrs = z.infer<typeof SrsParamsFsrsSchema>

export const SrsParamsUnionSchema = z.union([SrsParamsSm2Schema, SrsParamsFsrsSchema])

/**
 * 4. Schema Tiến độ học tập từng từ (user_vocab_progress)
 */
export const ProgressStateSchema = z.enum(['new', 'learning', 'review', 'relearning'])
export type ProgressState = z.infer<typeof ProgressStateSchema>

export const SrsAlgorithmSchema = z.enum(['sm2', 'fsrs'])
export type SrsAlgorithm = z.infer<typeof SrsAlgorithmSchema>

export const UserVocabProgressSchema = z.object({
  vocab_id: z.number().int().positive(),
  state: ProgressStateSchema.default('new'),
  algorithm: SrsAlgorithmSchema.default('sm2'),
  srs_params: z.record(z.string(), z.any()),
  wrong_count: z.number().int().min(0).default(0),
  correct_count: z.number().int().min(0).default(0),
  custom_note: z.string().nullable().optional(),
  last_reviewed_at: z.string().nullable().optional(),
  next_review_at: z.string().nullable().optional(),
  updated_at: z.string().optional()
})

export type UserVocabProgress = z.infer<typeof UserVocabProgressSchema>

/**
 * 5. Schema Lịch sử ôn tập (review_logs)
 */
export const ReviewModeSchema = z.enum(['typing', 'cloze', 'flashcard', 'handwriting', 'synonym_recall'])
export type ReviewMode = z.infer<typeof ReviewModeSchema>

export const SrsRatingSchema = z.union([
  z.literal(1), // Again
  z.literal(2), // Hard
  z.literal(3), // Good
  z.literal(4)  // Easy
])
export type SrsRating = z.infer<typeof SrsRatingSchema>

export const ReviewLogSchema = z.object({
  id: z.number().int().positive().optional(),
  vocab_id: z.number().int().positive(),
  review_mode: ReviewModeSchema,
  user_input: z.string().max(128).nullable().optional(),
  is_correct: z.boolean(),
  srs_rating: SrsRatingSchema,
  response_time_ms: z.number().int().min(0).default(0),
  reviewed_at: z.string().optional()
})

export type ReviewLog = z.infer<typeof ReviewLogSchema>

/**
 * 6. Schema Sổ tay từ vựng
 */
export const NotebookSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(128),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).default('#3b82f6'),
  sort_order: z.number().int().default(0),
  created_at: z.string().optional(),
  item_count: z.number().int().min(0).optional()
})

export type Notebook = z.infer<typeof NotebookSchema>

export const NotebookItemSchema = z.object({
  notebook_id: z.number().int().positive(),
  vocab_id: z.number().int().positive(),
  added_at: z.string().optional()
})

export type NotebookItem = z.infer<typeof NotebookItemSchema>

/**
 * 7. Schemas cho IPC Requests & Validations
 */
export const VocabSearchFilterSchema = z.object({
  query: z.string().optional(),
  hsk_level: z.number().int().min(1).max(6).optional(),
  state: z.enum(['all', 'new', 'learning', 'review', 'relearning']).optional(),
  notebook_id: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(10000).default(50),
  offset: z.number().int().min(0).default(0)
})

export type VocabSearchFilter = z.input<typeof VocabSearchFilterSchema>
export type VocabSearchFilterParsed = z.output<typeof VocabSearchFilterSchema>

export const VocabWithProgressSchema = VocabEntrySchema.extend({
  progress: UserVocabProgressSchema.nullable().optional(),
  is_in_notebook: z.boolean().optional()
})

export type VocabWithProgress = z.infer<typeof VocabWithProgressSchema>

export const VocabSearchResultSchema = z.object({
  items: z.array(VocabWithProgressSchema),
  total: z.number().int().min(0),
  limit: z.number().int(),
  offset: z.number().int()
})

export type VocabSearchResult = z.infer<typeof VocabSearchResultSchema>

export const VocabGetByIdRequestSchema = z.object({
  id: z.number().int().positive()
})

export const HanziGetDetailsRequestSchema = z.object({
  char: z.string().min(1).max(2)
})
export type HanziGetDetailsRequest = z.infer<typeof HanziGetDetailsRequestSchema>

export const ProgressGetRequestSchema = z.object({
  vocab_id: z.number().int().positive()
})
export type ProgressGetRequest = z.infer<typeof ProgressGetRequestSchema>

export const HanziGetStrokeDataRequestSchema = z.object({
  char: z.string().min(1).max(2)
})
export type HanziGetStrokeDataRequest = z.infer<typeof HanziGetStrokeDataRequestSchema>

export const HanziStrokeDataSchema = z.object({
  strokes: z.array(z.string()),
  medians: z.array(z.array(z.array(z.number()))),
  radStrokes: z.array(z.number()).optional()
})

export type HanziStrokeData = z.infer<typeof HanziStrokeDataSchema>

export const HanziCompoundWordSchema = z.object({
  id: z.number().int().positive(),
  word: z.string(),
  pinyin: z.string(),
  meaning_vi: z.string(),
  hsk_level: z.number().int()
})

export type HanziCompoundWord = z.infer<typeof HanziCompoundWordSchema>

export const HanziDetailsResponseSchema = z.object({
  character: HanziCharacterSchema.nullable(),
  compounds: z.array(HanziCompoundWordSchema)
})

export type HanziDetailsResponse = z.infer<typeof HanziDetailsResponseSchema>

export const SubmitReviewRequestSchema = z.object({
  vocab_id: z.number().int().positive(),
  review_mode: ReviewModeSchema,
  user_input: z.string().max(128).nullable().optional(),
  is_correct: z.boolean(),
  srs_rating: SrsRatingSchema,
  response_time_ms: z.number().int().min(0).default(0)
})

export type SubmitReviewRequest = z.input<typeof SubmitReviewRequestSchema>
export type SubmitReviewRequestParsed = z.output<typeof SubmitReviewRequestSchema>
export const ProgressSubmitReviewQuerySchema = SubmitReviewRequestSchema
export type ProgressSubmitReviewQuery = SubmitReviewRequest

export const SubmitReviewResponseSchema = z.object({
  progress: UserVocabProgressSchema,
  review_log: ReviewLogSchema
})

export type SubmitReviewResponse = z.infer<typeof SubmitReviewResponseSchema>

export const GetDueVocabRequestSchema = z.object({
  hsk_level: z.number().int().min(1).max(6).optional(),
  limit: z.number().int().min(1).max(100).default(20)
})

export type GetDueVocabRequest = z.input<typeof GetDueVocabRequestSchema>
export type GetDueVocabRequestParsed = z.output<typeof GetDueVocabRequestSchema>

export const NotebookCreateRequestSchema = z.object({
  name: z.string().min(1).max(128),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).default('#3b82f6')
})

export type NotebookCreateRequest = z.input<typeof NotebookCreateRequestSchema>
export type NotebookCreateRequestParsed = z.output<typeof NotebookCreateRequestSchema>

export const NotebookUpdateRequestSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(128).optional(),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  sort_order: z.number().int().optional()
})

export type NotebookUpdateRequest = z.infer<typeof NotebookUpdateRequestSchema>

export const NotebookToggleItemRequestSchema = z.object({
  notebook_id: z.number().int().positive(),
  vocab_id: z.number().int().positive()
})

export type NotebookToggleItemRequest = z.infer<typeof NotebookToggleItemRequestSchema>

export const NotebookToggleItemResponseSchema = z.object({
  added: z.boolean(),
  notebook_id: z.number(),
  vocab_id: z.number()
})

export type NotebookToggleItemResponse = z.infer<typeof NotebookToggleItemResponseSchema>

export const StatsSummaryRequestSchema = z.object({
  timezone_offset_minutes: z.number().int().default(420) // UTC+7 = +420 mins
})

export type StatsSummaryRequest = z.input<typeof StatsSummaryRequestSchema>
export type StatsSummaryRequestParsed = z.output<typeof StatsSummaryRequestSchema>

export const HskLevelCountSchema = z.object({
  hsk_level: z.number().int(),
  total: z.number().int(),
  learned: z.number().int(),
  due_today: z.number().int()
})

export type HskLevelCount = z.infer<typeof HskLevelCountSchema>

export const HeatmapDaySchema = z.object({
  date: z.string(), // YYYY-MM-DD
  count: z.number().int(),
  correct_count: z.number().int()
})

export type HeatmapDay = z.infer<typeof HeatmapDaySchema>

export const StatsSummaryResponseSchema = z.object({
  total_words: z.number().int(),
  total_learned: z.number().int(),
  total_due_today: z.number().int(),
  total_reviews: z.number().int(),
  hsk_levels: z.array(HskLevelCountSchema),
  heatmap: z.array(HeatmapDaySchema)
})

export type StatsSummaryResponse = z.infer<typeof StatsSummaryResponseSchema>

export const WrongWordsFilterSchema = z.object({
  date: z.string().optional(), // YYYY-MM-DD (local timezone)
  limit: z.number().int().min(1).max(100).default(50)
})

export type WrongWordsFilter = z.input<typeof WrongWordsFilterSchema>
export type WrongWordsFilterParsed = z.output<typeof WrongWordsFilterSchema>

export const SystemInfoResponseSchema = z.object({
  platform: z.string(),
  app_version: z.string(),
  node_version: z.string(),
  chrome_version: z.string(),
  electron_version: z.string(),
  encryption_available: z.boolean(),
  storage_backend: z.string(),
  db_connected: z.boolean()
})

export type SystemInfoResponse = z.infer<typeof SystemInfoResponseSchema>

/**
 * Standard Envelope Response cho mọi IPC Channel
 */
export type IpcResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string; details?: unknown }

/**
 * 12. Schemas Phân hệ Sơ đồ Từ đồng nghĩa (Synonym Map & Recall - Giai đoạn 5)
 */
export const SynonymRegisterSchema = z.enum(['formal', 'spoken', 'neutral'])
export type SynonymRegister = z.infer<typeof SynonymRegisterSchema>

export const SynonymSourceSchema = z.enum(['auto', 'curated', 'ai'])
export type SynonymSource = z.infer<typeof SynonymSourceSchema>

export const SynonymStatusSchema = z.enum(['draft', 'approved', 'hidden'])
export type SynonymStatus = z.infer<typeof SynonymStatusSchema>

export const SynonymMemberDTOSchema = z.object({
  vocab_id: z.number().int().positive(),
  word: z.string(),
  pinyin: z.string(),
  hsk_level: z.number().int().min(1).max(6),
  meaning_vi: z.string(),
  example_zh: z.string().nullable().optional(),
  example_pinyin: z.string().nullable().optional(),
  example_vi: z.string().nullable().optional(),
  rank_order: z.number().int().min(1).max(255),
  register: SynonymRegisterSchema,
  nuance_note: z.string().nullable().optional()
})
export type SynonymMemberDTO = z.infer<typeof SynonymMemberDTOSchema>

export const SynonymMapDTOSchema = z.object({
  id: z.number().int().positive(),
  root_gloss: z.string(),
  root_score: z.number(),
  source: SynonymSourceSchema,
  status: SynonymStatusSchema,
  members: z.array(SynonymMemberDTOSchema),
  total_members: z.number().int().default(0)
})
export type SynonymMapDTO = z.infer<typeof SynonymMapDTOSchema>

export const SynonymGetByVocabIdRequestSchema = z.object({
  vocabId: z.number().int().positive()
})
export type SynonymGetByVocabIdRequest = z.infer<typeof SynonymGetByVocabIdRequestSchema>

export const SynonymGetByRootGlossRequestSchema = z.object({
  rootGloss: z.string().min(1)
})
export type SynonymGetByRootGlossRequest = z.infer<typeof SynonymGetByRootGlossRequestSchema>

export const SynonymListGroupsRequestSchema = z.object({
  search: z.string().optional(),
  hskLevel: z.number().int().min(1).max(6).optional(),
  status: SynonymStatusSchema.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20)
})
export type SynonymListGroupsRequest = z.input<typeof SynonymListGroupsRequestSchema>
export type SynonymListGroupsRequestParsed = z.output<typeof SynonymListGroupsRequestSchema>

export const SynonymListGroupsResponseSchema = z.object({
  items: z.array(SynonymMapDTOSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int()
})
export type SynonymListGroupsResponse = z.infer<typeof SynonymListGroupsResponseSchema>

export const SynonymUpdateNuanceRequestSchema = z.object({
  groupId: z.number().int().positive(),
  vocabId: z.number().int().positive(),
  register: SynonymRegisterSchema,
  nuanceNote: z.string().max(255),
  approveGroup: z.boolean().optional()
})
export type SynonymUpdateNuanceRequest = z.infer<typeof SynonymUpdateNuanceRequestSchema>

export const SynonymRecallResultItemSchema = z.object({
  vocab_id: z.number().int().positive(),
  is_correct: z.boolean()
})
export type SynonymRecallResultItem = z.infer<typeof SynonymRecallResultItemSchema>

export const SynonymRecallSubmitRequestSchema = z.object({
  groupId: z.number().int().positive(),
  results: z.array(SynonymRecallResultItemSchema)
})
export type SynonymRecallSubmitRequest = z.infer<typeof SynonymRecallSubmitRequestSchema>

export const SynonymRecallSubmittedItemSchema = z.object({
  vocab_id: z.number().int().positive(),
  srs_rating: z.number().int().min(1).max(4),
  is_correct: z.boolean()
})
export type SynonymRecallSubmittedItem = z.infer<typeof SynonymRecallSubmittedItemSchema>

export const SynonymRecallSubmitResponseSchema = z.object({
  ratio: z.number(),
  items: z.array(SynonymRecallSubmittedItemSchema)
})
export type SynonymRecallSubmitResponse = z.infer<typeof SynonymRecallSubmitResponseSchema>

