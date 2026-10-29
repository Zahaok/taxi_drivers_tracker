# Инструкция по деплою SVdrivers на локальный IIS (Windows)

Проект SVdrivers состоит из двух частей:

1. **Фронтенд** — SPA на React/Vite (статические файлы `dist/`), раздаётся IIS.
2. **Бэкенд** — Node.js API (`server/index.js`, порт 4000): авторизация, bcrypt-хэши паролей, почтовые приглашения/сброс, SQLite (или MySQL — см. раздел 6). PHP в проекте **не используется**, но инструкция показывает, как поднять IIS с PHP+MySQL и «пристегнуть» к нему Node-API через reverse proxy.

---

## 0. Что понадобится

| Компонент | Зачем | Где взять |
|---|---|---|
| IIS 10+ | Веб-сервер для статики + reverse proxy | «Включение компонентов Windows» |
| URL Rewrite 2.1 | Проксирование `/api/*` на Node | https://iis.net/downloads |
| ARR 3.0 (Application Request Routing) | Движок проксирования для URL Rewrite | https://iis.net/downloads |
| Node.js LTS 20+ | Запуск `server/index.js` | https://nodejs.org |
| Python 3 + Visual Studio Build Tools | Нативная сборка `better-sqlite3` на Windows | https://python.org, https://visualstudio.com |
| (опционально) PHP 8.x + MySQL 8 | Если хотите использовать MySQL вместо SQLite и свой PHP-код | https://windows.php.net/download, https://dev.mysql.com/downloads |

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

### 1.1 Установите расширения (если ещё не стоят)

Скачайте и установите (msi, «Next» до конца):
- **URL Rewrite** — https://www.iis.net/downloads/microsoft/url-rewrite
- **ARR 3.0** — https://www.iis.net/downloads/microsoft/application-request-routing

После установки ARR: ИИС → корневой сервер → **Application Request Routing Cache → Server Proxy Settings** → включить **Enable proxy cache** → Apply.

---

## 2. PHP и MySQL (опционально, по вашему запросу)

Проект самодостаточен без PHP, но если PHP+MySQL нужны (например, для сопутствующих скриптов или миграции БД):

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
npm run build -- --config vite.config.prod.js
```

> `vite.config.prod.js` использует `base: "./"` — ассеты идут по относительным путям, билд работает из любого виртуального каталога IIS.

Результат — папка `dist\`. Скопируйте её содержимое в веб-корень сайта, например `C:\inetpub\svdrivers-web`.

Установите права:
```bat
icacls C:\inetpub\svdrivers-web /grant IIS_IUSRS:(OI)(CI)RX /T
```

---

## 4. Установка бэкенда (Node API)

1. Скопируйте проект (без `node_modules`) в `C:\svdrivers-api`.
2. Установите зависимости. Для нативного модуля `better-sqlite3` на Windows нужны Python 3 и VS Build Tools (галочка «Desktop development with C++»):

```bat
cd C:\svdrivers-api
npm ci --omit=dev
```

Если сборка нативного модуля не удаётся — используйте готовый prebuild (обычно скачивается автоматически) или переключитесь на MySQL (раздел 6).

3. Настройте `.env`-переменные (можно задать в свойствах сервиса NSSM, см. п. 5):

| Переменная | Пример | Назначение |
|---|---|---|
| `PORT` | `4000` | Порт API |
| `SVDRIVERS_DATA_DIR` | `C:\svdrivers-data` | Каталог SQLite-файла |
| `JWT_SECRET` | длинная случайная строка | Подпись токенов |
| `SMTP_HOST` / `SMTP_PORT` | `smtp.yandex.ru` / `465` | Отправка писем (регистрация, сброс пароля) |
| `SMTP_USER` / `SMTP_PASS` | логин / app-пароль | Учётная запись почты |
| `MAIL_FROM` | `no-reply@svdrivers.local` | Отправитель |
| `APP_BASE_URL` | `http://localhost:8080` | Ссылки в письмах (подтверждение e-mail, сброс пароля) |

Первичный админ-пользователь создаётся сидом:
```bat
node server\seed.js
```

---

## 5. Автозапуск API как служба Windows (NSSM)

1. Скачайте NSSM: https://nssm.cc/download, распакуйте `win64\nssm.exe` в `C:\svdrivers-api\bin`.
2. Установка службы (cmd от администратора):

