<?php
// /api/users* — управление пользователями (только администратор). Порт Express-версии.

require_once __DIR__ . '/../lib/http.php';
require_once __DIR__ . '/../lib/UsersRepo.php';
require_once __DIR__ . '/../lib/TokensRepo.php';
require_once __DIR__ . '/../lib/mailer.php';

function generate_temp_password(): string
{
    // Произносимо-безопасный временный пароль: 10 символов, буквы+цифры (без похожих)
    $abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    $s = '';
    $max = strlen($abc) - 1;
    for ($i = 0; $i < 10; $i++) $s .= $abc[random_int(0, $max)];
    return $s;
}

function route_users(string $method, string $path): void
{
    // path: '' | '/{id}' | '/{id}/reset-password' | '/{id}/must-change-password'
    $user = require_auth();
    require_admin($user);

    if ($path === '' && $method === 'GET') {
        json_out(200, ['users' => array_map('public_user', UsersRepo::all())]);
    }

    if ($path === '' && $method === 'POST') {
        $b = body();
        $username = trim((string)($b['username'] ?? ''));
        $email = mb_strtolower(trim((string)($b['email'] ?? '')));
        $role = (string)($b['role'] ?? '');
        if ($username === '' || $email === '') bad('Укажите имя и email');
        if (!in_array($role, ['driver', 'manager', 'admin'], true)) bad('Некорректная роль');
        if (!preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $email)) bad('Некорректный email');
        if (UsersRepo::byEmail($email)) json_out(409, ['error' => 'Email уже зарегистрирован']);

        $tempPassword = (isset($b['password']) && mb_strlen((string)$b['password']) >= 8)
            ? (string)$b['password'] : generate_temp_password();
        $err = validate_password($tempPassword);
        if ($err) bad($err);

        $id = UsersRepo::create($username, $email, password_hash($tempPassword, PASSWORD_BCRYPT), $role, true);
        $created = UsersRepo::byId($id);

        $raw = TokensRepo::newRaw();
        TokensRepo::create(TokensRepo::hash($raw), $id, 'registration');
        send_registration_email($created, $raw);

        json_out(201, ['user' => public_user($created), 'temp_password' => $tempPassword]);
    }

    if (preg_match('#^/(\d+)(/.*)?$#', $path, $m)) {
        $targetId = (int)$m[1];
        $sub = $m[2] ?? '';
        $target = UsersRepo::byId($targetId);
        if (!$target) notfound('Пользователь не найден');

        // PUT /api/users/{id}
        if ($sub === '' && $method === 'PUT') {
            $b = body();
            $email = isset($b['email']) && trim((string)$b['email']) !== ''
                ? mb_strtolower(trim((string)$b['email'])) : $target['email'];
            $dup = UsersRepo::byEmail($email);
            if ($dup && (int)$dup['id'] !== $targetId) json_out(409, ['error' => 'Email уже занят']);
            $username = trim((string)($b['username'] ?? '')) ?: $target['username'];
            $role = in_array($b['role'] ?? '', ['driver', 'manager', 'admin'], true) ? $b['role'] : $target['role'];
            UsersRepo::updateProfile($targetId, $username, $email, $role);
            json_out(200, ['user' => public_user(UsersRepo::byId($targetId))]);
        }

        // POST /api/users/{id}/reset-password — админ инициирует сброс: письмо + требование смены при входе
        if ($sub === '/reset-password' && $method === 'POST') {
            TokensRepo::revokeActive($targetId, 'reset');
            $raw = TokensRepo::newRaw();
            TokensRepo::create(TokensRepo::hash($raw), $targetId, 'reset');
            UsersRepo::setMustChange($targetId, true);
            send_reset_email($target, $raw);
            json_out(200, ['ok' => true, 'message' => "Письмо со ссылкой для смены пароля отправлено на {$target['email']}"]);
        }

        // POST /api/users/{id}/must-change-password
        if ($sub === '/must-change-password' && $method === 'POST') {
            $b = body();
            UsersRepo::setMustChange($targetId, !empty($b['value']));
            json_out(200, ['user' => public_user(UsersRepo::byId($targetId))]);
        }

        // DELETE /api/users/{id}
        if ($sub === '' && $method === 'DELETE') {
            if ($targetId === (int)$user['id']) bad('Нельзя удалить свой аккаунт');
            UsersRepo::remove($targetId);
            json_out(200, ['ok' => true]);
        }
    }

    notfound('Эндпоинт не найден');
}
