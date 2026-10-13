import React from 'react';
import { Dumbbell, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Header: React.FC = () => {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-[#223541] border-b border-[#182731] px-4 py-3 sm:px-6 shadow-sm text-white">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#8bb4cb] flex items-center justify-center border border-[#749fb7]">
            <Dumbbell className="w-4 h-4 text-[#0e2938]" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-base tracking-tight text-white">
                STRONGTIUM
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#b9a1c6] text-[#2e1837] px-1.5 py-0.5 rounded border border-[#a48ab2]">
                TRACKER
              </span>
            </div>
            <p className="text-[11px] text-[#94a3b8] hidden sm:block">Intent-Driven Fitness</p>
          </div>
        </div>

        {/* User / Session State */}
        {user && (
          <div className="flex items-center space-x-2.5">
            <div className="hidden sm:flex items-center space-x-2 bg-[#1b2b35] px-3 py-1.5 rounded-lg border border-[#132028]">
              <UserIcon className="w-3.5 h-3.5 text-[#94a3b8]" />
              <span className="text-xs text-white font-medium truncate max-w-[200px]">
                {user.email}
              </span>
            </div>
            <button
              onClick={() => signOut()}
              className="flex items-center space-x-1.5 bg-[#1b2b35] hover:bg-[#132028] text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition border border-[#132028]"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 text-[#cc8d8d]" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
