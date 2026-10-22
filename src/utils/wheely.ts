import { WeeklyReport } from '../types';

// Единая точка правды для расчёта дохода по Wheely.
// Формула:
//   База Wheely = грязный доход × 30%
//   − агентское вознаграждение (вычитается из заработка по Wheely)
//   − парковка аэропорт (вычитается из заработка по Wheely)
//   + бонусы (прибавляются к заработку по Wheely)
// Чаевые НЕ входят в базу Wheely — они прибавляются к итоговой выплате.

export const WHEELY_SHARE = 0.30;

export interface WheelyBreakdown {
  gross: number;          // общий (грязный) доход Wheely
  base: number;           // доля водителя до корректировок (gross * 30%)
  agentFee: number;       // агентское вознаграждение (-)
  airportParking: number; // парковка аэропорт (-)
  bonuses: number;        // бонусы (+)
  net: number;            // чистый доход по Wheely
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function getWheelyBreakdown(
  report: Pick<
    WeeklyReport,
    'wheely_gross' | 'wheely_agent_fee' | 'wheely_airport_parking' | 'bonuses'
  > | Partial<Pick<WeeklyReport, 'wheely_gross' | 'wheely_agent_fee' | 'wheely_airport_parking' | 'bonuses'>>
): WheelyBreakdown {
  const gross = num(report.wheely_gross);
  const agentFee = num(report.wheely_agent_fee);
  const airportParking = num(report.wheely_airport_parking);
  const bonuses = num(report.bonuses);
  const base = gross * WHEELY_SHARE;
  const net = base - agentFee - airportParking + bonuses;
  return { gross, base, agentFee, airportParking, bonuses, net };
}

// Совместимость со старыми данными (localStorage), где новых полей нет.
export function migrateReport(r: any): WeeklyReport {
  return {
    ...r,
    wheely_agent_fee: num(r.wheely_agent_fee),
    wheely_airport_parking: num(r.wheely_airport_parking),
    yandex_tips: num(r.yandex_tips),
    zsd: num(r.zsd),
    tips: num(r.tips),
  };
}
