import { getWheelyBreakdown } from './wheely';
import { getYandexBreakdown } from './yandex';

export interface PayoutInput {
  wheelyGross: number;
  wheelyAgentFee: number;      // агентское вознаграждение (- из Wheely)
  wheelyAirportParking: number; // парковка аэропорт (- из Wheely)
  yandexGross: number;
  yandexTips: number;          // чаевые Яндекс (- из заработка по Яндекс)
  zsd: number;                 // ЗСД (- из заработка по Яндекс и из общей выплаты)
  ownRentGross: number;
  hourlyRentHours: number;
  compensations: number;
  bonuses: number;             // бонусы (+ к Wheely)
  tips: number;                // чаевые (+ к итоговой выплате)
  deductions: number;
}

export function calculateDriverPayout(input: PayoutInput): number;
// Совместимость со старым позиционным вызовом
export function calculateDriverPayout(
  wheelyGross: number,
  yandexGross: number,
  ownRentGross: number,
  hourlyRentHours: number,
  compensations: number,
  bonuses: number,
  deductions: number
): number;
export function calculateDriverPayout(
  arg: PayoutInput | number,
  yandexGross?: number,
  ownRentGross?: number,
  hourlyRentHours?: number,
  compensations?: number,
  bonuses?: number,
  deductions?: number
): number {
  let p: PayoutInput;
  if (typeof arg === 'object') {
    p = arg;
  } else {
    p = {
      wheelyGross: arg,
      wheelyAgentFee: 0,
      wheelyAirportParking: 0,
      yandexGross: yandexGross ?? 0,
      yandexTips: 0,
      zsd: 0,
      ownRentGross: ownRentGross ?? 0,
      hourlyRentHours: hourlyRentHours ?? 0,
      compensations: compensations ?? 0,
      bonuses: bonuses ?? 0,
      tips: 0,
      deductions: deductions ?? 0,
    };
  }

  // Чистый доход по Wheely: база 30% − агентское − парковка + бонусы
  const wheelyNet = getWheelyBreakdown({
    wheely_gross: p.wheelyGross,
    wheely_agent_fee: p.wheelyAgentFee,
    wheely_airport_parking: p.wheelyAirportParking,
    bonuses: p.bonuses,
  }).net;

  // Чистый заработок по Яндекс: база 35% − чаевые − ЗСД
  const yandex = getYandexBreakdown({
    yandex_gross: p.yandexGross,
    yandex_tips: p.yandexTips,
    zsd: p.zsd,
  });
  const ownRentEarnings = p.ownRentGross * 0.30;
  const hourlyRentEarnings = p.hourlyRentHours * 500;

  // Чаевые (общие) прибавляются к общей выплате;
  // ЗСД additionally вычитается из общей выплаты (двойное удержание по бизнес-логике)
  return wheelyNet + yandex.net + ownRentEarnings + hourlyRentEarnings
    + p.compensations + p.tips - p.deductions - p.zsd;
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getWeekRange(year: number, weekNumber: number): { start: Date; end: Date } {
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay() || 7;
  const start = new Date(jan1);
  start.setDate(jan1.getDate() + (weekNumber - 1) * 7 - (dayOfWeek - 1));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(amount);
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older browsers / non-secure contexts
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// Escape a value for CSV (RFC 4180): wrap in quotes if it contains ; " or newline
function csvEscape(value: unknown): string {
  const s = String(value ?? '');
  if (/[";\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function hashPassword(password: string): string {
  // Simple hash for demo (in real PHP app, use password_hash)
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hashed_' + Math.abs(hash).toString(36) + '_' + password.length;
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function exportToCSV(reports: any[], users: any[], filename: string = 'reports.csv') {
  const headers = ['Водитель', 'Год', 'Неделя', 'Wheely (грязные)', 'Агентское Wheely (-)', 'Парковка аэропорт (-)', 'Бонусы Wheely (+)', 'Wheely (чистый)', 'Яндекс (грязные)', 'Чаевые Яндекс (-)', 'ЗСД (-)', 'Яндекс (чистый)', 'Возврат руководителю (65%)', 'Собств. аренда', 'Почас. часы', 'Компенсации', 'Чаевые', 'Вычеты', 'Итого к выплате'];
  const rows = reports.map(r => {
    const user = users.find(u => u.id === r.user_id);
    const w = getWheelyBreakdown(r);
    const y = getYandexBreakdown(r);
    return [
      user?.username || 'N/A',
      r.year,
      r.week_number,
      r.wheely_gross,
      r.wheely_agent_fee ?? 0,
      r.wheely_airport_parking ?? 0,
      r.bonuses,
      Math.round(w.net),
      r.yandex_gross,
      r.yandex_tips ?? 0,
      r.zsd ?? 0,
      Math.round(y.net),
      Math.round(y.managerRepayment),
      r.own_rent_gross,
      r.hourly_rent_hours,
      r.compensations,
      r.tips ?? 0,
      r.deductions,
      Number.isFinite(r.total_driver_payout) ? r.total_driver_payout.toFixed(2) : ''
    ];
  });

  const csvContent = [headers, ...rows].map(row => row.map(csvEscape).join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Release the object URL to avoid memory leaks
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
