<?php
// Инициализация демо-аккаунтов SVdrivers (порт server/seed.js).
// Запуск: php server-php/database/seed.php   (повторный запуск безопасен — INSERT игнорируется при существующем email)

require_once __DIR__ . '/../lib/UsersRepo.php';

if (PHP_SAPI !== 'cli') { http_response_code(403); exit("Только CLI\n"); }

// Для sqlite-режима убедимся, что таблицы созданы
if (Db::driver() === 'sqlite') {
    require __DIR__ . '/migrate.php';
}

$demo = [
    ['username' => 'Администратор', 'email' => 'admin@svdrivers.ru',    'password' => 'Admin2026!',   'role' => 'admin'],
    ['username' => 'Руководитель',  'email' => 'manager@svdrivers.ru',  'password' => 'Manager2026!', 'role' => 'manager'],
    ['username' => 'Иванов И.И.',   'email' => 'driver@svdrivers.ru',   'password' => 'Driver2026!',  'role' => 'driver'],
];

foreach ($demo as $d) {
    if (UsersRepo::byEmail($d['email'])) { echo "skip {$d['email']}\n"; continue; }
    UsersRepo::create($d['username'], $d['email'], password_hash($d['password'], PASSWORD_BCRYPT), $d['role'], false);
    echo "created {$d['email']} ({$d['role']})\n";
}
echo "Seed done.\n";
