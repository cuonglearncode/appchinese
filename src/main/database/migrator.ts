import * as fs from 'fs'
import * as path from 'path'
import { Pool, PoolConnection } from 'mysql2/promise'

export interface Migration {
  name: string
  up: (conn: PoolConnection) => Promise<void>
}

/**
 * Danh sách toàn bộ Migrations đã chuẩn hóa của hệ thống
 */
export const migrations: Migration[] = [
  {
    name: '001_normalize_hsk_vocabulary',
    up: async (conn: PoolConnection): Promise<void> => {
      // 1. Kiểm tra xem bảng hsk_vocabulary đã tồn tại chưa
      const [tableRows] = await conn.query<any[]>(
        "SHOW TABLES LIKE 'hsk_vocabulary';"
      )
      if (tableRows.length === 0) {
        console.warn('[Migration 001] Bảng hsk_vocabulary chưa tồn tại, bỏ qua chuẩn hóa.')
        return
      }

      // 2. Lấy thông tin các cột hiện tại
      const [columnRows] = await conn.query<any[]>('DESCRIBE `hsk_vocabulary`;')
      const columnNames = columnRows.map((r: any) => r.Field.toLowerCase())

      // 3. Chuẩn hóa cột word sang utf8mb4_bin
      await conn.query(
        "ALTER TABLE `hsk_vocabulary` MODIFY COLUMN `word` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT 'Từ mới (Chữ Hán)';"
      )

      // 4. Thêm cột standard_version nếu chưa có
      if (!columnNames.includes('standard_version')) {
        await conn.query(
          "ALTER TABLE `hsk_vocabulary` ADD COLUMN `standard_version` VARCHAR(16) NOT NULL DEFAULT 'HSK2.0' AFTER `id`;"
        )
      }

      // 5. Đổi tên cột meaning thành meaning_vi nếu chưa đổi
      if (columnNames.includes('meaning') && !columnNames.includes('meaning_vi')) {
        await conn.query(
          "ALTER TABLE `hsk_vocabulary` CHANGE COLUMN `meaning` `meaning_vi` VARCHAR(512) NOT NULL COMMENT 'Giải thích nghĩa tiếng Việt';"
        )
      }

      // 6. Thêm UNIQUE KEY uk_vocab_entry (standard_version, hsk_level, word, pinyin)
      const [indexRows] = await conn.query<any[]>(
        "SHOW INDEX FROM `hsk_vocabulary` WHERE Key_name = 'uk_vocab_entry';"
      )
      if (indexRows.length === 0) {
        await conn.query(
          'ALTER TABLE `hsk_vocabulary` ADD UNIQUE KEY `uk_vocab_entry` (`standard_version`, `hsk_level`, `word`, `pinyin`);'
        )
      }
    }
  },
  {
    name: '002_create_extension_tables',
    up: async (conn: PoolConnection): Promise<void> => {
      // 1. Bảng dữ liệu chữ Hán đơn
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`hanzi_characters\` (
          \`char\` CHAR(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
          \`radical\` VARCHAR(16) NOT NULL COMMENT 'Bộ thủ',
          \`stroke_count\` TINYINT UNSIGNED NOT NULL COMMENT 'Tổng số nét',
          \`sino_vietnamese\` VARCHAR(128) DEFAULT NULL COMMENT 'Âm Hán Việt',
          \`decomposition\` VARCHAR(128) DEFAULT NULL COMMENT 'Cấu trúc chiết tự IDS (VD: ⿰亻尔)',
          \`etymology_hint\` TEXT DEFAULT NULL COMMENT 'Giải nghĩa nguồn gốc / Mẹo nhớ',
          PRIMARY KEY (\`char\`),
          INDEX \`idx_radical\` (\`radical\`),
          INDEX \`idx_stroke\` (\`stroke_count\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `)

      // 2. Bảng tiến độ học tập (Hỗ trợ cả SM-2 và FSRS qua JSON)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`user_vocab_progress\` (
          \`vocab_id\` INT UNSIGNED NOT NULL,
          \`state\` VARCHAR(20) NOT NULL DEFAULT 'new' COMMENT 'new | learning | review | relearning',
          \`algorithm\` VARCHAR(16) NOT NULL DEFAULT 'sm2' COMMENT 'sm2 | fsrs',
          \`srs_params\` JSON NOT NULL COMMENT 'SM2: {efactor, interval, reps} | FSRS: {stability, difficulty, lapses}',
          \`wrong_count\` INT UNSIGNED NOT NULL DEFAULT 0,
          \`correct_count\` INT UNSIGNED NOT NULL DEFAULT 0,
          \`custom_note\` TEXT DEFAULT NULL,
          \`last_reviewed_at\` DATETIME DEFAULT NULL COMMENT 'Lưu theo giờ UTC',
          \`next_review_at\` DATETIME DEFAULT NULL COMMENT 'Lưu theo giờ UTC',
          \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`vocab_id\`),
          INDEX \`idx_next_review\` (\`next_review_at\`, \`state\`),
          INDEX \`idx_wrong_count\` (\`wrong_count\` DESC),
          CONSTRAINT \`fk_progress_vocab\` FOREIGN KEY (\`vocab_id\`) REFERENCES \`hsk_vocabulary\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `)

      // 3. Bảng lịch sử từng lượt trả lời
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`review_logs\` (
          \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`vocab_id\` INT UNSIGNED NOT NULL,
          \`review_mode\` VARCHAR(32) NOT NULL COMMENT 'typing | cloze | flashcard | handwriting',
          \`user_input\` VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
          \`is_correct\` TINYINT(1) NOT NULL,
          \`srs_rating\` TINYINT UNSIGNED NOT NULL COMMENT '1: Again, 2: Hard, 3: Good, 4: Easy',
          \`response_time_ms\` INT UNSIGNED DEFAULT 0,
          \`reviewed_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Lưu UTC, quy đổi UTC+7 khi query theo ngày',
          PRIMARY KEY (\`id\`),
          INDEX \`idx_vocab_reviewed\` (\`vocab_id\`, \`reviewed_at\`),
          INDEX \`idx_date_correct\` (\`reviewed_at\`, \`is_correct\`),
          CONSTRAINT \`fk_log_vocab\` FOREIGN KEY (\`vocab_id\`) REFERENCES \`hsk_vocabulary\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `)

      // 4. Bảng Sổ tay từ vựng
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`notebooks\` (
          \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`name\` VARCHAR(128) NOT NULL,
          \`color\` VARCHAR(16) NOT NULL DEFAULT '#3b82f6',
          \`sort_order\` INT NOT NULL DEFAULT 0,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `)

      // 5. Bảng liên kết Notebook Items
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`notebook_items\` (
          \`notebook_id\` INT UNSIGNED NOT NULL,
          \`vocab_id\` INT UNSIGNED NOT NULL,
          \`added_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`notebook_id\`, \`vocab_id\`),
          CONSTRAINT \`fk_nb_item_notebook\` FOREIGN KEY (\`notebook_id\`) REFERENCES \`notebooks\` (\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_nb_item_vocab\` FOREIGN KEY (\`vocab_id\`) REFERENCES \`hsk_vocabulary\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `)
    }
  },
  {
    name: '003_synonym_map',
    up: async (conn: PoolConnection): Promise<void> => {
      // 1. Bảng tách nghĩa đơn từ cột meaning_vi của hsk_vocabulary
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`meaning_glosses\` (
          \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`vocab_id\` INT UNSIGNED NOT NULL,
          \`gloss\` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT 'Nghĩa đã chuẩn hóa NFC, chữ thường, phân biệt dấu tuyệt đối',
          \`gloss_raw\` VARCHAR(128) NOT NULL COMMENT 'Nghĩa gốc trước khi hạ chữ thường',
          \`extracted_note\` VARCHAR(255) DEFAULT NULL COMMENT 'Chú thích trích xuất từ trong ngoặc đơn (nếu có)',
          \`position\` TINYINT UNSIGNED NOT NULL COMMENT 'Thứ tự xuất hiện của nghĩa trong cột meaning (1, 2, 3...)',
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uk_vocab_gloss\` (\`vocab_id\`, \`gloss\`),
          INDEX \`idx_gloss\` (\`gloss\`),
          CONSTRAINT \`fk_gloss_vocab\` FOREIGN KEY (\`vocab_id\`) REFERENCES \`hsk_vocabulary\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `)

      // 2. Bảng nhóm từ đồng nghĩa (Mỗi nghĩa gốc là tâm của 1 sơ đồ nhánh)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`synonym_groups\` (
          \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`root_gloss\` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT 'Nghĩa tiếng Việt làm nút gốc',
          \`root_score\` FLOAT NOT NULL DEFAULT 0 COMMENT 'Điểm chất lượng của nhóm để sắp xếp thứ tự ưu tiên hiển thị',
          \`source\` VARCHAR(16) NOT NULL DEFAULT 'auto' COMMENT 'auto | curated | ai',
          \`status\` VARCHAR(16) NOT NULL DEFAULT 'draft' COMMENT 'draft | approved | hidden',
          \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uk_root_gloss\` (\`root_gloss\`),
          INDEX \`idx_status_score\` (\`status\`, \`root_score\` DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `)

      // 3. Bảng thành viên chữ Hán trong mỗi nhóm đồng nghĩa
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`synonym_group_members\` (
          \`group_id\` INT UNSIGNED NOT NULL,
          \`vocab_id\` INT UNSIGNED NOT NULL,
          \`rank_order\` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Thứ tự nhánh (sắp theo HSK tăng dần)',
          \`register\` VARCHAR(16) NOT NULL DEFAULT 'neutral' COMMENT 'formal | spoken | neutral',
          \`nuance_note\` VARCHAR(255) DEFAULT NULL COMMENT 'Ghi chú sắc thái nghĩa / cách dùng khác biệt',
          PRIMARY KEY (\`group_id\`, \`vocab_id\`),
          INDEX \`idx_member_vocab\` (\`vocab_id\`),
          CONSTRAINT \`fk_syn_member_group\` FOREIGN KEY (\`group_id\`) REFERENCES \`synonym_groups\` (\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_syn_member_vocab\` FOREIGN KEY (\`vocab_id\`) REFERENCES \`hsk_vocabulary\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `)
    }
  }
]

