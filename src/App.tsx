import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { WorkoutProvider } from './context/WorkoutContext';
import { Header } from './components/Header';
import { Navbar, TabType } from './components/Navbar';
import { WorkoutsHub } from './components/WorkoutsHub';
import { AnalyticsView } from './components/AnalyticsView';
import { HistoryView } from './components/HistoryView';
import { RoutinesView } from './components/RoutinesView';
import { DatabaseSetupView } from './components/DatabaseSetupView';
import { AuthModal } from './components/AuthModal';

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabType>('workouts');
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#2f4858] text-[#f1f5f9] flex flex-col font-sans">
      {/* Top Header */}
      <Header onOpenAuth={() => setShowAuthModal(true)} />

      {/* Navigation Tabs */}
      <Navbar currentTab={currentTab} onSelectTab={(tab) => setCurrentTab(tab)} />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {currentTab === 'workouts' && (
          <WorkoutsHub
            onNavigateToRoutines={() => setCurrentTab('routines')}
          />
        )}
        {currentTab === 'analytics' && <AnalyticsView />}
        {currentTab === 'history' && <HistoryView />}
        {currentTab === 'routines' && <RoutinesView />}
        {currentTab === 'db-setup' && <DatabaseSetupView />}
      </main>

      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
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
