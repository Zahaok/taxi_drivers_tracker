import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { formatCurrency, formatDateShort, getWeekRange } from '../utils/calculations';
import { getWheelyBreakdown } from '../utils/wheely';
import { getYandexBreakdown } from '../utils/yandex';
import { getOwnRentBreakdown } from '../utils/ownRent';
import { Download, Filter, FileSpreadsheet, Car, User as UserIcon } from 'lucide-react';
import { exportToCSV, exportToExcel } from '../utils/calculations';
import { Chart, registerables } from 'chart.js';
import { hourlyRentRate, getSettings, subscribeSettings } from '../utils/settings';

Chart.register(...registerables);

// Единый светлый стиль графиков (лучшие практики: приглушенные сетки, подписанные оси,
// единый шрифт, аккуратные tooltip с форматированием рублей, скругленные столбцы).
const FONT = "'Manrope', system-ui, sans-serif";
const GRID = 'rgba(107, 114, 128, 0.12)';
const TICKS = '#6b7280';

const rubTick = (v: number | string) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₽`;
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)} тыс. ₽`;
  return `${Math.round(n)} ₽`;
};

const baseOptions = (): any => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        color: '#374151',
        font: { family: FONT, size: 12 },
        usePointStyle: true,
        pointStyle: 'circle',
        boxWidth: 8,
        padding: 16,
      },
    },
    tooltip: {
      backgroundColor: '#ffffff',
      titleColor: '#111827',
      bodyColor: '#374151',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 10,
      usePointStyle: true,
      titleFont: { family: FONT, weight: 700 as any, size: 12 },
      bodyFont: { family: FONT, size: 12 },
      callbacks: {
        label: (ctx: any) => ` ${ctx.dataset.label}: ${formatCurrency(Number(ctx.parsed.y ?? ctx.parsed ?? 0))}`,
      },
    },
  },
  scales: {
    x: {
      ticks: { color: TICKS, font: { family: FONT, size: 11 }, maxRotation: 0, autoSkipPadding: 12 },
      grid: { display: false },
      border: { color: '#e5e7eb' },
    },
    y: {
      ticks: { color: TICKS, font: { family: FONT, size: 11 }, callback: rubTick },
      grid: { color: GRID, drawTicks: false },
      border: { display: false },
    },
  },
});

