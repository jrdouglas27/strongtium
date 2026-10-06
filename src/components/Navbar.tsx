import React from 'react';
import { Dumbbell, LineChart, History, Layers, Database } from 'lucide-react';

export type TabType = 'workouts' | 'analytics' | 'history' | 'routines' | 'db-setup';

interface NavbarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const tabs = [
    { id: 'workouts' as TabType, label: 'Workouts', icon: Dumbbell },
    { id: 'analytics' as TabType, label: 'Analytics', icon: LineChart },
    { id: 'history' as TabType, label: 'History', icon: History },
    { id: 'routines' as TabType, label: 'Routines', icon: Layers },
    { id: 'db-setup' as TabType, label: 'Database', icon: Database },
  ];

  return (
    <>
      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#223541] border-t border-[#182731] pb-[env(safe-area-inset-bottom)] sm:hidden shadow-lg">
        <div className="flex items-center justify-around py-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
                  isActive
                    ? 'text-white font-bold'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg border ${
                    isActive
                      ? 'bg-[#8bb4cb] border-[#749fb7] text-[#0e2938]'
                      : 'border-transparent text-[#94a3b8]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] mt-0.5">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Navigation Bar */}
      <nav className="hidden sm:flex items-center border-b border-[#182731] bg-[#223541] px-6 py-2">
        <div className="max-w-7xl mx-auto w-full flex space-x-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors border ${
                  isActive
                    ? 'bg-[#8bb4cb] text-[#0e2938] border-[#749fb7]'
                    : 'text-[#94a3b8] hover:text-white hover:bg-[#1b2b35] border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
