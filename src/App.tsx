import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkoutProvider } from './context/WorkoutContext';
import { Header } from './components/Header';
import { Navbar, TabType } from './components/Navbar';
import { WorkoutsHub } from './components/WorkoutsHub';
import { AnalyticsView } from './components/AnalyticsView';
import { HistoryView } from './components/HistoryView';
import { RoutinesView } from './components/RoutinesView';
import { DatabaseSetupView } from './components/DatabaseSetupView';
import { LoginWall } from './components/LoginWall';
import { Dumbbell } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>('workouts');

  // Loading Session State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#2f4858] flex flex-col items-center justify-center p-4 text-white font-sans">
        <div className="w-14 h-14 rounded-2xl bg-[#8bb4cb] text-[#0e2938] border border-[#749fb7] flex items-center justify-center mb-4 shadow-lg animate-pulse">
          <Dumbbell className="w-7 h-7" />
        </div>
        <div className="w-6 h-6 border-2 border-[#8bb4cb] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-[#cbd5e1] font-bold tracking-wider uppercase font-mono">
          Verifying Session...
        </p>
      </div>
    );
  }

  // Not Logged In: Strict Login Wall. No site content, headers, or navigation tabs are mounted.
  if (!user) {
    return <LoginWall />;
  }

  // Authenticated: Full Application Access
  return (
    <div className="min-h-screen bg-[#2f4858] text-[#f1f5f9] flex flex-col font-sans">
      {/* Top Header */}
      <Header />

      {/* Navigation Tabs */}
      <Navbar currentTab={currentTab} onSelectTab={(tab) => setCurrentTab(tab)} />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {currentTab === 'workouts' && (
          <WorkoutsHub onNavigateToRoutines={() => setCurrentTab('routines')} />
        )}
        {currentTab === 'analytics' && <AnalyticsView />}
        {currentTab === 'history' && <HistoryView />}
        {currentTab === 'routines' && <RoutinesView />}
        {currentTab === 'db-setup' && <DatabaseSetupView />}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <WorkoutProvider>
        <AppContent />
      </WorkoutProvider>
    </AuthProvider>
  );
};

export default App;
