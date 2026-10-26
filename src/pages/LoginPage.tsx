import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Car, Lock, Mail, User } from 'lucide-react';

export default function LoginPage() {
  const { login, forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [busy, setBusy] = useState(false);

  const handleForgot = async () => {
    setError(''); setSuccess('');
    if (!email.trim()) { setError('Введите email, затем нажмите «Забыли пароль?»'); return; }
    const r = await forgotPassword(email.trim());
    if (r.success) setSuccess(r.message || 'Письмо со ссылкой для смены пароля отправлено');
    else setError(r.error || 'Не удалось отправить письмо');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    const result = await login(email, password);
    setBusy(false);
    if (!result.success) setError(result.error || 'Ошибка входа');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 mb-4">
            <Car className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">SVdrivers</h1>
          <p className="text-gray-600 mt-2">Еженедельный учёт доходов и расходов</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-xl shadow-gray-200/60">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Вход в систему</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            

            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-600" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500 transition-all"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-600" />
              <input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500 transition-all"
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm">
                {success}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-md shadow-amber-500/30"
            >
              {busy ? 'Входим…' : 'Войти'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button type="button" onClick={handleForgot}
              className="text-amber-600 hover:text-amber-700 text-sm transition-colors">
              Забыли пароль? Сброс по email
            </button>
            <p className="text-gray-500 text-xs mt-2">Регистрация выполняется администратором — на почту придёт приглашение со ссылкой активации.</p>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-gray-600 text-xs text-center mb-3">Демо-аккаунты:</p>
            <div className="space-y-1 text-xs text-gray-600">
              <p><span className="text-amber-600">Admin:</span> admin@svdrivers.ru / Admin2026!</p>
              <p><span className="text-amber-600">Manager:</span> manager@svdrivers.ru / Manager2026!</p>
              <p><span className="text-amber-600">Driver:</span> driver@svdrivers.ru / Driver2026!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
