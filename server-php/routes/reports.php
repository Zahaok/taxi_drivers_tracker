<?php
// /api/reports* — отчёты водителей (недельные и дневные, одна логика) + аудит-лог изменений.
// Права (как в матрице README):
//   driver  — видит/создаёт/редактирует/удаляет только СВОИ отчёты;
//   manager — видит все, редактирует чужие (с записью в report_edit_logs);
//   admin   — полный доступ, редактирование чужих тоже логируется.

require_once __DIR__ . '/../lib/http.php';
require_once __DIR__ . '/../lib/UsersRepo.php';
require_once __DIR__ . '/../lib/Db.php';

const REPORT_NUMERIC_FIELDS = [
    'mileage', 'wheely_gross', 'wheely_agent_fee', 'wheely_airport_parking',
    'sober_driver', 'wheely_tips', 'yandex_gross', 'yandex_tips', 'zsd',
    'own_rent_gross', 'zsd_own_rent', 'hourly_rent_hours', 'compensations',
    'bonuses', 'adjustment_bonuses', 'fines', 'zsd_payout', 'total_driver_payout',
];
const REPORT_TEXT_FIELDS = ['grnz', 'car', 'comment'];
// Период отчёта: weekly (год + ISO-неделя) или daily (год + месяц + день).
// Логика расчёта для обоих типов одна и та же — различается только задание периода.
const REPORT_PERIODS = ['weekly', 'daily'];

function report_fields(): array
{
    return array_merge(REPORT_NUMERIC_FIELDS, REPORT_TEXT_FIELDS);
}

// Нормализация входных данных отчёта
function normalize_report(array $b): array
{
    $out = [];
    foreach (REPORT_NUMERIC_FIELDS as $f) {
        $v = $b[$f] ?? 0;
        if ($v === null || $v === '') { $v = 0; }
        if (!is_numeric($v)) bad("Поле '$f' должно быть числом");
        $out[$f] = round((float)$v, 2);
    }
    foreach (REPORT_TEXT_FIELDS as $f) {
        $out[$f] = isset($b[$f]) && $b[$f] !== null ? mb_substr(trim((string)$b[$f]), 0, 500) : null;
    }
    $year = (int)($b['year'] ?? 0);
    if ($year < 2000 || $year > 2100) bad('Некорректный год');
    $out['year'] = $year;

    $period = ($b['period'] ?? 'weekly') === 'daily' ? 'daily' : 'weekly';
    if (!in_array($b['period'] ?? $period, REPORT_PERIODS, true)) bad('Некорректный тип периода');
    $out['period'] = $period;
    if ($period === 'weekly') {
        $week = (int)($b['week_number'] ?? 0);
        if ($week < 1 || $week > 53) bad('Номер недели должен быть от 1 до 53');
        $out['week_number'] = $week;
        $out['month'] = 0;
        $out['day'] = 0;
    } else {
        $month = (int)($b['month'] ?? 0);
        $day = (int)($b['day'] ?? 0);
        if ($month < 1 || $month > 12) bad('Номер месяца должен быть от 1 до 12');
        $daysInMonth = (int)date('t', mktime(0, 0, 0, $month, 1, $year));
        if ($day < 1 || $day > $daysInMonth) bad("Некорректный день месяца (в месяце $month/$year дней: $daysInMonth)");
        $out['week_number'] = 0;
        $out['month'] = $month;
        $out['day'] = $day;
    }
    return $out;
}

// Ключ уникальности периода (для проверки дублей одним запросом)
function period_key(array $data): string
{
    return $data['period'] === 'daily'
        ? "{$data['year']}-{$data['month']}-{$data['day']}"
        : "{$data['year']}-W{$data['week_number']}";
}

