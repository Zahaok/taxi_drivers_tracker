import { WeeklyReport } from '../types';
import { roundRubles } from './wheely';
import { ownRentShare } from './settings';
// Формула (по аналогии с Яндекс):
//   База водителя = общий доход × 30%
//   Возврат руководителю = общий доход × 70%
// Оставшуюся часть (70%) водитель направляет своему работодателю.

// Доли задаются настройками администратора (см. utils/settings.ts).
// Значение по умолчанию: водитель 30%, работодателю 70%.
export const DEFAULT_OWN_RENT_SHARE = 0.30;

export interface OwnRentBreakdown {
  gross: number;              // общий доход по собственной аренде
  base: number;               // доля водителя до корректировок (gross * 30%)
  managerRepayment: number;   // сумма, подлежащая возврату руководителю (70% от общего дохода)
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function getOwnRentBreakdown(
  report: Pick<WeeklyReport, 'own_rent_gross'> |
    Partial<Pick<WeeklyReport, 'own_rent_gross'>>
): OwnRentBreakdown {
  const gross = num(report.own_rent_gross);
  const share = ownRentShare();
  const base = roundRubles(gross * share);
  const managerRepayment = roundRubles(gross * (1 - share));
  return { gross, base, managerRepayment };
}
