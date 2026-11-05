<?php
// /api/reports* — недельные отчёты водителей + аудит-лог изменений.
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
    $week = (int)($b['week_number'] ?? 0);
    if ($year < 2000 || $year > 2100) bad('Некорректный год');
    if ($week < 1 || $week > 53) bad('Номер недели должен быть от 1 до 53');
    $out['year'] = $year;
    $out['week_number'] = $week;
    return $out;
}

function can_view(array $user, array $report): bool
{
    return in_array($user['role'], ['manager', 'admin'], true) || (int)$report['user_id'] === (int)$user['id'];
}

function route_reports(string $method, string $path): void
{
    $user = require_auth();

    // GET /api/reports?userId=&year= — список отчётов
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
        $sql = 'SELECT r.*, u.username FROM weekly_reports r JOIN users u ON u.id = r.user_id';
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        $sql .= ' ORDER BY r.year DESC, r.week_number DESC';
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

        $dup = Db::one('SELECT id FROM weekly_reports WHERE user_id = ? AND year = ? AND week_number = ?',
            [$targetUserId, $data['year'], $data['week_number']]);
        if ($dup) json_out(409, ['error' => 'Отчёт за эту неделю уже существует']);

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
                // из тела запроса берём только известные поля
                ...array_intersect_key($b, array_flip(array_merge(report_fields(), ['year', 'week_number']))),
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
            // смена периода (год/неделя) тоже возможна
            if ((int)$report['year'] !== $data['year'] || (int)$report['week_number'] !== $data['week_number']) {
                $dup = Db::one('SELECT id FROM weekly_reports WHERE user_id = ? AND year = ? AND week_number = ? AND id <> ?',
                    [(int)$report['user_id'], $data['year'], $data['week_number'], $reportId]);
                if ($dup) json_out(409, ['error' => 'Отчёт за эту неделю уже существует']);
                $set[] = 'year = ?';         $execParams[] = $data['year'];
                $set[] = 'week_number = ?';  $execParams[] = $data['week_number'];
                $changes['period'] = ["{$report['year']}/W{$report['week_number']}", "{$data['year']}/W{$data['week_number']}"];
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
