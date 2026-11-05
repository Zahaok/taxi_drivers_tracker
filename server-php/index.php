<?php
// Точка входа PHP-бэкенда SVdrivers. Все /api/* запросы перенаправляются сюда
// через web.config (IIS URL Rewrite) или rewrite в built-in сервере.
// Порт функциональности Express-версии (server/index.js): авторизация, JWT,
// пользователи, outbox; + CRUD недельных отчётов и аудит-лог для MySQL-схемы.

declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '0'); // исключения покажем JSON'ом ниже

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/Db.php';
require_once __DIR__ . '/routes/auth.php';
require_once __DIR__ . '/routes/users.php';
require_once __DIR__ . '/routes/reports.php';

set_exception_handler(function (Throwable $e): void {
    error_log('[svdrivers-php] ' . $e->getMessage());
    json_out(500, ['error' => 'Внутренняя ошибка сервера']);
});

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
// Поддержка деплоя в виртуальный каталог IIS: /SVdrivers/api/... -> /api/...
if (preg_match('#(/api(?:/.*|))$#', $uri, $m)) $uri = $m[1];

$path = rtrim((string)substr($uri, strlen('/api')), '/'); // '', '/auth/login', '/users/3/reset-password'...

if (!str_starts_with($uri, '/api')) {
    json_out(404, ['error' => 'Not found']);
}

try {
    if ($path === '' || $path === '/health') {
        json_out(200, ['ok' => true, 'service' => 'svdrivers-api-php']);
    } elseif (str_starts_with($path, '/auth/')) {
        route_auth($method, substr($path, strlen('/auth')));
    } elseif ($path === '/me' && $method === 'GET') {
        $user = require_auth();
        json_out(200, ['user' => public_user($user)]);
    } elseif (str_starts_with($path, '/users')) {
        route_users($method, substr($path, strlen('/users')));
    } elseif (str_starts_with($path, '/reports')) {
        route_reports($method, substr($path, strlen('/reports')));
    } elseif ($path === '/dev/outbox' && $method === 'GET') {
        // Статистика outbox — только локальная разработка (SMTP не настроен), доступ админу
        $user = require_auth();
        require_admin($user);
        if (($GLOBALS['SMTP_HOST'] ?? '') !== '') notfound('Отключено при настроенном SMTP');
        $dir = rtrim($GLOBALS['SVDRIVERS_DATA_DIR'], '\\/') . '/outbox';
        $files = is_dir($dir) ? array_values(array_filter(scandir($dir), fn($f) => str_ends_with($f, '.json'))) : [];
        rsort($files);
        $mails = array_map(function ($f) use ($dir) {
            return json_decode((string)file_get_contents("$dir/$f"), true);
        }, array_slice($files, 0, 20));
        json_out(200, ['mails' => $mails]);
    } else {
        notfound('Эндпоинт не найден');
    }
} catch (Throwable $e) {
    error_log('[svdrivers-php] ' . $e->getMessage());
    json_out(500, ['error' => 'Внутренняя ошибка сервера']);
}
