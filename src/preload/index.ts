import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, ElectronAPI } from '@shared/ipc-contracts'
import {
  VocabSearchFilter,
  SubmitReviewRequest,
  GetDueVocabRequest,
  NotebookCreateRequest,
  NotebookUpdateRequest,
  NotebookToggleItemRequest,
  WrongWordsFilter
} from '@shared/schemas'

const api: ElectronAPI = {
  vocab: {
    search: (filter: VocabSearchFilter) => ipcRenderer.invoke(IPC_CHANNELS.VOCAB_SEARCH, filter),
    getById: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.VOCAB_GET_BY_ID, { id })
  },
  hanzi: {
    getDetails: (char: string) => ipcRenderer.invoke(IPC_CHANNELS.HANZI_GET_DETAILS, { char }),
    getStrokeData: (char: string) => ipcRenderer.invoke(IPC_CHANNELS.HANZI_GET_STROKE_DATA, { char })
  },
  progress: {
    get: (vocabId: number) => ipcRenderer.invoke(IPC_CHANNELS.PROGRESS_GET, { vocab_id: vocabId }),
    submitReview: (req: SubmitReviewRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROGRESS_SUBMIT_REVIEW, req),
    getDue: (req: GetDueVocabRequest) => ipcRenderer.invoke(IPC_CHANNELS.PROGRESS_GET_DUE, req)
  },
  notebook: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.NOTEBOOK_LIST),
    create: (req: NotebookCreateRequest) => ipcRenderer.invoke(IPC_CHANNELS.NOTEBOOK_CREATE, req),
    update: (req: NotebookUpdateRequest) => ipcRenderer.invoke(IPC_CHANNELS.NOTEBOOK_UPDATE, req),
    delete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.NOTEBOOK_DELETE, { id }),
    toggleItem: (req: NotebookToggleItemRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTEBOOK_TOGGLE_ITEM, req)
  },
  stats: {
    getSummary: (timezoneOffsetMinutes?: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.STATS_GET_SUMMARY, {
        timezone_offset_minutes: timezoneOffsetMinutes ?? 420
      }),
    getWrongWords: (filter: WrongWordsFilter) =>
      ipcRenderer.invoke(IPC_CHANNELS.STATS_GET_WRONG_WORDS, filter)
  },
  synonym: {
    getByVocabId: (vocabId: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.SYNONYM_GET_BY_VOCAB_ID, { vocabId }),
    getByRootGloss: (rootGloss: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SYNONYM_GET_BY_ROOT_GLOSS, { rootGloss }),
    listGroups: (req) =>
      ipcRenderer.invoke(IPC_CHANNELS.SYNONYM_LIST_GROUPS, req),
    updateNuance: (req) =>
      ipcRenderer.invoke(IPC_CHANNELS.SYNONYM_UPDATE_NUANCE, req),
    submitRecallResult: (req) =>
      ipcRenderer.invoke(IPC_CHANNELS.SYNONYM_RECALL_SUBMIT, req),
    buildGroups: () =>
      ipcRenderer.invoke(IPC_CHANNELS.SYNONYM_BUILD_GROUPS)
  },
  system: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_INFO)
  }
}

// Phơi bày API an toàn vào window.api của Renderer
try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  // Fallback khi contextIsolation không bật
  // @ts-expect-error fallback gán trực tiếp vào window
  window.api = api
}
