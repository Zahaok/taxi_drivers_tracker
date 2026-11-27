// Клиент REST API SVdrivers (PHP-бэкенд server-php/ в проде, Express+SQLite в dev).
// В dev-режиме запросы проксируются Vite на http://localhost:4000 (см. vite.config.js),
// в прод-режиме статика и API раздаются с одного сайта IIS — правило ^api/(.*)
// в web.config переписывает их на /server-php/index.php.
export const TOKEN_KEY = 'sv_session_token';

// Базовый путь API относительно КОРНЯ сайта. По умолчанию '/api' — как в DEPLOY-IIS.md.
// Если сайт задеплоен в виртуальный каталог IIS (http://host/SVdrivers/), задайте
// window.SVDRIVERS_API_BASE = '/SVdrivers/api' в index.html до загрузки main.js.
const DEFAULT_API_BASE = '/api';

function apiUrl(path: string): string {
  if (!path.startsWith('/api')) return path;
  const raw = (window as any)?.SVDRIVERS_API_BASE; // например '/SVdrivers/api' или 'http://host:4000/api'
  const base = typeof raw === 'string' && raw.trim() ? raw.trim().replace(/\/+$/, '') : DEFAULT_API_BASE;
  // Всегда строим абсолютный URL от origin — иначе относительный путь «съедет»
  // при нахождении страницы не в корне (виртуальный каталог, внутренний роут SPA).
  return new URL(base + path.slice('/api'.length), window.location.origin).pathname;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const url = apiUrl(path);
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any || {}) };
  const authHeader = token !== undefined ? token : localStorage.getItem(TOKEN_KEY);
  if (authHeader) headers['Authorization'] = `Bearer ${authHeader}`;
  const res = await fetch(url, { ...options, headers }).catch(() => null);
  // Бэкенд недоступен (например, при статическом деплое только dist/ на IIS без API-сервера):
  // отдаём структурированную ошибку вместо необработанного исключения.
  if (res === null) {
    const err: any = new Error('Сервер SVdrivers недоступен. Проверьте, что PHP-бэкенд (server-php/) скопирован в веб-корень IIS и настроено правило /api/* в web.config (см. DEPLOY-IIS.md, раздел 7).');
    err.status = 0;
    throw err;
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* пустое тело */ }
  if (!res.ok) {
    // Статика с IIS может вернуть index.html вместо JSON (SPA fallback) — приводим к понятной ошибке
    if (res.status === 404 || res.status === 405) {
      const err: any = new Error(`API-эндпоинт не найден (${res.status}): ${url}. Убедитесь, что запросы /api/* переписываются правилом «API to PHP» в web.config на /server-php/index.php (DEPLOY-IIS.md, раздел 7).`);
      err.status = res.status;
      throw err;
    }
    const err: any = new Error(data?.error || `Ошибка сервера (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data as T;
}

const post = <T = unknown>(p: string, body: any, token?: string | null) =>
  // Поле "path" — резервный маркер маршрута для PHP-бэкенда (server-php/index.php):
  // при некоторых настройках IIS URL Rewrite серверные переменные теряют исходный
  // /api/... путь; сервер использует path только если его не удалось восстановить
  // из URL, и удаляет это поле из payload перед обработкой.
  request<T>(p, { method: 'POST', body: JSON.stringify({ ...(body ?? {}), path: p }) }, token);
const get = <T = unknown>(p: string, token?: string | null) => request<T>(p, { method: 'GET' }, token);
const put = <T = unknown>(p: string, body: any) =>
  request<T>(p, { method: 'PUT', body: JSON.stringify({ ...(body ?? {}), path: p }) });
const del = <T = unknown>(p: string) => request<T>(p, { method: 'DELETE' });

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  role: 'driver' | 'manager' | 'admin';
  must_change_password: boolean;
  created_at: string;
  last_login_at?: string | null;
}

export const api = {
  login: (email: string, password: string) =>
    post<{ token: string; user: PublicUser }>('/api/auth/login', { email, password }),

  me: () => get<{ user: PublicUser }>('/api/me'),

  changePassword: (current_password: string, new_password: string) =>
    post<{ user: PublicUser }>('/api/auth/change-password', { current_password, new_password }),

  forgotPassword: (email: string) =>
    post<{ ok: boolean; message: string }>('/api/auth/forgot-password', { email }),

  tokenInfo: (token: string) =>
    // POST вместо GET: GET с телом отклоняется некоторыми конфигурациями IIS (400/405),
    // а fetch в ряде браузеров не отправляет тело у GET-запросов.
    post<{ kind: 'registration' | 'reset' }>('/api/auth/token-info', { token }),

  resetPassword: (token: string, new_password: string) =>
    post<{ ok: boolean }>('/api/auth/reset-password', { token, new_password }),

  listUsers: () => get<{ users: PublicUser[] }>('/api/users'),

  createUser: (username: string, email: string, role: string, password?: string) =>
    post<{ user: PublicUser; temp_password: string }>('/api/users', { username, email, role, password }),

  updateUser: (id: string, data: { username?: string; email?: string; role?: string }) =>
    put<{ user: PublicUser }>(`/api/users/${id}`, data),

  adminResetPassword: (id: string) =>
    post<{ ok: boolean; message: string }>(`/api/users/${id}/reset-password`, {}),

  setMustChange: (id: string, value: boolean) =>
    post<{ user: PublicUser }>(`/api/users/${id}/must-change-password`, { value }),

  deleteUser: (id: string) => del<{ ok: boolean }>(`/api/users/${id}`),

  outbox: () => get<{ mails: Array<{ to: string; subject: string; text: string }> }>('/api/dev/outbox'),
};