/**
 * Nạp dữ liệu gốc từ file SQL dump nếu bảng hsk_vocabulary chưa có dữ liệu
 */
export async function importSqlDumpIfEmpty(pool: Pool, sqlPath?: string): Promise<boolean> {
  const filePath = sqlPath || path.resolve(process.cwd(), 'hsk_vocabulary_mysql.sql')
  if (!fs.existsSync(filePath)) {
    console.warn(`[Migrator] Không tìm thấy file SQL dump tại: ${filePath}`)
    return false
  }

  const conn = await pool.getConnection()
  try {
    // Kiểm tra bảng hsk_vocabulary
    const [tables] = await conn.query<any[]>("SHOW TABLES LIKE 'hsk_vocabulary';")
    if (tables.length > 0) {
      const [rows] = await conn.query<any[]>('SELECT COUNT(*) as total FROM `hsk_vocabulary`;')
      if (rows[0].total > 0) {
        // Đã có dữ liệu, không cần nạp lại
        return true
      }
    }

    console.info(`[Migrator] Đang nạp 5.003 từ vựng từ ${filePath}...`)
    const sqlContent = await fs.promises.readFile(filePath, 'utf-8')
    
    // Tách các câu lệnh theo dấu ; ở cuối dòng
    const statements = sqlContent
      .split(/;\s*$/m)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'))

    for (const stmt of statements) {
      if (stmt.length > 0) {
        await conn.query(stmt)
      }
    }

    console.info('[Migrator] Nạp SQL dump thành công.')
    return true
  } catch (err) {
    console.error('[Migrator] Lỗi khi nạp SQL dump:', err)
    throw err
  } finally {
    conn.release()
  }
}

