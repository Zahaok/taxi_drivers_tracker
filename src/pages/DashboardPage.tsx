import React, { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { TrendingUp, Users, FileText, Receipt, Send, Wallet, CalendarClock } from 'lucide-react';

// Иконка рубля (₽) — вместо доллара
const RoubleIcon = ({ className }: { className?: string }) => (
  <span className={`inline-flex items-center justify-center font-bold leading-none select-none ${className ?? ''}`}>₽</span>
);
import { formatCurrency } from '../utils/calculations';
import { getWheelyBreakdown } from '../utils/wheely';
import { getYandexBreakdown } from '../utils/yandex';
import { getOwnRentBreakdown } from '../utils/ownRent';
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
    // Wheely к выплате: (общий − вычеты) × 30% + бонусы
    const totalWheely = userReports.reduce((sum, r) => sum + getWheelyBreakdown(r).net, 0);
    // Чистый Яндекс: база 35% − чаевые − ЗСД; возврат руководителю: 65% от общего дохода
    const totalYandex = userReports.reduce((sum, r) => sum + getYandexBreakdown(r).net, 0);
    const totalYandexRepayment = userReports.reduce((sum, r) => sum + getYandexBreakdown(r).managerRepayment, 0);
    const totalOwnRentRepayment = userReports.reduce((sum, r) => sum + getOwnRentBreakdown(r).managerRepayment, 0);
    const totalManagerRepayment = totalYandexRepayment + totalOwnRentRepayment;
    const totalFines = userReports.reduce((sum, r) => sum + (r.fines ?? 0), 0);

    return { totalPayout, avgPayout, totalWheely, totalYandex, totalManagerRepayment, totalFines, reportCount: userReports.length };
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
      icon: Wallet,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
    },
    {
      title: 'Средний за неделю',
      value: formatCurrency(stats.avgPayout),
      icon: CalendarClock,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      title: 'Всего отчётов',
      value: stats.reportCount.toString(),
      icon: FileText,
      color: 'text-purple-600',
      bg: 'bg-purple-50'
    },
    {
      title: user?.role === 'driver' ? 'Wheely (к выплате)' : 'Водителей',
      value: user?.role === 'driver' ? formatCurrency(stats.totalWheely) : users.filter((u: User) => u.role === 'driver').length.toString(),
      icon: user?.role === 'driver' ? TrendingUp : Users,
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    },
    {
      title: 'Яндекс (чистый)',
      value: formatCurrency(stats.totalYandex),
      icon: RoubleIcon,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      title: 'Подлежит переводу',
      value: formatCurrency(stats.totalManagerRepayment),
      icon: Send,
      color: 'text-orange-600',
      bg: 'bg-orange-50'
    },
    {
      title: 'Штрафы',
      value: formatCurrency(stats.totalFines),
      icon: Receipt,
      color: 'text-red-600',
      bg: 'bg-red-50'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {user?.role === 'driver' ? 'Мой Dashboard' : 'Сводная аналитика'}
        </h1>
        <p className="text-gray-600 mt-1">
          {user?.role === 'driver' ? 'Ваши финансовые показатели' : 'Обзор по всему парку'}
        </p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
        {cards.map((card, i) => (
          <div key={i} className="bg-white shadow-sm border border-gray-200 rounded-xl p-5 min-w-0 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-gray-600 text-sm truncate" title={card.title}>{card.title}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 break-words tabular-nums">{card.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${card.bg}`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {topDrivers.length > 0 && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Топ водители</h2>
          <div className="space-y-3">
            {topDrivers.map((driver: { name: string; total: number; count: number }, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-amber-600 font-bold text-lg">#{i + 1}</span>
                  <span className="text-gray-900">{driver.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-gray-900 font-semibold">{formatCurrency(driver.total)}</p>
                  <p className="text-gray-600 text-xs">{driver.count} отчётов</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.reportCount === 0 && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600">Отчётов пока нет</p>
          <p className="text-gray-600 text-sm mt-2">Создайте первый недельный отчёт</p>
        </div>
      )}
    </div>
  );
}
