<?php
// /api/auth/* — логин, смена пароля, сброс по токену (порт Express-версии).
// Вызывается из index.php; $path = часть URL после '/api/auth'.

require_once __DIR__ . '/../lib/http.php';
require_once __DIR__ . '/../lib/UsersRepo.php';
require_once __DIR__ . '/../lib/TokensRepo.php';
require_once __DIR__ . '/../lib/mailer.php';

function route_auth(string $method, string $path): void
{
    // POST /api/auth/login
    if ($path === 'login' && $method === 'POST') {
        $b = body();
        $email = trim((string)($b['email'] ?? ''));
        $password = (string)($b['password'] ?? '');
        if ($email === '' || $password === '') bad('Укажите email и пароль');
        $user = UsersRepo::byEmail($email);
        if (!$user || !password_verify($password, $user['password_hash'])) {
            unauthorized('Неверный email или пароль'); // единое сообщение — без утечки существования аккаунта
        }
        UsersRepo::touchLogin((int)$user['id']);
        $token = Jwt::sign(['sub' => (int)$user['id'], 'role' => $user['role']]);
        json_out(200, ['token' => $token, 'user' => public_user(UsersRepo::byId((int)$user['id']))]);
    }

    // POST /api/auth/change-password
    if ($path === 'change-password' && $method === 'POST') {
        $user = require_auth();
        $b = body();
        if (!password_verify((string)($b['current_password'] ?? ''), $user['password_hash'])) {
            bad('Текущий пароль неверен');
        }
        $err = validate_password($b['new_password'] ?? null);
        if ($err) bad($err);
        UsersRepo::updatePassword((int)$user['id'], password_hash((string)$b['new_password'], PASSWORD_BCRYPT), false);
        json_out(200, ['user' => public_user(UsersRepo::byId((int)$user['id']))]);
    }

    // POST /api/auth/forgot-password (публичный)
    if ($path === 'forgot-password' && $method === 'POST') {
        $b = body();
        $email = trim((string)($b['email'] ?? ''));
        $user = $email !== '' ? UsersRepo::byEmail($email) : null;
        // Всегда 200 — не раскрываем, зарегистрирован ли email
        if ($user) {
            TokensRepo::revokeActive((int)$user['id'], 'reset');
            $raw = TokensRepo::newRaw();
            TokensRepo::create(TokensRepo::hash($raw), (int)$user['id'], 'reset');
            send_reset_email($user, $raw);
        }
        json_out(200, ['ok' => true, 'message' => 'Если email зарегистрирован — на него отправлено письмо со ссылкой для смены пароля']);
    }

    // GET /api/auth/token-info?token=... (публичная проверка токена для отображения формы)
    if ($path === 'token-info' && $method === 'GET') {
        $t = (string)($_GET['token'] ?? '');
        $rec = $t !== '' ? TokensRepo::validToken($t) : null;
        if (!$rec) bad('Ссылка недействительна или истекла');
        json_out(200, ['kind' => $rec['kind']]);
    }

    // POST /api/auth/reset-password (сброс или активация регистрации)
    if ($path === 'reset-password' && $method === 'POST') {
        $b = body();
        $t = (string)($b['token'] ?? '');
        $rec = $t !== '' ? TokensRepo::validToken($t) : null;
        if (!$rec) bad('Ссылка недействительна или истекла. Запросите новую.');
        $err = validate_password($b['new_password'] ?? null);
        if ($err) bad($err);
        $user = UsersRepo::byId((int)$rec['user_id']);
        if (!$user) bad('Пользователь не найден');
        TokensRepo::markUsed(TokensRepo::hash($t));
        UsersRepo::updatePassword((int)$user['id'], password_hash((string)$b['new_password'], PASSWORD_BCRYPT), false);
        json_out(200, ['ok' => true]);
    }

    notfound('Эндпоинт не найден');
}
