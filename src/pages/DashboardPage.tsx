import React, { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { TrendingUp, Users, FileText, DollarSign } from 'lucide-react';
import { formatCurrency } from '../utils/calculations';
import { getWheelyBreakdown } from '../utils/wheely';
import { getYandexBreakdown } from '../utils/yandex';
import { User } from '../types';

export default function DashboardPage() {
  const { user, getAllUsers } = useAuth();
  const { reports } = useData();
  const users = getAllUsers();

  // Recompute stats when reports change (e.g., after login following report creation)
  const stats = useMemo(() => {
    const userReports = user?.role === 'driver'
      ? reports.filter(r => r.user_id === user.id)
      : reports;

    const totalPayout = userReports.reduce((sum, r) => sum + r.total_driver_payout, 0);
    const avgPayout = userReports.length > 0 ? totalPayout / userReports.length : 0;
    // Чистый Wheely: база 30% − агентское − парковка + бонусы
    const totalWheely = userReports.reduce((sum, r) => sum + getWheelyBreakdown(r).net, 0);
    // Чистый Яндекс: база 35% − чаевые − ЗСД; возврат руководителю: 65% от грязных
    const totalYandex = userReports.reduce((sum, r) => sum + getYandexBreakdown(r).net, 0);
    const totalManagerRepayment = userReports.reduce((sum, r) => sum + getYandexBreakdown(r).managerRepayment, 0);
    const totalTips = userReports.reduce((sum, r) => sum + (r.tips ?? 0), 0);

    return { totalPayout, avgPayout, totalWheely, totalYandex, totalManagerRepayment, totalTips, reportCount: userReports.length };
  }, [reports, user]);

  const topDrivers = useMemo(() => {
    if (user?.role === 'driver') return [];
    const driverStats = users
      .filter((u: User) => u.role === 'driver')
      .map((u: User) => {
        const driverReports = reports.filter(r => r.user_id === u.id);
        const total = driverReports.reduce((sum, r) => sum + r.total_driver_payout, 0);
        return { name: u.username, total, count: driverReports.length };
      })
      .sort((a: { total: number }, b: { total: number }) => b.total - a.total)
      .slice(0, 5);
    return driverStats;
  }, [reports, users, user]);

  const cards = [
    {
      title: 'Общая выплата',
      value: formatCurrency(stats.totalPayout),
      icon: DollarSign,
      color: 'text-green-400',
      bg: 'bg-green-500/10'
    },
    {
      title: 'Средний за неделю',
      value: formatCurrency(stats.avgPayout),
      icon: TrendingUp,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10'
    },
    {
      title: 'Всего отчётов',
      value: stats.reportCount.toString(),
      icon: FileText,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10'
    },
    {
      title: user?.role === 'driver' ? 'Wheely (чистый)' : 'Водителей',
      value: user?.role === 'driver' ? formatCurrency(stats.totalWheely) : users.filter((u: User) => u.role === 'driver').length.toString(),
      icon: Users,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10'
    },
    {
      title: 'Яндекс (чистый)',
      value: formatCurrency(stats.totalYandex),
      icon: DollarSign,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10'
    },
    {
      title: 'Возврат руководителю',
      value: formatCurrency(stats.totalManagerRepayment),
      icon: TrendingUp,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10'
    },
    {
      title: 'Чаевые',
      value: formatCurrency(stats.totalTips),
      icon: DollarSign,
      color: 'text-yellow-300',
      bg: 'bg-yellow-500/10'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          {user?.role === 'driver' ? 'Мой Dashboard' : 'Сводная аналитика'}
        </h1>
        <p className="text-gray-400 mt-1">
          {user?.role === 'driver' ? 'Ваши финансовые показатели' : 'Обзор по всему парку'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card, i) => (
          <div key={i} className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">{card.title}</p>
                <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${card.bg}`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {topDrivers.length > 0 && (
        <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Топ водители</h2>
          <div className="space-y-3">
            {topDrivers.map((driver: { name: string; total: number; count: number }, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-amber-400 font-bold text-lg">#{i + 1}</span>
                  <span className="text-white">{driver.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold">{formatCurrency(driver.total)}</p>
                  <p className="text-gray-500 text-xs">{driver.count} отчётов</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.reportCount === 0 && (
        <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Отчётов пока нет</p>
          <p className="text-gray-500 text-sm mt-2">Создайте первый недельный отчёт</p>
        </div>
      )}
    </div>
  );
}
