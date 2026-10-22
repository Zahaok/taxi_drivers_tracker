import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from '../types';
import { hashPassword, verifyPassword, generateId } from '../utils/calculations';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => { success: boolean; error?: string };
  register: (username: string, email: string, password: string, role: Role) => { success: boolean; error?: string };
  logout: () => void;
  updateUser: (id: string, data: Partial<User>) => void;
  deleteUser: (id: string) => void;
  getAllUsers: () => User[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'taxi_users';
const SESSION_KEY = 'taxi_session';

function initializeDefaultUsers(): User[] {
  const users: User[] = [
    {
      id: 'admin_1',
      username: 'Администратор',
      email: 'admin@taxi.ru',
      password_hash: hashPassword('admin123'),
      role: 'admin',
      created_at: new Date().toISOString()
    },
    {
      id: 'manager_1',
      username: 'Руководитель',
      email: 'manager@taxi.ru',
      password_hash: hashPassword('manager123'),
      role: 'manager',
      created_at: new Date().toISOString()
    },
    {
      id: 'driver_1',
      username: 'Иванов И.И.',
      email: 'driver1@taxi.ru',
      password_hash: hashPassword('driver123'),
      role: 'driver',
      created_at: new Date().toISOString()
    },
    {
      id: 'driver_2',
      username: 'Петров П.П.',
      email: 'driver2@taxi.ru',
      password_hash: hashPassword('driver123'),
      role: 'driver',
      created_at: new Date().toISOString()
    }
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  return users;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const users = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!users || users.length === 0) {
      initializeDefaultUsers();
    }
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      const allUsers = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const found = allUsers.find((u: User) => u.id === session);
      if (found) setUser(found);
    }
  }, []);

  const login = (email: string, password: string) => {
    const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const found = users.find(u => u.email === email);
    if (!found) return { success: false, error: 'Пользователь не найден' };
    if (!verifyPassword(password, found.password_hash)) return { success: false, error: 'Неверный пароль' };
    setUser(found);
    localStorage.setItem(SESSION_KEY, found.id);
    return { success: true };
  };

  const register = (username: string, email: string, password: string, role: Role) => {
    const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (users.find(u => u.email === email)) return { success: false, error: 'Email уже зарегистрирован' };
    const newUser: User = {
      id: generateId(),
      username,
      email,
      password_hash: hashPassword(password),
      role,
      created_at: new Date().toISOString()
    };
    users.push(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const updateUser = (id: string, data: Partial<User>) => {
    const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const idx = users.findIndex(u => u.id === id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...data };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
      if (user?.id === id) setUser(users[idx]);
    }
  };

  const deleteUser = (id: string) => {
    const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const filtered = users.filter(u => u.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  };

  const getAllUsers = (): User[] => {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser, deleteUser, getAllUsers }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