function period_exists(int $userId, array $data, ?int $excludeId = null): bool
{
    $sql = $data['period'] === 'daily'
        ? 'SELECT id FROM weekly_reports WHERE user_id = ? AND period = \'daily\' AND year = ? AND month = ? AND day = ?'
        : 'SELECT id FROM weekly_reports WHERE user_id = ? AND period = \'weekly\' AND year = ? AND week_number = ?';
    $params = $data['period'] === 'daily'
        ? [$userId, $data['year'], $data['month'], $data['day']]
        : [$userId, $data['year'], $data['week_number']];
    if ($excludeId !== null) { $sql .= ' AND id <> ?'; $params[] = $excludeId; }
    return Db::one($sql, $params) !== null;
}

function duplicate_error(string $period): array
{
    return ['error' => $period === 'daily' ? 'Отчёт за этот день уже существует' : 'Отчёт за эту неделю уже существует'];
}

function can_view(array $user, array $report): bool
{
    return in_array($user['role'], ['manager', 'admin'], true) || (int)$report['user_id'] === (int)$user['id'];
}

function route_reports(string $method, string $path): void
{
    $user = require_auth();

    // GET /api/reports?userId=&year=&period=weekly|daily — список отчётов
    if ($path === '' && $method === 'GET') {
        $where = [];
        $params = [];
        if ($user['role'] === 'driver') {
            $where[] = 'r.user_id = ?';
            $params[] = (int)$user['id'];
        } elseif (!empty($_GET['userId'])) {
            $where[] = 'r.user_id = ?';
            $params[] = (int)$_GET['userId'];
        }
        if (!empty($_GET['year'])) {
            $where[] = 'r.year = ?';
            $params[] = (int)$_GET['year'];
        }
        if (!empty($_GET['period']) && in_array($_GET['period'], REPORT_PERIODS, true)) {
            $where[] = 'r.period = ?';
            $params[] = $_GET['period'];
        }
        $sql = 'SELECT r.*, u.username FROM weekly_reports r JOIN users u ON u.id = r.user_id';
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        $sql .= ' ORDER BY r.year DESC, r.period ASC, r.week_number DESC, r.month DESC, r.day DESC';
        json_out(200, ['reports' => Db::all($sql, $params)]);
    }

    // POST /api/reports — создание (водитель — только свой; менеджер/админ — любой userId)
    if ($path === '' && $method === 'POST') {
        $b = body();
        $targetUserId = isset($b['userId']) ? (int)$b['userId'] : (int)$user['id'];
        if ($targetUserId !== (int)$user['id'] && $user['role'] === 'driver') {
            forbidden('Водитель может создавать только свои отчёты');
        }
        if (!UsersRepo::byId($targetUserId)) bad('Водитель не найден');
        $data = normalize_report($b);

        if (period_exists($targetUserId, $data)) json_out(409, duplicate_error($data['period']));

        $cols = ['user_id', ...array_keys($data)];
        $placeholders = implode(', ', array_fill(0, count($cols), '?'));
        Db::run(
            'INSERT INTO weekly_reports (' . implode(', ', $cols) . ") VALUES ($placeholders)",
            array_merge([$targetUserId], array_values($data))
        );
        $id = (int)Db::pdo()->lastInsertId();
        json_out(201, ['report' => Db::one('SELECT * FROM weekly_reports WHERE id = ?', [$id])]);
    }

    if (preg_match('#^/(\d+)(/.*)?$#', $path, $m)) {
        $reportId = (int)$m[1];
        $sub = $m[2] ?? '';
        $report = Db::one('SELECT * FROM weekly_reports WHERE id = ?', [$reportId]);
        if (!$report) notfound('Отчёт не найден');

        // GET /api/reports/{id}/logs — аудит-лог (менеджер/админ)
        if ($sub === '/logs' && $method === 'GET') {
            require_manager($user);
            $logs = Db::all(
                'SELECT l.*, u.username AS changed_by FROM report_edit_logs l
                 JOIN users u ON u.id = l.changed_by_user_id
                 WHERE l.report_id = ? ORDER BY l.changed_at DESC, l.id DESC',
                [$reportId]
            );
            json_out(200, ['logs' => $logs]);
        }

        if ($sub === '' && $method === 'GET') {
            if (!can_view($user, $report)) forbidden();
            json_out(200, ['report' => $report]);
        }

        // PUT /api/reports/{id} — редактирование
        if ($sub === '' && $method === 'PUT') {
            $b = body();
            $isOwner = (int)$report['user_id'] === (int)$user['id'];
            if ($user['role'] === 'driver' && !$isOwner) forbidden('Чужие отчёты недоступны');
            // менеджер/админ при правке ЧУЖОГО отчёта — пишем аудит-лог по каждому изменённому полю
            $editingOthersReport = !$isOwner;
            if ($editingOthersReport) require_manager($user);

            $data = normalize_report(array_merge($report, [
                // из тела запроса берём только известные поля (+ поля периода)
                ...array_intersect_key($b, array_flip(array_merge(
                    report_fields(), ['year', 'week_number', 'period', 'month', 'day'],
                ))),
            ]));

            $set = [];
            $execParams = [];
            $changes = [];
            foreach (report_fields() as $f) {
                $old = $report[$f];
                $new = $data[$f];
                $changed = $new === null ? $old !== null : (string)$new !== (string)($old ?? '');
                if ($changed) {
                    $set[] = "$f = ?";
                    $execParams[] = $new;
                    $changes[$f] = [(string)($old ?? ''), (string)($new ?? '')];
                }
            }
            // смена периода (тип / год / неделя / месяц / день) тоже возможна
            $periodChanged = (int)$report['year'] !== $data['year']
                || ($report['period'] ?? 'weekly') !== $data['period']
                || (int)($report['week_number'] ?? 0) !== $data['week_number']
                || (int)($report['month'] ?? 0) !== $data['month']
                || (int)($report['day'] ?? 0) !== $data['day'];
            if ($periodChanged) {
                if (period_exists((int)$report['user_id'], $data, $reportId)) {
                    json_out(409, duplicate_error($data['period']));
                }
                $set[] = 'period = ?';       $execParams[] = $data['period'];
                $set[] = 'year = ?';         $execParams[] = $data['year'];
                $set[] = 'week_number = ?';  $execParams[] = $data['week_number'];
                $set[] = 'month = ?';        $execParams[] = $data['month'];
                $set[] = 'day = ?';          $execParams[] = $data['day'];
                $changes['period'] = [period_key($report), period_key($data)];
            }

            if ($editingOthersReport) {
                $set[] = 'edited_by_admin = 1';
                $execParams[] = 1;
            }

            if ($set) {
                $execParams[] = $reportId;
                Db::run('UPDATE weekly_reports SET ' . implode(', ', $set) . ' WHERE id = ?', $execParams);

                if ($editingOthersReport) {
                    foreach ($changes as $field => [$oldV, $newV]) {
                        Db::run(
                            'INSERT INTO report_edit_logs (report_id, changed_by_user_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
                            [$reportId, (int)$user['id'], $field, $oldV, $newV]
                        );
                    }
                }
            }
            json_out(200, ['report' => Db::one('SELECT * FROM weekly_reports WHERE id = ?', [$reportId])]);
        }

        // DELETE /api/reports/{id} — водитель: свой; админ: любой (менеджер — нет, см. матрицу прав)
        if ($sub === '' && $method === 'DELETE') {
            $isOwner = (int)$report['user_id'] === (int)$user['id'];
            if ($user['role'] === 'admin' || ($user['role'] === 'driver' && $isOwner)) {
                Db::run('DELETE FROM weekly_reports WHERE id = ?', [$reportId]);
                json_out(200, ['ok' => true]);
            }
            forbidden('Удаление доступно администратору или владельцу отчёта');
        }
    }

    notfound('Эндпоинт не найден');
}
