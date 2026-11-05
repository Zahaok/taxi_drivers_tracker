<?php
// SVdrivers PHP — HTTP-хелперы: JSON-ответы, чтение тела запроса, авторизация.

require_once __DIR__ . '/Jwt.php';
require_once __DIR__ . '/Db.php';

function json_out(int $status, array $data): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return [];
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

function bad(string $msg): never        { json_out(400, ['error' => $msg]); }
function unauthorized(string $msg = 'Требуется авторизация'): never { json_out(401, ['error' => $msg]); }
function forbidden(string $msg = 'Недостаточно прав'): never         { json_out(403, ['error' => $msg]); }
function notfound(string $msg = 'Не найдено'): never                { json_out(404, ['error' => $msg]); }

// Публичное представление пользователя — password_hash НИКОГДА не отдаётся клиенту
function public_user(?array $u): ?array
{
    if (!$u) return null;
    return [
        'id'                   => (int)$u['id'],
        'username'             => $u['username'],
        'email'                => $u['email'],
        'role'                 => $u['role'],
        'must_change_password' => (bool)$u['must_change_password'],
        'created_at'           => $u['created_at'],
        'last_login_at'        => $u['last_login_at'] ?? null,
    ];
}

// Валидация пароля — те же правила, что в Express-версии
function validate_password(mixed $pw): ?string
{
    if (!is_string($pw) || mb_strlen($pw) < 8) return 'Пароль должен быть не короче 8 символов';
    if (!preg_match('/[A-Za-zА-Яа-яЁё]/u', $pw) || !preg_match('/\d/u', $pw)) {
        return 'Пароль должен содержать буквы и цифры';
    }
    return null;
}

// Разбор Bearer-токена; при успехе возвращает строку токена
function bearer_token(): ?string
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if ($h === '' && function_exists('apache_request_headers')) {
        $hdrs = apache_request_headers();
        $h = $hdrs['Authorization'] ?? $hdrs['authorization'] ?? '';
    }
    if (is_string($h) && str_starts_with($h, 'Bearer ')) return substr($h, 7);
    return null;
}

// Аутентификация по JWT + загрузка пользователя из БД. Останавливает запрос с 401 при ошибке.
function require_auth(): array
{
    $token = bearer_token();
    if (!$token) unauthorized();
    $payload = Jwt::verify($token);
    if (!$payload || !isset($payload['sub'])) unauthorized('Сессия истекла, войдите заново');
    $user = Db::one('SELECT * FROM users WHERE id = ?', [(int)$payload['sub']]);
    if (!$user) unauthorized('Пользователь не найден');
    return $user;
}

function require_admin(array $user): void
{
    if ($user['role'] !== 'admin') forbidden('Только для администратора');
}

function require_manager(array $user): void
{
    if (!in_array($user['role'], ['manager', 'admin'], true)) forbidden('Только для руководителя или администратора');
}

function new_uuid(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}
