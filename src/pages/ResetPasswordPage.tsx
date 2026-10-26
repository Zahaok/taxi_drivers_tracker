import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { KeyRound, ShieldCheck, AlertTriangle, Car } from 'lucide-react';

// Страница по ссылке из письма: #/reset-password?token=... и активация регистрации #/activate?token=...
export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [kind, setKind] = useState<'registration' | 'reset' | null>(null);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const m = window.location.hash.match(/[?&]token=([^&]+)/);
    const t = m?.[1] || '';
    setToken(t);
    if (!t) { setChecking(false); setError('Ссылка не содержит токен. Запросите сброс пароля на странице входа.'); return; }
    api.tokenInfo(t)
      .then(info => { setKind(info.kind); setChecking(false); })
      .catch(e => { setError(e.message || 'Ссылка недействительна или истекла'); setChecking(false); });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pw1 !== pw2) { setError('Пароли не совпадают'); return; }
    try {
      await api.resetPassword(token, pw1);
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Не удалось установить пароль');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 mb-4">
            <Car className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">SVdrivers</h1>
          <p className="text-gray-600 mt-2">
            {kind === 'registration' ? 'Активация аккаунта — задайте постоянный пароль' : 'Установка нового пароля'}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-xl shadow-gray-200/60">
          {checking && <p className="text-gray-600 text-sm">Проверяем ссылку…</p>}
          {done && (
            <div className="space-y-4 text-center">
              <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="text-gray-900 font-medium">Пароль установлен!</p>
              <a href="#/" onClick={() => { window.location.hash = '/'; window.location.reload(); }}
                className="inline-block px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium">
                Перейти ко входу
              </a>
            </div>
          )}
          {!checking && !done && !error && (
            <form onSubmit={submit} className="space-y-4">
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 w-5 h-5 text-gray-600" />
                <input type="password" placeholder="Новый пароль (мин. 8 символов, буквы и цифры)" value={pw1} onChange={e => setPw1(e.target.value)} required minLength={8}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 w-5 h-5 text-gray-600" />
                <input type="password" placeholder="Повторите новый пароль" value={pw2} onChange={e => setPw2(e.target.value)} required minLength={8}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <button type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-all shadow-md shadow-amber-500/30">
                Сохранить пароль
              </button>
            </form>
          )}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
