import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { KeyRound, AlertTriangle } from 'lucide-react';

// Обязательная смена пароля: показывается, пока must_change_password === true.
// Закрыть без смены нельзя — это блокирующая модаль.
export default function MustChangePasswordModal() {
  const { user, changePassword, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user?.must_change_password) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (next !== repeat) { setError('Новые пароли не совпадают'); return; }
    setBusy(true);
    const r = await changePassword(current, next);
    setBusy(false);
    if (!r.success) setError(r.error || 'Не удалось сменить пароль');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Требуется смена пароля</h2>
            <p className="text-gray-600 text-sm">Это первый вход после создания аккаунта или сброса. Задайте новый пароль.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input type="password" placeholder="Текущий (временный) пароль" value={current} onChange={e => setCurrent(e.target.value)} required
            className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <input type="password" placeholder="Новый пароль: мин. 8 символов, буквы и цифры" value={next} onChange={e => setNext(e.target.value)} required minLength={8}
            className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <input type="password" placeholder="Повторите новый пароль" value={repeat} onChange={e => setRepeat(e.target.value)} required minLength={8}
            className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={busy}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-all">
              {busy ? 'Сохраняем…' : 'Сменить пароль'}
            </button>
            <button type="button" onClick={logout}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all">
              Выйти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
