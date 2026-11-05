# Инструкция по деплою SVdrivers на локальный IIS (Windows)

Проект SVdrivers состоит из двух частей:

1. **Фронтенд** — SPA на React/Vite (статические файлы `dist/`), раздаётся IIS.
2. **Бэкенд** — **PHP API** (`server-php/`, точка входа `server-php/index.php`) на MySQL: авторизация, JWT, bcrypt-хэши паролей (`password_hash`), почтовые приглашения/сброс (SMTP или outbox), CRUD пользователей и отчётов. Работает как нативное приложение IIS через FastCGI — **Node.js не требуется**.

> Node-версия (`server/index.js` + SQLite) осталась в репозитории только как легаси/локальная разработка. Данная инструкция описывает полностью PHP-сборку: IIS отдаёт статику `dist/` и исполняет `server-php/` на том же сайте.

---

## 0. Что понадобится

| Компонент | Зачем | Где взять |
|---|---|---|
| IIS 10+ | Веб-сервер для статики + FastCGI | «Включение компонентов Windows» |
| URL Rewrite 2.1 | Маршрутизация `/api/*` в PHP + SPA-fallback | https://iis.net/downloads |
| PHP 8.1+ (NTS x64) | Исполнение бэкенда `server-php/` | https://windows.php.net/download |
| MySQL 8 | База данных (схема `server-php/database/schema.mysql.sql`) | https://dev.mysql.com/downloads |

ARR и Node.js для PHP-сборки **не нужны**.

---

## 1. Установка IIS и компонентов

PowerShell **от администратора**:

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName `
  IIS-WebServerRole, IIS-WebServer, IIS-CommonHttpFeatures, `
  IIS-StaticContent, IIS-DefaultDocument, IIS-HttpErrors, `
  IIS-ApplicationDevelopment, IIS-ISAPIFilter, IIS-ISAPIExtensions, `
  IIS-ManagementConsole, IIS-WebServerManagementTools -All
```

Дополнительно через «Программы → Включение или отключение компонентов Windows» убедитесь, что включены:
- Средство управления IIS → Консоль управления IIS
- Службы IIS → Общий HTTP-компонент → Статическое содержимое

После установки откройте `http://localhost` — должна открыться страница IIS.

### 1.1 Установите расширение URL Rewrite (если ещё не стоит)

Скачайте и установите (msi, «Next» до конца):
- **URL Rewrite** — https://www.iis.net/downloads/microsoft/url-rewrite

ARR для PHP-сборки не нужен (проксирование на Node не используется).

---

## 2. PHP и MySQL

### 2.1 PHP через FastCGI

1. Скачайте **PHP 8.3 NTS x64 Zip** с https://windows.php.net/download/, распакуйте в `C:\php`.
2. В `C:\php\php.ini-development` скопируйте в `php.ini`, раскомментируйте:
   ```ini
   fastcgi_impersonator = 1
   extension_dir = "ext"
   extension=curl
   extension=mbstring
   extension=openssl
   extension=pdo_mysql
   extension=mysqli
   date.timezone = Europe/Moscow
   ```
3. IIS → пулы приложений → **Добавить пул**: имя `Php83`, .NET CLR — *No Managed Code*, Identity — `ApplicationPoolIdentity`.
4. IIS → корневой сервер → **Обработчик сопоставления MIME**: добавить `application/php; .php` (или через «FastCGI Modules»).
5. IIS → корневой сервер → **FastCGI Module → Add a FastCGI application profile**:
   - Executable: `C:\php\php-cgi.exe`
   - Role: `Unaffiliated Application`
6. Назначьте обработчик: сайт → **Обработчики сопоставления (Handler Mappings)** → Add Module Mapping:
   - Request path: `*.php`, Module: `FastCgiModule`, Executable: `C:\php\php-cgi.exe`, Name: `PHP via FastCGI`.
7. Проверка: положите `C:\inetpub\svdrivers-web\info.php` с `<?php phpinfo();` → откройте `http://localhost/info.php`.

