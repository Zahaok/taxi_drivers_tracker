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
  wheely_gross: number;
  yandex_gross: number;
  own_rent_gross: number;
  hourly_rent_hours: number;
  compensations: number;
  bonuses: number;
  deductions: number;
  total_driver_payout: number;
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
