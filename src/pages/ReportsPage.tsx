import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { WeeklyReport } from '../types';
import { calculateDriverPayout, getWeekNumber, getWeekRange, formatDate, formatCurrency, formatDateTime, exportToExcel, effectiveZsdPayout } from '../utils/calculations';
import { getWheelyBreakdown } from '../utils/wheely';
import { getYandexBreakdown } from '../utils/yandex';
import { getOwnRentBreakdown } from '../utils/ownRent';
import { Plus, ChevronDown, ChevronUp, History, PencilLine, Trash2, AlertCircle, Info, Send, StickyNote, Wallet, ArrowLeftRight, Receipt, FileSpreadsheet, Car, Gauge, Eye, X, Gift } from 'lucide-react';
import { hourlyRentRate, getSettings } from '../utils/settings';
// Актуальные проценты из настроек администратора для подписей в UI
const pct = (v: number) => `${Math.round(v * 100)}%`;

// Пустое значение в числовых полях формы (чтобы не показывать «0» в пустых полях)
type NumOrEmpty = number | '';
const toInputValue = (v: NumOrEmpty): string => (v === '' ? '' : String(v));

interface ReportFormProps {
  report?: WeeklyReport;
  userId: string;
  onSave: (data: any) => void;
  onCancel: () => void;
}

