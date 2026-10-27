import { PoolConnection } from 'mysql2/promise'
import {
  VocabSearchFilter,
  VocabSearchResult,
  VocabWithProgress,
  GetDueVocabRequest,
  WrongWordsFilter,
  HskLevelCount,
  HanziCharacter,
  HanziCompoundWord,
  HanziDetailsResponse,
  UserVocabProgress,
  ReviewLog,
  StatsSummaryResponse,
  Notebook,
  NotebookCreateRequest,
  NotebookUpdateRequest,
  NotebookToggleItemRequest,
  NotebookToggleItemResponse,
  SynonymMapDTO
} from '@shared/schemas'

/**
 * Interface Repository Từ vựng HSK (Tách biệt khỏi MySQL driver để dễ mở rộng sang SQLite)
 */
export interface IVocabRepository {
  search(filter: VocabSearchFilter): Promise<VocabSearchResult>
  getById(id: number): Promise<VocabWithProgress | null>
  getByWord(word: string): Promise<VocabWithProgress | null>
  getDueWords(req: GetDueVocabRequest): Promise<VocabWithProgress[]>
  getWrongWords(filter: WrongWordsFilter): Promise<VocabWithProgress[]>
  countByHskLevel(): Promise<HskLevelCount[]>
}

/**
 * Interface Repository Chữ Hán đơn & Nét viết
 */
export interface IHanziRepository {
  getByChar(char: string): Promise<HanziCharacter | null>
  getCompounds(char: string, limit?: number): Promise<HanziCompoundWord[]>
  getDetails(char: string): Promise<HanziDetailsResponse>
}

/**
 * Interface Repository Tiến độ học tập & SRS Review Logs
 */
export interface IProgressRepository {
  get(vocabId: number): Promise<UserVocabProgress | null>
  upsert(progress: UserVocabProgress, conn?: PoolConnection): Promise<void>
  logReview(reviewLog: ReviewLog, conn?: PoolConnection): Promise<number>
  getStatsSummary(timezoneOffsetMinutes: number): Promise<StatsSummaryResponse>
}

/**
 * Interface Repository Sổ tay từ vựng
 */
export interface INotebookRepository {
  list(): Promise<Notebook[]>
  getById(id: number): Promise<Notebook | null>
  create(req: NotebookCreateRequest): Promise<Notebook>
  update(req: NotebookUpdateRequest): Promise<Notebook>
  delete(id: number): Promise<boolean>
  toggleItem(req: NotebookToggleItemRequest): Promise<NotebookToggleItemResponse>
  isItemInNotebook(notebookId: number, vocabId: number): Promise<boolean>
}

/**
 * Interface Repository Sơ đồ Từ đồng nghĩa (Synonym Map & Recall - Giai đoạn 5)
 */
export interface ISynonymRepository {
  getByVocabId(vocabId: number): Promise<SynonymMapDTO[]>
  getByRootGloss(rootGloss: string): Promise<SynonymMapDTO | null>
  listGroups(filter: {
    search?: string
    hskLevel?: number
    status?: string
    page: number
    limit: number
  }): Promise<{ items: SynonymMapDTO[]; total: number; page: number; limit: number }>
  updateNuance(req: {
    groupId: number
    vocabId: number
    register: string
    nuanceNote: string
    approveGroup?: boolean
  }): Promise<void>
}

