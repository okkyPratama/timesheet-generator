'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, CalendarClock, Combine, Menu, X } from 'lucide-react';
import { useState } from 'react';

const menuItems = [
  {
    name: 'Jira CSV to PDF',
    path: '/csv-to-pdf',
    icon: FileText,
    description: 'Convert Jira CSV files to PDF'
  },
  {
    name: 'Great Day to PDF',
    path: '/greatday-to-pdf',
    icon: CalendarClock,
    description: 'Convert Great Day attendance to PDF'
  },
  {
    name: 'Merge PDFs',
    path: '/merge-pdf',
    icon: Combine,
    description: 'Merge multiple PDF files'
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? (
          <X className="w-6 h-6 text-gray-700" />
        ) : (
          <Menu className="w-6 h-6 text-gray-700" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-72 bg-white border-r border-gray-200
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-800">
              Timesheet Generator
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Convert & Merge Documents
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    flex items-start gap-3 p-3 rounded-lg transition-all
                    ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                    }
                  `}
                >
                  <Icon
                    className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                      isActive ? 'text-blue-600' : 'text-gray-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                      {item.name}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {item.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}