```bat
C:\svdrivers-api\bin\nssm install SVdriversAPI "C:\Program Files\nodejs\node.exe" "C:\svdrivers-api\server\index.js"
C:\svdrivers-api\bin\nssm set SVdriversAPI AppDirectory C:\svdrivers-api
C:\svdrivers-api\bin\nssm set SVdriversAPI AppEnvironmentExtra PORT=4000 JWT_SECRET=ЗаменитеНаСлучайнуюСтроку SMTP_HOST=smtp.yandex.ru SMTP_PORT=465 SMTP_USER=you@yandex.ru SMTP_PASS=app-password APP_BASE_URL=http://localhost:8080 SVDRIVERS_DATA_DIR=C:\svdrivers-data
C:\svdrivers-api\bin\nssm start SVdriversAPI
```

3. Проверка: `curl http://localhost:4000/api/health` (или откройте в браузере) — должен быть JSON-ответ.

Логи службы: `C:\svdrivers-api\logs\` (задаются параметрами `stdout`/`stderr` в NSSM).

---

## 6. Вариант с MySQL вместо SQLite

Текущий слой данных (`server/db.js`) — SQLite. Схема портируется на MySQL один-в-один (та же структура `users`, `auth_tokens`, типы `TEXT→VARCHAR(191)`, `INTEGER→TINYINT`). Порядок действий:

1. Замените драйвер: `npm i mysql2` (bcrypt-хэши и JWT остаются без изменений).
2. В `db.js` замените `better-sqlite3` на `mysql2/promise` (пул соединений), плейсхолдеры `?` совпадают, `COLLATE NOCASE` → `utf8mb4_unicode_ci`.
3. Строку подключения вынесите в env: `MYSQL_HOST=localhost; MYSQL_DB=svdrivers; MYSQL_USER=svdrivers; MYSQL_PASS=...`.

> Если нужен PHP-слой (например, adminer/phpMyAdmin для управления БД) — установите phpMyAdmin в отдельный сайт IIS, он подключится к той же MySQL по тем же креденшелам.

---

## 7. Сайт IIS + reverse proxy на Node

1. IIS Manager → **Sites → Add Website**:
   - Site name: `SVdrivers`
   - Physical path: `C:\inetpub\svdrivers-web`
   - Port: `8080` (чтобы не конфликтовать с Default Web Site на :80)
2. Пул приложения: `SVdrivers`, .NET CLR — No Managed Code.
3. **SPA-fallback и прокси API.** Отредактируйте `C:\inetpub\svdrivers-web\web.config`:

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
        <!-- 1. /api/* -> Node.js (localhost:4000) -->
        <rule name="Proxy API to Node" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="http://localhost:4000/api/{R:1}" />
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

4. Фронтенд обращается к `/api/...` относительно своего адреса — при проксировании через IIS ничего дополнительно настраивать не нужно.

---

## 8. Проверка после деплоя

1. `http://localhost:8080/` → страница входа SVdrivers.
2. Вход под учёткой сида → создание пользователя (админ), письмо с ссылкой регистрации, принудительная смена пароля при первом входе.
3. `http://localhost:8080/api/health` → JSON (значит прокси работает).
4. Обновление страницы на внутреннем роуте (F5) → не 404 (значит SPA-fallback работает).
5. Сброс пароля по почте → ссылка ведёт на `APP_BASE_URL`.

---

## 9. Частые проблемы

| Симптом | Причина / решение |
|---|---|
| 502.5 / пустой ответ на `/api/*` | ARR не включён (Server Proxy Settings) или служба SVdriversAPI не запущена |
| 404 на F5 внутри приложения | Нет `web.config` с SPA-fallback или URL Rewrite не установлен |
| `better-sqlite3` не собирается | Нужны Python 3 + VS Build Tools (C++); либо переход на MySQL (раздел 6) |
| Письма не уходят | Проверьте `SMTP_*` (для Gmail/Yandex — только «пароль приложения»), порт 465/587, антивирус не блокирует исходящие |
| Старый контент после обновления | Очистите кэш браузера (Ctrl+F5); при необходимости добавьте заголовки `Cache-Control` для `index.html` |
| Ошибка React #310 | Не делайте conditional hooks; пересоберите `npm run build -- --config vite.config.prod.js` и обновите `dist` |
| Права на `C:\svdrivers-data` | Выдайте `IIS_IUSRS`/`NETWORK SERVICE` Modify на каталог данных SQLite (WAL требует записи) |

---

## 10. Резервное копирование

- SQLite: останавливать службу не обязательно (WAL), но надёжнее копировать снапшот:
  `copy C:\svdrivers-data\svdrivers.db* E:\backup\` (по планировщику задач).
- MySQL: `mysqldump -u svdrivers -p svdrivers > backup.sql` по планировщику.
- Обязательно бекапьте `JWT_SECRET` и конфиги — без них токены/сессии будут инвалидны.