export default function AnalyticsPage() {
  const { user, getAllUsers } = useAuth();
  const { reports } = useData();
  const allUsers = getAllUsers();
  const drivers = allUsers.filter(u => u.role === 'driver');

  const [filterDriver, setFilterDriver] = useState('all');
  const [filterCar, setFilterCar] = useState('all');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  // Реактивность на изменения настроек администратора (проценты/ставка аренды)
  const [, setSettingsTick] = useState(0);
  useEffect(() => subscribeSettings(() => setSettingsTick(t => t + 1)), []);

  const lineChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<HTMLCanvasElement>(null);

  const lineChartInstance = useRef<Chart | null>(null);
  const pieChartInstance = useRef<Chart | null>(null);
  const barChartInstance = useRef<Chart | null>(null);

  const filteredReports = useMemo(() => {
    let filtered = reports.filter(r => r.year === filterYear);
    if (user?.role === 'driver') {
      // Drivers only ever see their own data
      filtered = filtered.filter(r => r.user_id === user.id);
    } else if (filterDriver !== 'all') {
      filtered = filtered.filter(r => r.user_id === filterDriver);
    }
    if (filterCar !== 'all') {
      filtered = filtered.filter(r => ((r.grnz ?? '').trim() || 'Без ГРНЗ') === filterCar);
    }
    return [...filtered].sort((a, b) => a.week_number - b.week_number);
  }, [reports, filterDriver, filterCar, filterYear, user]);

  const years = useMemo(() => {
    const yrs = new Set(reports.map(r => r.year));
    yrs.add(new Date().getFullYear());
    return Array.from(yrs).sort();
  }, [reports]);

  // Привязка «водитель — автомобиль»: список машин в выборке с именами водителей
  const cars = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of reports) {
      if (r.year !== filterYear) continue;
      if (user?.role === 'driver' && r.user_id !== user.id) continue;
      if (filterDriver !== 'all' && r.user_id !== filterDriver) continue;
      const key = (r.grnz ?? '').trim() || 'Без ГРНЗ';
      const drv = allUsers.find(u => u.id === r.user_id)?.username || 'Неизвестный';
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(drv);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'ru'));
  }, [reports, allUsers, filterYear, filterDriver, user]);

  const periodLabel = (r: any) => {
    const wr = getWeekRange(r.year, r.week_number);
    return `${formatDateShort(wr.start)}–${formatDateShort(wr.end)}`;
  };

  // Line chart - weekly income dynamics
  useEffect(() => {
    if (!lineChartRef.current) return;
    if (lineChartInstance.current) lineChartInstance.current.destroy();

    const labels = filteredReports.map(periodLabel);
    const data = filteredReports.map(r => r.total_driver_payout);

    lineChartInstance.current = new Chart(lineChartRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'К выплате водителю',
          data,
          borderColor: '#f59e0b',
          backgroundColor: (ctx: any) => {
            const { chartArea, ctx: c } = ctx.chart;
            if (!chartArea) return 'rgba(245,158,11,0.08)';
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
            g.addColorStop(1, 'rgba(245, 158, 11, 0.02)');
            return g;
          },
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#f59e0b',
          pointBorderWidth: 2,
        }]
      },
      options: { ...baseOptions(), plugins: { ...baseOptions().plugins, legend: { display: false } } }
    });

    return () => { if (lineChartInstance.current) lineChartInstance.current.destroy(); };
  }, [filteredReports, getSettings()]);

  // Pie chart - income sources (по аналогии с расчётом выплаты)
  useEffect(() => {
    if (!pieChartRef.current) return;
    if (pieChartInstance.current) pieChartInstance.current.destroy();

    const s = getSettings();
    const totalWheely = filteredReports.reduce((acc, r) => acc + getWheelyBreakdown(r).net, 0);
    const totalYandex = filteredReports.reduce((acc, r) => acc + getYandexBreakdown(r).net, 0);
    const totalOwnRent = filteredReports.reduce((acc, r) => acc + getOwnRentBreakdown(r).base, 0);
    const totalHourly = filteredReports.reduce((acc, r) => acc + r.hourly_rent_hours * s.hourlyRentRateRub, 0);

    pieChartInstance.current = new Chart(pieChartRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Wheely (к выплате)', 'Яндекс (чистый)', `Аренда собственная (${s.ownRentSharePct}%)`, 'Почасовая аренда'],
        datasets: [{
          data: [totalWheely, totalYandex, totalOwnRent, totalHourly],
          backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'],
          hoverBackgroundColor: ['#d97706', '#2563eb', '#059669', '#7c3aed'],
          borderColor: '#ffffff',
          borderWidth: 3,
          borderRadius: 4,
          spacing: 2,
        }]
      },
      options: {
        cutout: '62%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom' as const,
            labels: { color: '#374151', font: { family: FONT, size: 12 }, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 14 },
          },
          tooltip: {
            backgroundColor: '#ffffff', titleColor: '#111827', bodyColor: '#374151',
            borderColor: '#e5e7eb', borderWidth: 1, padding: 12, cornerRadius: 10, usePointStyle: true,
            titleFont: { family: FONT, weight: 700 as any, size: 12 },
            bodyFont: { family: FONT, size: 12 },
            callbacks: {
              label: (ctx: any) => {
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0) || 1;
                const share = Math.round((Number(ctx.parsed) / total) * 100);
                return ` ${ctx.label}: ${formatCurrency(Number(ctx.parsed))} (${share}%)`;
              },
            },
          },
        },
      }
    });

    return () => { if (pieChartInstance.current) pieChartInstance.current.destroy(); };
  }, [filteredReports, getSettings()]);

  // Bar chart - weekly revenue
  useEffect(() => {
    if (!barChartRef.current) return;
    if (barChartInstance.current) barChartInstance.current.destroy();

    const labels = filteredReports.map(periodLabel);
    const wheelyData = filteredReports.map(r => Math.round(getWheelyBreakdown(r).net));
    const yandexData = filteredReports.map(r => Math.round(getYandexBreakdown(r).net));
    const managerRepaymentData = filteredReports.map(r => Math.round(getYandexBreakdown(r).managerRepayment + getOwnRentBreakdown(r).managerRepayment));
    const rentData = filteredReports.map(r => Math.round(getOwnRentBreakdown(r).base + r.hourly_rent_hours * hourlyRentRate()));
    const finesData = filteredReports.map(r => Math.round((r.fines ?? 0)));

    barChartInstance.current = new Chart(barChartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Wheely (к выплате)', data: wheelyData, backgroundColor: '#f59e0b', hoverBackgroundColor: '#d97706', borderRadius: 4, borderSkipped: false as any, maxBarThickness: 42 },
          { label: 'Яндекс (чистый)', data: yandexData, backgroundColor: '#3b82f6', hoverBackgroundColor: '#2563eb', borderRadius: 4, borderSkipped: false as any, maxBarThickness: 42 },
          { label: 'Подлежит переводу', data: managerRepaymentData, backgroundColor: '#f97316', hoverBackgroundColor: '#ea580c', borderRadius: 4, borderSkipped: false as any, maxBarThickness: 42 },
          { label: 'Аренда (собственная + почасовая)', data: rentData, backgroundColor: '#10b981', hoverBackgroundColor: '#059669', borderRadius: 4, borderSkipped: false as any, maxBarThickness: 42 },
          { label: 'Штрафы', data: finesData, backgroundColor: '#ef4444', hoverBackgroundColor: '#dc2626', borderRadius: 4, borderSkipped: false as any, maxBarThickness: 42 }
        ]
      },
      options: {
        ...baseOptions(),
        scales: {
          ...baseOptions().scales,
          x: { ...baseOptions().scales.x, stacked: true },
          y: { ...baseOptions().scales.y, stacked: true, ticks: { ...baseOptions().scales.y.ticks } },
        },
      }
    });

    return () => { if (barChartInstance.current) barChartInstance.current.destroy(); };
  }, [filteredReports, getSettings()]);

  const handleExportCSV = () => {
    exportToCSV(filteredReports, allUsers, `reports_${filterYear}.csv`);
  };

  const handleExportExcel = () => {
    exportToExcel(filteredReports, allUsers, `SVdrivers_analitika_${filterYear}.xls`);
  };

  const selectCls = "px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 min-w-0 max-w-full";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Аналитика</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all">
            <Download className="w-4 h-4" /> Скачать CSV
          </button>
          <button onClick={handleExportExcel} title="Выгрузить статистику в Excel (сводки по машинам и водителям)"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all">
            <FileSpreadsheet className="w-4 h-4" /> Скачать Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-600" />
          <span className="text-gray-600 text-sm">Фильтры</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <select value={filterYear} onChange={e => { setFilterYear(Number(e.target.value)); setFilterCar('all'); }} className={selectCls}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {user?.role !== 'driver' && (
            <select value={filterDriver} onChange={e => { setFilterDriver(e.target.value); setFilterCar('all'); }} className={selectCls}>
              <option value="all">Все водители</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.username}</option>)}
            </select>
          )}
          <select value={filterCar} onChange={e => setFilterCar(e.target.value)} className={selectCls}
            title="Привязка водитель — автомобиль">
            <option value="all">Все автомобили</option>
            {cars.map(([grnz, drvSet]) => (
              <option key={grnz} value={grnz}>{grnz} · {Array.from(drvSet).join(', ')}</option>
            ))}
          </select>
        </div>
        {/* Чипы привязки водитель — автомобиль (в кабинете водителя видна его машина) */}
        {cars.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {cars.map(([grnz, drvSet]) => (
              <button key={grnz} onClick={() => setFilterCar(filterCar === grnz ? 'all' : grnz)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  filterCar === grnz
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                <Car className="w-3.5 h-3.5" />
                <span className="font-medium tracking-wide">{grnz}</span>
                <span className="flex items-center gap-1 text-gray-400">
                  <UserIcon className="w-3 h-3" />{Array.from(drvSet).join(', ')}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))' }}>
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
          <h3 className="text-gray-900 font-semibold mb-1">Динамика выплат по периодам</h3>
          <p className="text-gray-500 text-xs mb-4">Сумма к выплате водителю за каждую неделю</p>
          <div className="h-64">
            <canvas ref={lineChartRef}></canvas>
          </div>
        </div>

        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
          <h3 className="text-gray-900 font-semibold mb-1">Доли источников дохода</h3>
          <p className="text-gray-500 text-xs mb-4">Из чего складывается доход за выбранный год</p>
          <div className="h-64">
            <canvas ref={pieChartRef}></canvas>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
        <h3 className="text-gray-900 font-semibold mb-1">Выручка по периодам</h3>
        <p className="text-gray-500 text-xs mb-4">Составляющие дохода и подлежащие переводу суммы по каждой неделе</p>
        <div className="h-72">
          <canvas ref={barChartRef}></canvas>
        </div>
      </div>

      {filteredReports.length === 0 && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-600">Нет данных для отображения</p>
          <p className="text-gray-600 text-sm mt-2">Создайте отчёты для выбранного периода</p>
        </div>
      )}
    </div>
  );
}
