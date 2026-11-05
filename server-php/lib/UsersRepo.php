<?php
// SVdrivers PHP — репозиторий пользователей (MySQL через PDO).
// Пароли хранятся только как password_hash() (bcrypt, совместим с $2y$ из Node/bcryptjs).

require_once __DIR__ . '/Db.php';

class UsersRepo
{
    public static function all(): array
    {
        return Db::all('SELECT * FROM users ORDER BY created_at, id');
    }

    public static function byId(int $id): ?array
    {
        return Db::one('SELECT * FROM users WHERE id = ?', [$id]);
    }

    // utf8mb4_unicode_ci регистронезависим; на всякий случай нормализуем.
    // Единое место поиска по email — вход не раскрывает существование аккаунта (см. routes/auth.php).
    public static function byEmail(string $email): ?array
    {
        return Db::one('SELECT * FROM users WHERE email = ?', [strtolower(trim($email))]);
    }

    public static function create(string $username, string $email, string $passwordHash, string $role, bool $mustChange): int
    {
        Db::run(
            'INSERT INTO users (username, email, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, ?)',
            [$username, $email, $passwordHash, $role, $mustChange ? 1 : 0]
        );
        return (int)Db::pdo()->lastInsertId();
    }

    public static function updatePassword(int $id, string $hash, bool $mustChange): void
    {
        Db::run('UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?', [$hash, $mustChange ? 1 : 0, $id]);
    }

    public static function setMustChange(int $id, bool $v): void
    {
        Db::run('UPDATE users SET must_change_password = ? WHERE id = ?', [$v ? 1 : 0, $id]);
    }

    public static function touchLogin(int $id): void
    {
        Db::run('UPDATE users SET last_login_at = NOW() WHERE id = ?', [$id]);
    }

    public static function updateProfile(int $id, string $username, string $email, string $role): void
    {
        Db::run('UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?', [$username, $email, $role, $id]);
    }

    public static function remove(int $id): void
    {
        Db::run('DELETE FROM auth_tokens WHERE user_id = ?', [$id]);
        Db::run('DELETE FROM weekly_reports WHERE user_id = ?', [$id]);
        Db::run('DELETE FROM report_edit_logs WHERE changed_by_user_id = ?', [$id]);
        Db::run('DELETE FROM users WHERE id = ?', [$id]);
    }
}
