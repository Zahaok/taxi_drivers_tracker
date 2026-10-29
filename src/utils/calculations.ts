import { getWheelyBreakdown, roundRubles } from './wheely';
import { getYandexBreakdown } from './yandex';
import { getOwnRentBreakdown } from './ownRent';
import { hourlyRentRate } from './settings';

export interface PayoutInput {
  wheelyGross: number;
  wheelyAgentFee: number;      // агентское вознаграждение (- из Wheely)
  wheelyAirportParking: number; // парковка аэропорт (- из Wheely)
  soberDriver?: number;        // трезвый водитель (- из Wheely, + в компенсации к выплате)
  wheelyTips?: number;         // чаевые Wheely (+ к итоговой сумме к выплате)
  yandexGross: number;
  yandexTips: number;          // чаевые Яндекс (- из заработка по Яндекс)
  zsd: number;                 // ЗСД (- из заработка по Яндекс)
  ownRentGross: number;
  zsdOwnRent?: number;         // ЗСД по собственной аренде (- из суммы к выплате, автоподтягивается в корректировки)
  hourlyRentHours: number;
  compensations: number;
  bonuses: number;             // бонусы Wheely (+ к уже вычтенным 30% водителя, не участвуют в 30/70)
  adjustmentBonuses?: number;  // бонусы в корректировках к выплатам (+ к итоговой сумме к выплате)
  fines: number;               // штрафы (- из суммы к выплате)
  zsdPayout: number;           // ЗСД (- из суммы к выплате, корректировки к выплатам)
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
      soberDriver: 0,
      wheelyTips: 0,
      yandexGross: yandexGross ?? 0,
      yandexTips: 0,
      zsd: 0,
      ownRentGross: ownRentGross ?? 0,
      zsdOwnRent: 0,
      hourlyRentHours: hourlyRentHours ?? 0,
      compensations: compensations ?? 0,
      bonuses: bonuses ?? 0,
      adjustmentBonuses: 0,
      fines: deductions ?? 0, // старый параметр «вычеты» трактуем как штрафы
      zsdPayout: 0,
    };
  }

  // Сумма к выплате по Wheely: (общий − агентское − парковка − трезвый водитель) × 30% + бонусы.
  // Бонусы прибавляются к уже вычтенным 30% водителя и НЕ участвуют в распределении 30/70.
  const sober = p.soberDriver ?? 0;
  const wheelyNet = getWheelyBreakdown({
    wheely_gross: p.wheelyGross,
    wheely_agent_fee: p.wheelyAgentFee,
    wheely_airport_parking: p.wheelyAirportParking,
    sober_driver: sober,
    bonuses: p.bonuses,
  }).net;

  // Чистый заработок по Яндекс: база 35% − чаевые − ЗСД
  const yandex = getYandexBreakdown({
    yandex_gross: p.yandexGross,
    yandex_tips: p.yandexTips,
    zsd: p.zsd,
  });
  const ownRentEarnings = getOwnRentBreakdown({ own_rent_gross: p.ownRentGross }).base; // gross × доля водителя из настроек администратора
  const hourlyRentEarnings = p.hourlyRentHours * hourlyRentRate();

  // Корректировки к выплатам:
  //   трезвый водитель автоматически попадает в компенсации (+);
  //   бонусы корректировок прибавляются к итоговой сумме к выплате (+);
  //   штрафы вычитаются из суммы к выплате;
  //   ЗСД (из корректировок) также вычитается из суммы к выплате.
  //   чаевые Wheely прибавляются напрямую к итоговой сумме к выплате.
  // Итог округляем до целых рублей (копейки — в большую или меньшую сторону).
  return roundRubles(
    wheelyNet + yandex.net + ownRentEarnings + hourlyRentEarnings
    + p.compensations + sober + (p.wheelyTips ?? 0) + (p.adjustmentBonuses ?? 0) - p.fines - p.zsdPayout
  );
}

