import { ipcMain, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { IPC_CHANNELS } from '@shared/ipc-contracts'
import {
  VocabSearchFilterSchema,
  VocabGetByIdRequestSchema,
  HanziGetDetailsRequestSchema,
  HanziGetStrokeDataRequestSchema,
  ProgressGetRequestSchema,
  ProgressSubmitReviewQuerySchema,
  GetDueVocabRequestSchema,
  NotebookCreateRequestSchema,
  NotebookUpdateRequestSchema,
  NotebookToggleItemRequestSchema,
  StatsSummaryRequestSchema,
  WrongWordsFilterSchema,
  SynonymGetByVocabIdRequestSchema,
  SynonymGetByRootGlossRequestSchema,
  SynonymListGroupsRequestSchema,
  SynonymUpdateNuanceRequestSchema,
  SynonymRecallSubmitRequestSchema,
  HanziStrokeData,
  VocabSearchResult,
  VocabWithProgress,
  HanziDetailsResponse,
  SubmitReviewResponse,
  Notebook,
  NotebookToggleItemResponse,
  StatsSummaryResponse,
  SystemInfoResponse,
  UserVocabProgress,
  SynonymMapDTO,
  SynonymListGroupsResponse,
  SynonymRecallSubmitResponse
} from '@shared/schemas'
import { createSafeIpcHandler, checkSafeStorageStatus } from './security'
import { checkDatabaseConnection, withTransaction } from './database/pool'
import { calculateNextReview } from '@shared/srs'
import {
  MySqlVocabRepository,
  MySqlHanziRepository,
  MySqlProgressRepository,
  MySqlNotebookRepository,
  MySqlSynonymRepository
} from './database/repositories'
import { BuildSynonymGroupsUseCase } from './modules/synonym-map/synonym-builder.use-case'
import { convertRecallToSrsRatings } from './modules/synonym-map/gloss-normalizer'

// Khởi tạo các Repository thực thi nghiệp vụ
const vocabRepo = new MySqlVocabRepository()
const hanziRepo = new MySqlHanziRepository()
const progressRepo = new MySqlProgressRepository()
const notebookRepo = new MySqlNotebookRepository()
const synonymRepo = new MySqlSynonymRepository()

/**
 * Đọc dữ liệu nét viết Offline từ gói hanzi-writer-data cài đặt cục bộ (không dùng CDN)
 */
async function getOfflineStrokeData(char: string): Promise<HanziStrokeData | null> {
  try {
    if (!char || char.length === 0) return null

    // Lấy ký tự đầu tiên
    const targetChar = Array.from(char)[0]

    // Đường dẫn trong node_modules hoặc packaged resources
    const possiblePaths = [
      path.join(app.getAppPath(), 'node_modules', 'hanzi-writer-data', `${targetChar}.json`),
      path.join(process.cwd(), 'node_modules', 'hanzi-writer-data', `${targetChar}.json`)
    ]

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        const rawContent = await fs.promises.readFile(filePath, 'utf-8')
        return JSON.parse(rawContent) as HanziStrokeData
      }
    }

    try {
      const resolved = require.resolve(`hanzi-writer-data/${targetChar}.json`)
      if (fs.existsSync(resolved)) {
        const rawContent = await fs.promises.readFile(resolved, 'utf-8')
        return JSON.parse(rawContent) as HanziStrokeData
      }
    } catch {
      // Bỏ qua nếu require.resolve không tìm thấy
    }

    return null
  } catch (err) {
    console.error(`[HanziWriter] Không thể nạp dữ liệu nét viết cho chữ "${char}":`, err)
    return null
  }
}

/**
 * Đăng ký tất cả các IPC Handlers liên kết trực tiếp với Database Repository
 */