/**
 * Chạy hệ thống migrations quản lý phiên bản schema
 */
export async function runMigrations(customPool?: Pool): Promise<void> {
  if (!customPool) {
    // Với SQLite, toàn bộ schema và migrations đã được chuẩn hóa và tự động nạp qua SQLite Database Manager
    return
  }
  const p = customPool
  const conn = await p.getConnection()

  try {
    // 1. Khởi tạo bảng lưu lịch sử migration
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`schema_migrations\` (
        \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`migration_name\` VARCHAR(128) NOT NULL UNIQUE,
        \`applied_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // 2. Lấy danh sách các migrations đã áp dụng
    const [appliedRows] = await conn.query<any[]>(
      'SELECT `migration_name` FROM `schema_migrations`;'
    )
    const appliedNames = new Set(appliedRows.map((r: any) => r.migration_name))

    // 3. Thực thi từng migration chưa áp dụng theo thứ tự
    for (const migration of migrations) {
      if (!appliedNames.has(migration.name)) {
        console.info(`[Migrator] Đang áp dụng migration: ${migration.name}...`)
        await migration.up(conn)
        await conn.execute(
          'INSERT INTO `schema_migrations` (`migration_name`) VALUES (?);',
          [migration.name]
        )
        console.info(`[Migrator] Hoàn tất migration: ${migration.name}`)
      }
    }
  } catch (err) {
    console.error('[Migrator] Lỗi thực thi migration:', err)
    throw err
  } finally {
    conn.release()
  }
}
