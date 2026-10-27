import { ElectronAPI, IPC_CHANNELS } from '@shared/ipc-contracts'

async function callIpc<T>(channel: string, payload?: unknown): Promise<T> {
  const res = await fetch('/api/ipc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, payload })
  })

  if (!res.ok) {
    throw new Error(`Lỗi kết nối máy chủ (${res.status}): ${res.statusText}`)
  }

  const result = await res.json()
  return result as T
}

/**
 * Tự động gắn window.api khi người dùng mở ứng dụng bằng trình duyệt web (Cốc Cốc, Chrome)
 * mà không chạy bên trong cửa sổ Electron.
 */
export function initBrowserApi(): void {
  if (typeof window === 'undefined') return

  if (!window.api) {
    console.info('[AppChinese] Đã kích hoạt Browser API Bridge (Hỗ trợ Cốc Cốc / Chrome trực tiếp)')

    const browserApi: ElectronAPI = {
      vocab: {
        search: (filter) => callIpc(IPC_CHANNELS.VOCAB_SEARCH, filter),
        getById: (id) => callIpc(IPC_CHANNELS.VOCAB_GET_BY_ID, { id })
      },
      hanzi: {
        getDetails: (char) => callIpc(IPC_CHANNELS.HANZI_GET_DETAILS, { char }),
        getStrokeData: (char) => callIpc(IPC_CHANNELS.HANZI_GET_STROKE_DATA, { char })
      },
      progress: {
        get: (vocabId) => callIpc(IPC_CHANNELS.PROGRESS_GET, { vocab_id: vocabId }),
        submitReview: (req) => callIpc(IPC_CHANNELS.PROGRESS_SUBMIT_REVIEW, req),
        getDue: (req) => callIpc(IPC_CHANNELS.PROGRESS_GET_DUE, req)
      },
      notebook: {
        list: () => callIpc(IPC_CHANNELS.NOTEBOOK_LIST),
        create: (req) => callIpc(IPC_CHANNELS.NOTEBOOK_CREATE, req),
        update: (req) => callIpc(IPC_CHANNELS.NOTEBOOK_UPDATE, req),
        delete: (id) => callIpc(IPC_CHANNELS.NOTEBOOK_DELETE, { id }),
        toggleItem: (req) => callIpc(IPC_CHANNELS.NOTEBOOK_TOGGLE_ITEM, req)
      },
      stats: {
        getSummary: (tz) =>
          callIpc(IPC_CHANNELS.STATS_GET_SUMMARY, { timezone_offset_minutes: tz ?? 420 }),
        getWrongWords: (filter) => callIpc(IPC_CHANNELS.STATS_GET_WRONG_WORDS, filter)
      },
      synonym: {
        getByVocabId: (vocabId) =>
          callIpc(IPC_CHANNELS.SYNONYM_GET_BY_VOCAB_ID, { vocabId }),
        getByRootGloss: (rootGloss) =>
          callIpc(IPC_CHANNELS.SYNONYM_GET_BY_ROOT_GLOSS, { rootGloss }),
        listGroups: (req) => callIpc(IPC_CHANNELS.SYNONYM_LIST_GROUPS, req),
        updateNuance: (req) => callIpc(IPC_CHANNELS.SYNONYM_UPDATE_NUANCE, req),
        submitRecallResult: (req) =>
          callIpc(IPC_CHANNELS.SYNONYM_RECALL_SUBMIT, req),
        buildGroups: () => callIpc(IPC_CHANNELS.SYNONYM_BUILD_GROUPS)
      },
      system: {
        getInfo: () => callIpc(IPC_CHANNELS.SYSTEM_GET_INFO)
      }
    }

    window.api = browserApi
  }
}
