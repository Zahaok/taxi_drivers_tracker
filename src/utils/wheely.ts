import { WeeklyReport } from '../types';
import { calculateDriverPayout, effectiveZsdPayout } from './calculations';

// Пересчёт сохранённого итога выплаты из актуальных данных отчёта (см. migrateReport).
export function recalcPayout(r: WeeklyReport): number {
  const n = (v: unknown) => {
    const x = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  return calculateDriverPayout({
    wheelyGross: n(r.wheely_gross),
    wheelyAgentFee: n(r.wheely_agent_fee),
    wheelyAirportParking: n(r.wheely_airport_parking),
    soberDriver: n(r.sober_driver),
    wheelyTips: n(r.wheely_tips),
    yandexGross: n(r.yandex_gross),
    yandexTips: n(r.yandex_tips),
    zsd: n(r.zsd),
    ownRentGross: n(r.own_rent_gross),
    zsdOwnRent: n(r.zsd_own_rent),
    hourlyRentHours: n(r.hourly_rent_hours),
    compensations: n(r.compensations),
    bonuses: n(r.bonuses),
    adjustmentBonuses: n(r.adjustmentBonuses),
    fines: n(r.fines),
    zsdPayout: n(r.zsdPayout),
  });
}

// Единая точка правды для расчёта дохода по Wheely.
// Формула (актуальная бизнес-логика):
//   Общий заработок по Wheely
//   − агентское вознаграждение
//   − парковка аэропорт
//   − трезвый водитель (сумма также автоматически попадает в компенсации и прибавляется к итоговой выплате)
//   = чистый заработок Wheely (после вычета комиссии)
//   Водитель забирает свои 30% от чистого заработка; остаток (70%) — возврат руководителю.
//   БОНУСЫ НЕ участвуют в распределении 30/70: они прибавляются к уже вычтенным 30% водителя
//   (пример: заработок с учётом комиссии 30 000 ₽, бонус 700 ₽ → к выплате 30 700 ₽).
//   Чаевые Wheely НЕ участвуют в формуле выше — они прибавляются напрямую к итоговой сумме к выплате.

import { wheelyShare } from './settings';

// Доли задаются настройками администратора (см. utils/settings.ts).
// Значение по умолчанию: водитель 30%, сервис удерживает 70%.
export const DEFAULT_WHEELY_SHARE = 0.30;

export interface WheelyBreakdown {
  gross: number;          // общий доход Wheely
  agentFee: number;       // агентское вознаграждение (-)
  airportParking: number; // парковка аэропорт (-)
  soberDriver: number;    // трезвый водитель (-)
  bonuses: number;        // бонусы (+ к уже вычтенным 30% водителя, НЕ участвуют в распределении 30/70)
  netGross: number;       // чистый заработок Wheely после всех вычетов (до распределения 30/70)
  driverShare: number;    // 30% от netGross (без бонусов)
  base: number;           // сумма к выплате по Wheely: driverShare + bonuses
  managerShare: number;   // 70% от netGross — удерживается сервисом Wheely и автоматически
                          // отправляется работодателю; водителем НЕ переводится (в «Подлежит переводу» не входит)
  net: number;            // то же, что base (итог по Wheely для водителя с учётом бонусов)
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Округляем копейки до целых рублей (в большую или меньшую сторону — по математическим правилам).
// Это исключает «хвосты» вида 1234.5 из-за процентных долей (30%).
export const roundRubles = (v: number): number => Math.round(v);

export function getWheelyBreakdown(
  report: Partial<Pick<WeeklyReport,
    'wheely_gross' | 'wheely_agent_fee' | 'wheely_airport_parking' | 'sober_driver' | 'bonuses'>>
): WheelyBreakdown {
  const gross = num(report.wheely_gross);
  const agentFee = num(report.wheely_agent_fee);
  const airportParking = num(report.wheely_airport_parking);
  const soberDriver = num(report.sober_driver);
  const bonuses = num(report.bonuses);
  // Чистый заработок после вычетов — БЕЗ бонусов (бонусы не участвуют в распределении 30/70).
  const netGross = roundRubles(gross - agentFee - airportParking - soberDriver);
  const share = wheelyShare();
  const driverShare = roundRubles(netGross * share);                 // доля водителя от чистого заработка
  const base = roundRubles(driverShare + bonuses);                   // к выплате: доля водителя + бонусы
  // Справка: остаток удерживает сервис Wheely и автоматически переводит работодателю.
  // Водитель ничего не должен — эта сумма НЕ включается в «Подлежит переводу».
  const managerShare = roundRubles(netGross * (1 - share));
  return { gross, agentFee, airportParking, soberDriver, bonuses, netGross, driverShare, base, managerShare, net: base };
}

// Совместимость со старыми данными (localStorage), где новых полей нет.
// ВАЖНО: total_driver_payout всегда пересчитывается по актуальной формуле,
// иначе отчёты, сохранённые старой версией приложения, показывают устаревшие итоги
// (например, без учёта бонусов Wheely).
export function migrateReport(r: any): WeeklyReport {
  const migrated: WeeklyReport = {
    ...r,
    grnz: typeof r.grnz === 'string' ? r.grnz : '',
    mileage: num(r.mileage),
    car: typeof r.car === 'string' ? r.car : '',
    wheely_agent_fee: num(r.wheely_agent_fee),
    wheely_airport_parking: num(r.wheely_airport_parking),
    sober_driver: num(r.sober_driver),
    wheely_tips: num(r.wheely_tips),
    yandex_tips: num(r.yandex_tips),
    zsd: num(r.zsd),
    zsd_own_rent: num(r.zsd_own_rent),
    adjustmentBonuses: num(r.adjustmentBonuses),
    fines: num(r.fines),
    // ЗСД к выплате автоподтягивается из ЗСД по Яндекс И ЗСД по собственной аренде (если заданы);
    // вручную можно переопределить в форме.
    zsdPayout: effectiveZsdPayout(num(r.zsd), num(r.zsd_own_rent)),
    comment: typeof r.comment === 'string' ? r.comment : '',
  };
  migrated.total_driver_payout = recalcPayout(migrated);
  return migrated;
}
