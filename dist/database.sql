-- ============================================
-- SQL-скрипт для создания базы данных MySQL
-- Система учёта доходов и расходов водителей такси
-- ============================================

CREATE DATABASE IF NOT EXISTS taxi_accounting
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE taxi_accounting;

-- Таблица пользователей
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('driver', 'manager', 'admin') NOT NULL DEFAULT 'driver',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB;

-- Таблица недельных отчётов
CREATE TABLE weekly_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    year INT NOT NULL,
    week_number INT NOT NULL CHECK (week_number BETWEEN 1 AND 53),
    wheely_gross DECIMAL(12, 2) NOT NULL DEFAULT 0,
    yandex_gross DECIMAL(12, 2) NOT NULL DEFAULT 0,
    own_rent_gross DECIMAL(12, 2) NOT NULL DEFAULT 0,
    hourly_rent_hours DECIMAL(8, 2) NOT NULL DEFAULT 0,
    compensations DECIMAL(12, 2) NOT NULL DEFAULT 0,
    bonuses DECIMAL(12, 2) NOT NULL DEFAULT 0,
    deductions DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_driver_payout DECIMAL(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_year_week (user_id, year, week_number),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_year (user_id, year),
    INDEX idx_year_week (year, week_number)
) ENGINE=InnoDB;

-- Таблица логов изменений отчётов
CREATE TABLE report_edit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT NOT NULL,
    changed_by_user_id INT NOT NULL,
    field_name VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES weekly_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_report (report_id),
    INDEX idx_changed_by (changed_by_user_id),
    INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB;

-- ============================================
-- Начальные данные
-- ============================================

-- Пароли хэшируются через password_hash() в PHP
-- admin123, manager123, driver123

INSERT INTO users (username, email, password_hash, role) VALUES
('Администратор', 'admin@taxi.ru', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2Inhe/4UWCo', 'admin'),
('Руководитель', 'manager@taxi.ru', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2Inhe/4UWCo', 'manager'),
('Иванов И.И.', 'driver1@taxi.ru', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2Inhe/4UWCo', 'driver'),
('Петров П.П.', 'driver2@taxi.ru', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2Inhe/4UWCo', 'driver');

-- ============================================
-- Пример PHP-кода для серверной части
-- ============================================

-- config/database.php
-- <?php
-- $host = 'localhost';
-- $dbname = 'taxi_accounting';
-- $username = 'root';
-- $password = '';
-- 
-- try {
--     $pdo = new PDO(
--         "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
--         $username,
--         $password,
--         [
--             PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
--             PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
--             PDO::ATTR_EMULATE_PREPARES => false
--         ]
--     );
-- } catch (PDOException $e) {
--     die("Connection failed: " . $e->getMessage());
-- }
-- ?>

-- ============================================
-- Пример PHP-функции расчёта выплаты
-- ============================================

-- <?php
-- function calculateDriverPayout($wheelyGross, $yandexGross, $ownRentGross, $hourlyHours, $compensations, $bonuses, $deductions) {
--     $wheelyEarnings = $wheelyGross * 0.30;      // 30% от Wheely
--     $yandexEarnings = $yandexGross * 0.35;       // 35% от Яндекс
--     $ownRentEarnings = $ownRentGross * 0.30;     // 30% от собственной аренды
--     $hourlyEarnings = $hourlyHours * 500;         // 500 руб/час
--     
--     return $wheelyEarnings + $yandexEarnings + $ownRentEarnings + $hourlyEarnings + $compensations + $bonuses - $deductions;
-- }
-- ?>

-- ============================================
-- Пример PHP-функции логирования изменений
-- ============================================

-- <?php
-- function logReportChanges($pdo, $reportId, $changedByUserId, $oldData, $newData) {
--     $fields = ['wheely_gross', 'yandex_gross', 'own_rent_gross', 'hourly_rent_hours', 
--                'compensations', 'bonuses', 'deductions', 'total_driver_payout'];
--     
--     $stmt = $pdo->prepare("INSERT INTO report_edit_logs (report_id, changed_by_user_id, field_name, old_value, new_value) 
--                            VALUES (?, ?, ?, ?, ?)");
--     
--     foreach ($fields as $field) {
--         if (isset($newData[$field]) && $newData[$field] != $oldData[$field]) {
--             $stmt->execute([$reportId, $changedByUserId, $field, $oldData[$field], $newData[$field]]);
--         }
--     }
-- }
-- ?>
