<?php
// SVdrivers PHP — JWT (HS256) без внешних зависимостей.
// Совместим с токенами Node-версии: тот же формат header.payload.signature,
// те же claims { sub, role, iat, exp }. Секрет задаётся в JWT_SECRET.

class Jwt
{
    private static function b64(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function unb64(string $data): string|false
    {
        return base64_decode(strtr($data, '-_', '+/'), true);
    }

    public static function sign(array $payload, int $ttlSeconds = 43200): string // 12 ч, как в Express-версии
    {
        $now = time();
        $payload = array_merge($payload, ['iat' => $now, 'exp' => $now + $ttlSeconds]);
        $header  = self::b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $body    = self::b64(json_encode($payload, JSON_UNESCAPED_UNICODE));
        $sig     = self::b64(hash_hmac('sha256', "$header.$body", $GLOBALS['JWT_SECRET'], true));
        return "$header.$body.$sig";
    }

    // Возвращает payload или null (подпись невалидна / истёк срок)
    public static function verify(string $jwt): ?array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) return null;
        [$h, $p, $s] = $parts;
        $expect = self::b64(hash_hmac('sha256', "$h.$p", $GLOBALS['JWT_SECRET'], true));
        if (!hash_equals($expect, $s)) return null;
        $payload = json_decode((string)self::unb64($p), true);
        if (!is_array($payload) || !isset($payload['exp']) || $payload['exp'] < time()) return null;
        return $payload;
    }
}
