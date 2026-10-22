import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import UsersPage from './pages/UsersPage';
import { Car, LayoutDashboard, FileText, BarChart3, Users, LogOut, Menu, X } from 'lucide-react';

type Page = 'dashboard' | 'reports' | 'analytics' | 'users';

function AppContent() {
  const { user, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) {
    return <LoginPage />;
  }

  const navItems: { id: Page; label: string; icon: React.ElementType; roles: string[] }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['driver', 'manager', 'admin'] },
    { id: 'reports', label: 'Отчёты', icon: FileText, roles: ['driver', 'manager', 'admin'] },
    { id: 'analytics', label: 'Аналитика', icon: BarChart3, roles: ['manager', 'admin'] },
    { id: 'users', label: 'Пользователи', icon: Users, roles: ['admin'] }
  ];

  const visibleNav = navItems.filter(item => item.roles.includes(user.role));

  const getRoleLabel = () => {
    switch (user.role) {
      case 'admin': return 'Администратор';
      case 'manager': return 'Руководитель';
      case 'driver': return 'Водитель';
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />;
      case 'reports': return <ReportsPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'users': return <UsersPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-gray-800/50 border-r border-gray-700/50 backdrop-blur-xl">
        <div className="p-6 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Car className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-white font-bold">ТаксиУчёт</h1>
              <p className="text-gray-500 text-xs">{getRoleLabel()}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {visibleNav.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                currentPage === item.id
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/30'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700/50">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm text-white font-medium">
              {user.username[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm truncate">{user.username}</p>
              <p className="text-gray-500 text-xs truncate">{user.email}</p>
            </div>
          </div>
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2 mt-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-all text-sm">
            <LogOut className="w-4 h-4" /> Выйти
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gray-800/90 backdrop-blur-xl border-b border-gray-700/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Car className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-white font-bold">ТаксиУчёт</span>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-gray-400 hover:text-white">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="px-4 pb-4 space-y-1">
            {visibleNav.map(item => (
              <button
                key={item.id}
                onClick={() => { setCurrentPage(item.id); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  currentPage === item.id
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/30'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
            <button onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all text-sm">
              <LogOut className="w-5 h-5" /> Выйти
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:p-8 p-4 pt-20 lg:pt-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
}
