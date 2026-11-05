import { WeeklyReport } from '../types';
import { calculateDriverPayout, generateId } from './calculations';
import { toPayoutInput } from './wheely';

// Вспомогательный генератор случайных демо-сумм: с вероятностью p — значение
// в диапазоне [min, max], иначе 0 (имитация «незаполненности» поля).
const maybe = (p: number, min: number, range: number) =>
  Math.random() > p ? Math.floor(min + Math.random() * range) : 0;
const between = (min: number, range: number) => min + Math.random() * range;

export function generateDemoData(): Partial<WeeklyReport>[] {
  const now = new Date();
  const year = now.getFullYear();
  const currentWeek = Math.ceil(((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);

  // Профили демо-водителей: id, ГРНЗ, авто и диапазоны сумм (база + размах).
  const drivers = [
    { user_id: 'driver_1', grnz: 'Х571ТК 799', car: 'Kia Rio',
      wheely: [30000, 20000] as const, yandex: [25000, 15000] as const, rent: [15000, 10000] as const, mileage: [1800, 900] as const },
    { user_id: 'driver_2', grnz: 'У342МН 750', car: 'Hyundai Solaris',
      wheely: [25000, 18000] as const, yandex: [20000, 12000] as const, rent: [10000, 8000] as const, mileage: [1500, 800] as const },
  ];

  const reports: Partial<WeeklyReport>[] = [];
  for (const d of drivers) {
    for (let w = Math.max(1, currentWeek - 7); w <= currentWeek; w++) {
      reports.push({
        user_id: d.user_id,
        year,
        week_number: w,
        grnz: d.grnz,
        car: d.car,
        mileage: Math.floor(between(d.mileage[0], d.mileage[1])),
        wheely_gross: Math.floor(between(d.wheely[0], d.wheely[1])),
        wheely_agent_fee: maybe(0.45, 0, 1400),
        wheely_airport_parking: maybe(0.55, 0, 850),
        sober_driver: maybe(0.72, 450, 1350),
        wheely_tips: maybe(0.42, 0, 1350),
        yandex_gross: Math.floor(between(d.yandex[0], d.yandex[1])),
        yandex_tips: maybe(0.47, 0, 1650),
        zsd: maybe(0.32, 250, 1100),
        own_rent_gross: Math.floor(between(d.rent[0], d.rent[1])),
        zsd_own_rent: maybe(0.62, 160, 550),
        hourly_rent_hours: Math.floor(between(16, 22)),
        compensations: maybe(0.75, 0, 2500),
        bonuses: maybe(0.55, 0, 4000),
        adjustmentBonuses: maybe(0.72, 250, 1350),
        fines: maybe(0.55, 350, 1750),
        zsdPayout: maybe(0.32, 250, 1100),
      });
    }
  }

  return reports;
}

export function initializeDemoData() {
  const reportsKey = 'taxi_reports';
  const existing = localStorage.getItem(reportsKey);
  if (existing && JSON.parse(existing).length > 0) return;

  const now = new Date().toISOString();

  const fullReports: WeeklyReport[] = generateDemoData().map(r => {
    // Округляем исходные демо-суммы до рублей и нормализуем через единый toPayoutInput.
    const rounded: Partial<WeeklyReport> = Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v) : v])
    );
    const input = toPayoutInput(rounded);
    return {
      ...rounded,
      id: generateId(),
      created_at: now,
      updated_at: now,
      total_driver_payout: calculateDriverPayout(input),
    } as WeeklyReport;
  });

  localStorage.setItem(reportsKey, JSON.stringify(fullReports));
}
