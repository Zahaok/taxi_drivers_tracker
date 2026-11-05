<?php
// SVdrivers PHP — конфигурация.
// Значения берутся из переменных окружения (задаются в web.config / пуле IIS / .env),
// либо из server-php/config/local-config.php (не коммитится в git).
//
// Движок БД переключается через SVDRIVERS_DB_DRIVER:
//   mysql  — продакшн (IIS + MySQL)  [по умолчанию]
//   sqlite — локальная проверка без MySQL (послабление схемы, см. lib/Db.php)

$defaults = [
    'SVDRIVERS_DB_DRIVER'  => 'mysql',
    'SVDRIVERS_DB_HOST'    => '127.0.0.1',
    'SVDRIVERS_DB_PORT'    => '3306',
    'SVDRIVERS_DB_NAME'    => 'svdrivers',
    'SVDRIVERS_DB_USER'    => 'svdrivers',
    'SVDRIVERS_DB_PASS'    => '',
    'SVDRIVERS_DB_SOCKET'  => '',
    // Каталог данных для sqlite-режима и outbox-писем
    'SVDRIVERS_DATA_DIR'   => __DIR__ . '/../data',
    // Секрет подписи JWT (обязательно задайте свой, длинный и случайный!)
    'JWT_SECRET'           => 'change-me-to-a-long-random-string',
    // Добавка к хэшированию одноразовых токенов сброса/активации
    'TOKEN_PEPPER'         => 'change-me-too',
    // Базовый URL приложения для ссылок в письмах
    'PUBLIC_APP_URL'       => 'http://localhost:8080',
    // TTL одноразовых токенов, минуты
    'RESET_TOKEN_TTL_MIN'  => '60',
    'REG_TOKEN_TTL_MIN'    => '10080', // 7 суток
    // SMTP пусто -> письма пишутся в data/outbox/*.json (видно в /api/dev/outbox у админа)
    'SMTP_HOST'            => '',
    'SMTP_PORT'            => '587',
    'SMTP_SECURE'          => 'false', // true = SSL (порт 465); false = STARTTLS
    'SMTP_USER'            => '',
    'SMTP_PASS'            => '',
    'MAIL_FROM'            => 'no-reply@svdrivers.local',
];

foreach ($defaults as $k => $v) {
    $env = getenv($k);
    if (!array_key_exists($k, $GLOBALS)) {
        $GLOBALS[$k] = ($env !== false && $env !== '') ? $env : $v;
    }
}

// Локальные переопределения для разработки (копия local-config.example.php -> local-config.php)
if (is_file(__DIR__ . '/local-config.php')) {
    require __DIR__ . '/local-config.php';
}