export function registerIpcHandlers(): void {
  // 1. Tìm kiếm từ vựng (HSK 1-6, Bộ lọc, Sổ tay)
  ipcMain.handle(
    IPC_CHANNELS.VOCAB_SEARCH,
    createSafeIpcHandler(VocabSearchFilterSchema, async (filter): Promise<VocabSearchResult> => {
      return await vocabRepo.search(filter)
    })
  )

  // 2. Lấy chi tiết từ vựng theo ID
  ipcMain.handle(
    IPC_CHANNELS.VOCAB_GET_BY_ID,
    createSafeIpcHandler(VocabGetByIdRequestSchema, async (req): Promise<VocabWithProgress | null> => {
      return await vocabRepo.getById(req.id)
    })
  )

  // 3. Lấy thông tin chiết tự & chữ Hán đơn
  ipcMain.handle(
    IPC_CHANNELS.HANZI_GET_DETAILS,
    createSafeIpcHandler(HanziGetDetailsRequestSchema, async (req): Promise<HanziDetailsResponse> => {
      return await hanziRepo.getDetails(req.char)
    })
  )

  // 4. Lấy dữ liệu nét viết Offline 100%
  ipcMain.handle(
    IPC_CHANNELS.HANZI_GET_STROKE_DATA,
    createSafeIpcHandler(HanziGetStrokeDataRequestSchema, async (req): Promise<HanziStrokeData | null> => {
      return await getOfflineStrokeData(req.char)
    })
  )

  // 5. Lấy tiến độ SRS của từ vựng
  ipcMain.handle(
    IPC_CHANNELS.PROGRESS_GET,
    createSafeIpcHandler(ProgressGetRequestSchema, async (req): Promise<UserVocabProgress | null> => {
      return await progressRepo.get(req.vocab_id)
    })
  )

  // 6. Gửi kết quả ôn tập (Submit Review) bên trong một Database Transaction
  ipcMain.handle(
    IPC_CHANNELS.PROGRESS_SUBMIT_REVIEW,
    createSafeIpcHandler(ProgressSubmitReviewQuerySchema, async (req): Promise<SubmitReviewResponse> => {
      return await withTransaction(async (conn) => {
        // Lấy tiến độ hiện tại hoặc tạo mới
        const currentProgress = await progressRepo.get(req.vocab_id)
        const nowDate = new Date()
        const now = nowDate.toISOString()

        // Tính toán thông số SRS chuẩn SM-2 hoặc FSRS-4.5
        const algorithm = currentProgress?.algorithm || 'sm2'
        const srsCalculation = calculateNextReview(
          currentProgress,
          req.srs_rating as 1 | 2 | 3 | 4,
          algorithm,
          nowDate
        )

        const isCorrect = req.is_correct
        const wrongCount = (currentProgress?.wrong_count || 0) + (isCorrect ? 0 : 1)
        const correctCount = (currentProgress?.correct_count || 0) + (isCorrect ? 1 : 0)

        const updatedProgress: UserVocabProgress = {
          vocab_id: req.vocab_id,
          state: srsCalculation.state,
          algorithm: srsCalculation.algorithm,
          srs_params: srsCalculation.srs_params,
          wrong_count: wrongCount,
          correct_count: correctCount,
          custom_note: currentProgress?.custom_note || null,
          last_reviewed_at: now,
          next_review_at: srsCalculation.next_review_at
        }

        // Lưu tiến độ và nhật ký trong cùng transaction
        await progressRepo.upsert(updatedProgress, conn)
        const logId = await progressRepo.logReview(
          {
            vocab_id: req.vocab_id,
            review_mode: req.review_mode,
            user_input: req.user_input,
            is_correct: req.is_correct,
            srs_rating: req.srs_rating as 1 | 2 | 3 | 4,
            response_time_ms: req.response_time_ms,
            reviewed_at: now
          },
          conn
        )

        return {
          progress: updatedProgress,
          review_log: {
            id: logId,
            vocab_id: req.vocab_id,
            review_mode: req.review_mode,
            user_input: req.user_input,
            is_correct: req.is_correct,
            srs_rating: req.srs_rating as 1 | 2 | 3 | 4,
            response_time_ms: req.response_time_ms,
            reviewed_at: now
          }
        }
      })
    })
  )

  // 7. Lấy danh sách từ cần ôn (Due Vocabs)
  ipcMain.handle(
    IPC_CHANNELS.PROGRESS_GET_DUE,
    createSafeIpcHandler(GetDueVocabRequestSchema, async (req): Promise<VocabWithProgress[]> => {
      return await vocabRepo.getDueWords(req)
    })
  )

  // 8. Sổ tay từ vựng (Notebooks)
  ipcMain.handle(
    IPC_CHANNELS.NOTEBOOK_LIST,
    createSafeIpcHandler(null, async (): Promise<Notebook[]> => {
      return await notebookRepo.list()
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTEBOOK_CREATE,
    createSafeIpcHandler(NotebookCreateRequestSchema, async (req): Promise<Notebook> => {
      return await notebookRepo.create(req)
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTEBOOK_UPDATE,
    createSafeIpcHandler(NotebookUpdateRequestSchema, async (req): Promise<Notebook> => {
      return await notebookRepo.update(req)
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTEBOOK_DELETE,
    createSafeIpcHandler(VocabGetByIdRequestSchema, async (req): Promise<boolean> => {
      return await notebookRepo.delete(req.id)
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.NOTEBOOK_TOGGLE_ITEM,
    createSafeIpcHandler(
      NotebookToggleItemRequestSchema,
      async (req): Promise<NotebookToggleItemResponse> => {
        return await notebookRepo.toggleItem(req)
      }
    )
  )

  // 9. Thống kê & Logs
  ipcMain.handle(
    IPC_CHANNELS.STATS_GET_SUMMARY,
    createSafeIpcHandler(StatsSummaryRequestSchema, async (req): Promise<StatsSummaryResponse> => {
      return await progressRepo.getStatsSummary(req.timezone_offset_minutes ?? 420)
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.STATS_GET_WRONG_WORDS,
    createSafeIpcHandler(WrongWordsFilterSchema, async (filter): Promise<VocabWithProgress[]> => {
      return await vocabRepo.getWrongWords(filter)
    })
  )

  // 10. Phân hệ Sơ đồ Từ đồng nghĩa (Synonym Map & Recall - Giai đoạn 5)
  ipcMain.handle(
    IPC_CHANNELS.SYNONYM_GET_BY_VOCAB_ID,
    createSafeIpcHandler(
      SynonymGetByVocabIdRequestSchema,
      async (req): Promise<SynonymMapDTO[]> => {
        return await synonymRepo.getByVocabId(req.vocabId)
      }
    )
  )

  ipcMain.handle(
    IPC_CHANNELS.SYNONYM_GET_BY_ROOT_GLOSS,
    createSafeIpcHandler(
      SynonymGetByRootGlossRequestSchema,
      async (req): Promise<SynonymMapDTO | null> => {
        return await synonymRepo.getByRootGloss(req.rootGloss)
      }
    )
  )

  ipcMain.handle(
    IPC_CHANNELS.SYNONYM_LIST_GROUPS,
    createSafeIpcHandler(
      SynonymListGroupsRequestSchema,
      async (req): Promise<SynonymListGroupsResponse> => {
        return await synonymRepo.listGroups(req)
      }
    )
  )

  ipcMain.handle(
    IPC_CHANNELS.SYNONYM_UPDATE_NUANCE,
    createSafeIpcHandler(
      SynonymUpdateNuanceRequestSchema,
      async (req): Promise<boolean> => {
        await synonymRepo.updateNuance(req)
        return true
      }
    )
  )

  ipcMain.handle(
    IPC_CHANNELS.SYNONYM_RECALL_SUBMIT,
    createSafeIpcHandler(
      SynonymRecallSubmitRequestSchema,
      async (req): Promise<SynonymRecallSubmitResponse> => {
        const { ratio, items } = convertRecallToSrsRatings(req.results)

        // Ghi nhận lịch sử từng từ vào review_logs và cập nhật user_vocab_progress
        await withTransaction(async (conn) => {
          const nowDate = new Date()
          const nowIso = nowDate.toISOString()

          for (const item of items) {
            // 1. Ghi log review_mode = 'synonym_recall'
            await progressRepo.logReview(
              {
                vocab_id: item.vocab_id,
                review_mode: 'synonym_recall',
                is_correct: item.is_correct,
                srs_rating: item.srs_rating,
                response_time_ms: 0,
                reviewed_at: nowIso
              },
              conn
            )

            // 2. Cập nhật tiến độ SRS
            const currentProgress = await progressRepo.get(item.vocab_id)
            const algorithm = currentProgress?.algorithm || 'sm2'
            const srsCalc = calculateNextReview(
              currentProgress,
              item.srs_rating,
              algorithm,
              nowDate
            )

            const wrongCount = (currentProgress?.wrong_count || 0) + (item.is_correct ? 0 : 1)
            const correctCount = (currentProgress?.correct_count || 0) + (item.is_correct ? 1 : 0)

            const updatedProgress: UserVocabProgress = {
              vocab_id: item.vocab_id,
              state: srsCalc.state,
              algorithm: srsCalc.algorithm,
              srs_params: srsCalc.srs_params,
              wrong_count: wrongCount,
              correct_count: correctCount,
              custom_note: currentProgress?.custom_note || null,
              last_reviewed_at: nowIso,
              next_review_at: srsCalc.next_review_at
            }

            await progressRepo.upsert(updatedProgress, conn)
          }
        })

        return {
          ratio,
          items
        }
      }
    )
  )

  ipcMain.handle(
    IPC_CHANNELS.SYNONYM_BUILD_GROUPS,
    createSafeIpcHandler(
      null,
      async (): Promise<{ totalGroups: number; totalMembers: number }> => {
        const useCase = new BuildSynonymGroupsUseCase(null, synonymRepo)
        const res = await useCase.execute()
        return {
          totalGroups: res.totalGroups,
          totalMembers: res.totalMembers
        }
      }
    )
  )

  // 11. Thông tin hệ thống & Trạng thái Database
  ipcMain.handle(
    IPC_CHANNELS.SYSTEM_GET_INFO,
    createSafeIpcHandler(null, async (): Promise<SystemInfoResponse> => {
      const storageStatus = checkSafeStorageStatus()
      const dbConnected = await checkDatabaseConnection()

      return {
        platform: process.platform,
        app_version: app.getVersion(),
        node_version: process.versions.node,
        chrome_version: process.versions.chrome,
        electron_version: process.versions.electron,
        encryption_available: storageStatus.encryptionAvailable,
        storage_backend: storageStatus.backend,
        db_connected: dbConnected
      }
    })
  )
}
