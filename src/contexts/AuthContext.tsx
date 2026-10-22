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

function loadUsers(): User[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
  const [usersList, setUsersList] = useState<User[]>(() => loadUsers());

  useEffect(() => {
    let users = loadUsers();
    if (users.length === 0) {
      users = initializeDefaultUsers();
    }
    // Always sync state with the loaded users — otherwise login races
    // against the empty initial state on the first render tick.
    setUsersList(users);
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      const found = users.find((u: User) => u.id === session);
      if (found) setUser(found);
    }
  }, []);

  const login = (email: string, password: string) => {
    const found = usersList.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!found) return { success: false, error: 'Пользователь не найден' };
    if (!verifyPassword(password, found.password_hash)) return { success: false, error: 'Неверный пароль' };
    setUser(found);
    localStorage.setItem(SESSION_KEY, found.id);
    return { success: true };
  };

  const register = (username: string, email: string, password: string, role: Role) => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!username.trim()) return { success: false, error: 'Укажите имя пользователя' };
    if (password.length < 6) return { success: false, error: 'Пароль должен быть не короче 6 символов' };
    if (usersList.find(u => u.email.toLowerCase() === trimmedEmail)) return { success: false, error: 'Email уже зарегистрирован' };
    const newUser: User = {
      id: generateId(),
      username: username.trim(),
      email: trimmedEmail,
      password_hash: hashPassword(password),
      role,
      created_at: new Date().toISOString()
    };
    const updated = [...usersList, newUser];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setUsersList(updated);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const updateUser = (id: string, data: Partial<User>) => {
    const idx = usersList.findIndex(u => u.id === id);
    if (idx !== -1) {
      const updated = [...usersList];
      updated[idx] = { ...updated[idx], ...data };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setUsersList(updated);
      if (user?.id === id) setUser(updated[idx]);
    }
  };

  const deleteUser = (id: string) => {
    const filtered = usersList.filter(u => u.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    setUsersList(filtered);
    if (user?.id === id) logout();
  };

  const getAllUsers = (): User[] => usersList;

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
