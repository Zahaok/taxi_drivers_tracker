<?php
// SVdrivers PHP — репозиторий одноразовых токенов (активация регистрации / сброс пароля).
// Как и в Node-версии, хранится только sha256(pepper + raw_token), сырые токены не пишутся в БД.

require_once __DIR__ . '/Db.php';

class TokensRepo
{
    public static function hash(string $raw): string
    {
        return hash('sha256', $GLOBALS['TOKEN_PEPPER'] . $raw);
    }

    public static function newRaw(): string
    {
        return bin2hex(random_bytes(32));
    }

    public static function ttlMinutes(string $kind): int
    {
        return $kind === 'registration'
            ? (int)$GLOBALS['REG_TOKEN_TTL_MIN']
            : (int)$GLOBALS['RESET_TOKEN_TTL_MIN'];
    }

    public static function create(string $rawHashed, int $userId, string $kind): void
    {
        // Даты считаем на стороне PHP: единая часовая зона с валидацией (strtotime),
        // формат 'Y-m-d H:i:s' совместим и с MySQL TIMESTAMP, и с sqlite-режимом.
        $ttl = self::ttlMinutes($kind);
        $expiresAt = date('Y-m-d H:i:s', time() + $ttl * 60);
        Db::run(
            'INSERT INTO auth_tokens (token, user_id, kind, expires_at) VALUES (?, ?, ?, ?)',
            [$rawHashed, $userId, $kind, $expiresAt]
        );
    }

    public static function find(string $hash): ?array
    {
        return Db::one('SELECT * FROM auth_tokens WHERE token = ?', [$hash]);
    }

    public static function markUsed(string $hash): void
    {
        Db::run('UPDATE auth_tokens SET used_at = NOW() WHERE token = ?', [$hash]);
    }

    // Отменяем все активные токены данного типа для пользователя (один действующий сброс за раз)
    public static function revokeActive(int $userId, string $kind): void
    {
        Db::run('UPDATE auth_tokens SET used_at = NOW() WHERE user_id = ? AND kind = ? AND used_at IS NULL', [$userId, $kind]);
    }

    public static function purgeExpired(): void
    {
        Db::run('DELETE FROM auth_tokens WHERE expires_at < NOW()');
    }

    // Валидный (не использованный, не истёкший) токен или null
    public static function validToken(string $raw, string $expectedKind = ''): ?array
    {
        $rec = self::find(self::hash($raw));
        if (!$rec) return null;
        if (!empty($rec['used_at'])) return null;
        if (strtotime((string)$rec['expires_at']) < time()) return null;
        if ($expectedKind !== '' && $rec['kind'] !== $expectedKind) return null;
        return $rec;
    }
}
