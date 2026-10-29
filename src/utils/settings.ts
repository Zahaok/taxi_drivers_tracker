// Глобальные настройки расчётов, редактируемые администратором.
// Хранятся в localStorage; единая точка правды для всех модулей расчёта.

export interface RateSettings {
  wheelySharePct: number;    // % заработка водителя с Wheely (по умолчанию 30)
  yandexSharePct: number;    // % заработка водителя с Яндекс (по умолчанию 35)
  ownRentSharePct: number;   // % заработка водителя с личной аренды (по умолчанию 30)
  hourlyRentRateRub: number; // стоимость часа почасовой аренды, ₽ (по умолчанию 500)
}

export const DEFAULT_SETTINGS: RateSettings = {
  wheelySharePct: 30,
  yandexSharePct: 35,
  ownRentSharePct: 30,
  hourlyRentRateRub: 500,
};

const STORAGE_KEY = 'svdrivers_settings_v1';

let cache: RateSettings | null = null;
const listeners = new Set<(s: RateSettings) => void>();

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function sanitizeSettings(raw: Partial<RateSettings> | null | undefined): RateSettings {
  const r = raw ?? {};
  return {
    wheelySharePct: clamp(r.wheelySharePct, 1, 99, DEFAULT_SETTINGS.wheelySharePct),
    yandexSharePct: clamp(r.yandexSharePct, 1, 99, DEFAULT_SETTINGS.yandexSharePct),
    ownRentSharePct: clamp(r.ownRentSharePct, 1, 99, DEFAULT_SETTINGS.ownRentSharePct),
    hourlyRentRateRub: clamp(r.hourlyRentRateRub, 0, 1_000_000, DEFAULT_SETTINGS.hourlyRentRateRub),
  };
}

export function getSettings(): RateSettings {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? sanitizeSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    cache = { ...DEFAULT_SETTINGS };
  }
  return cache!;
}

export function saveSettings(next: Partial<RateSettings>): RateSettings {
  const merged = sanitizeSettings({ ...getSettings(), ...next });
  cache = merged;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* ignore quota errors */
  }
  listeners.forEach((fn) => fn(merged));
  return merged;
}

export function resetSettings(): RateSettings {
  return saveSettings({ ...DEFAULT_SETTINGS });
}

export function subscribeSettings(fn: (s: RateSettings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Удобные геттеры долей (в долях единицы) для модулей расчёта
export const wheelyShare = () => getSettings().wheelySharePct / 100;
export const yandexShare = () => getSettings().yandexSharePct / 100;
export const ownRentShare = () => getSettings().ownRentSharePct / 100;
export const hourlyRentRate = () => getSettings().hourlyRentRateRub;
