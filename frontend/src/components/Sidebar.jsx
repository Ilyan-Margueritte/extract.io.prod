import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  History,
  Key,
  CreditCard,
  Settings,
  LogOut,
  Zap,
  Menu,
  X
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Historique', href: '/dashboard/history', icon: History },
  { name: 'Clés API', href: '/dashboard/api-keys', icon: Key },
  { name: 'Abonnement', href: '/billing', icon: CreditCard },
  { name: 'Paramètres', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar({ children }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="app-wrapper">
      {/* Mobile menu button */}
      <div className="mobile-header">
        <button
          className="mobile-menu-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <Link to="/" className="logo">
          <div className="logo__icon">
            <Zap size={16} color="white" />
          </div>
          <span className="logo__text">Extract.io</span>
        </Link>
      </div>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__inner">
          <Link to="/" className="sidebar__logo">
            <div className="logo__icon">
              <Zap size={16} color="white" />
            </div>
            <span className="logo__text">Extract.io</span>
          </Link>

          <nav className="sidebar__nav">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon size={18} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="sidebar__footer">
            <div className="sidebar__user">
              <div className="sidebar__avatar">
                {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <div className="sidebar__user-info">
                <div className="sidebar__user-name">{user?.full_name || 'Utilisateur'}</div>
                <div className="sidebar__user-email">{user?.email}</div>
              </div>
            </div>
            <button className="sidebar__logout" onClick={logout}>
              <LogOut size={16} />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
