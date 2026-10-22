import { WeeklyReport } from '../types';
import { calculateDriverPayout } from './calculations';

export function generateDemoData(): Partial<WeeklyReport>[] {
  const now = new Date();
  const year = now.getFullYear();
  const currentWeek = Math.ceil(((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);

  const reports: Partial<WeeklyReport>[] = [];

  // Generate 8 weeks of data for driver_1
  for (let w = Math.max(1, currentWeek - 7); w <= currentWeek; w++) {
    reports.push({
      user_id: 'driver_1',
      year,
      week_number: w,
      wheely_gross: 30000 + Math.random() * 20000,
      wheely_agent_fee: Math.random() > 0.4 ? Math.floor(Math.random() * 1500) : 0,
      wheely_airport_parking: Math.random() > 0.5 ? Math.floor(Math.random() * 900) : 0,
      yandex_gross: 25000 + Math.random() * 15000,
      yandex_tips: Math.random() > 0.4 ? Math.floor(Math.random() * 1800) : 0,
      zsd: Math.random() > 0.3 ? Math.floor(300 + Math.random() * 1200) : 0,
      own_rent_gross: 15000 + Math.random() * 10000,
      hourly_rent_hours: 20 + Math.floor(Math.random() * 20),
      compensations: Math.random() > 0.7 ? Math.floor(Math.random() * 3000) : 0,
      bonuses: Math.random() > 0.5 ? Math.floor(Math.random() * 5000) : 0,
      tips: Math.random() > 0.4 ? Math.floor(Math.random() * 2500) : 0,
      deductions: Math.random() > 0.6 ? Math.floor(Math.random() * 2000) : 0
    });
  }

  // Generate 8 weeks of data for driver_2
  for (let w = Math.max(1, currentWeek - 7); w <= currentWeek; w++) {
    reports.push({
      user_id: 'driver_2',
      year,
      week_number: w,
      wheely_gross: 25000 + Math.random() * 18000,
      wheely_agent_fee: Math.random() > 0.5 ? Math.floor(Math.random() * 1200) : 0,
      wheely_airport_parking: Math.random() > 0.6 ? Math.floor(Math.random() * 800) : 0,
      yandex_gross: 20000 + Math.random() * 12000,
      yandex_tips: Math.random() > 0.5 ? Math.floor(Math.random() * 1500) : 0,
      zsd: Math.random() > 0.35 ? Math.floor(250 + Math.random() * 1000) : 0,
      own_rent_gross: 10000 + Math.random() * 8000,
      hourly_rent_hours: 15 + Math.floor(Math.random() * 25),
      compensations: Math.random() > 0.8 ? Math.floor(Math.random() * 2000) : 0,
      bonuses: Math.random() > 0.6 ? Math.floor(Math.random() * 3000) : 0,
      tips: Math.random() > 0.5 ? Math.floor(Math.random() * 2000) : 0,
      deductions: Math.random() > 0.5 ? Math.floor(Math.random() * 1500) : 0
    });
  }

  return reports;
}

export function initializeDemoData() {
  const reportsKey = 'taxi_reports';
  const existing = localStorage.getItem(reportsKey);
  if (existing && JSON.parse(existing).length > 0) return;

  const demoReports = generateDemoData();
  const now = new Date().toISOString();

  const fullReports: WeeklyReport[] = demoReports.map(r => {
    const payoutInput = {
      wheelyGross: Math.round(r.wheely_gross!),
      wheelyAgentFee: Math.round(r.wheely_agent_fee ?? 0),
      wheelyAirportParking: Math.round(r.wheely_airport_parking ?? 0),
      yandexGross: Math.round(r.yandex_gross!),
      yandexTips: Math.round(r.yandex_tips ?? 0),
      zsd: Math.round(r.zsd ?? 0),
      ownRentGross: Math.round(r.own_rent_gross!),
      hourlyRentHours: r.hourly_rent_hours!,
      compensations: Math.round(r.compensations!),
      bonuses: Math.round(r.bonuses!),
      tips: Math.round(r.tips ?? 0),
      deductions: Math.round(r.deductions!)
    };
    return {
      id: Math.random().toString(36).substr(2, 9),
      user_id: r.user_id!,
      year: r.year!,
      week_number: r.week_number!,
      wheely_gross: payoutInput.wheelyGross,
      wheely_agent_fee: payoutInput.wheelyAgentFee,
      wheely_airport_parking: payoutInput.wheelyAirportParking,
      yandex_gross: payoutInput.yandexGross,
      yandex_tips: payoutInput.yandexTips,
      zsd: payoutInput.zsd,
      own_rent_gross: payoutInput.ownRentGross,
      hourly_rent_hours: payoutInput.hourlyRentHours,
      compensations: payoutInput.compensations,
      bonuses: payoutInput.bonuses,
      tips: payoutInput.tips,
      deductions: payoutInput.deductions,
      total_driver_payout: Math.round(calculateDriverPayout(payoutInput)),
      created_at: now,
      updated_at: now
    };
  });

  localStorage.setItem(reportsKey, JSON.stringify(fullReports));
}
