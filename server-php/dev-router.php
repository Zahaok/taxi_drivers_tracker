<?php
// Локальный dev-сервер для PHP-бэкенда (без IIS):
//   php -S localhost:4000 server-php/dev-router.php
// Статика dist/ раздаётся с корня, /api/* уходит в server-php/index.php.

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (preg_match('#^/api(/|$)#', $uri)) {
    require __DIR__ . '/index.php';
    return true;
}

// SPA-fallback: несуществующие файлы -> dist/index.html
$dist = dirname(__DIR__) . '/dist';
$file = realpath($dist . $uri);
if ($file && is_file($file)) {
    return false; // built-in сервер отдаст файл сам
}
header('Content-Type: text/html; charset=utf-8');
readfile("$dist/index.html");
return true;
