'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';

export default function DashboardLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <main
        className={`
          flex-1 overflow-y-auto transition-all duration-300
          ${isCollapsed ? 'lg:ml-0' : 'lg:ml-72'}
        `}
      >
        {children}
      </main>
    </div>
  );
}
