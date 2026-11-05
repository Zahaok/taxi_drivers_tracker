<?php
// SVdrivers PHP — почтовая служба (без внешних зависимостей, нативный SMTP).
// Если заданы SMTP_* — реальная отправка (STARTTLS/SSL, AUTH LOGIN/PLAIN).
// Иначе письма пишутся в data/outbox/*.json (видно админу через GET /api/dev/outbox),
// чтобы flow регистрации/сброса был полностью проверяемым локально.

function mailer_send(array $msg): array // $msg: {to, subject, text, html}
{
    $host = $GLOBALS['SMTP_HOST'] ?? '';
    if ($host !== '' && ($GLOBALS['SMTP_USER'] ?? '') !== '') {
        try {
            smtp_send($msg);
            return ['delivered' => true, 'via' => 'smtp'];
        } catch (Throwable $e) {
            error_log('[mailer] SMTP error: ' . $e->getMessage());
            // при сбое SMTP всё равно сохраняем в outbox, чтобы письмо не потерялось
        }
    }
    $dir = rtrim($GLOBALS['SVDRIVERS_DATA_DIR'], '\\/') . '/outbox';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $file = $dir . '/' . sprintf('%d_%s.json', (int)(microtime(true) * 1000), bin2hex(random_bytes(4)));
    @file_put_contents($file, json_encode($msg, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    return ['delivered' => true, 'via' => 'outbox', 'file' => $file];
}

function send_registration_email(array $user, string $token): array
{
    $link = rtrim($GLOBALS['PUBLIC_APP_URL'], '/') . '/#/activate?token=' . urlencode($token);
    $days = max(1, (int)round(TokensRepo_ttl('registration') / 1440));
    return mailer_send([
        'to'      => $user['email'],
        'subject' => 'SVdrivers: подтвердите регистрацию',
        'text'    => "Здравствуйте, {$user['username']}!\n\nДля завершения регистрации в SVdrivers перейдите по ссылке (действует {$days} сут.):\n$link\n\n"
                   . "Если аккаунт создавал администратор — пароль для первого входа выдан ему; после активации система потребует сменить его.",
        'html'    => '<p>Здравствуйте, <b>' . e($user['username']) . '</b>!</p>'
                   . '<p>Для завершения регистрации в <b>SVdrivers</b> перейдите по ссылке:</p>'
                   . '<p><a href="' . e($link) . '">' . e($link) . '</a></p>'
                   . '<p style="color:#666">Ссылка действует ' . $days . ' сут. После активации будет обязательна смена пароля.</p>',
    ]);
}

function send_reset_email(array $user, string $token): array
{
    $link = rtrim($GLOBALS['PUBLIC_APP_URL'], '/') . '/#/reset-password?token=' . urlencode($token);
    $min = TokensRepo_ttl('reset');
    return mailer_send([
        'to'      => $user['email'],
        'subject' => 'SVdrivers: сброс пароля',
        'text'    => "{$user['username']}, для смены пароля откройте ссылку (действует {$min} мин):\n$link\n\nЕсли запрос отправляли не вы — просто проигнорируйте письмо.",
        'html'    => '<p>Здравствуйте, <b>' . e($user['username']) . '</b>!</p>'
                   . '<p>Для установки нового пароля откройте ссылку:</p>'
                   . '<p><a href="' . e($link) . '">' . e($link) . '</a></p>'
                   . '<p style="color:#666">Ссылка действует ' . $min . ' минут и одноразовая. Если запрос отправляли не вы — игнорируйте письмо.</p>',
    ]);
}

function e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

// ---------- минимальный SMTP-клиент ----------
function smtp_send(array $msg): void
{
    $host   = $GLOBALS['SMTP_HOST'];
    $port   = (int)($GLOBALS['SMTP_PORT'] ?: 587);
    $secure = filter_var($GLOBALS['SMTP_SECURE'], FILTER_VALIDATE_BOOLEAN);
    $user   = $GLOBALS['SMTP_USER'];
    $pass   = $GLOBALS['SMTP_PASS'];
    $from   = $GLOBALS['MAIL_FROM'] ?: $user;

    $remote = ($secure ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $sock = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$sock) throw new RuntimeException("connect $host:$port -> $errstr ($errno)");
    stream_set_timeout($sock, 15);

    $expect = fn() => smtp_read($sock);
    $cmd = function (string $c) use ($sock, $expect) { fwrite($sock, $c . "\r\n"); return $expect(); };

    $expect(); // greeting
    $cmd('EHLO svdrivers.local');

    if (!$secure) {
        // STARTTLS для портов 587/25
        $resp = $cmd('STARTTLS');
        if (str_starts_with($resp, '220')) {
            if (!stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('STARTTLS negotiate failed');
            }
            $expect();
            $cmd('EHLO svdrivers.local');
        }
    }

    // Выбор поддерживаемого механизма аутентификации
    $authResp = $cmd('AUTH LOGIN');
    if (str_starts_with($authResp, '504') || str_starts_with($authResp, '530') || str_starts_with($authResp, '500')) {
        $cmd('AUTH PLAIN ' . base64_encode("\0$user\0$pass"));
    } else {
        $cmd(base64_encode($user));
        $cmd(base64_encode($pass));
    }

    $cmd('MAIL FROM:<' . $from . '>');
    $cmd('RCPT TO:<' . $msg['to'] . '>');
    $cmd('DATA');

    $boundary = 'svdr-' . bin2hex(random_bytes(8));
    $headers = [
        'From: ' . $from,
        'To: ' . $msg['to'],
        'Subject: =?UTF-8?B?' . base64_encode($msg['subject']) . '?=',
        'Date: ' . date('r'),
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    ];
    $body = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
          . chunk_split(base64_encode($msg['text']))
          . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
          . chunk_split(base64_encode($msg['html']))
          . "--$boundary--\r\n";

    $data = implode("\r\n", $headers) . "\r\n\r\n" . $body;
    $data = preg_replace('/^\./m', '..', $data); // dot-stuffing
    $cmd($data . "\r\n.");
    $cmd('QUIT');
    fclose($sock);
}

function smtp_read($sock): string
{
    $out = '';
    while ($line = fgets($sock, 1024)) {
        $out .= $line;
        if (strlen($line) < 4 || $line[3] === ' ') break; // последняя строка многострочного ответа
    }
    return trim($out);
}

function TokensRepo_ttl(string $kind): int
{
    require_once __DIR__ . '/TokensRepo.php';
    return TokensRepo::ttlMinutes($kind);
}