### 2.2 MySQL

1. Установите **MySQL 8 Community** (Setup Type: Server only), задайте root-пароль, сервис запустится автоматически (`mysqld`).
2. Создайте базу и пользователя (mysql -u root -p):

```sql
CREATE DATABASE svdrivers CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'svdrivers'@'localhost' IDENTIFIED BY 'StrongPass_2026!';
GRANT ALL PRIVILEGES ON svdrivers.* TO 'svdrivers'@'localhost';
FLUSH PRIVILEGES;
```

---

## 3. Сборка фронтенда

На машине разработки (или прямо на сервере) в корне проекта:

```bat
npm ci
npm run build:iis
```

> ⚠️ Не используйте команду вида `npm run build -- --config vite.config.prod.js` — в Windows через npm extra-аргументы могут передаваться в Vite одной группой, из-за чего Vite воспринимает файл конфигурации как директорию и падает с ошибкой `Could not resolve entry module "vite.config.prod.js/index.html"`. В package.json добавлен готовый скрипт `build:iis`, который вызывает `vite build --config vite.config.prod.js` напрямую.

> `vite.config.prod.js` использует `base: "./"` — ассеты идут по относительным путям, билд работает из любого виртуального каталога IIS.

Результат — папка `dist\`. Скопируйте её содержимое в веб-корень сайта, например `C:\inetpub\svdrivers-web`.

Установите права:
```bat
icacls C:\inetpub\svdrivers-web /grant IIS_IUSRS:(OI)(CI)RX /T
```

---

## 4. Установка бэкенда (PHP API)

Бэкенд лежит в папке **`server-php/`** проекта:

```
server-php/
├── index.php            — точка входа всех /api/* запросов
├── config/config.php    — конфигурация (env или local-config.php)
├── lib/                 — Db (PDO), Jwt, репозитории, mailer
├── routes/              — auth.php, users.php, reports.php
└── database/
    ├── schema.mysql.sql — схема MySQL 8
    ├── migrate.php      — применение схемы
    └── seed.php         — демо-аккаунты (админ/менеджер/водитель)
```

1. Скопируйте `server-php\` в веб-корень сайта (например `C:\inetpub\svdrivers-web\server-php\`, рядом с файлами из `dist\`). Отдельного каталога или службы не требуется — IIS исполнит PHP напрямую через FastCGI (настройка — раздел 7).
2. Настройте конфигурацию. Проще всего скопировать `server-php\config\local-config.example.php` → `server-php\config\local-config.php` и заполнить значения (файл не коммитится в git):

```php
$GLOBALS['SVDRIVERS_DB_DRIVER'] = 'mysql';
$GLOBALS['SVDRIVERS_DB_HOST']   = '127.0.0.1';
$GLOBALS['SVDRIVERS_DB_NAME']   = 'svdrivers';
$GLOBALS['SVDRIVERS_DB_USER']   = 'svdrivers';
$GLOBALS['SVDRIVERS_DB_PASS']   = 'StrongPass_2026!';
$GLOBALS['JWT_SECRET']          = 'задайте длинную случайную строку и НЕ меняйте её';
$GLOBALS['TOKEN_PEPPER']        = 'ещё одна случайная строка';
$GLOBALS['PUBLIC_APP_URL']      = 'http://localhost:8080'; // базовый URL для ссылок в письмах
// SMTP пустой -> письма пишутся в server-php/data/outbox/*.json (для локальной проверки)
$GLOBALS['SMTP_HOST']           = 'smtp.yandex.ru';
$GLOBALS['SMTP_PORT']           = '465';
$GLOBALS['SMTP_SECURE']         = 'true';
$GLOBALS['SMTP_USER']           = 'you@yandex.ru';
$GLOBALS['SMTP_PASS']           = 'app-password';
$GLOBALS['MAIL_FROM']           = 'no-reply@svdrivers.local';
```

Все переменные также читаются из окружения (`getenv`), если вы предпочитаете задавать их в настройках пула IIS. Права на запись нужны только каталогу `server-php\data\` (outbox-письма; при sqlite-режиме — ещё и БД-файл там же):

```bat
icacls C:\inetpub\svdrivers-web\server-php\data /grant IIS_IUSRS:(OI)(CI)M /T
```

3. Примените схему и создайте первичных пользователей (cmd, из корня проекта или укажите полный путь):

```bat
C:\php\php.exe C:\inetpub\svdrivers-web\server-php\database\migrate.php
C:\php\php.exe C:\inetpub\svdrivers-web\server-php\database\seed.php
```

Созданные сидами учётки (сменить пароли после первого входа!):

| Роль | E-mail | Пароль |
|---|---|---|
| admin | admin@svdrivers.ru | Admin2026! |
| manager | manager@svdrivers.ru | Manager2026! |
| driver | driver@svdrivers.ru | Driver2026! |

---

## 5. (Не требуется) Автозапуск как служба Windows

Для PHP-бэкенда отдельная служба **не нужна**: код исполняет сам IIS через FastCGI (процессы `php-cgi.exe` пулит IIS, перезапускается вместе с сайтом/пулом). Раздел сохранён только для легаси Node-версии (`server/index.js`) — если она вам не используется, пропускайте.

<details>
<summary>Легаси: запуск Node API через NSSM (не нужен для PHP-сборки)</summary>

1. Скачайте NSSM: https://nssm.cc/download, распакуйте `win64\nssm.exe` в `C:\svdrivers-api\bin`.
2. Установка службы (cmd от администратора):

```bat
C:\svdrivers-api\bin\nssm install SVdriversAPI "C:\Program Files\nodejs\node.exe" "C:\svdrivers-api\server\index.js"
C:\svdrivers-api\bin\nssm set SVdriversAPI AppDirectory C:\svdrivers-api
C:\svdrivers-api\bin\nssm set SVdriversAPI AppEnvironmentExtra PORT=4000 JWT_SECRET=ЗаменитеНаСлучайнуюСтроку SMTP_HOST=smtp.yandex.ru SMTP_PORT=465 SMTP_USER=you@yandex.ru SMTP_PASS=app-password APP_BASE_URL=http://localhost:8080 SVDRIVERS_DATA_DIR=C:\svdrivers-data
C:\svdrivers-api\bin\nssm start SVdriversAPI
```

Логи службы: `C:\svdrivers-api\logs\` (задаются параметрами `stdout`/`stderr` в NSSM).

</details>

---

## 6. Схема базы данных

Единственная актуальная схема — **MySQL 8**: `server-php/database/schema.mysql.sql` (создаёт БД `svdrivers`, таблицы `users`, `auth_tokens`, `weekly_reports`, `audit_log` и индексы/FK). Применяется командой из п. 4.3; вручную:

```bat
mysql -u root -p < server-php\database\schema.mysql.sql
```

Файл `supabase/schema.postgres.sql` — историческая PostgreSQL-версия, для деплоя не используется. phpMyAdmin/Adminer (по желанию) подключается к той же MySQL по тем же креденшелам.

---

## 7. Сайт IIS + маршрутизация `/api/*` в PHP

1. IIS Manager → **Sites → Add Website**:
   - Site name: `SVdrivers`
   - Physical path: `C:\inetpub\svdrivers-web` (внутри — файлы из `dist\` и папка `server-php\`)
   - Port: `8080` (чтобы не конфликтовать с Default Web Site на :80)
2. Пул приложения: `SVdrivers`, .NET CLR — No Managed Code. Убедитесь, что обработчик `*.php` (FastCgiModule) назначен на этот сайт (раздел 2.1, шаг 6).
3. Создайте `C:\inetpub\svdrivers-web\web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <staticContent>
      <!-- корректные MIME для шрифтов/карт -->
      <remove fileExtension=".woff2" />
      <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
    </staticContent>
    <rewrite>
      <rules>
        <!-- 1. /api/* -> PHP (server-php/index.php) -->
        <rule name="API to PHP" stopProcessing="true">
          <match url="^api/(.*)$" />
          <action type="Rewrite" url="/server-php/index.php" />
        </rule>
        <!-- 2. Всё остальное -> index.html (SPA routing) -->
        <rule name="SPA fallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

Как это работает: URL Rewrite переписывает любой `/api/...` на `/server-php/index.php`; дальше за обработку отвечает сам `index.php` — он берёт путь из `REQUEST_URI` (поддерживается и деплой в виртуальный каталог вида `/SVdrivers/api/...`), матчит роуты (`/auth/*`, `/users*`, `/reports*`, `/me`, `/health`) и отдаёт JSON. Поэтому правило #1 сознательно всегда указывает на `index.php`, а не сохраняет хвост пути.

4. Фронтенд обращается к `/api/...` относительно своего адреса — ничего дополнительно настраивать не нужно.

> Альтернатива без правки web.config: создать «виртуальное приложение» `/api` на папку `server-php` (в этом случае внутри `server-php` положите свой `web.config` с правилом `.*` → `index.php`). Вариант с одним сайтом проще и уже протестирован.

---

## 8. Проверка после деплоя

1. `http://localhost:8080/api/health` → `{"ok":true,"service":"svdrivers-api-php"}` (значит PHP + маршрутизация работают).
2. `http://localhost:8080/` → страница входа SVdrivers.
3. Вход под учёткой сида (admin@svdrivers.ru) → создание пользователя (админ), письмо с ссылкой регистрации, принудительная смена пароля при первом входе.
4. Обновление страницы на внутреннем роуте (F5) → не 404 (значит SPA-fallback работает).
5. Сброс пароля по почте: при ненастроенном SMTP письмо появится в `server-php\data\outbox\` и в `GET /api/dev/outbox` (под админом); ссылка ведёт на `PUBLIC_APP_URL`.

---

## 9. Частые проблемы

| Симптом | Причина / решение |
|---|---|
| 500 на `/api/*`, пустое тело | Включите вывод ошибок PHP (`display_errors=1` временно) и смотрите `error.log` пула (`%SystemDrive%\inetpub\temp\PHP FastCGI Errors` / event viewer). Чаще всего: неверные креденшалы MySQL или не запущен сервис `mysqld` |
| 404 на `/api/health` | Не установлен URL Rewrite, нет `web.config` в веб-корне, или папка `server-php` не скопирована в сайт |
| «Access denied» / IIS 5.x ошибка на *.php | Обработчик FastCgiModule не назначен на сайт (раздел 2.1, шаг 6) или путь к `php-cgi.exe` неверный |
| Ошибка подключения к БД в логах | Проверьте `local-config.php` / env-переменные; пользователь `svdrivers` должен иметь доступ к БД `svdrivers` с `localhost`; раскомментируйте `extension=pdo_mysql` в `php.ini` |
| Письма не уходят | Проверьте `SMTP_*` (для Gmail/Yandex — только «пароль приложения»), порт 465/587, исходящие не блокируются антивирусом. Без SMTP письма копятся в `data\outbox` |
| Старый контент после обновления | Очистите кэш браузера (Ctrl+F5); при необходимости добавьте заголовки `Cache-Control` для `index.html` |
| Ошибка React #310 | Не делайте conditional hooks; пересоберите `npm run build:iis` и обновите `dist` |
| Нет прав на запись в `server-php\data` | Выдайте `IIS_IUSRS` Modify на каталог (нужен для outbox-писем) |

---

## 10. Резервное копирование

- MySQL: `mysqldump -u svdrivers -p svdrivers > backup.sql` по планировщику задач Windows.
- Обязательно бекапьте `server-php\config\local-config.php` (`JWT_SECRET`, `TOKEN_PEPPER`) — без них токены/сессии и хэши одноразовых токенов будут инвалидны, ссылки сброса пароля перестанут работать.
- Папку `server-php\data\outbox` бекапить не нужно (это лишь журнал неотправленных писем на время разработки).
