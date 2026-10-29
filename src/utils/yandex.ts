import { WeeklyReport } from '../types';
import { roundRubles } from './wheely';
import { yandexShare } from './settings';
// Формула:
//   База Яндекс = общий доход × 35%
//   − чаевые (вычитаются из заработка по Яндекс)
//   − ЗСД (вычитается из заработка по Яндекс И из общей выплаты)
// Оставшуюся часть общего дохода (65%) водитель направляет руководителю:
//   Возврат руководителю = общий доход × 65%
// Примечание: ЗСД удерживается дважды — один раз внутри заработка по Яндекс,
// второй раз как вычет из итоговой выплаты водителя (согласно бизнес-логике).

// Доли задаются настройками администратора (см. utils/settings.ts).
// Значения по умолчанию: водитель 35%, руководитель 65%.
export const DEFAULT_YANDEX_SHARE = 0.35;

export interface YandexBreakdown {
  gross: number;              // общий доход Яндекс
  base: number;               // доля водителя до корректировок (gross * 35%)
  tips: number;               // чаевые по Яндекс (-)
  zsd: number;                // ЗСД (-)
  net: number;                // чистый заработок по Яндекс (после чаевых и ЗСД)
  managerRepayment: number;   // сумма, подлежащая возврату руководителю (65% от общего дохода)
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
  const share = yandexShare();
  const base = roundRubles(gross * share);
  const net = roundRubles(base - tips - zsd);
  const managerRepayment = roundRubles(gross * (1 - share));
  return { gross, base, tips, zsd, net, managerRepayment };
}
