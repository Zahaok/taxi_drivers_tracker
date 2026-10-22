import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { WeeklyReport } from '../types';
import { calculateDriverPayout, getWeekNumber, getWeekRange, formatDate, formatCurrency, formatDateTime } from '../utils/calculations';
import { getWheelyBreakdown } from '../utils/wheely';
import { getYandexBreakdown, YANDEX_MANAGER_SHARE } from '../utils/yandex';
import { Plus, ChevronDown, ChevronUp, History, Edit2, Trash2, AlertCircle } from 'lucide-react';

interface ReportFormProps {
  report?: WeeklyReport;
  userId: string;
  onSave: (data: any) => void;
  onCancel: () => void;
}

function ReportForm({ report, userId, onSave, onCancel }: ReportFormProps) {
  const currentYear = new Date().getFullYear();
  const currentWeek = getWeekNumber(new Date());

  const [year, setYear] = useState<number>(report?.year || currentYear);
  const [weekNumber, setWeekNumber] = useState<number>(report?.week_number || currentWeek);
  const [wheelyGross, setWheelyGross] = useState<number>(report?.wheely_gross || 0);
  const [wheelyAgentFee, setWheelyAgentFee] = useState<number>(report?.wheely_agent_fee || 0);
  const [wheelyAirportParking, setWheelyAirportParking] = useState<number>(report?.wheely_airport_parking || 0);
  const [yandexGross, setYandexGross] = useState<number>(report?.yandex_gross || 0);
  const [yandexTips, setYandexTips] = useState<number>(report?.yandex_tips || 0);
  const [zsd, setZsd] = useState<number>(report?.zsd || 0);
  const [ownRentGross, setOwnRentGross] = useState<number>(report?.own_rent_gross || 0);
  const [hourlyRentHours, setHourlyRentHours] = useState<number>(report?.hourly_rent_hours || 0);
  const [compensations, setCompensations] = useState<number>(report?.compensations || 0);
  const [bonuses, setBonuses] = useState<number>(report?.bonuses || 0);
  const [tips, setTips] = useState<number>(report?.tips || 0);
  const [deductions, setDeductions] = useState<number>(report?.deductions || 0);

  const safe = (n: number) => (Number.isFinite(n) ? n : 0);

  const wheely = getWheelyBreakdown({
    wheely_gross: safe(wheelyGross),
    wheely_agent_fee: safe(wheelyAgentFee),
    wheely_airport_parking: safe(wheelyAirportParking),
    bonuses: safe(bonuses),
  });

  const yandex = getYandexBreakdown({
    yandex_gross: safe(yandexGross),
    yandex_tips: safe(yandexTips),
    zsd: safe(zsd),
  });

  const totalPayout = calculateDriverPayout({
    wheelyGross: safe(wheelyGross),
    wheelyAgentFee: safe(wheelyAgentFee),
    wheelyAirportParking: safe(wheelyAirportParking),
    yandexGross: safe(yandexGross),
    yandexTips: safe(yandexTips),
    zsd: safe(zsd),
    ownRentGross: safe(ownRentGross),
    hourlyRentHours: safe(hourlyRentHours),
    compensations: safe(compensations),
    bonuses: safe(bonuses),
    tips: safe(tips),
    deductions: safe(deductions),
  });

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
      yandex_gross: safe(yandexGross),
      yandex_tips: safe(yandexTips),
      zsd: safe(zsd),
      own_rent_gross: safe(ownRentGross),
      hourly_rent_hours: safe(hourlyRentHours),
      compensations: safe(compensations),
      bonuses: safe(bonuses),
      tips: safe(tips),
      deductions: safe(deductions),
      total_driver_payout: safe(totalPayout)
    });
  };

  const handleNumberInput = (setter: (v: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value === '' ? 0 : Number(e.target.value));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-700/30 rounded-xl p-4 border border-gray-600/30">
        <h3 className="text-white font-medium mb-3">Отчётный период</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Год</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Неделя</label>
            <select value={weekNumber} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setWeekNumber(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50">
              {weeks.map(w => <option key={w} value={w}>Неделя {w}</option>)}
            </select>
          </div>
        </div>
        <p className="text-gray-500 text-sm mt-2">
          {formatDate(weekRange.start)} — {formatDate(weekRange.end)}
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-white font-medium">Доход по Wheely</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Общий доход Wheely (₽)</label>
            <input type="number" value={wheelyGross} onChange={handleNumberInput(setWheelyGross)}
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" min="0" />
            <p className="text-green-400 text-xs mt-1">База водителю: {formatCurrency(wheely.base)} (30%)</p>
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Агентское вознаграждение (−)</label>
            <input type="number" value={wheelyAgentFee} onChange={handleNumberInput(setWheelyAgentFee)}
              className="w-full px-3 py-2 bg-gray-700/50 border border-red-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500/40" min="0" />
            <p className="text-red-400 text-xs mt-1">Вычитается из заработка по Wheely</p>
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Парковка аэропорт (−)</label>
            <input type="number" value={wheelyAirportParking} onChange={handleNumberInput(setWheelyAirportParking)}
              className="w-full px-3 py-2 bg-gray-700/50 border border-red-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500/40" min="0" />
            <p className="text-red-400 text-xs mt-1">Вычитается из заработка по Wheely</p>
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Бонусы Wheely (+)</label>
            <input type="number" value={bonuses} onChange={handleNumberInput(setBonuses)}
              className="w-full px-3 py-2 bg-gray-700/50 border border-green-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500/40" min="0" />
            <p className="text-green-400 text-xs mt-1">Прибавляются к заработку по Wheely</p>
          </div>
        </div>

        {/* Наглядная раскладка (waterfall): как формируется чистый доход Wheely */}
        <div className="bg-gray-700/30 rounded-xl p-4 border border-gray-600/30 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">База (30% от общего дохода)</span>
            <span className="text-white font-medium">{formatCurrency(wheely.base)}</span>
          </div>
          {wheely.agentFee > 0 && (
            <div className="flex justify-between items-center pl-3 border-l-2 border-red-500/40">
              <span className="text-gray-400">− Агентское вознаграждение</span>
              <span className="text-red-400 font-medium">−{formatCurrency(wheely.agentFee)}</span>
            </div>
          )}
          {wheely.airportParking > 0 && (
            <div className="flex justify-between items-center pl-3 border-l-2 border-red-500/40">
              <span className="text-gray-400">− Парковка аэропорт</span>
              <span className="text-red-400 font-medium">−{formatCurrency(wheely.airportParking)}</span>
            </div>
          )}
          {wheely.bonuses > 0 && (
            <div className="flex justify-between items-center pl-3 border-l-2 border-green-500/40">
              <span className="text-gray-400">+ Бонусы</span>
              <span className="text-green-400 font-medium">+{formatCurrency(wheely.bonuses)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-gray-600/40">
            <span className="text-amber-400 font-medium">Итого Wheely (чистый)</span>
            <span className={`font-bold ${wheely.net >= 0 ? 'text-white' : 'text-red-400'}`}>{formatCurrency(wheely.net)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-white font-medium">Доход по Яндекс</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Общий доход Яндекс (₽)</label>
            <input type="number" value={yandexGross} onChange={handleNumberInput(setYandexGross)}
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" min="0" />
            <p className="text-green-400 text-xs mt-1">База водителю: {formatCurrency(yandex.base)} (35%)</p>
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Чаевые Яндекс (−)</label>
            <input type="number" value={yandexTips} onChange={handleNumberInput(setYandexTips)}
              className="w-full px-3 py-2 bg-gray-700/50 border border-red-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500/40" min="0" />
            <p className="text-red-400 text-xs mt-1">Вычитается из заработка по Яндекс</p>
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">ЗСД (−)</label>
            <input type="number" value={zsd} onChange={handleNumberInput(setZsd)}
              className="w-full px-3 py-2 bg-gray-700/50 border border-red-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500/40" min="0" />
            <p className="text-red-400 text-xs mt-1">Вычитается из заработка по Яндекс и из общей выплаты</p>
          </div>
        </div>

        {/* Наглядная раскладка (waterfall): как формируется чистый доход по Яндекс */}
        <div className="bg-gray-700/30 rounded-xl p-4 border border-gray-600/30 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">База (35% от общего дохода)</span>
            <span className="text-white font-medium">{formatCurrency(yandex.base)}</span>
          </div>
          {yandex.tips > 0 && (
            <div className="flex justify-between items-center pl-3 border-l-2 border-red-500/40">
              <span className="text-gray-400">− Чаевые</span>
              <span className="text-red-400 font-medium">−{formatCurrency(yandex.tips)}</span>
            </div>
          )}
          {yandex.zsd > 0 && (
            <div className="flex justify-between items-center pl-3 border-l-2 border-red-500/40">
              <span className="text-gray-400">− ЗСД</span>
              <span className="text-red-400 font-medium">−{formatCurrency(yandex.zsd)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-gray-600/40">
            <span className="text-blue-400 font-medium">Итого Яндекс (чистый)</span>
            <span className={`font-bold ${yandex.net >= 0 ? 'text-white' : 'text-red-400'}`}>{formatCurrency(yandex.net)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-600/40">
            <span className="text-orange-400 font-medium">Возврат руководителю ({Math.round(YANDEX_MANAGER_SHARE * 100)}% от общего дохода)</span>
            <span className="font-bold text-orange-400">{formatCurrency(yandex.managerRepayment)}</span>
          </div>
          <p className="text-gray-500 text-xs">Эту сумму водитель направляет руководителю из своей части заработка по Яндекс.</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-white font-medium">Прочие доходы (грязные)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Собственная аренда (₽)</label>
            <input type="number" value={ownRentGross} onChange={handleNumberInput(setOwnRentGross)}
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" min="0" />
            <p className="text-green-400 text-xs mt-1">Водителю: {formatCurrency(ownRentGross * 0.30)} (30%)</p>
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Почасовая аренда (часы)</label>
            <input type="number" value={hourlyRentHours} onChange={handleNumberInput(setHourlyRentHours)}
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" min="0" />
            <p className="text-green-400 text-xs mt-1">Водителю: {formatCurrency(hourlyRentHours * 500)} (500₽/час)</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-white font-medium">К корректировкам выплаты</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Компенсации (+)</label>
            <input type="number" value={compensations} onChange={handleNumberInput(setCompensations)}
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" min="0" />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Чаевые (+)</label>
            <input type="number" value={tips} onChange={handleNumberInput(setTips)}
              className="w-full px-3 py-2 bg-gray-700/50 border border-green-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500/40" min="0" />
            <p className="text-green-400 text-xs mt-1">Прибавляются к итоговой выплате</p>
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Вычеты (-)</label>
            <input type="number" value={deductions} onChange={handleNumberInput(setDeductions)}
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" min="0" />
          </div>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
        <div className="flex justify-between items-center">
          <span className="text-amber-400 font-medium">Итого к выплате водителю:</span>
          <span className="text-2xl font-bold text-white">{formatCurrency(totalPayout)}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold rounded-xl transition-all">
          {report ? 'Сохранить изменения' : 'Создать отчёт'}
        </button>
        <button type="button" onClick={onCancel} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all">
          Отмена
        </button>
      </div>
    </form>
  );
}

export default function ReportsPage() {
  const { user, getAllUsers } = useAuth();
  const { reports, addReport, updateReport, deleteReport, getEditLogsByReport } = useData();
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState<WeeklyReport | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string>(user?.role === 'driver' ? user.id : 'all');
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
      yandex_gross: 'Доход Яндекс',
      yandex_tips: 'Чаевые Яндекс',
      zsd: 'ЗСД',
      own_rent_gross: 'Собств. аренда',
      hourly_rent_hours: 'Почас. часы',
      compensations: 'Компенсации',
      bonuses: 'Бонусы Wheely',
      tips: 'Чаевые',
      deductions: 'Вычеты',
      total_driver_payout: 'Итого'
    };
    return labels[field] || field;
  };

  if (showForm || editingReport) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">
          {editingReport ? 'Редактирование отчёта' : 'Новый отчёт'}
        </h1>
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
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
        <h1 className="text-2xl font-bold text-white">Недельные отчёты</h1>
        <div className="flex gap-3">
          {(user?.role === 'manager' || user?.role === 'admin') && (
            <select
              value={selectedDriver}
              onChange={e => setSelectedDriver(e.target.value)}
              className="px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="all">Все водители</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.username}</option>)}
            </select>
          )}
          {user?.role === 'driver' && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-medium rounded-lg transition-all">
              <Plus className="w-4 h-4" /> Новый отчёт
            </button>
          )}
          {user?.role === 'admin' && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-medium rounded-lg transition-all">
              <Plus className="w-4 h-4" /> Создать отчёт
            </button>
          )}
        </div>
      </div>

      {filteredReports.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-12 text-center">
          <p className="text-gray-400">Отчётов не найдено</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map(report => {
            const driver = allUsers.find(u => u.id === report.user_id);
            const logs = getEditLogsByReport(report.id);
            const isExpanded = expandedLogs === report.id;

            return (
              <div key={report.id} className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl overflow-hidden">
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">
                          {report.year}, Неделя {report.week_number}
                        </span>
                        {user?.role !== 'driver' && driver && (
                          <span className="text-xs px-2 py-0.5 bg-gray-700 rounded-full text-gray-300">
                            {driver.username}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-sm">
                        {formatDate(getWeekRange(report.year, report.week_number).start)} — {formatDate(getWeekRange(report.year, report.week_number).end)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(user?.role === 'manager' || user?.role === 'admin') && (
                        <button onClick={() => setEditingReport(report)}
                          className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all" title="Редактировать">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {user?.role === 'admin' && (
                        <button onClick={() => handleDelete(report.id)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Удалить">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="bg-gray-700/30 rounded-lg p-3">
                      <p className="text-gray-500 text-xs">Wheely (грязн.)</p>
                      <p className="text-white font-medium">{formatCurrency(report.wheely_gross)}</p>
                    </div>
                    <div className="bg-gray-700/30 rounded-lg p-3">
                      <p className="text-gray-500 text-xs">Wheely (чистый)</p>
                      <p className="text-amber-400 font-semibold">{formatCurrency(getWheelyBreakdown(report).net)}</p>
                    </div>
                    <div className="bg-gray-700/30 rounded-lg p-3">
                      <p className="text-gray-500 text-xs">Яндекс (грязн.)</p>
                      <p className="text-white font-medium">{formatCurrency(report.yandex_gross)}</p>
                    </div>
                    <div className="bg-gray-700/30 rounded-lg p-3">
                      <p className="text-gray-500 text-xs">Яндекс (чистый)</p>
                      <p className="text-blue-400 font-semibold">{formatCurrency(getYandexBreakdown(report).net)}</p>
                    </div>
                    <div className="bg-gray-700/30 rounded-lg p-3">
                      <p className="text-gray-500 text-xs">Возврат руководителю</p>
                      <p className="text-orange-400 font-semibold">{formatCurrency(getYandexBreakdown(report).managerRepayment)}</p>
                    </div>
                    <div className="bg-gray-700/30 rounded-lg p-3">
                      <p className="text-gray-500 text-xs">Собств. аренда</p>
                      <p className="text-white font-medium">{formatCurrency(report.own_rent_gross)}</p>
                    </div>
                    <div className="bg-gray-700/30 rounded-lg p-3">
                      <p className="text-gray-500 text-xs">Почас. часы</p>
                      <p className="text-white font-medium">{report.hourly_rent_hours} ч.</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    {(report.wheely_agent_fee ?? 0) > 0 && <span className="text-red-400">−Агентское: {formatCurrency(report.wheely_agent_fee)}</span>}
                    {(report.wheely_airport_parking ?? 0) > 0 && <span className="text-red-400">−Парковка аэропорт: {formatCurrency(report.wheely_airport_parking)}</span>}
                    {report.bonuses > 0 && <span className="text-green-400">+Бонус Wheely: {formatCurrency(report.bonuses)}</span>}
                    {(report.yandex_tips ?? 0) > 0 && <span className="text-red-400">−Чаевые Яндекс: {formatCurrency(report.yandex_tips)}</span>}
                    {(report.zsd ?? 0) > 0 && <span className="text-red-400">−ЗСД: {formatCurrency(report.zsd)}</span>}
                    {report.compensations > 0 && <span className="text-green-400">+Комп: {formatCurrency(report.compensations)}</span>}
                    {(report.tips ?? 0) > 0 && <span className="text-yellow-300">+Чаевые: {formatCurrency(report.tips)}</span>}
                    {report.deductions > 0 && <span className="text-red-400">-Вычет: {formatCurrency(report.deductions)}</span>}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-700/50 flex justify-between items-center">
                    <span className="text-gray-400">Итого к выплате:</span>
                    <span className="text-xl font-bold text-amber-400">{formatCurrency(report.total_driver_payout)}</span>
                  </div>
                </div>

                {/* History toggle */}
                <div className="border-t border-gray-700/50">
                  <button
                    onClick={() => setExpandedLogs(isExpanded ? null : report.id)}
                    className="w-full px-5 py-3 flex items-center justify-between text-sm text-gray-400 hover:text-white hover:bg-gray-700/30 transition-all"
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
                        <p className="text-gray-500 text-sm italic">Оригинальная запись</p>
                      ) : (
                        <div className="space-y-2">
                          {logs.map(log => {
                            const editor = allUsers.find(u => u.id === log.changed_by_user_id);
                            return (
                              <div key={log.id} className="text-sm p-2 bg-gray-700/20 rounded-lg">
                                <span className="text-gray-500">[{formatDateTime(log.changed_at)}]</span>
                                {' '}
                                <span className="text-blue-400">{editor?.username || 'N/A'}</span>
                                {' '}изменил{' '}
                                <span className="text-amber-400">{getFieldLabel(log.field_name)}</span>:
                                {' '}
                                <span className="text-red-400">{log.old_value}</span>
                                {' → '}
                                <span className="text-green-400">{log.new_value}</span>
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
