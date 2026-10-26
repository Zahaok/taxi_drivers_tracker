// Клиент REST API SVdrivers (Express + SQLite).
// В dev-режиме запросы проксируются Vite на http://localhost:4000 (см. vite.config.js),
// в прод-режиме статика и API раздаются с одного порта — путь тот же.
export const TOKEN_KEY = 'sv_session_token';

// Относительный путь '/api/...' разрешается браузером ОТНОСИТЕЛЬНО текущей страницы.
// При деплое в виртуальный каталог IIS (например http://host/SVdrivers/index.html)
// это ломает запросы. Поэтому строим абсолютный URL от корня сайта (origin).
// Переопределяется через window.SVDRIVERS_API_BASE (задаётся в web.config / index.html при need).
function apiUrl(path: string): string {
  const base = (window as any)?.SVDRIVERS_API_BASE; // например 'http://host:4000' или '/sv-api'
  if (!path.startsWith('/api')) return path;
  if (typeof base === 'string' && base) return base.replace(/\/+$/, '') + path;
  return new URL(path, window.location.origin).pathname; // всегда от корня origin
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any || {}) };
  const authHeader = token !== undefined ? token : localStorage.getItem(TOKEN_KEY);
  if (authHeader) headers['Authorization'] = `Bearer ${authHeader}`;
  const res = await fetch(apiUrl(path), { ...options, headers }).catch(() => null);
  // Бэкенд недоступен (например, при статическом деплое только dist/ на IIS без API-сервера):
  // отдаём структурированную ошибку вместо необработанного исключения.
  if (res === null) {
    const err: any = new Error('Сервер SVdrivers недоступен. Проверьте, что запущен backend (node server/index.js) или настроен прокси /api в IIS.');
    err.status = 0;
    throw err;
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* пустое тело */ }
  if (!res.ok) {
    // Статика с IIS может вернуть index.html вместо JSON (SPA fallback) — приводим к понятной ошибке
    if (res.status === 404 || res.status === 405) {
      const err: any = new Error(`API-эндпоинт не найден (${res.status}). Убедитесь, что запросы /api/* проксируются на backend.`);
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
  request<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) }, token);
const get = <T = unknown>(p: string, token?: string | null) => request<T>(p, { method: 'GET' }, token);
const put = <T = unknown>(p: string, body: any) => request<T>(p, { method: 'PUT', body: JSON.stringify(body) });
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
    get<{ kind: 'registration' | 'reset' }>(`/api/auth/token-info?token=${encodeURIComponent(token)}`),

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
