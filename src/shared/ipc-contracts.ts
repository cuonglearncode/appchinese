import {
  VocabSearchFilter,
  VocabSearchResult,
  VocabWithProgress,
  HanziDetailsResponse,
  HanziStrokeData,
  UserVocabProgress,
  SubmitReviewRequest,
  SubmitReviewResponse,
  GetDueVocabRequest,
  Notebook,
  NotebookCreateRequest,
  NotebookUpdateRequest,
  NotebookToggleItemRequest,
  NotebookToggleItemResponse,
  StatsSummaryResponse,
  WrongWordsFilter,
  SystemInfoResponse,
  IpcResult,
  SynonymMapDTO,
  SynonymGetByVocabIdRequest,
  SynonymGetByRootGlossRequest,
  SynonymListGroupsRequest,
  SynonymListGroupsResponse,
  SynonymUpdateNuanceRequest,
  SynonymRecallSubmitRequest,
  SynonymRecallSubmitResponse
} from './schemas'

/**
 * Định nghĩa danh sách định danh kênh IPC (IPC Channel Names)
 */
export const IPC_CHANNELS = {
  // Vocabulary
  VOCAB_SEARCH: 'vocab:search',
  VOCAB_GET_BY_ID: 'vocab:getById',

  // Hanzi & Stroke Data
  HANZI_GET_DETAILS: 'hanzi:getDetails',
  HANZI_GET_STROKE_DATA: 'hanzi:getStrokeData',

  // Progress & SRS
  PROGRESS_GET: 'progress:get',
  PROGRESS_SUBMIT_REVIEW: 'progress:submitReview',
  PROGRESS_GET_DUE: 'progress:getDue',

  // Notebooks
  NOTEBOOK_LIST: 'notebook:list',
  NOTEBOOK_CREATE: 'notebook:create',
  NOTEBOOK_UPDATE: 'notebook:update',
  NOTEBOOK_DELETE: 'notebook:delete',
  NOTEBOOK_TOGGLE_ITEM: 'notebook:toggleItem',

  // Stats & Logs
  STATS_GET_SUMMARY: 'stats:getSummary',
  STATS_GET_WRONG_WORDS: 'stats:getWrongWords',

  // Synonym Map & Recall (Giai đoạn 5)
  SYNONYM_GET_BY_VOCAB_ID: 'synonym:getByVocabId',
  SYNONYM_GET_BY_ROOT_GLOSS: 'synonym:getByRootGloss',
  SYNONYM_LIST_GROUPS: 'synonym:listGroups',
  SYNONYM_UPDATE_NUANCE: 'synonym:updateNuance',
  SYNONYM_RECALL_SUBMIT: 'synonym:submitRecallResult',
  SYNONYM_BUILD_GROUPS: 'synonym:buildGroups',

  // System & Security
  SYSTEM_GET_INFO: 'system:getInfo'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

/**
 * Ánh xạ kiểu dữ liệu Request -> Response cho từng kênh IPC
 */
export interface IpcChannelMap {
  [IPC_CHANNELS.VOCAB_SEARCH]: {
    request: VocabSearchFilter
    response: IpcResult<VocabSearchResult>
  }
  [IPC_CHANNELS.VOCAB_GET_BY_ID]: {
    request: { id: number }
    response: IpcResult<VocabWithProgress | null>
  }
  [IPC_CHANNELS.HANZI_GET_DETAILS]: {
    request: { char: string }
    response: IpcResult<HanziDetailsResponse>
  }
  [IPC_CHANNELS.HANZI_GET_STROKE_DATA]: {
    request: { char: string }
    response: IpcResult<HanziStrokeData | null>
  }
  [IPC_CHANNELS.PROGRESS_GET]: {
    request: { vocab_id: number }
    response: IpcResult<UserVocabProgress | null>
  }
  [IPC_CHANNELS.PROGRESS_SUBMIT_REVIEW]: {
    request: SubmitReviewRequest
    response: IpcResult<SubmitReviewResponse>
  }
  [IPC_CHANNELS.PROGRESS_GET_DUE]: {
    request: GetDueVocabRequest
    response: IpcResult<VocabWithProgress[]>
  }
  [IPC_CHANNELS.NOTEBOOK_LIST]: {
    request: void | undefined
    response: IpcResult<Notebook[]>
  }
  [IPC_CHANNELS.NOTEBOOK_CREATE]: {
    request: NotebookCreateRequest
    response: IpcResult<Notebook>
  }
  [IPC_CHANNELS.NOTEBOOK_UPDATE]: {
    request: NotebookUpdateRequest
    response: IpcResult<Notebook>
  }
  [IPC_CHANNELS.NOTEBOOK_DELETE]: {
    request: { id: number }
    response: IpcResult<boolean>
  }
  [IPC_CHANNELS.NOTEBOOK_TOGGLE_ITEM]: {
    request: NotebookToggleItemRequest
    response: IpcResult<NotebookToggleItemResponse>
  }
  [IPC_CHANNELS.STATS_GET_SUMMARY]: {
    request: { timezone_offset_minutes?: number }
    response: IpcResult<StatsSummaryResponse>
  }
  [IPC_CHANNELS.STATS_GET_WRONG_WORDS]: {
    request: WrongWordsFilter
    response: IpcResult<VocabWithProgress[]>
  }
  [IPC_CHANNELS.SYNONYM_GET_BY_VOCAB_ID]: {
    request: SynonymGetByVocabIdRequest
    response: IpcResult<SynonymMapDTO[]>
  }
  [IPC_CHANNELS.SYNONYM_GET_BY_ROOT_GLOSS]: {
    request: SynonymGetByRootGlossRequest
    response: IpcResult<SynonymMapDTO | null>
  }
  [IPC_CHANNELS.SYNONYM_LIST_GROUPS]: {
    request: SynonymListGroupsRequest
    response: IpcResult<SynonymListGroupsResponse>
  }
  [IPC_CHANNELS.SYNONYM_UPDATE_NUANCE]: {
    request: SynonymUpdateNuanceRequest
    response: IpcResult<boolean>
  }
  [IPC_CHANNELS.SYNONYM_RECALL_SUBMIT]: {
    request: SynonymRecallSubmitRequest
    response: IpcResult<SynonymRecallSubmitResponse>
  }
  [IPC_CHANNELS.SYNONYM_BUILD_GROUPS]: {
    request: void | undefined
    response: IpcResult<{ totalGroups: number; totalMembers: number }>
  }
  [IPC_CHANNELS.SYSTEM_GET_INFO]: {
    request: void | undefined
    response: IpcResult<SystemInfoResponse>
  }
}

/**
 * Interface đối tượng API công khai đưa vào window.api qua Preload ContextBridge
 */
export interface ElectronAPI {
  vocab: {
    search(filter: VocabSearchFilter): Promise<IpcResult<VocabSearchResult>>
    getById(id: number): Promise<IpcResult<VocabWithProgress | null>>
  }
  hanzi: {
    getDetails(char: string): Promise<IpcResult<HanziDetailsResponse>>
    getStrokeData(char: string): Promise<IpcResult<HanziStrokeData | null>>
  }
  progress: {
    get(vocabId: number): Promise<IpcResult<UserVocabProgress | null>>
    submitReview(req: SubmitReviewRequest): Promise<IpcResult<SubmitReviewResponse>>
    getDue(req: GetDueVocabRequest): Promise<IpcResult<VocabWithProgress[]>>
  }
  notebook: {
    list(): Promise<IpcResult<Notebook[]>>
    create(req: NotebookCreateRequest): Promise<IpcResult<Notebook>>
    update(req: NotebookUpdateRequest): Promise<IpcResult<Notebook>>
    delete(id: number): Promise<IpcResult<boolean>>
    toggleItem(req: NotebookToggleItemRequest): Promise<IpcResult<NotebookToggleItemResponse>>
  }
  stats: {
    getSummary(timezoneOffsetMinutes?: number): Promise<IpcResult<StatsSummaryResponse>>
    getWrongWords(filter: WrongWordsFilter): Promise<IpcResult<VocabWithProgress[]>>
  }
  synonym: {
    getByVocabId(vocabId: number): Promise<IpcResult<SynonymMapDTO[]>>
    getByRootGloss(rootGloss: string): Promise<IpcResult<SynonymMapDTO | null>>
    listGroups(req: SynonymListGroupsRequest): Promise<IpcResult<SynonymListGroupsResponse>>
    updateNuance(req: SynonymUpdateNuanceRequest): Promise<IpcResult<boolean>>
    submitRecallResult(req: SynonymRecallSubmitRequest): Promise<IpcResult<SynonymRecallSubmitResponse>>
    buildGroups(): Promise<IpcResult<{ totalGroups: number; totalMembers: number }>>
  }
  system: {
    getInfo(): Promise<IpcResult<SystemInfoResponse>>
  }
}

