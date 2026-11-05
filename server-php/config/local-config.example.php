<?php
// Скопируйте этот файл в local-config.php и задайте свои значения.
// local-config.php НЕ должен попадать в git (секреты!).
$GLOBALS['SVDRIVERS_DB_DRIVER'] = 'mysql';
$GLOBALS['SVDRIVERS_DB_HOST']   = '127.0.0.1';
$GLOBALS['SVDRIVERS_DB_NAME']   = 'svdrivers';
$GLOBALS['SVDRIVERS_DB_USER']   = 'svdrivers';
$GLOBALS['SVDRIVERS_DB_PASS']   = 'StrongPass_2026!';
$GLOBALS['JWT_SECRET']          = bin2hex(random_bytes(32)); // задайте ПОСТОЯННОЕ значение!
$GLOBALS['TOKEN_PEPPER']        = bin2hex(random_bytes(16)); // задайте ПОСТОЯННОЕ значение!
$GLOBALS['PUBLIC_APP_URL']      = 'http://localhost:8080';
