import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Calendar,
  BarChart3,
  Settings,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Главная', exact: true },
  { to: '/expenses', icon: TrendingDown, label: 'Расходы' },
  { to: '/income', icon: TrendingUp, label: 'Доходы' },
  { to: '/recurring', icon: RefreshCw, label: 'Постоянные' },
  { to: '/calendar', icon: Calendar, label: 'Календарь' },
  { to: '/analytics', icon: BarChart3, label: 'Аналитика' },
  { to: '/settings', icon: Settings, label: 'Настройки' },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ to, icon: Icon, label, exact }) => {
        const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);
        return (
          <NavLink
            key={to}
            to={to}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            aria-label={label}
          >
            <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
            <span>{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function SideNav() {
  const location = useLocation();

  return (
    <aside className="side-nav">
      <div className="side-nav-logo">
        <span className="side-nav-logo-icon">💰</span>
        <span className="side-nav-logo-text">Финансы</span>
      </div>
      <nav className="side-nav-links">
        {NAV_ITEMS.map(({ to, icon: Icon, label, exact }) => {
          const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={`side-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
