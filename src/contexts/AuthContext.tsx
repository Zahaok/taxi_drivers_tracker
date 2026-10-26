import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Role } from '../types';
import { api, PublicUser, TOKEN_KEY } from '../utils/api';

// Аутентификация через бэкенд (Express + SQLite). Клиент НЕ получает password_hash —
// только публичные поля и флаг must_change_password. Пароли в localStorage не хранятся.
export type { PublicUser };

interface AuthResult { success: boolean; error?: string }

interface AuthContextType {
  user: PublicUser | null;
  usersList: PublicUser[];
  initializing: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  changePassword: (current: string, next: string) => Promise<AuthResult & { user?: PublicUser }>;
  forgotPassword: (email: string) => Promise<AuthResult & { message?: string }>;
  // Админ-методы (бэкенд дополнительно проверяет роль):
  adminCreateUser: (username: string, email: string, role: Role, password?: string) => Promise<AuthResult & { temp_password?: string }>;
  adminUpdateUser: (id: string, data: Partial<{ username: string; email: string; role: Role }>) => Promise<AuthResult>;
  adminDeleteUser: (id: string) => Promise<AuthResult>;
  adminResetUserPassword: (id: string) => Promise<AuthResult & { message?: string }>;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [usersList, setUsersList] = useState<PublicUser[]>([]);
  const [initializing, setInitializing] = useState(true);

  const refreshUsers = useCallback(async () => {
    try {
      const { users } = await api.listUsers();
      setUsersList(users);
    } catch {
      // Не-админ не имеет доступа к списку — это нормально, оставляем пустым
      setUsersList([]);
    }
  }, []);

  // Восстановление сессии по JWT при загрузке приложения
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setInitializing(false); return; }
    api.me()
      .then(({ user: u }) => setUser(u))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setInitializing(false));
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') refreshUsers();
  }, [user, refreshUsers]);

  const login = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { token, user: u } = await api.login(email, password);
      localStorage.setItem(TOKEN_KEY, token);
      setUser(u);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Ошибка входа' };
    }
  };

  const logout = () => {
    setUser(null);
    setUsersList([]);
    localStorage.removeItem(TOKEN_KEY);
  };

  const changePassword = async (current: string, next: string) => {
    try {
      const { user: u } = await api.changePassword(current, next);
      setUser(u);
      return { success: true, user: u };
    } catch (e: any) {
      return { success: false, error: e.message || 'Не удалось сменить пароль' };
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const r = await api.forgotPassword(email);
      return { success: true, message: r.message };
    } catch (e: any) {
      return { success: false, error: e.message || 'Ошибка запроса сброса' };
    }
  };

  const adminCreateUser = async (username: string, email: string, role: Role, password?: string) => {
    try {
      const r = await api.createUser(username, email, role, password);
      await refreshUsers();
      return { success: true, temp_password: r.temp_password };
    } catch (e: any) {
      return { success: false, error: e.message || 'Ошибка создания пользователя' };
    }
  };

  const adminUpdateUser = async (id: string, data: Partial<{ username: string; email: string; role: Role }>) => {
    try {
      await api.updateUser(id, data);
      await refreshUsers();
      if (user?.id === id) { const { user: me } = await api.me(); setUser(me); }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Ошибка обновления' };
    }
  };

  const adminDeleteUser = async (id: string) => {
    try {
      await api.deleteUser(id);
      await refreshUsers();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Ошибка удаления' };
    }
  };

  const adminResetUserPassword = async (id: string) => {
    try {
      const r = await api.adminResetPassword(id);
      await refreshUsers();
      return { success: true, message: r.message };
    } catch (e: any) {
      return { success: false, error: e.message || 'Ошибка сброса пароля' };
    }
  };

  return (
    <AuthContext.Provider value={{
      user, usersList, initializing,
      login, logout, changePassword, forgotPassword,
      adminCreateUser, adminUpdateUser, adminDeleteUser, adminResetUserPassword, refreshUsers,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
