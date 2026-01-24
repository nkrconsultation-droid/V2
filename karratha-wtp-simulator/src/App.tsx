/**
 * KARRATHA WATER TREATMENT PLANT SIMULATOR
 * Version 15 - Delta-Canter 20-843A Three-Phase Tricanter
 *
 * Main application with navigation between:
 * - Front Page (tile navigation)
 * - Full Simulator (process control)
 */

import { useState, useCallback } from 'react';
import FrontPage from './components/FrontPage';
import CentrifugeProcessControl from './components/CentrifugeProcessControl';

type Page = 'home' | 'simulator' | string;

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [plantStatus, setPlantStatus] = useState({
    isRunning: true,
    activeAlarms: 0,
    throughput: 15.0,
    oilEfficiency: 95.2,
  });

  const handleNavigate = useCallback((page: string) => {
    // For now, most tiles go to the full simulator
    // In future, could route to specific tabs/sections
    if (page === 'home') {
      setCurrentPage('home');
    } else {
      // All other pages go to the simulator
      // The page ID could be used to auto-select a tab
      setCurrentPage('simulator');
    }
  }, []);

  const handleBackToHome = useCallback(() => {
    setCurrentPage('home');
  }, []);

  // Render current page
  if (currentPage === 'home') {
    return (
      <FrontPage
        onNavigate={handleNavigate}
        plantStatus={plantStatus}
      />
    );
  }

  // Full simulator with back button
  return (
    <div className="relative">
      {/* Back to Home Button */}
      <button
        onClick={handleBackToHome}
        className="fixed top-4 left-4 z-[100] bg-slate-800/90 hover:bg-slate-700
                   text-white px-4 py-2 rounded-lg shadow-lg border border-slate-600
                   flex items-center gap-2 transition-all hover:scale-105 backdrop-blur-sm"
      >
        <span className="text-lg">←</span>
        <span className="font-medium">Home</span>
      </button>

      {/* Main Simulator */}
      <CentrifugeProcessControl />
    </div>
  );
}
