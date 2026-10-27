import mysql from 'mysql2/promise'
import * as fs from 'fs'

let pool: mysql.Pool | null = null

export interface DatabaseConfig {
  host?: string
  port?: number
  user?: string
  password?: string
  database?: string
  socketPath?: string
  connectionLimit?: number
}

/**
 * Lấy cấu hình kết nối MySQL từ môi trường hoặc giá trị mặc định
 */
export function getDatabaseConfig(): DatabaseConfig {
  // Danh sách các đường dẫn socket MySQL chuẩn trên hệ điều hành Linux
  const linuxStandardSockets = [
    '/var/run/mysqld/mysqld.sock',
    '/run/mysqld/mysqld.sock',
    '/tmp/mysql.sock'
  ]
  const detectedSocket = linuxStandardSockets.find((sockPath) => {
    try {
      return fs.existsSync(sockPath) && fs.statSync(sockPath).isSocket()
    } catch {
      return false
    }
  })

  const config: DatabaseConfig = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'appchinese',
    connectionLimit: Number(process.env.DB_POOL_SIZE) || 10
  }

  const customSocket = process.env.DB_SOCKET

  // 1. Nếu người dùng chỉ định rõ DB_SOCKET
  if (customSocket) {
    config.socketPath = customSocket
  }
  // 2. Nếu người dùng chỉ định rõ DB_HOST
  else if (process.env.DB_HOST) {
    config.host = process.env.DB_HOST
    config.port = Number(process.env.DB_PORT) || 3306
  }
  // 3. Nếu tìm thấy socket chuẩn của Linux (Ubuntu/Debian: /var/run/mysqld/mysqld.sock)
  else if (detectedSocket) {
    config.socketPath = detectedSocket
  }
  // 4. Mặc định kết nối TCP 127.0.0.1:3306
  else {
    config.host = '127.0.0.1'
    config.port = Number(process.env.DB_PORT) || 3306
  }

  return config
}

/**
 * Đảm bảo Database đích tồn tại trước khi khởi tạo Pool
 */
export async function ensureDatabaseExists(): Promise<void> {
  const config = getDatabaseConfig()
  const targetDb = config.database || 'appchinese'
  const { database, ...connectConfig } = config

  try {
    const conn = await mysql.createConnection({
      ...connectConfig,
      timezone: 'Z'
    })
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${targetDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    )
    await conn.end()
    console.info(`[Database] Đã đảm bảo database "${targetDb}" sẵn sàng.`)
  } catch (err) {
    console.warn(`[Database] Không thể tự động tạo database "${targetDb}":`, (err as any)?.message || err)
  }
}

/**
 * Khởi tạo hoặc lấy Connection Pool MySQL (Singleton)
 * Tuân thủ bảo mật: multipleStatements: false, timezone: 'Z' (UTC)
 */
export function getPool(): mysql.Pool {
  if (!pool) {
    const config = getDatabaseConfig()
    const poolConfig: mysql.PoolOptions = {
      ...config,
      waitForConnections: true,
      queueLimit: 0,
      multipleStatements: false,
      timezone: 'Z',
      dateStrings: false
    }

    pool = mysql.createPool(poolConfig)
    console.info(
      `[Database Pool] Đã khởi tạo MySQL Pool kết nối tới database "${config.database}" qua ${
        config.socketPath ? `socket "${config.socketPath}"` : `TCP "${config.host}:${config.port}"`
      }`
    )
  }
  return pool
}

import {
  checkDatabaseConnection as checkSqliteConnection,
  withTransaction as withSqliteTransaction,
  closeSqliteDatabase
} from './sqlite-db'

/**
 * Đóng kết nối Pool khi ứng dụng tắt
 */
export async function closePool(): Promise<void> {
  closeSqliteDatabase()
  if (pool) {
    await pool.end()
    pool = null
    console.info('[Database Pool] Đã giải phóng kết nối Pool.')
  }
}

/**
 * Kiểm tra trạng thái sẵn sàng của Database (SQLite)
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  return checkSqliteConnection()
}

/**
 * Helper thực thi Transaction an toàn với SQLite
 */
export async function withTransaction<T>(
  callback: (conn?: any) => Promise<T>
): Promise<T> {
  return withSqliteTransaction(async (db) => {
    return callback(db)
  })
}

