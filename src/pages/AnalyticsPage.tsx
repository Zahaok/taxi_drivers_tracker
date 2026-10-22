import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { formatCurrency } from '../utils/calculations';
import { Download, Filter } from 'lucide-react';
import { exportToCSV } from '../utils/calculations';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export default function AnalyticsPage() {
  const { user, getAllUsers } = useAuth();
  const { reports } = useData();
  const allUsers = getAllUsers();
  const drivers = allUsers.filter(u => u.role === 'driver');

  const [filterDriver, setFilterDriver] = useState('all');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const lineChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<HTMLCanvasElement>(null);

  const lineChartInstance = useRef<Chart | null>(null);
  const pieChartInstance = useRef<Chart | null>(null);
  const barChartInstance = useRef<Chart | null>(null);

  const filteredReports = useMemo(() => {
    let filtered = reports.filter(r => r.year === filterYear);
    if (user?.role === 'driver') {
      filtered = filtered.filter(r => r.user_id === user.id);
    } else if (filterDriver !== 'all') {
      filtered = filtered.filter(r => r.user_id === filterDriver);
    }
    return filtered.sort((a, b) => a.week_number - b.week_number);
  }, [reports, filterDriver, filterYear, user]);

  const years = useMemo(() => {
    const yrs = new Set(reports.map(r => r.year));
    yrs.add(new Date().getFullYear());
    return Array.from(yrs).sort();
  }, [reports]);

  // Line chart - weekly income dynamics
  useEffect(() => {
    if (!lineChartRef.current) return;
    if (lineChartInstance.current) lineChartInstance.current.destroy();

    const labels = filteredReports.map(r => `Нед. ${r.week_number}`);
    const data = filteredReports.map(r => r.total_driver_payout);

    lineChartInstance.current = new Chart(lineChartRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Выплата водителю (₽)',
          data,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#f59e0b',
          pointBorderColor: '#fff',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af' } }
        },
        scales: {
          x: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(75,85,99,0.3)' } },
          y: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(75,85,99,0.3)' } }
        }
      }
    });

    return () => { if (lineChartInstance.current) lineChartInstance.current.destroy(); };
  }, [filteredReports]);

  // Pie chart - income sources
  useEffect(() => {
    if (!pieChartRef.current) return;
    if (pieChartInstance.current) pieChartInstance.current.destroy();

    const totalWheely = filteredReports.reduce((s, r) => s + r.wheely_gross * 0.3, 0);
    const totalYandex = filteredReports.reduce((s, r) => s + r.yandex_gross * 0.35, 0);
    const totalOwnRent = filteredReports.reduce((s, r) => s + r.own_rent_gross * 0.3, 0);
    const totalHourly = filteredReports.reduce((s, r) => s + r.hourly_rent_hours * 500, 0);

    pieChartInstance.current = new Chart(pieChartRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Wheely', 'Яндекс', 'Собств. аренда', 'Почасовая'],
        datasets: [{
          data: [totalWheely, totalYandex, totalOwnRent, totalHourly],
          backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'],
          borderColor: '#1f2937',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af', padding: 15 } }
        }
      }
    });

    return () => { if (pieChartInstance.current) pieChartInstance.current.destroy(); };
  }, [filteredReports]);

  // Bar chart - weekly revenue
  useEffect(() => {
    if (!barChartRef.current) return;
    if (barChartInstance.current) barChartInstance.current.destroy();

    const labels = filteredReports.map(r => `Нед. ${r.week_number}`);
    const wheelyData = filteredReports.map(r => r.wheely_gross * 0.3);
    const yandexData = filteredReports.map(r => r.yandex_gross * 0.35);
    const rentData = filteredReports.map(r => r.own_rent_gross * 0.3 + r.hourly_rent_hours * 500);

    barChartInstance.current = new Chart(barChartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Wheely', data: wheelyData, backgroundColor: '#f59e0b' },
          { label: 'Яндекс', data: yandexData, backgroundColor: '#3b82f6' },
          { label: 'Аренда', data: rentData, backgroundColor: '#10b981' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af' } }
        },
        scales: {
          x: { stacked: true, ticks: { color: '#6b7280' }, grid: { color: 'rgba(75,85,99,0.3)' } },
          y: { stacked: true, ticks: { color: '#6b7280' }, grid: { color: 'rgba(75,85,99,0.3)' } }
        }
      }
    });

    return () => { if (barChartInstance.current) barChartInstance.current.destroy(); };
  }, [filteredReports]);

  const handleExportCSV = () => {
    exportToCSV(filteredReports, allUsers, `reports_${filterYear}.csv`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Аналитика</h1>
        <button onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all">
          <Download className="w-4 h-4" /> Скачать CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-gray-400 text-sm">Фильтры</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
            className="px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {user?.role !== 'driver' && (
            <select value={filterDriver} onChange={e => setFilterDriver(e.target.value)}
              className="px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50">
              <option value="all">Все водители</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.username}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl p-6">
          <h3 className="text-white font-medium mb-4">Динамика выплат по неделям</h3>
          <div className="h-64">
            <canvas ref={lineChartRef}></canvas>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl p-6">
          <h3 className="text-white font-medium mb-4">Доли источников дохода</h3>
          <div className="h-64">
            <canvas ref={pieChartRef}></canvas>
          </div>
        </div>
      </div>

      <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl p-6">
        <h3 className="text-white font-medium mb-4">Выручка по неделям (стек)</h3>
        <div className="h-72">
          <canvas ref={barChartRef}></canvas>
        </div>
      </div>

      {filteredReports.length === 0 && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-12 text-center">
          <p className="text-gray-400">Нет данных для отображения</p>
          <p className="text-gray-500 text-sm mt-2">Создайте отчёты для выбранного периода</p>
        </div>
      )}
    </div>
  );
}
