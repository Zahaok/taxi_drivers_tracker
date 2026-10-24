export type Role = 'driver' | 'manager' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: string;
}

export interface WeeklyReport {
  id: string;
  user_id: string;
  year: number;
  week_number: number;
  grnz?: string;              // ГРНЗ (государственный регистрационный знак ТС)
  mileage?: number;           // Пробег ТС за период, км
  car?: string;               // Автомобиль (марка/модель) — для детального просмотра отчёта
  wheely_gross: number;
  wheely_agent_fee: number;   // агентское вознаграждение Wheely (-)
  wheely_airport_parking: number; // парковка аэропорт Wheely (-)
  sober_driver: number;       // трезвый водитель Wheely (- из заработка, + в компенсации к выплате)
  wheely_tips: number;        // чаевые Wheely (+ к итоговой сумме к выплате)
  yandex_gross: number;
  yandex_tips: number;        // чаевые Яндекс (- из заработка по Яндекс)
  zsd: number;                // ЗСД (- из заработка по Яндекс и из общей выплаты)
  own_rent_gross: number;
  zsd_own_rent?: number;      // ЗСД по собственной аренде (- из выплаты, автоподтягивается в корректировки)
  hourly_rent_hours: number;
  compensations: number;
  bonuses: number;            // бонусы Wheely (+ к уже вычтенным 30% водителя, не участвуют в 30/70)
  adjustmentBonuses?: number; // бонусы в корректировках к выплатам (+ к итоговой сумме к выплате)
  fines: number;              // штрафы (- из суммы к выплате)
  zsdPayout: number;          // ЗСД (- из суммы к выплате, корректировки к выплатам)
  deductions?: number;        // устарело (вычеты) — не используется в новом расчёте
  total_driver_payout: number;
  comment?: string;           // комментарий к сумме к выплате (произвольный текст)
  created_at: string;
  updated_at: string;
}

export interface ReportEditLog {
  id: string;
  report_id: string;
  changed_by_user_id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  changed_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
