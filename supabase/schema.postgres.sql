-- SVdrivers: эталонная схема для PostgreSQL / Supabase (порт с SQLite-версии server/db.js).
-- Пароли — только bcrypt-хэши. Plaintext не хранится нигде.
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  email text not null unique,
  password_hash text not null,            -- bcrypt($10)
  role text not null check (role in ('driver','manager','admin')),
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists auth_tokens (
  token text primary key,                 -- sha256(pepper + raw_token), сырые токены не храним
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('registration','reset')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_tokens_user on auth_tokens(user_id);

create table if not exists weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  year int not null,
  week_number int not null,
  grnz text,
  mileage numeric,
  car text,
  wheely_gross numeric not null default 0,
  wheely_agent_fee numeric not null default 0,
  wheely_airport_parking numeric not null default 0,
  sober_driver numeric not null default 0,
  wheely_tips numeric not null default 0,
  yandex_gross numeric not null default 0,
  yandex_tips numeric not null default 0,
  zsd numeric not null default 0,
  own_rent_gross numeric not null default 0,
  zsd_own_rent numeric not null default 0,
  hourly_rent_hours numeric not null default 0,
  compensations numeric not null default 0,
  bonuses numeric not null default 0,
  adjustment_bonuses numeric not null default 0,
  fines numeric not null default 0,
  zsd_payout numeric not null default 0,
  total_driver_payout numeric not null default 0,
  comment text,
  edited_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year, week_number)
);

-- RLS для Supabase: водитель видит только свои отчёты, менеджер/админ — все
alter table weekly_reports enable row level security;
create policy "own reports" on weekly_reports for all
  using (auth.uid() = user_id or exists (
    select 1 from users u where u.id = auth.uid() and u.role in ('manager','admin')
  ));
