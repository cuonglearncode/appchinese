-- =========================================================
-- MIGRATION 003: SYNONYM MAP TABLES
-- Phân hệ Sơ đồ Từ đồng nghĩa (Synonym Map Card & Recall)
-- =========================================================

-- 1. Bảng tách nghĩa đơn từ cột meaning của hsk_vocabulary
CREATE TABLE IF NOT EXISTS `meaning_glosses` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `vocab_id` INT UNSIGNED NOT NULL,
  `gloss` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT 'Nghĩa đã chuẩn hóa NFC, chữ thường, phân biệt dấu tuyệt đối',
  `gloss_raw` VARCHAR(128) NOT NULL COMMENT 'Nghĩa gốc trước khi hạ chữ thường',
  `extracted_note` VARCHAR(255) DEFAULT NULL COMMENT 'Chú thích trích xuất từ trong ngoặc đơn (nếu có)',
  `position` TINYINT UNSIGNED NOT NULL COMMENT 'Thứ tự xuất hiện của nghĩa trong cột meaning (1, 2, 3...)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_vocab_gloss` (`vocab_id`, `gloss`),
  INDEX `idx_gloss` (`gloss`),
  CONSTRAINT `fk_gloss_vocab` FOREIGN KEY (`vocab_id`) REFERENCES `hsk_vocabulary` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bảng nhóm từ đồng nghĩa (Mỗi nghĩa gốc là tâm của 1 sơ đồ nhánh)
CREATE TABLE IF NOT EXISTS `synonym_groups` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `root_gloss` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT 'Nghĩa tiếng Việt làm nút gốc',
  `root_score` FLOAT NOT NULL DEFAULT 0 COMMENT 'Điểm chất lượng của nhóm để sắp xếp thứ tự ưu tiên hiển thị',
  `source` VARCHAR(16) NOT NULL DEFAULT 'auto' COMMENT 'auto | curated | ai',
  `status` VARCHAR(16) NOT NULL DEFAULT 'draft' COMMENT 'draft | approved | hidden',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_root_gloss` (`root_gloss`),
  INDEX `idx_status_score` (`status`, `root_score` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bảng thành viên chữ Hán trong mỗi nhóm đồng nghĩa
CREATE TABLE IF NOT EXISTS `synonym_group_members` (
  `group_id` INT UNSIGNED NOT NULL,
  `vocab_id` INT UNSIGNED NOT NULL,
  `rank_order` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Thứ tự nhánh (sắp theo HSK tăng dần)',
  `register` VARCHAR(16) NOT NULL DEFAULT 'neutral' COMMENT 'formal | spoken | neutral',
  `nuance_note` VARCHAR(255) DEFAULT NULL COMMENT 'Ghi chú sắc thái nghĩa / cách dùng khác biệt',
  PRIMARY KEY (`group_id`, `vocab_id`),
  INDEX `idx_member_vocab` (`vocab_id`),
  CONSTRAINT `fk_syn_member_group` FOREIGN KEY (`group_id`) REFERENCES `synonym_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_syn_member_vocab` FOREIGN KEY (`vocab_id`) REFERENCES `hsk_vocabulary` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
