import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Role } from '../types';
import { UserPlus, Trash2, Edit2, Shield, X, Check } from 'lucide-react';

export default function UsersPage() {
  const { getAllUsers, register, updateUser, deleteUser, user: currentUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('driver');
  const [error, setError] = useState('');

  const handleDelete = (id: string) => {
    if (id === currentUser?.id) {
      setError('Нельзя удалить свой аккаунт');
      return;
    }
    if (confirm('Удалить пользователя?')) {
      deleteUser(id);
    }
  };

  const users = getAllUsers();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (editingUser) {
      updateUser(editingUser.id, { username, email, role });
      setEditingUser(null);
    } else {
      const result = register(username, email, password, role);
      if (!result.success) {
        setError(result.error || 'Ошибка');
        return;
      }
    }
    setShowForm(false);
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('driver');
  };

  const handleEdit = (u: User) => {
    setEditingUser(u);
    setUsername(u.username);
    setEmail(u.email);
    setRole(u.role);
    setShowForm(true);
  };

  const getRoleBadge = (role: Role) => {
    const styles: Record<Role, string> = {
      admin: 'bg-red-100 text-red-600 border-red-200',
      manager: 'bg-blue-100 text-blue-600 border-blue-200',
      driver: 'bg-emerald-100 text-emerald-600 border-emerald-200'
    };
    const labels: Record<Role, string> = {
      admin: 'Администратор',
      manager: 'Руководитель',
      driver: 'Водитель'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs border ${styles[role]}`}>
        {labels[role]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Управление пользователями</h1>
        <button onClick={() => { setShowForm(true); setEditingUser(null); setUsername(''); setEmail(''); setPassword(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-all">
          <UserPlus className="w-4 h-4" /> Добавить
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
          <h3 className="text-gray-900 font-medium mb-4">
            {editingUser ? 'Редактирование пользователя' : 'Новый пользователь'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-600 text-sm mb-1 block">Имя</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400" required />
              </div>
              <div>
                <label className="text-gray-600 text-sm mb-1 block">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400" required />
              </div>
              {!editingUser && (
                <div>
                  <label className="text-gray-600 text-sm mb-1 block">Пароль</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400" required />
                </div>
              )}
              <div>
                <label className="text-gray-600 text-sm mb-1 block">Роль</label>
                <select value={role} onChange={e => setRole(e.target.value as Role)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400">
                  <option value="driver">Водитель</option>
                  <option value="manager">Руководитель</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-all">
                <Check className="w-4 h-4" /> Сохранить
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingUser(null); }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg transition-all">
                <X className="w-4 h-4" /> Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-5 py-3 text-gray-600 text-sm font-medium">Пользователь</th>
                <th className="text-left px-5 py-3 text-gray-600 text-sm font-medium">Email</th>
                <th className="text-left px-5 py-3 text-gray-600 text-sm font-medium">Роль</th>
                <th className="text-right px-5 py-3 text-gray-600 text-sm font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-200 hover:bg-gray-100/70">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-gray-600" />
                      </div>
                      <span className="text-gray-900">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3">{getRoleBadge(u.role)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleEdit(u)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Редактировать">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(u.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Удалить">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