// Эффективный ЗСД для корректировок к выплатам: суммирует ЗСД по Яндекс и ЗСД по собственной аренде,
// если поле не переопределено вручную. Единая точка правды для формы, миграции и расчётов.
export function effectiveZsdPayout(zsdYandex: number, zsdOwnRent: number, manualOverride?: number | ''): number {
  if (manualOverride !== undefined && manualOverride !== '' && Number.isFinite(Number(manualOverride))) {
    return Number(manualOverride);
  }
  return (Number.isFinite(zsdYandex) ? zsdYandex : 0) + (Number.isFinite(zsdOwnRent) ? zsdOwnRent : 0);
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

// Компактная дата «дд.мм» — для подписей на осях графиков (без года и недель)
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
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

// Общая функция скачивания CSV-совместимого текста (BOM + ; разделитель — открывается в Excel)
function downloadCsv(headers: string[], rows: (string | number)[][], filename: string) {
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

export function exportToCSV(reports: any[], users: any[], filename: string = 'reports.csv') {
  const headers = ['Водитель', 'Год', 'Период (7 дней)', 'ГРНЗ', 'Пробег ТС, км', 'Wheely (общий)', 'Агентское Wheely (-)', 'Парковка аэропорт (-)', 'Трезвый водитель Wheely (-)', 'Бонусы Wheely (+ к 30% водителя)', 'Чаевые Wheely (+ к выплате)', 'Wheely (чистый общий)', 'Wheely водителю (30%)', 'Wheely к выплате (30% + бонусы)', 'Wheely 70% (удерживает сервис, не переводится водителем)', 'Яндекс (общий)', 'Чаевые Яндекс (-)', 'ЗСД (-)', 'Яндекс (чистый)', 'Подлежит переводу Яндекс (65%)', 'Аренда (собственная)', 'ЗСД аренда (-)', 'Аренда водителю (30%)', 'Подлежит переводу по аренде (70%)', 'Почас. часы', 'Компенсации', 'Бонусы корректировок (+)', 'Штрафы (-)', 'ЗСД к выплате (-)', 'Итого к выплате', 'Подлежит переводу (Яндекс + аренда)', 'Комментарий'];
  const rows = reports.map(r => {
    const user = users.find(u => u.id === r.user_id);
    const w = getWheelyBreakdown(r);
    const y = getYandexBreakdown(r);
    return [
      user?.username || 'N/A',
      r.year,
      (() => { const wr = getWeekRange(r.year, r.week_number); return `${formatDate(wr.start)} — ${formatDate(wr.end)}`; })(),
      r.grnz ?? '',
      r.mileage ?? 0,
      r.wheely_gross,
      r.wheely_agent_fee ?? 0,
      r.wheely_airport_parking ?? 0,
      r.sober_driver ?? 0,
      r.bonuses,
      r.wheely_tips ?? 0, // чаевые Wheely: прибавляются напрямую к итоговой выплате
      Math.round(w.netGross),
      Math.round(w.driverShare), // водителю 30% (без бонусов)
      Math.round(w.base),        // к выплате по Wheely: 30% + бонусы
      Math.round(w.managerShare), // справка: удерживает сервис Wheely, водителем не переводится
      r.yandex_gross,
      r.yandex_tips ?? 0,
      r.zsd ?? 0,
      Math.round(y.net),
      Math.round(y.managerRepayment),
      r.own_rent_gross,
      r.zsd_own_rent ?? 0,
      Math.round(getOwnRentBreakdown(r).base),
      Math.round(getOwnRentBreakdown(r).managerRepayment),
      r.hourly_rent_hours,
      r.compensations, // уже включает трезвого водителя (автокомпенсация)
      r.adjustmentBonuses ?? 0,
      r.fines ?? 0,
      r.zsdPayout ?? 0,
      Number.isFinite(r.total_driver_payout) ? Math.round(r.total_driver_payout) : '',
      Math.round(y.managerRepayment + getOwnRentBreakdown(r).managerRepayment), // Подлежит переводу (Яндекс + аренда; Wheely исключён — удерживает сервис)
      r.comment ?? ''
    ];
  });

  downloadCsv(headers, rows, filename);
}

// Экспорт детальной статистики в формат Excel (.xls через HTMLTable — открывается в MS Excel / Google Sheets / LibreOffice без доп. библиотек).
// Содержит сводки «доход по машине (ГРНЗ)» и «доход по водителю», а также детальные строки по каждому отчёту.
export function exportToExcel(reports: any[], users: any[], filename: string = 'SVdrivers_statistics.xls') {
  const esc = (v: unknown) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Группировка: доход по машине (ГРНЗ) и по водителю
  const byCar = new Map<string, { payout: number; wheely: number; yandex: number; rent: number; mileage: number; count: number }>();
  const byDriver = new Map<string, { payout: number; wheely: number; yandex: number; rent: number; transfer: number; count: number }>();

  for (const r of reports) {
    const w = getWheelyBreakdown(r);
    const y = getYandexBreakdown(r);
    const o = getOwnRentBreakdown(r);
    const carKey = (r.grnz ?? '').trim() || 'Без ГРНЗ';
    const c = byCar.get(carKey) ?? { payout: 0, wheely: 0, yandex: 0, rent: 0, mileage: 0, count: 0 };
    c.payout += r.total_driver_payout ?? 0;
    c.wheely += w.base;
    c.yandex += y.net;
    c.rent += o.base + (r.hourly_rent_hours ?? 0) * hourlyRentRate();
    c.mileage += r.mileage ?? 0;
    c.count += 1;
    byCar.set(carKey, c);

    const drv = users.find((u: any) => u.id === r.user_id);
    const dKey = drv?.username || 'Неизвестный';
    const d = byDriver.get(dKey) ?? { payout: 0, wheely: 0, yandex: 0, rent: 0, transfer: 0, count: 0 };
    d.payout += r.total_driver_payout ?? 0;
    d.wheely += w.base;
    d.yandex += y.net;
    d.rent += o.base + (r.hourly_rent_hours ?? 0) * hourlyRentRate();
    d.transfer += y.managerRepayment + o.managerRepayment;
    d.count += 1;
    byDriver.set(dKey, d);
  }

  const detailHeaders = ['Водитель', 'Год', 'Период (7 дней)', 'ГРНЗ', 'Пробег ТС, км', 'Wheely к выплате (30% + бонусы)', 'Яндекс (чистый)', 'Аренда (водителя)', 'Компенсации', 'Бонусы', 'Штрафы', 'ЗСД к выплате', 'Итого к выплате', 'Подлежит переводу', 'Комментарий'];
  const detailRows = reports.map(r => {
    const user = users.find((u: any) => u.id === r.user_id);
    const w = getWheelyBreakdown(r);
    const y = getYandexBreakdown(r);
    const o = getOwnRentBreakdown(r);
    return [
      user?.username || 'N/A',
      r.year,
      (() => { const wr = getWeekRange(r.year, r.week_number); return `${formatDate(wr.start)} — ${formatDate(wr.end)}`; })(),
      r.grnz ?? '',
      r.mileage ?? 0,
      Math.round(w.base),
      Math.round(y.net),
      Math.round(o.base + (r.hourly_rent_hours ?? 0) * hourlyRentRate()),
      Math.round(r.compensations ?? 0),
      Math.round((r.bonuses ?? 0) + (r.adjustmentBonuses ?? 0)),
      Math.round(r.fines ?? 0),
      Math.round(r.zsdPayout ?? 0),
      Math.round(r.total_driver_payout ?? 0),
      Math.round(y.managerRepayment + o.managerRepayment),
      r.comment ?? '',
    ];
  });

  const tableHtml = (caption: string, headers: string[], rows: (string | number)[][]) => `
    <h2>${esc(caption)}</h2>
    <table border="1" cellspacing="0" cellpadding="4">
      <thead><tr>${headers.map(h => `<th style="background:#f59e0b;color:#fff;font-weight:bold">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;

  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>SVdrivers</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>table{border-collapse:collapse}td,th{font-family:Calibri,Arial,sans-serif;font-size:11pt}</style></head><body>
<h1>SVdrivers — статистика</h1>
${tableHtml('Доход по автомобилям (ГРНЗ)', ['ГРНЗ', 'Отчётов', 'Пробег, км', 'Wheely (к выплате)', 'Яндекс (чистый)', 'Аренда (водителя)', 'Итого к выплате'],
  [...byCar.entries()].map(([car, s]) => [car, s.count, Math.round(s.mileage), Math.round(s.wheely), Math.round(s.yandex), Math.round(s.rent), Math.round(s.payout)]))}
${tableHtml('Доход по водителям', ['Водитель', 'Отчётов', 'Wheely (к выплате)', 'Яндекс (чистый)', 'Аренда (водителя)', 'Подлежит переводу', 'Итого к выплате'],
  [...byDriver.entries()].map(([drv, s]) => [drv, s.count, Math.round(s.wheely), Math.round(s.yandex), Math.round(s.rent), Math.round(s.transfer), Math.round(s.payout)]))}
${tableHtml('Детальные отчёты', detailHeaders, detailRows)}
</body></html>`;

  const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
