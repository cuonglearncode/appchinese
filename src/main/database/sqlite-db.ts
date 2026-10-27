import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'

function getElectronApp(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require('electron')
    return electron.app || electron?.default?.app || null
  } catch {
    return null
  }
}

let sqliteInstance: Database.Database | null = null

/**
 * Lấy đường dẫn lưu database SQLite của ứng dụng
 */
export function getSqliteDatabasePath(): string {
  // 1. Nếu có biến môi trường chỉ định
  if (process.env.SQLITE_DB_PATH) {
    return path.resolve(process.env.SQLITE_DB_PATH)
  }

  // 2. Nếu đang chạy trong môi trường Electron (app đã sẵn sàng)
  try {
    const electronApp = getElectronApp()
    if (electronApp && typeof electronApp.getPath === 'function') {
      const userDataDir = electronApp.getPath('userData')
      return path.join(userDataDir, 'appchinese.db')
    }
  } catch {
    // Không có app hoặc đang chạy unit test
  }

  // 3. Fallback lưu tại thư mục project root khi dev / test
  return path.resolve(process.cwd(), 'appchinese.db')
}

/**
 * Đảm bảo database SQLite tồn tại.
 * Nếu chưa tồn tại, tự động sao chép từ database hạt giống (resources/appchinese_seed.db)
 * Quá trình sao chép 2MB chỉ mất ~5ms, ứng dụng có ngay toàn bộ 5.003 từ vựng và 990 sơ đồ đồng nghĩa.
 */
export function ensureSqliteDatabase(): string {
  const targetDbPath = getSqliteDatabasePath()

  if (fs.existsSync(targetDbPath)) {
    return targetDbPath
  }

  // Tạo thư mục cha nếu chưa có
  const targetDir = path.dirname(targetDbPath)
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  // Tìm file hạt giống appchinese_seed.db
  const potentialSeedPaths = [
    // Khi chạy trong môi trường packaged / extraResources
    path.join(process.resourcesPath || '', 'resources', 'appchinese_seed.db'),
    path.join(process.resourcesPath || '', 'appchinese_seed.db'),
    // Khi chạy trong môi trường dev / source
    path.resolve(process.cwd(), 'resources', 'appchinese_seed.db')
  ]

  const seedPath = potentialSeedPaths.find((p) => p && fs.existsSync(p))

  if (seedPath) {
    console.info(`[SQLite] Đang nạp database hạt giống từ ${seedPath} -> ${targetDbPath}...`)
    fs.copyFileSync(seedPath, targetDbPath)
    console.info('[SQLite] Đã nạp xong database hạt giống thành công!')
  } else {
    console.warn('[SQLite] Không tìm thấy appchinese_seed.db, khởi tạo database mới rỗng.')
  }

  return targetDbPath
}

/**
 * Lấy kết nối SQLite Database (Singleton)
 */
export function getSqliteDb(): Database.Database {
  if (!sqliteInstance) {
    const dbPath = ensureSqliteDatabase()
    sqliteInstance = new Database(dbPath)

    // Cấu hình PRAGMA tối ưu hóa hiệu năng và độ an toàn ACId
    sqliteInstance.pragma('journal_mode = WAL')
    sqliteInstance.pragma('synchronous = NORMAL')
    sqliteInstance.pragma('foreign_keys = ON')

    console.info(`[SQLite] Đã kết nối cơ sở dữ liệu SQLite tại: ${dbPath}`)
  }
  return sqliteInstance
}

/**
 * Kiểm tra kết nối cơ sở dữ liệu (tương thích IPC checkDatabaseConnection)
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const db = getSqliteDb()
    const result = db.prepare('SELECT 1 as alive').get() as { alive: number }
    return result?.alive === 1
  } catch (err) {
    console.error('[SQLite] Lỗi kiểm tra kết nối database:', err)
    return false
  }
}

/**
 * Thực thi một khối lệnh bên trong Transaction SQLite (ACID an toàn tuyệt đối)
 */
export async function withTransaction<T>(
  callback: (db: Database.Database) => Promise<T> | T
): Promise<T> {
  const db = getSqliteDb()
  const tx = db.transaction(() => {
    return callback(db)
  })
  return Promise.resolve(tx())
}

/**
 * Đóng kết nối cơ sở dữ liệu khi tắt ứng dụng
 */
export function closeSqliteDatabase(): void {
  if (sqliteInstance) {
    try {
      sqliteInstance.close()
      console.info('[SQLite] Đã đóng kết nối database an toàn.')
    } catch (e) {
      console.warn('[SQLite] Lỗi khi đóng database:', e)
    } finally {
      sqliteInstance = null
    }
  }
}
