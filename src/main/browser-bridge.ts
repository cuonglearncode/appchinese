import * as fs from 'fs'
import * as path from 'path'
import { IPC_CHANNELS } from '../shared/ipc-contracts'
import {
  SqliteVocabRepository,
  SqliteHanziRepository,
  SqliteProgressRepository,
  SqliteNotebookRepository,
  SqliteSynonymRepository
} from './database/repositories'
import { withTransaction } from './database/pool'
import { calculateNextReview } from '../shared/srs'
import { convertRecallToSrsRatings } from './modules/synonym-map/gloss-normalizer'
import { BuildSynonymGroupsUseCase } from './modules/synonym-map/synonym-builder.use-case'
import { UserVocabProgress, HanziStrokeData } from '../shared/schemas'

const vocabRepo = new SqliteVocabRepository()
const hanziRepo = new SqliteHanziRepository()
const progressRepo = new SqliteProgressRepository()
const notebookRepo = new SqliteNotebookRepository()
const synonymRepo = new SqliteSynonymRepository()

async function getOfflineStrokeData(char: string): Promise<HanziStrokeData | null> {
  try {
    if (!char || char.length === 0) return null
    const targetChar = Array.from(char)[0]
    const possiblePaths = [
      path.join(process.cwd(), 'node_modules', 'hanzi-writer-data', `${targetChar}.json`)
    ]

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        const rawContent = await fs.promises.readFile(filePath, 'utf-8')
        return JSON.parse(rawContent) as HanziStrokeData
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Xử lý các lệnh gọi IPC từ trình duyệt web (Cốc Cốc, Chrome) thông qua Vite dev middleware
 */
export async function handleBrowserIpc(channel: string, payload: any): Promise<any> {
  if (process.env.USE_TURSO === 'true' || process.env.TURSO_DATABASE_URL) {
    const { handleTursoIpc } = await import('../shared/turso-backend')
    return await handleTursoIpc(channel, payload)
  }

  switch (channel) {
    case IPC_CHANNELS.VOCAB_SEARCH:
      return await vocabRepo.search(payload || {})

    case IPC_CHANNELS.VOCAB_GET_BY_ID:
      return await vocabRepo.getById(payload.id)

    case IPC_CHANNELS.HANZI_GET_DETAILS:
      return await hanziRepo.getDetails(payload.char)

    case IPC_CHANNELS.HANZI_GET_STROKE_DATA:
      return await getOfflineStrokeData(payload.char)

    case IPC_CHANNELS.PROGRESS_GET:
      return await progressRepo.get(payload.vocab_id)

    case IPC_CHANNELS.PROGRESS_SUBMIT_REVIEW: {
      return await withTransaction(async (conn) => {
        const currentProgress = await progressRepo.get(payload.vocab_id)
        const nowDate = new Date()
        const now = nowDate.toISOString()
        const algorithm = currentProgress?.algorithm || 'sm2'
        const srsCalculation = calculateNextReview(
          currentProgress,
          payload.srs_rating as 1 | 2 | 3 | 4,
          algorithm,
          nowDate
        )

        const isCorrect = payload.is_correct
        const wrongCount = (currentProgress?.wrong_count || 0) + (isCorrect ? 0 : 1)
        const correctCount = (currentProgress?.correct_count || 0) + (isCorrect ? 1 : 0)

        const updatedProgress: UserVocabProgress = {
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

        await progressRepo.upsert(updatedProgress, conn)
        const logId = await progressRepo.logReview(
          {
            vocab_id: payload.vocab_id,
            review_mode: payload.review_mode,
            user_input: payload.user_input,
            is_correct: payload.is_correct,
            srs_rating: payload.srs_rating as 1 | 2 | 3 | 4,
            response_time_ms: payload.response_time_ms,
            reviewed_at: now
          },
          conn
        )

        return {
          progress: updatedProgress,
          review_log: {
            id: logId,
            vocab_id: payload.vocab_id,
            review_mode: payload.review_mode,
            user_input: payload.user_input,
            is_correct: payload.is_correct,
            srs_rating: payload.srs_rating as 1 | 2 | 3 | 4,
            response_time_ms: payload.response_time_ms,
            reviewed_at: now
          }
        }
      })
    }

    case IPC_CHANNELS.PROGRESS_GET_DUE:
      return await vocabRepo.getDueWords(payload || {})

    case IPC_CHANNELS.NOTEBOOK_LIST:
      return await notebookRepo.list()

    case IPC_CHANNELS.NOTEBOOK_CREATE:
      return await notebookRepo.create(payload)

    case IPC_CHANNELS.NOTEBOOK_UPDATE:
      return await notebookRepo.update(payload)

    case IPC_CHANNELS.NOTEBOOK_DELETE:
      return await notebookRepo.delete(payload.id)

    case IPC_CHANNELS.NOTEBOOK_TOGGLE_ITEM:
      return await notebookRepo.toggleItem(payload)

    case IPC_CHANNELS.STATS_GET_SUMMARY:
      return await progressRepo.getStatsSummary(payload?.timezone_offset_minutes ?? 420)

    case IPC_CHANNELS.STATS_GET_WRONG_WORDS:
      return await vocabRepo.getWrongWords(payload || {})

    case IPC_CHANNELS.SYNONYM_GET_BY_VOCAB_ID:
      return await synonymRepo.getByVocabId(payload.vocabId)

    case IPC_CHANNELS.SYNONYM_GET_BY_ROOT_GLOSS:
      return await synonymRepo.getByRootGloss(payload.rootGloss)

    case IPC_CHANNELS.SYNONYM_LIST_GROUPS:
      return await synonymRepo.listGroups(payload || {})

    case IPC_CHANNELS.SYNONYM_UPDATE_NUANCE:
      return await synonymRepo.updateNuance(payload)

    case IPC_CHANNELS.SYNONYM_RECALL_SUBMIT: {
      const { ratio, items } = convertRecallToSrsRatings(payload.results)
      await withTransaction(async (conn) => {
        const nowDate = new Date()
        const nowIso = nowDate.toISOString()

        for (const item of items) {
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

    case IPC_CHANNELS.SYNONYM_BUILD_GROUPS: {
      const useCase = new BuildSynonymGroupsUseCase(null, synonymRepo)
      const res = await useCase.execute()
      return {
        totalGroups: res.totalGroups,
        totalMembers: res.totalMembers
      }
    }

    case IPC_CHANNELS.SYSTEM_GET_INFO:
      return {
        app_version: '1.0.0',
        db_type: 'sqlite',
        encryption_backend: 'browser_dev',
        total_vocab: 5003
      }

    default:
      throw new Error(`Kênh IPC không được hỗ trợ trong Browser Bridge: ${channel}`)
  }
}
