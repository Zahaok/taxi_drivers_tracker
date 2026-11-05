-- ============================================================
-- SVdrivers — эталонная схема MySQL 8 (порт с SQLite/Supabase-версий)
-- Импорт: mysql -u root -p < database.mysql.sql
--  (или выполните в phpMyAdmin / MySQL Workbench)
-- Пароли — только bcrypt-хэши ($2y$), plaintext не хранится нигде.
-- ============================================================

CREATE DATABASE IF NOT EXISTS svdrivers
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE svdrivers;

-- Пользователи
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(191) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,            -- utf8mb4_unicode_ci регистронезависим (аналог COLLATE NOCASE)
  password_hash VARCHAR(255) NOT NULL,           -- password_hash() / bcrypt
  role ENUM('driver','manager','admin') NOT NULL DEFAULT 'driver',
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_users_role (role)
) ENGINE=InnoDB;

-- Одноразовые токены активации/сброса (хранится sha256(pepper+token), сырые токены — никогда)
CREATE TABLE IF NOT EXISTS auth_tokens (
  token CHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  kind ENUM('registration','reset') NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tokens_user (user_id)
) ENGINE=InnoDB;

-- Недельные отчёты водителей (колонки — как в supabase/schema.sql)
CREATE TABLE IF NOT EXISTS weekly_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  year SMALLINT NOT NULL,
  week_number TINYINT NOT NULL,
  grnz VARCHAR(32) NULL,
  mileage DECIMAL(12,2) NOT NULL DEFAULT 0,
  car VARCHAR(191) NULL,
  wheely_gross DECIMAL(12,2) NOT NULL DEFAULT 0,
  wheely_agent_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  wheely_airport_parking DECIMAL(12,2) NOT NULL DEFAULT 0,
  sober_driver DECIMAL(12,2) NOT NULL DEFAULT 0,
  wheely_tips DECIMAL(12,2) NOT NULL DEFAULT 0,
  yandex_gross DECIMAL(12,2) NOT NULL DEFAULT 0,
  yandex_tips DECIMAL(12,2) NOT NULL DEFAULT 0,
  zsd DECIMAL(12,2) NOT NULL DEFAULT 0,
  own_rent_gross DECIMAL(12,2) NOT NULL DEFAULT 0,
  zsd_own_rent DECIMAL(12,2) NOT NULL DEFAULT 0,
  hourly_rent_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  compensations DECIMAL(12,2) NOT NULL DEFAULT 0,
  bonuses DECIMAL(12,2) NOT NULL DEFAULT 0,
  adjustment_bonuses DECIMAL(12,2) NOT NULL DEFAULT 0,
  fines DECIMAL(12,2) NOT NULL DEFAULT 0,
  zsd_payout DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_driver_payout DECIMAL(12,2) NOT NULL DEFAULT 0,
  comment TEXT NULL,
  edited_by_admin TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_year_week (user_id, year, week_number),
  CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reports_user_year (user_id, year),
  INDEX idx_reports_year_week (year, week_number)
) ENGINE=InnoDB;

-- Аудит-лог изменений отчётов менеджером/админом
CREATE TABLE IF NOT EXISTS report_edit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  changed_by_user_id INT NOT NULL,
  field_name VARCHAR(64) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_logs_report FOREIGN KEY (report_id) REFERENCES weekly_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_logs_user FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_logs_report (report_id),
  INDEX idx_logs_changed_at (changed_at)
) ENGINE=InnoDB;

-- Демо-аккаунты создаются сидом: php server-php/database/seed.php
-- (пароли: Admin2026! / Manager2026! / Driver2026!)
