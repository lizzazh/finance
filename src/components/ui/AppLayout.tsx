import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav, SideNav } from './Navigation';

export function AppLayout() {
  return (
    <div className="app-layout">
      <SideNav />
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
