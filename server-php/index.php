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

// Восстанавливаем «логический» путь /api/... независимо от формы URL и настроек IIS:
//  - IIS (URL Rewrite): /api/auth/login -> index.php; REQUEST_URI обычно сохраняет /api/...,
//    но при некоторых настройках подменяется путём скрипта — тогда оригинальный путь лежит в
//    ORIGINAL_URL / ORIGINAL_REQUEST_URI / HTTP_X_ORIGINAL_URL (ставит URL Rewrite),
//    REDIRECT_URL, ORIG_PATH_INFO, PATH_INFO.
//  - если правило rewrite сохранило хвост пути (/server-php/index.php/auth/login),
//    сегмент после index.php тоже учитывается;
//  - деплой в виртуальный каталог: /SVdrivers/api/auth/login;
//  - крайний случай (все серверные переменные потеряли путь): берём маршрут из тела
//    POST-запроса (клиент дублирует туда `path`, см. src/utils/api.ts).
function api_path_from(string $s): ?string {
    $p = parse_url($s, PHP_URL_PATH);
    if (!is_string($p) || $p === '') return null;
    if (preg_match('#(^|/)api(/.*)?$#', $p, $m)) {          // .../api/auth/login
        return rtrim('/api' . ($m[2] ?? ''), '/') ?: '/api';
    }
    // /server-php/index.php/auth/login или /index.php/auth/login (rewrite с сохранением хвоста)
    if (preg_match('#index\.php(/.*)$#', $p, $m) && $m[1] !== '/index.php') {
        return '/api' . $m[1];
    }
    return null;
}

function extract_api_path(): ?string {
    $candidates = [
        $_SERVER['ORIGINAL_URL'] ?? null,         // URL Rewrite (самый надёжный)
        $_SERVER['ORIGINAL_REQUEST_URI'] ?? null, // URL Rewrite
        $_SERVER['HTTP_X_ORIGINAL_URL'] ?? null,  // URL Rewrite (заголовок)
        parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH),
        $_SERVER['REDIRECT_URL'] ?? null,
        $_SERVER['ORIG_PATH_INFO'] ?? null,       // IIS FastCGI + URL Rewrite
        $_SERVER['PATH_INFO'] ?? null,            // /server-php/index.php/api/auth/login
    ];
    foreach ($candidates as $c) {
        if (is_string($c) && $c !== '') {
            $p = api_path_from($c);
            if ($p !== null) return $p;
        }
    }
    // Крайний случай: клиент продублировал путь API в теле JSON-запроса (поле "path").
    if (in_array($_SERVER['REQUEST_METHOD'] ?? '', ['POST', 'PUT', 'PATCH'], true)) {
        $raw = file_get_contents('php://input');
        $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
        if (is_array($data) && isset($data['path']) && is_string($data['path'])) {
            $GLOBALS['SVDRIVERS_BODY_OVERRIDE'] = $raw; // тело уже прочитана — переиспользуем
            $p = api_path_from($data['path']);
            if ($p !== null) return $p;
        }
    }
    return null;
}

$uri = extract_api_path();
if ($uri === null) {
    json_out(404, [
        'error' => 'API route not found. Проверьте web.config: правило ^api/(.*) -> /server-php/index.php '
            . 'и наличие папки server-php в веб-корне сайта (DEPLOY-IIS.md, раздел 7).',
        'debug' => [
            'request_uri'    => $_SERVER['REQUEST_URI'] ?? null,
            'script_name'    => $_SERVER['SCRIPT_NAME'] ?? null,
            'path_info'      => $_SERVER['PATH_INFO'] ?? null,
            'orig_path_info' => $_SERVER['ORIG_PATH_INFO'] ?? null,
            'original_url'   => $_SERVER['ORIGINAL_URL'] ?? ($_SERVER['HTTP_X_ORIGINAL_URL'] ?? null),
            'redirect_url'   => $_SERVER['REDIRECT_URL'] ?? null,
        ],
    ]);
}

$path = rtrim((string)substr($uri, strlen('/api')), '/'); // '', '/auth/login', '/users/3/reset-password'...

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
