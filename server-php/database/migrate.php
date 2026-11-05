<?php
// Применение схемы к текущему драйверу БД (config: SVDRIVERS_DB_DRIVER).
// Запуск: php server-php/database/migrate.php
// Для sqlite схема адаптируется на лету (Db::adapt), для MySQL выполняется как есть.

require_once __DIR__ . '/../lib/Db.php';

if (PHP_SAPI !== 'cli') { http_response_code(403); exit("Только CLI\n"); }

$sql = file_get_contents(__DIR__ . '/schema.mysql.sql');
if ($sql === false) exit("Не найден schema.mysql.sql\n");

// Отбрасываем комментарии и разбиваем на инструкции
$lines = preg_split('/\r\n|\r|\n/', $sql);
$clean = [];
foreach ($lines as $l) {
    $t = ltrim($l);
    if (str_starts_with($t, '--')) continue;
    $clean[] = $l;
}
$stmts = array_filter(array_map('trim', explode(';', implode("\n", $clean))));

$pdo = Db::pdo();
foreach ($stmts as $s) {
    $adapted = Db::adapt($s);
    // sqlite не умеет CREATE DATABASE/USE — пропускаем
    if (preg_match('/^\s*(CREATE DATABASE|USE)\b/i', $adapted)) continue;
    $pdo->exec($adapted);
    echo "OK: " . substr(preg_replace('/\s+/', ' ', $adapted), 0, 60) . "...\n";
}
echo "Migrate done. Driver=" . Db::driver() . "\n";
