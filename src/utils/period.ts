// Единый модуль «отчётных периодов». Недельные и дневные отчёты используют одну и ту же
// логику (одна сущность WeeklyReport, одни расчёты), различается только задание периода:
//   weekly — year + week_number (пн–вс); daily — year + month + day (один день).
import { WeeklyReport, ReportPeriod } from '../types';
import { getWeekRange, formatDate } from './calculations';

export type PeriodKind = ReportPeriod;

export interface Period {
  kind: PeriodKind;
  year: number;
  weekNumber: number; // для daily == 0
  month: number;      // для weekly == 0
  day: number;        // для weekly == 0
}

export const periodOf = (r: Pick<WeeklyReport, 'period'>): PeriodKind =>
  r.period === 'daily' ? 'daily' : 'weekly';

export function makePeriod(kind: PeriodKind, year: number, weekNumberOrMonth: number, day?: number): Period {
  return kind === 'daily'
    ? { kind, year, weekNumber: 0, month: weekNumberOrMonth, day: day ?? 1 }
    : { kind, year, weekNumber: weekNumberOrMonth, month: 0, day: 0 };
}

export function periodFromReport(r: WeeklyReport): Period {
  return makePeriod(periodOf(r), r.year, r.period === 'daily' ? (r.month ?? 1) : r.week_number, r.day);
}

// Границы периода в виде дат (start === end для дневного)
export function getPeriodRange(p: Period): { start: Date; end: Date } {
  if (p.kind === 'daily') {
    const d = new Date(p.year, p.month - 1, p.day);
    return { start: d, end: d };
  }
  return getWeekRange(p.year, p.weekNumber);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// Подпись периода для списков/деталей: «03.11.2026» или «03.11.2026 — 09.11.2026»
export function formatPeriodLabel(p: Period): string {
  const { start, end } = getPeriodRange(p);
  return p.kind === 'daily' ? formatDate(start) : `${formatDate(start)} — ${formatDate(end)}`;
}

// Короткая подпись для форм: день недели + дата / диапазон недель
export function formatPeriodShort(p: Period): string {
  const { start, end } = getPeriodRange(p);
  if (p.kind === 'daily') {
    const wd = start.toLocaleDateString('ru-RU', { weekday: 'short' });
    return `${wd}, ${formatDate(start)}`;
  }
  return `${formatDate(start)} — ${formatDate(end)}`;
}

// Сортировка «самые свежие периоды первыми» (работает для смешанных списков)
export function comparePeriodsDesc(a: WeeklyReport, b: WeeklyReport): number {
  const pa = getPeriodRange(periodFromReport(a));
  const pb = getPeriodRange(periodFromReport(b));
  return pb.start.getTime() - pa.start.getTime();
}

// Уникальность периода у одного водителя: weekly — год+неделя, daily — год+месяц+день
export function samePeriod(a: WeeklyReport, b: WeeklyReport): boolean {
  if (periodOf(a) !== periodOf(b)) return false;
  if (a.year !== b.year) return false;
  return periodOf(a) === 'daily'
    ? a.month === b.month && a.day === b.day
    : a.week_number === b.week_number;
}

export const periodDuplicateMessage = (kind: PeriodKind) =>
  kind === 'daily' ? 'Отчёт за этот день уже существует' : 'Отчёт за эту неделю уже существует';

// ─── Конвертация между форматами хранения (MySQL-строка <-> клиентский объект) ───
export interface BackendReportRow { [k: string]: any }

const num = (v: any): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Строка из БД (snake_case, DECIMAL как строки, week_number=0 у дневных) → WeeklyReport
export function fromBackendRow(row: BackendReportRow): WeeklyReport {
  const kind: PeriodKind = row.period === 'daily' ? 'daily' : 'weekly';
  return {
    ...row,
    id: String(row.id),
    user_id: String(row.user_id),
    year: num(row.year),
    week_number: num(row.week_number),
    period: kind,
    month: kind === 'daily' ? num(row.month) : undefined,
    day: kind === 'daily' ? num(row.day) : undefined,
    mileage: row.mileage === null || row.mileage === undefined ? undefined : num(row.mileage),
    wheely_gross: num(row.wheely_gross),
    wheely_agent_fee: num(row.wheely_agent_fee),
    wheely_airport_parking: num(row.wheely_airport_parking),
    sober_driver: num(row.sober_driver),
    wheely_tips: num(row.wheely_tips),
    yandex_gross: num(row.yandex_gross),
    yandex_tips: num(row.yandex_tips),
    zsd: num(row.zsd),
    own_rent_gross: num(row.own_rent_gross),
    zsd_own_rent: row.zsd_own_rent === null || row.zsd_own_rent === undefined ? undefined : num(row.zsd_own_rent),
    hourly_rent_hours: num(row.hourly_rent_hours),
    compensations: num(row.compensations),
    bonuses: num(row.bonuses),
    adjustmentBonuses: num(row.adjustment_bonuses ?? row.adjustmentBonuses),
    fines: num(row.fines),
    zsdPayout: num(row.zsd_payout ?? row.zsdPayout),
    total_driver_payout: num(row.total_driver_payout),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  } as WeeklyReport;
}

// Клиентский отчёт → тело запроса API (camelCase-синонимы для совместимости с PHP-валидатором)
export function toBackendPayload(r: Partial<WeeklyReport>): BackendReportRow {
  const kind: PeriodKind = periodOf(r as WeeklyReport);
  return {
    ...r,
    period: kind,
    week_number: kind === 'daily' ? 0 : r.week_number ?? 0,
    month: kind === 'daily' ? r.month ?? 0 : 0,
    day: kind === 'daily' ? r.day ?? 0 : 0,
    adjustment_bonuses: r.adjustmentBonuses ?? 0,
    zsd_payout: r.zsdPayout ?? 0,
  };
}
