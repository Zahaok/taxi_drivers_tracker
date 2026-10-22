import { WeeklyReport } from '../types';

// Единая точка правды для расчёта дохода по Яндекс.
// Формула:
//   База Яндекс = грязный доход × 35%
//   − чаевые (вычитаются из заработка по Яндекс)
//   − ЗСД (вычитается из заработка по Яндекс И из общей выплаты)
// Оставшуюся часть грязного дохода (65%) водитель направляет руководителю:
//   Возврат руководителю = грязный доход × 65%
// Примечание: ЗСД удерживается дважды — один раз внутри заработка по Яндекс,
// второй раз как вычет из итоговой выплаты водителя (согласно бизнес-логике).

export const YANDEX_SHARE = 0.35;
export const YANDEX_MANAGER_SHARE = 1 - YANDEX_SHARE; // 0.65

export interface YandexBreakdown {
  gross: number;              // общий (грязный) доход Яндекс
  base: number;               // доля водителя до корректировок (gross * 35%)
  tips: number;               // чаевые по Яндекс (-)
  zsd: number;                // ЗСД (-)
  net: number;                // чистый заработок по Яндекс (после чаевых и ЗСД)
  managerRepayment: number;   // сумма, подлежащая возврату руководителю (65% от грязных)
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function getYandexBreakdown(
  report: Pick<WeeklyReport, 'yandex_gross' | 'yandex_tips' | 'zsd'> |
    Partial<Pick<WeeklyReport, 'yandex_gross' | 'yandex_tips' | 'zsd'>>
): YandexBreakdown {
  const gross = num(report.yandex_gross);
  const tips = num(report.yandex_tips);
  const zsd = num(report.zsd);
  const base = gross * YANDEX_SHARE;
  const net = base - tips - zsd;
  const managerRepayment = gross * YANDEX_MANAGER_SHARE;
  return { gross, base, tips, zsd, net, managerRepayment };
}
