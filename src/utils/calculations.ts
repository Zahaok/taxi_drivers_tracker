export function calculateDriverPayout(
  wheelyGross: number,
  yandexGross: number,
  ownRentGross: number,
  hourlyRentHours: number,
  compensations: number,
  bonuses: number,
  deductions: number
): number {
  const wheelyEarnings = wheelyGross * 0.30;
  const yandexEarnings = yandexGross * 0.35;
  const ownRentEarnings = ownRentGross * 0.30;
  const hourlyRentEarnings = hourlyRentHours * 500;

  return wheelyEarnings + yandexEarnings + ownRentEarnings + hourlyRentEarnings + compensations + bonuses - deductions;
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getWeekRange(year: number, weekNumber: number): { start: Date; end: Date } {
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay() || 7;
  const start = new Date(jan1);
  start.setDate(jan1.getDate() + (weekNumber - 1) * 7 - (dayOfWeek - 1));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(amount);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function hashPassword(password: string): string {
  // Simple hash for demo (in real PHP app, use password_hash)
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hashed_' + Math.abs(hash).toString(36) + '_' + password.length;
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function exportToCSV(reports: any[], users: any[], filename: string = 'reports.csv') {
  const headers = ['Водитель', 'Год', 'Неделя', 'Wheely (грязные)', 'Яндекс (грязные)', 'Собств. аренда', 'Почас. часы', 'Компенсации', 'Бонусы', 'Вычеты', 'Итого к выплате'];
  const rows = reports.map(r => {
    const user = users.find(u => u.id === r.user_id);
    return [
      user?.username || 'N/A',
      r.year,
      r.week_number,
      r.wheely_gross,
      r.yandex_gross,
      r.own_rent_gross,
      r.hourly_rent_hours,
      r.compensations,
      r.bonuses,
      r.deductions,
      r.total_driver_payout.toFixed(2)
    ];
  });

  const csvContent = [headers, ...rows].map(row => row.join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
