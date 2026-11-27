export type Role = 'driver' | 'manager' | 'admin';

// Публичное представление пользователя (без паролей и хэшей) — приходит с бэкенда.
export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  must_change_password?: boolean;
  created_at: string;
  last_login_at?: string | null;
}

export interface WeeklyReport {
  id: string;
  user_id: string;
  year: number;
  week_number: number;        // недельный отчёт (period='weekly'); в дневном = 0
  // Дневные отчёты: тот же набор полей и та же логика расчёта, но период — один день.
  period?: ReportPeriod;      // отсутствует у записей, созданных до появления дневных отчётов == 'weekly'
  month?: number;             // 1..12 (только для дневных)
  day?: number;               // 1..31  (только для дневных)
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
  total_driver_payout: number;
  comment?: string;           // комментарий к сумме к выплате (произвольный текст)
  created_at: string;
  updated_at: string;
}

// Единая «отчётная» сущность: период задаётся либо неделей (year + week_number),
// либо днём (year + month + day). Логика расчёта полностью общая — см. utils/period.ts.
export type ReportPeriod = 'weekly' | 'daily';

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