function ReportForm({ report, userId, onSave, onCancel }: ReportFormProps) {
  const currentYear = new Date().getFullYear();
  const currentWeek = getWeekNumber(new Date());

  // Пустое поле = ещё не введено (не показываем «0»); при расчётах пусто == 0
  const numOrEmpty = (v: number | undefined): NumOrEmpty => (v && v !== 0 ? v : '');

  const [year, setYear] = useState<number>(report?.year || currentYear);
  const [weekNumber, setWeekNumber] = useState<number>(report?.week_number || currentWeek);
  const [wheelyGross, setWheelyGross] = useState<NumOrEmpty>(numOrEmpty(report?.wheely_gross));
  const [wheelyAgentFee, setWheelyAgentFee] = useState<NumOrEmpty>(numOrEmpty(report?.wheely_agent_fee));
  const [wheelyAirportParking, setWheelyAirportParking] = useState<NumOrEmpty>(numOrEmpty(report?.wheely_airport_parking));
  const [soberDriver, setSoberDriver] = useState<NumOrEmpty>(numOrEmpty(report?.sober_driver));
  const [wheelyTips, setWheelyTips] = useState<NumOrEmpty>(numOrEmpty(report?.wheely_tips));
  const [yandexGross, setYandexGross] = useState<NumOrEmpty>(numOrEmpty(report?.yandex_gross));
  const [yandexTips, setYandexTips] = useState<NumOrEmpty>(numOrEmpty(report?.yandex_tips));
  const [zsd, setZsd] = useState<NumOrEmpty>(numOrEmpty(report?.zsd));
  const [ownRentGross, setOwnRentGross] = useState<NumOrEmpty>(numOrEmpty(report?.own_rent_gross));
  const [hourlyRentHours, setHourlyRentHours] = useState<NumOrEmpty>(numOrEmpty(report?.hourly_rent_hours));
  const [bonuses, setBonuses] = useState<NumOrEmpty>(numOrEmpty(report?.bonuses));
  const [fines, setFines] = useState<NumOrEmpty>(numOrEmpty(report?.fines));
  const [zsdPayout, setZsdPayout] = useState<NumOrEmpty>(numOrEmpty(report?.zsdPayout));
  const [adjustmentBonuses, setAdjustmentBonuses] = useState<NumOrEmpty>(numOrEmpty(report?.adjustmentBonuses));
  const [zsdOwnRent, setZsdOwnRent] = useState<NumOrEmpty>(numOrEmpty(report?.zsd_own_rent));
  // ГРНЗ и пробег ТС — данные автомобиля за период
  const [grnz, setGrnz] = useState<string>((report?.grnz ?? '').toUpperCase());
  const [mileage, setMileage] = useState<NumOrEmpty>(numOrEmpty(report?.mileage));
  // Комментарий к сумме к выплате (произвольный текст)
  const [comment, setComment] = useState<string>(report?.comment ?? '');

  const safe = (n: NumOrEmpty) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

  // Ручная часть компенсаций (без автоподтянутого «трезвого водителя»).
  // Хранится отдельно, поэтому автокомпенсация не может испортить ручной ввод.
  const [manualComp, setManualComp] = useState<NumOrEmpty>(() => {
    const c = numOrEmpty(report?.compensations);
    if (c === '') return '';
    const m = Math.max(0, c - safe(report?.sober_driver ?? 0));
    return m > 0 ? m : '';
  });

  const wheely = getWheelyBreakdown({
    wheely_gross: safe(wheelyGross),
    wheely_agent_fee: safe(wheelyAgentFee),
    wheely_airport_parking: safe(wheelyAirportParking),
    sober_driver: safe(soberDriver),
    bonuses: safe(bonuses),
  });

  const yandex = getYandexBreakdown({
    yandex_gross: safe(yandexGross),
    yandex_tips: safe(yandexTips),
    zsd: safe(zsd),
  });

  // Собственная аренда: водителю 30%, остальное — возврат руководителю (70%)
  const ownRent = getOwnRentBreakdown({ own_rent_gross: safe(ownRentGross) });
  // Wheely в расчёт не входит: 70% удерживает сервис и автоматически переводит работодателю, водитель ничего не должен.
  const totalManagerRepayment = yandex.managerRepayment + ownRent.managerRepayment;

  // ЗСД из Яндекса И ЗСД по собственной аренде автоматически подтягиваются в корректировки к выплатам:
  // пока поле не переопределено вручную, используем сумму обоих значений.
  const autoZsdTotal = effectiveZsdPayout(safe(zsd), safe(zsdOwnRent));
  const effZsdPayout = zsdPayout === '' ? autoZsdTotal : safe(zsdPayout);

  // Поле «Компенсации» = ручная часть + автокомпенсация «трезвый водитель».
  const autoSober = safe(soberDriver);
  const effectiveCompensations = safe(manualComp) + autoSober;

  const totalPayout = calculateDriverPayout({
    wheelyGross: safe(wheelyGross),
    wheelyAgentFee: safe(wheelyAgentFee),
    wheelyAirportParking: safe(wheelyAirportParking),
    soberDriver: safe(soberDriver),
    wheelyTips: safe(wheelyTips),
    yandexGross: safe(yandexGross),
    yandexTips: safe(yandexTips),
    zsd: safe(zsd),
    ownRentGross: safe(ownRentGross),
    zsdOwnRent: safe(zsdOwnRent),
    hourlyRentHours: safe(hourlyRentHours),
    compensations: safe(manualComp), // только ручная часть — трезвый водитель добавляется отдельно (авто)
    bonuses: safe(bonuses),
    adjustmentBonuses: safe(adjustmentBonuses),
    fines: safe(fines),
    zsdPayout: effZsdPayout,
  });

  // Доход до корректировок к выплатам (без компенсаций, штрафов и ЗСД из выплаты)
  const payoutBeforeAdjustments = totalPayout - effectiveCompensations - safe(adjustmentBonuses) + safe(fines) + effZsdPayout;

  const weekRange = getWeekRange(year, weekNumber);
  const weeks = Array.from({ length: 52 }, (_, i) => i + 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      user_id: userId,
      year,
      week_number: weekNumber,
      wheely_gross: safe(wheelyGross),
      wheely_agent_fee: safe(wheelyAgentFee),
      wheely_airport_parking: safe(wheelyAirportParking),
      sober_driver: safe(soberDriver),
      wheely_tips: safe(wheelyTips),
      yandex_gross: safe(yandexGross),
      yandex_tips: safe(yandexTips),
      zsd: safe(zsd),
      own_rent_gross: safe(ownRentGross),
      hourly_rent_hours: safe(hourlyRentHours),
      compensations: effectiveCompensations, // вручную + трезвый водитель (автокомпенсация)
      bonuses: safe(bonuses),
      fines: safe(fines),
      zsdPayout: effZsdPayout, // вручную или автоподтянуто из ЗСД по Яндекс
      comment: comment.trim(),
      total_driver_payout: safe(totalPayout)
    });
  };

  const handleNumberInput = (setter: (v: NumOrEmpty) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    // Пустая строка остаётся пустой — ноль в поле не показываем.
    // Не ровные суммы (67 161,77) оставляем как есть — итоговое значение округляется до рублей
    // по математическим правилам (>= ,5 — вверх; < ,5 — вниз) в функции roundRubles.
    setter(e.target.value === '' ? '' : Number(e.target.value));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <h3 className="text-gray-900 font-medium mb-3">Отчётный период</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div>
            <label className="text-gray-600 text-sm mb-1 block">Год</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-600 text-sm mb-1 block">Период (7 дней)</label>
            <select value={weekNumber} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setWeekNumber(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400">
              {weeks.map(w => {
                const r = getWeekRange(year, w);
                return <option key={w} value={w}>{formatDate(r.start)} — {formatDate(r.end)}</option>;
              })}
            </select>
          </div>
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-gray-200">
            <div>
              <label className="text-gray-600 text-sm mb-1 flex items-center gap-1.5" htmlFor="grnz-input">
                <Car className="w-3.5 h-3.5 text-gray-400" /> ГРНЗ (номер ТС)
              </label>
              <input id="grnz-input" type="text" value={grnz}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGrnz(e.target.value.toUpperCase())}
                placeholder="А123ВС 799" maxLength={12}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-gray-600 text-sm mb-1 flex items-center gap-1.5" htmlFor="mileage-input">
                <Gauge className="w-3.5 h-3.5 text-gray-400" /> Пробег ТС (км)
              </label>
              <input id="mileage-input" type="number" value={toInputValue(mileage)} placeholder="0"
                onChange={handleNumberInput(setMileage)} min="0" step="1"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Подсказка: ЗСД и трезвый водитель автоматически попадают в корректировки к выплатам */}
      {(autoZsdTotal > 0 || safe(zsdOwnRent) > 0 || autoSober > 0) && (
        <div className="flex items-start gap-2 bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-800">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-sky-600" />
          <span>
            Автоподтягивание в «Корректировки к выплатам»:
            {(safe(zsd) > 0 || safe(zsdOwnRent) > 0) && <> ЗСД (Яндекс{safe(zsd) > 0 ? `: ${formatCurrency(safe(zsd))}` : ''}{safe(zsdOwnRent) > 0 ? ` + аренда: ${formatCurrency(safe(zsdOwnRent))}` : ''} = <b>{formatCurrency(autoZsdTotal)}</b>) → поле «ЗСД (−)».</>}
            {autoSober > 0 && <> Трезвый водитель <b>{formatCurrency(autoSober)}</b> → поле «Компенсации (+)».</>}
          </span>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-gray-900 font-medium">Доход по Wheely</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-600 text-sm mb-1 block">Общий доход Wheely (₽)</label>
            <input type="number" value={toInputValue(wheelyGross)} placeholder="0" onChange={handleNumberInput(setWheelyGross)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400" min="0" step="0.01" />
            <p className="text-emerald-600 text-xs mt-1">Водителю {pct(getSettings().wheelySharePct / 100)} от чистого заработка: {formatCurrency(wheely.driverShare)}</p>
          </div>
          <div>
            <label className="text-gray-600 text-sm mb-1 block">Агентское вознаграждение (−)</label>
            <input type="number" value={toInputValue(wheelyAgentFee)} placeholder="0" onChange={handleNumberInput(setWheelyAgentFee)}
              className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300" min="0" step="0.01" />
            <p className="text-red-600 text-xs mt-1">Вычитается из общего заработка по Wheely</p>
          </div>
          <div>
            <label className="text-gray-600 text-sm mb-1 block">Парковка аэропорт (−)</label>
            <input type="number" value={toInputValue(wheelyAirportParking)} placeholder="0" onChange={handleNumberInput(setWheelyAirportParking)}
              className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300" min="0" step="0.01" />
            <p className="text-red-600 text-xs mt-1">Вычитается из общего заработка по Wheely</p>
          </div>
          <div>
            <label className="text-gray-600 text-sm mb-1 block">Трезвый водитель (−)</label>
            <input type="number" value={toInputValue(soberDriver)} placeholder="0" onChange={handleNumberInput(setSoberDriver)}
              className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300" min="0" step="0.01" />
            <p className="text-red-600 text-xs mt-1">Вычитается из заработка по Wheely и автоматически попадает в компенсации (+ к выплате)</p>
          </div>
          <div>
            <label className="text-gray-600 text-sm mb-1 block">Бонусы Wheely (+)</label>
            <input type="number" value={toInputValue(bonuses)} placeholder="0" onChange={handleNumberInput(setBonuses)}
              className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-300" min="0" step="0.01" />
            <p className="text-emerald-600 text-xs mt-1">Прибавляются к уже вычтенной доле водителя (не участвуют в распределении долей)</p>
          </div>
          <div>
            <label className="text-gray-600 text-sm mb-1 block">Чаевые Wheely (+)</label>
            <input type="number" value={toInputValue(wheelyTips)} placeholder="0" onChange={handleNumberInput(setWheelyTips)}
              className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-300" min="0" step="0.01" />
            <p className="text-emerald-600 text-xs mt-1">Прибавляются к итоговой сумме к выплате (не участвуют в расчёте доли)</p>
          </div>
        </div>

        {/* Наглядная раскладка (waterfall): как формируется доход по Wheely */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Общий заработок по Wheely</span>
            <span className="text-gray-900 font-medium">{formatCurrency(wheely.gross)}</span>
          </div>
          {wheely.agentFee > 0 && (
            <div className="flex justify-between items-center pl-3 border-l-2 border-red-300">
              <span className="text-gray-600">− Агентское вознаграждение</span>
              <span className="text-red-600 font-medium">−{formatCurrency(wheely.agentFee)}</span>
            </div>
          )}
          {wheely.airportParking > 0 && (
            <div className="flex justify-between items-center pl-3 border-l-2 border-red-300">
              <span className="text-gray-600">− Парковка аэропорт</span>
              <span className="text-red-600 font-medium">−{formatCurrency(wheely.airportParking)}</span>
            </div>
          )}
          {wheely.soberDriver > 0 && (
            <div className="flex justify-between items-center pl-3 border-l-2 border-red-300">
              <span className="text-gray-600">− Трезвый водитель</span>
              <span className="text-red-600 font-medium">−{formatCurrency(wheely.soberDriver)}</span>
            </div>
          )}
          {wheely.bonuses > 0 && (
            <div className="flex justify-between items-center pl-3 border-l-2 border-emerald-300">
              <span className="text-gray-600">+ Бонусы (к доле водителя, после вычета доли)</span>
              <span className="text-emerald-600 font-medium">+{formatCurrency(wheely.bonuses)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-gray-600">Чистый заработок Wheely (после вычетов)</span>
            <span className={`font-semibold ${wheely.netGross >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(wheely.netGross)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Водителю ({pct(getSettings().wheelySharePct / 100)} от чистого заработка)</span>
            <span className={`font-medium ${wheely.driverShare >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(wheely.driverShare)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-amber-600 font-medium">К выплате по Wheely ({pct(getSettings().wheelySharePct / 100)} + бонусы)</span>
            <span className={`font-bold ${wheely.net >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(wheely.base)}</span>
          </div>
          {wheely.managerShare > 0 && (
            <div className="flex justify-between items-center text-xs text-gray-400">
              <span>{pct(1 - getSettings().wheelySharePct / 100)} удерживает сервис и отправляет работодателю автоматически — водителем не переводится</span>
              <span>{formatCurrency(wheely.managerShare)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-gray-900 font-medium">Доход по Яндекс</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-600 text-sm mb-1 block">Общий доход Яндекс (₽)</label>
            <input type="number" value={toInputValue(yandexGross)} placeholder="0" onChange={handleNumberInput(setYandexGross)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400" min="0" step="0.01" />
            <p className="text-emerald-600 text-xs mt-1">База водителю: {formatCurrency(yandex.base)} ({pct(getSettings().yandexSharePct / 100)})</p>
          </div>
          <div>
            <label className="text-gray-600 text-sm mb-1 block">Чаевые Яндекс (−)</label>
            <input type="number" value={toInputValue(yandexTips)} placeholder="0" onChange={handleNumberInput(setYandexTips)}
              className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300" min="0" step="0.01" />
            <p className="text-red-600 text-xs mt-1">Вычитается из заработка по Яндекс</p>
          </div>
          <div>
            <label className="text-gray-600 text-sm mb-1 block">ЗСД (−)</label>
            <input type="number" value={toInputValue(zsd)} placeholder="0" onChange={handleNumberInput(setZsd)}
              className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300" min="0" step="0.01" />
            <p className="text-red-600 text-xs mt-1">Вычитается из заработка по Яндекс и автоматически подтягивается в корректировки к выплатам</p>
          </div>
        </div>

        {/* Наглядная раскладка (waterfall): как формируется чистый доход по Яндекс */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">База ({pct(getSettings().yandexSharePct / 100)} от общего дохода)</span>
            <span className="text-gray-900 font-medium">{formatCurrency(yandex.base)}</span>
          </div>
          {yandex.tips > 0 && (
            <div className="flex justify-between items-center pl-3 border-l-2 border-red-300">
              <span className="text-gray-600">− Чаевые</span>
              <span className="text-red-600 font-medium">−{formatCurrency(yandex.tips)}</span>
            </div>
          )}
          {yandex.zsd > 0 && (
            <div className="flex justify-between items-center pl-3 border-l-2 border-red-300">
              <span className="text-gray-600">− ЗСД</span>
              <span className="text-red-600 font-medium">−{formatCurrency(yandex.zsd)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-blue-600 font-medium">Итого Яндекс (чистый)</span>
            <span className={`font-bold ${yandex.net >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(yandex.net)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200">
            <span className="text-orange-600 font-medium">Подлежит переводу по Яндекс</span>
            <span className="font-bold text-orange-600">{formatCurrency(yandex.managerRepayment)}</span>
          </div>
          <p className="text-gray-600 text-xs">Эту сумму водитель направляет руководителю из своей части заработка по Яндекс.</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-gray-900 font-medium">Аренда</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-600 text-sm mb-1 block">Собственная аренда (₽)</label>
            <input type="number" value={toInputValue(ownRentGross)} placeholder="0" onChange={handleNumberInput(setOwnRentGross)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400" min="0" step="0.01" />
            <p className="text-emerald-600 text-xs mt-1">Водителю: {formatCurrency(ownRent.base)} ({pct(getSettings().ownRentSharePct / 100)})</p>
          </div>
          <div>
            <label className="text-gray-600 text-sm mb-1 block">ЗСД по аренде (−)</label>
            <input type="number" value={toInputValue(zsdOwnRent)} placeholder="0" onChange={handleNumberInput(setZsdOwnRent)}
              className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300" min="0" step="0.01" />
            <p className="text-red-600 text-xs mt-1">Вычитается из суммы к выплате и автоматически подтягивается в корректировки к выплатам</p>
          </div>
          <div>
            <label className="text-gray-600 text-sm mb-1 block">Почасовая аренда (часы)</label>
            <input type="number" value={toInputValue(hourlyRentHours)} placeholder="0" onChange={handleNumberInput(setHourlyRentHours)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400" min="0" step="0.01" />
            <p className="text-emerald-600 text-xs mt-1">Водителю: {formatCurrency(safe(hourlyRentHours) * hourlyRentRate())} ({hourlyRentRate()}₽/час)</p>
          </div>
        </div>

        {/* Раскладка по собственной аренде — по аналогии с Яндекс */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Собственная аренда: база водителю ({pct(getSettings().ownRentSharePct / 100)})</span>
            <span className="text-gray-900 font-medium">{formatCurrency(ownRent.base)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-orange-600 font-medium">Подлежит переводу по аренде</span>
            <span className="font-bold text-orange-600">{formatCurrency(ownRent.managerRepayment)}</span>
          </div>
          <p className="text-gray-600 text-xs">Эту сумму водитель направляет руководителю из дохода по собственной аренде.</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-gray-900 font-medium">Корректировки к выплатам</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-600 text-sm mb-1 block">Компенсации (+)</label>
            <input type="number" value={toInputValue(manualComp)} placeholder={autoSober > 0 ? String(autoSober) : '0'} onChange={handleNumberInput(setManualComp)}
              className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-300" min="0" step="0.01" />
            <p className="text-emerald-600 text-xs mt-1">
              Прибавляются к сумме к выплате. Итого с автокомпенсациями: {formatCurrency(effectiveCompensations)}
              {autoSober > 0 && <> (включая трезвого водителя: +{formatCurrency(autoSober)})</>}
            </p>
          </div>
          <div>
            <label className="text-gray-600 text-sm mb-1 block">Бонусы (+)</label>
            <input type="number" value={toInputValue(adjustmentBonuses)} placeholder="0" onChange={handleNumberInput(setAdjustmentBonuses)}
              className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-300" min="0" step="0.01" />
            <p className="text-emerald-600 text-xs mt-1">Прибавляются к итоговой сумме к выплате</p>
          </div>
          <div>
            <label className="text-gray-600 text-sm mb-1 block">Штрафы (−)</label>
            <input type="number" value={toInputValue(fines)} placeholder="0" onChange={handleNumberInput(setFines)}
              className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300" min="0" step="0.01" />
            <p className="text-red-600 text-xs mt-1">Вычитаются из суммы к выплате</p>
          </div>
          <div>
            <label className="text-gray-600 text-sm mb-1 block">ЗСД (−)</label>
            <input type="number" value={toInputValue(zsdPayout)} placeholder={autoZsdTotal > 0 ? String(autoZsdTotal) : '0'} onChange={handleNumberInput(setZsdPayout)}
              className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300" min="0" step="0.01" />
            <p className="text-red-600 text-xs mt-1">
              Вычитается из суммы к выплате
              {zsdPayout === '' && autoZsdTotal > 0 && <> · автоматически подтянуто (ЗСД Яндекс + ЗСД аренда): {formatCurrency(autoZsdTotal)}</>}
              {zsdPayout !== '' && autoZsdTotal > 0 && <> · переопределено вручную (авто: {formatCurrency(autoZsdTotal)})</>}
            </p>
          </div>
        </div>

        {/* Наглядная раскладка (waterfall): корректировки к сумме к выплате */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Доход до корректировок</span>
            <span className="text-gray-900 font-medium">{formatCurrency(payoutBeforeAdjustments)}</span>
          </div>
          {effectiveCompensations > 0 && (
            <div className="flex justify-between items-center pl-3 border-l-2 border-emerald-300">
              <span className="text-gray-600">+ Компенсации{safe(soberDriver) > 0 ? ' (в т.ч. трезвый водитель)' : ''}</span>
              <span className="text-emerald-600 font-medium">+{formatCurrency(effectiveCompensations)}</span>
            </div>
          )}
          {safe(wheelyTips) > 0 && (
            <div className="flex justify-between items-center pl-3 border-l-2 border-emerald-300">
              <span className="text-gray-600">+ Чаевые Wheely</span>
              <span className="text-emerald-600 font-medium">+{formatCurrency(safe(wheelyTips))}</span>
            </div>
          )}
          {safe(adjustmentBonuses) > 0 && (
            <div className="flex justify-between items-center pl-3 border-l-2 border-emerald-300">
              <span className="text-gray-600">+ Бонусы</span>
              <span className="text-emerald-600 font-medium">+{formatCurrency(safe(adjustmentBonuses))}</span>
            </div>
          )}
          {safe(fines) > 0 && (
            <div className="flex justify-between items-center pl-3 border-l-2 border-red-300">
              <span className="text-gray-600">− Штрафы</span>
              <span className="text-red-600 font-medium">−{formatCurrency(safe(fines))}</span>
            </div>
          )}
          {effZsdPayout > 0 && (
            <div className="flex justify-between items-center pl-3 border-l-2 border-red-300">
              <span className="text-gray-600">− ЗСД{zsdPayout === '' && autoZsdTotal > 0 ? ' (Яндекс + аренда, авто)' : ''}</span>
              <span className="text-red-600 font-medium">−{formatCurrency(effZsdPayout)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-amber-600 font-medium">Итого к выплате</span>
            <span className={`font-bold ${totalPayout >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(totalPayout)}</span>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-amber-700 font-medium flex items-center gap-2"><Wallet className="w-4 h-4" />Итого к выплате водителю:</span>
          <span className="text-2xl font-bold text-gray-900">{formatCurrency(totalPayout)}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-amber-200">
          <span className="text-orange-700 font-medium flex items-center gap-2"><Send className="w-4 h-4" />Подлежит переводу:</span>
          <span className="text-xl font-bold text-orange-700">{formatCurrency(totalManagerRepayment)}</span>
        </div>
        <div className="pt-2 border-t border-amber-200">
          <label className="text-gray-600 text-sm mb-1 flex items-center gap-1.5" htmlFor="payout-comment">
            <StickyNote className="w-3.5 h-3.5" /> Комментарий к сумме к выплате
          </label>
          <textarea id="payout-comment" value={comment} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
            rows={2} maxLength={500}
            placeholder="Например: выплата перенесена на след. неделю из-за задержки от Whelly…"
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y" />
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-all">
          {report ? 'Сохранить изменения' : 'Создать отчёт'}
        </button>
        <button type="button" onClick={onCancel} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl transition-all">
          Отмена
        </button>
      </div>
    </form>
  );
}


// ─── Детальный просмотр отчёта (руководитель/админ может «провалиться» в отчёт:
// доход по машине (ГРНЗ), водителю, все секции расчёта и корректировки) ───
function ReportDetailView({ report, driverName, onBack }: { report: WeeklyReport; driverName: string; onBack: () => void }) {
  const w = getWheelyBreakdown(report);
  const y = getYandexBreakdown(report);
  const o = getOwnRentBreakdown(report);
  const range = getWeekRange(report.year, report.week_number);
  const totalTransfer = y.managerRepayment + o.managerRepayment;

  const Row = ({ label, value, tone = 'gray' }: { label: string; value: string; tone?: 'gray' | 'green' | 'red' | 'orange' | 'blue' }) => {
    const tones: Record<string, string> = {
      gray: 'text-gray-900', green: 'text-emerald-600', red: 'text-red-600', orange: 'text-orange-600', blue: 'text-blue-600'
    };
    return (
      <div className="flex justify-between items-center py-1">
        <span className="text-gray-600 text-sm">{label}</span>
        <span className={`text-sm font-medium ${tones[tone]}`}>{value}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-1">
            <ArrowLeftRight className="w-4 h-4" /> Назад к списку отчётов
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Отчёт: {formatDate(range.start)} — {formatDate(range.end)}</h1>
          <p className="text-gray-600 mt-1 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1"><Receipt className="w-4 h-4 text-gray-400" /> Водитель: <b className="text-gray-900">{driverName}</b></span>
            {(report.grnz ?? '') !== '' && (
              <span className="flex items-center gap-1"><Car className="w-4 h-4 text-gray-400" /> ГРНЗ: <b className="text-gray-900 tracking-wider">{report.grnz}</b>{report.car ? ` (${report.car})` : ''}</span>
            )}
            {(report.mileage ?? 0) > 0 && (
              <span className="flex items-center gap-1"><Gauge className="w-4 h-4 text-gray-400" /> Пробег ТС: <b className="text-gray-900">{new Intl.NumberFormat('ru-RU').format(report.mileage ?? 0)} км</b></span>
            )}
          </p>
        </div>
      </div>

      {/* Доход по машине и водителю */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
          <p className="text-gray-600 text-xs">Доход водителя (к выплате)</p>
          <p className="text-amber-600 font-bold text-lg mt-1">{formatCurrency(report.total_driver_payout)}</p>
        </div>
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
          <p className="text-gray-600 text-xs">Доход по машине (общий оборот)</p>
          <p className="text-gray-900 font-bold text-lg mt-1">{formatCurrency(Math.round((report.wheely_gross ?? 0) + (report.yandex_gross ?? 0) + (report.own_rent_gross ?? 0) + (report.hourly_rent_hours ?? 0) * hourlyRentRate()))}</p>
        </div>
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
          <p className="text-gray-600 text-xs">Подлежит переводу</p>
          <p className="text-orange-600 font-bold text-lg mt-1">{formatCurrency(totalTransfer)}</p>
        </div>
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
          <p className="text-gray-600 text-xs">Пробег / ГРНЗ</p>
          <p className="text-gray-900 font-bold text-lg mt-1">{(report.mileage ?? 0) > 0 ? `${new Intl.NumberFormat('ru-RU').format(report.mileage ?? 0)} км` : '—'}</p>
          <p className="text-gray-500 text-xs">{(report.grnz ?? '') !== '' ? report.grnz : 'ГРНЗ не указан'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-5 space-y-1">
          <h3 className="text-gray-900 font-semibold mb-2">Доход по Wheely</h3>
          <Row label="Общий заработок" value={formatCurrency(w.gross)} />
          {w.agentFee > 0 && <Row label="− Агентское вознаграждение" value={`−${formatCurrency(w.agentFee)}`} tone="red" />}
          {w.airportParking > 0 && <Row label="− Парковка аэропорт" value={`−${formatCurrency(w.airportParking)}`} tone="red" />}
          {w.soberDriver > 0 && <Row label="− Трезвый водитель" value={`−${formatCurrency(w.soberDriver)}`} tone="red" />}
          <Row label="Чистый заработок (после вычетов)" value={formatCurrency(w.netGross)} />
          <Row label={"Водителю (" + pct(getSettings().wheelySharePct / 100) + ")"} value={formatCurrency(w.driverShare)} tone="green" />
          {w.bonuses > 0 && <Row label="+ Бонусы" value={`+${formatCurrency(w.bonuses)}`} tone="green" />}
          <Row label="К выплате по Wheely" value={formatCurrency(w.base)} tone="orange" />
          <p className="text-xs text-gray-400 pt-1">{pct(1 - getSettings().wheelySharePct / 100)} удерживает сервис Wheely автоматически — водителем не переводится{w.managerShare > 0 ? ` (${formatCurrency(w.managerShare)})` : ''}</p>
        </div>

        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-5 space-y-1">
          <h3 className="text-gray-900 font-semibold mb-2">Доход по Яндекс</h3>
          <Row label="Общий заработок" value={formatCurrency(y.gross)} />
          <Row label={"База (" + pct(getSettings().yandexSharePct / 100) + ")"} value={formatCurrency(y.base)} tone="green" />
          {y.tips > 0 && <Row label="− Чаевые" value={`−${formatCurrency(y.tips)}`} tone="red" />}
          {y.zsd > 0 && <Row label="− ЗСД" value={`−${formatCurrency(y.zsd)}`} tone="red" />}
          <Row label="Итого Яндекс (чистый)" value={formatCurrency(y.net)} tone="blue" />
          <Row label={"Подлежит переводу (" + pct(1 - getSettings().yandexSharePct / 100) + ")"} value={formatCurrency(y.managerRepayment)} tone="orange" />

          <h3 className="text-gray-900 font-semibold pt-4 mb-2">Аренда</h3>
          <Row label="Собственная аренда (общий)" value={formatCurrency(o.gross)} />
          <Row label={"Водителю (" + pct(getSettings().ownRentSharePct / 100) + ")"} value={formatCurrency(o.base)} tone="green" />
          {(report.zsd_own_rent ?? 0) > 0 && <Row label="− ЗСД по аренде" value={`−${formatCurrency(report.zsd_own_rent ?? 0)}`} tone="red" />}
          <Row label={"Подлежит переводу (" + pct(1 - getSettings().ownRentSharePct / 100) + ")"} value={formatCurrency(o.managerRepayment)} tone="orange" />
          <Row label="Почасовая аренда" value={`${report.hourly_rent_hours ?? 0} ч. × ${hourlyRentRate()} ₽ = ${formatCurrency((report.hourly_rent_hours ?? 0) * hourlyRentRate())}`} tone="green" />
        </div>

        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-5 space-y-1 lg:col-span-2">
          <h3 className="text-gray-900 font-semibold mb-2">Корректировки к выплатам</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <div>
              <Row label="+ Компенсации (вкл. трезвого водителя)" value={`+${formatCurrency(report.compensations)}`} tone="green" />
              {(report.adjustmentBonuses ?? 0) > 0 && <Row label="+ Бонусы" value={`+${formatCurrency(report.adjustmentBonuses ?? 0)}`} tone="green" />}
              {(report.wheely_tips ?? 0) > 0 && <Row label="+ Чаевые Wheely" value={`+${formatCurrency(report.wheely_tips ?? 0)}`} tone="green" />}
            </div>
            <div>
              {(report.fines ?? 0) > 0 && <Row label="− Штрафы" value={`−${formatCurrency(report.fines ?? 0)}`} tone="red" />}
              {(report.zsdPayout ?? 0) > 0 && <Row label="− ЗСД к выплате" value={`−${formatCurrency(report.zsdPayout ?? 0)}`} tone="red" />}
            </div>
          </div>
          <div className="flex justify-between items-center pt-3 mt-2 border-t border-gray-200">
            <span className="text-amber-600 font-semibold flex items-center gap-2"><Wallet className="w-4 h-4" />Итого к выплате водителю</span>
            <span className="text-xl font-bold text-gray-900">{formatCurrency(report.total_driver_payout)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-orange-600 font-medium text-sm flex items-center gap-1.5"><Send className="w-3.5 h-3.5" />Подлежит переводу (Яндекс + аренда)</span>
            <span className="font-bold text-orange-600">{formatCurrency(totalTransfer)}</span>
          </div>
          {(report.comment ?? '').trim() !== '' && (
            <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 mt-3">
              <StickyNote className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
              <span className="break-words whitespace-pre-wrap">{report.comment}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { user, getAllUsers } = useAuth();
  const { reports, addReport, updateReport, deleteReport, getEditLogsByReport } = useData();
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState<WeeklyReport | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string>(user?.role === 'driver' ? user.id : 'all');
  // Детальный просмотр отчёта (доступен руководителю и админу — «провалиться» в отчёт)
  const [viewingReport, setViewingReport] = useState<WeeklyReport | null>(null);
  const [error, setError] = useState('');

  const allUsers = getAllUsers();
  const drivers = allUsers.filter(u => u.role === 'driver');

  const filteredReports = useMemo(() => {
    let filtered = reports;
    if (user?.role === 'driver') {
      // Drivers must never see other drivers' reports, even if the filter is changed
      filtered = filtered.filter(r => r.user_id === user.id);
    } else if (selectedDriver !== 'all') {
      filtered = filtered.filter(r => r.user_id === selectedDriver);
    }
    return [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [reports, user, selectedDriver]);

  const handleSave = (data: any) => {
    setError('');
    if (editingReport) {
      // Only manager/admin can reach the edit UI; enforce it here too
      if (user?.role === 'driver') {
        setError('Водители не могут редактировать отчёты');
        return;
      }
      updateReport(editingReport.id, data, user!.id);
      setEditingReport(null);
    } else {
      const result = addReport(data);
      if (!result.success) {
        setError(result.error || 'Ошибка');
        return;
      }
    }
    setShowForm(false);
  };

  const handleExportExcel = () => {
    exportToExcel(filteredReports, allUsers, `SVdrivers_statistika_${new Date().toISOString().slice(0, 10)}.xls`);
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить этот отчёт?')) {
      deleteReport(id);
    }
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      wheely_gross: 'Доход Wheely',
      wheely_agent_fee: 'Агентское вознаграждение Wheely',
      wheely_airport_parking: 'Парковка аэропорт Wheely',
      sober_driver: 'Трезвый водитель Wheely',
      wheely_tips: 'Чаевые Wheely',
      yandex_gross: 'Доход Яндекс',
      yandex_tips: 'Чаевые Яндекс',
      zsd: 'ЗСД',
      own_rent_gross: 'Аренда (собственная)',
      zsd_own_rent: 'ЗСД по аренде',
      hourly_rent_hours: 'Почас. часы',
      grnz: 'ГРНЗ',
      mileage: 'Пробег ТС',
      car: 'Автомобиль',
      compensations: 'Компенсации',
      bonuses: 'Бонусы Wheely',
      adjustmentBonuses: 'Бонусы (корректировки)',
      fines: 'Штрафы',
      zsdPayout: 'ЗСД (из выплаты)',
      total_driver_payout: 'Итого'
    };
    return labels[field] || field;
  };

  if (viewingReport) {
    const drv = allUsers.find(u => u.id === viewingReport.user_id);
    return <ReportDetailView report={viewingReport} driverName={drv?.username || 'N/A'} onBack={() => setViewingReport(null)} />;
  }

  if (showForm || editingReport) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {editingReport ? 'Редактирование отчёта' : 'Новый отчёт'}
        </h1>
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
        <ReportForm
          report={editingReport || undefined}
          userId={editingReport?.user_id || user!.id}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingReport(null); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Недельные отчёты</h1>
          <p className="text-gray-600 mt-1 text-sm">Даты соответствуют периодам пн–вс</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(user?.role === 'manager' || user?.role === 'admin') && (
            <>
              <button onClick={handleExportExcel} title="Выгрузить статистику в Excel"
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-all">
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
              <select
                aria-label="Фильтр по водителю"
              value={selectedDriver}
              onChange={e => setSelectedDriver(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
                <option value="all">Все водители</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.username}</option>)}
              </select>
            </>
          )}
          {user?.role === 'driver' && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-all">
              <Plus className="w-4 h-4" /> Новый отчёт
            </button>
          )}
          {user?.role === 'admin' && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-all">
              <Plus className="w-4 h-4" /> Создать отчёт
            </button>
          )}
        </div>
      </div>

      {filteredReports.length === 0 ? (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-600">Отчётов не найдено</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map(report => {
            const driver = allUsers.find(u => u.id === report.user_id);
            const logs = getEditLogsByReport(report.id);
            const isExpanded = expandedLogs === report.id;

            return (
              <div key={report.id} className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setViewingReport(report)} className="text-gray-900 font-semibold hover:text-amber-600 underline-offset-2 hover:underline transition-colors" title="Открыть отчёт детально">
                          {(() => {
                          const range = getWeekRange(report.year, report.week_number);
                          return `${formatDate(range.start)} — ${formatDate(range.end)}`;
                        })()}
                        </button>
                        {user?.role !== 'driver' && driver && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                            {driver.username}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(user?.role === 'manager' || user?.role === 'admin') && (
                        <button onClick={() => setViewingReport(report)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all" title="Посмотреть детально">
                          <Eye className="w-4 h-4" /> Подробнее
                        </button>
                      )}
                      {(user?.role === 'manager' || user?.role === 'admin') && (
                        <button onClick={() => setEditingReport(report)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Редактировать">
                          <PencilLine className="w-4 h-4" />
                        </button>
                      )}
                      {user?.role === 'admin' && (
                        <button onClick={() => handleDelete(report.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Удалить">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-600 text-xs">Wheely (общий)</p>
                      <p className="text-gray-900 font-medium">{formatCurrency(report.wheely_gross)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-600 text-xs">Wheely (к выплате: доля + бонусы)</p>
                      <p className="text-amber-600 font-semibold">{formatCurrency(getWheelyBreakdown(report).base)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-600 text-xs">Яндекс (общий)</p>
                      <p className="text-gray-900 font-medium">{formatCurrency(report.yandex_gross)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-600 text-xs">Яндекс (чистый)</p>
                      <p className="text-blue-600 font-semibold">{formatCurrency(getYandexBreakdown(report).net)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-600 text-xs">Аренда (чистый)</p>
                      <p className="text-gray-900 font-medium">{formatCurrency(getOwnRentBreakdown(report).base)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 col-span-2 sm:col-span-1">
                      <p className="text-gray-600 text-xs">Подлежит переводу</p>
                      <p className="text-orange-600 font-semibold">{formatCurrency(getYandexBreakdown(report).managerRepayment + getOwnRentBreakdown(report).managerRepayment)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-600 text-xs">Почас. часы</p>
                      <p className="text-gray-900 font-medium">{report.hourly_rent_hours} ч.</p>
                    </div>
                    {(report.mileage ?? 0) > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-gray-600 text-xs flex items-center gap-1"><Gauge className="w-3 h-3" />Пробег ТС</p>
                        <p className="text-gray-900 font-medium">{new Intl.NumberFormat('ru-RU').format(report.mileage ?? 0)} км</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    {(report.grnz ?? '') !== '' && (
                      <span className="text-gray-600 flex items-center gap-1 bg-gray-100 rounded-full px-2 py-0.5 text-xs">
                        <Car className="w-3 h-3" /> {report.grnz}{report.car ? ` · ${report.car}` : ''}
                      </span>
                    )}
                    {(report.wheely_agent_fee ?? 0) > 0 && <span className="text-red-600">−Агентское: {formatCurrency(report.wheely_agent_fee)}</span>}
                    {(report.wheely_airport_parking ?? 0) > 0 && <span className="text-red-600">−Парковка аэропорт: {formatCurrency(report.wheely_airport_parking)}</span>}
                    {(report.sober_driver ?? 0) > 0 && <span className="text-red-600">−Трезвый водитель: {formatCurrency(report.sober_driver)}</span>}
                    {(report.wheely_tips ?? 0) > 0 && <span className="text-emerald-600">+Чаевые Wheely: {formatCurrency(report.wheely_tips)}</span>}
                    {report.bonuses > 0 && <span className="text-emerald-600">+Бонус Wheely: {formatCurrency(report.bonuses)}</span>}
                    {(report.yandex_tips ?? 0) > 0 && <span className="text-red-600">−Чаевые Яндекс: {formatCurrency(report.yandex_tips)}</span>}
                    {(report.zsd ?? 0) > 0 && <span className="text-red-600">−ЗСД: {formatCurrency(report.zsd)}</span>}
                    {report.compensations > 0 && <span className="text-emerald-600">+Комп: {formatCurrency(report.compensations)}</span>}
                    {(report.adjustmentBonuses ?? 0) > 0 && <span className="text-emerald-600 flex items-center gap-1"><Gift className="w-3 h-3" />+Бонусы: {formatCurrency(report.adjustmentBonuses ?? 0)}</span>}
                    {(report.zsd_own_rent ?? 0) > 0 && <span className="text-red-600">−ЗСД аренды: {formatCurrency(report.zsd_own_rent ?? 0)}</span>}
                    {(report.fines ?? 0) > 0 && <span className="text-red-600">−Штрафы: {formatCurrency(report.fines)}</span>}
                    {(report.zsdPayout ?? 0) > 0 && <span className="text-red-600">−ЗСД из выплаты: {formatCurrency(report.zsdPayout)}</span>}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 flex items-center gap-1.5"><Wallet className="w-4 h-4 text-amber-600" />Итого к выплате:</span>
                      <span className="text-xl font-bold text-amber-600">{formatCurrency(report.total_driver_payout)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-orange-600 text-sm flex items-center gap-1.5"><Send className="w-3.5 h-3.5" />Подлежит переводу:</span>
                      <span className="font-semibold text-orange-600">{formatCurrency(getYandexBreakdown(report).managerRepayment + getOwnRentBreakdown(report).managerRepayment)}</span>
                    </div>
                    {(report.comment ?? '').trim() !== '' && (
                      <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700">
                        <StickyNote className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                        <span className="break-words whitespace-pre-wrap">{report.comment}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* History toggle */}
                <div className="border-t border-gray-200">
                  <button
                    onClick={() => setExpandedLogs(isExpanded ? null : report.id)}
                    className="w-full px-5 py-3 flex items-center justify-between text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <History className="w-4 h-4" />
                      {logs.length > 0 ? `История изменений (${logs.length})` : 'История изменений'}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-4">
                      {logs.length === 0 ? (
                        <p className="text-gray-600 text-sm italic">Оригинальная запись</p>
                      ) : (
                        <div className="space-y-2">
                          {logs.map(log => {
                            const editor = allUsers.find(u => u.id === log.changed_by_user_id);
                            return (
                              <div key={log.id} className="text-sm p-2 bg-gray-100/70 rounded-lg">
                                <span className="text-gray-600">[{formatDateTime(log.changed_at)}]</span>
                                {' '}
                                <span className="text-blue-600">{editor?.username || 'N/A'}</span>
                                {' '}изменил{' '}
                                <span className="text-amber-600">{getFieldLabel(log.field_name)}</span>:
                                {' '}
                                <span className="text-red-600">{log.old_value}</span>
                                {' → '}
                                <span className="text-emerald-600">{log.new_value}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
