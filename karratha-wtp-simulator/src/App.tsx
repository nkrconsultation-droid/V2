/**
 * KARRATHA WATER TREATMENT PLANT SIMULATOR
 * Version 15 - Delta-Canter 20-843A Three-Phase Tricanter
 *
 * Main application with navigation between:
 * - Front Page (tile navigation)
 * - Process Overview (block flow diagram)
 * - Full Simulator (process control)
 */

import { useState, useCallback } from 'react';
import FrontPage from './components/FrontPage';
import CentrifugeProcessControl from './components/CentrifugeProcessControl';
import ProcessOverview from './components/ProcessOverview';

type Page = 'home' | 'process-overview' | 'simulator';

// Map FrontPage tile IDs to simulator tab IDs
const TILE_TO_TAB_MAP: Record<string, string> = {
  overview: 'feed',           // Plant overview -> Feed Lab (main KPIs)
  centrifuge: 'centrifuge',   // Centrifuge control -> Centrifuge tab
  tankfarm: 'tankage',        // Tank farm -> Tanks tab
  chemical: 'chemDosing',     // Chemical dosing -> Chemicals tab
  filter: 'feed',             // Polishing filter -> Feed Lab (has filter section)
  pond: 'feed',               // Evaporation pond -> Feed Lab (has pond section)
  trends: 'trends',           // Trend analysis -> Trends tab
  alarms: 'alarms',           // Alarm management -> Alarms tab
  reports: 'report',          // Reports & Export -> Report tab
  settings: 'config',         // Configuration -> Config tab
  maintenance: 'config',      // Maintenance -> Config tab
  help: 'feed',               // Help -> Default to Feed Lab
  simulator: 'feed',          // Full simulator -> Feed Lab
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [initialTab, setInitialTab] = useState<string>('feed');
  const [plantStatus, setPlantStatus] = useState({
    isRunning: true,
    activeAlarms: 0,
    throughput: 15.0,
    oilEfficiency: 95.2,
  });

  const handleNavigate = useCallback((page: string) => {
    if (page === 'home') {
      setCurrentPage('home');
    } else if (page === 'process-overview') {
      // Navigate to Process Overview page
      setCurrentPage('process-overview');
    } else {
      // Map tile ID to tab ID and navigate to simulator
      const tabId = TILE_TO_TAB_MAP[page] || 'feed';
      setInitialTab(tabId);
      setCurrentPage('simulator');
    }
  }, []);

  const handleBackToHome = useCallback(() => {
    setCurrentPage('home');
  }, []);

  // Handle navigation from Process Overview to simulator tabs
  const handleProcessOverviewNavigate = useCallback((destination: string) => {
    if (destination === 'simulator') {
      setInitialTab('feed');
      setCurrentPage('simulator');
    } else {
      setInitialTab(destination);
      setCurrentPage('simulator');
    }
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

  // Process Overview page
  if (currentPage === 'process-overview') {
    return (
      <ProcessOverview
        onNavigate={handleProcessOverviewNavigate}
        onBackToHome={handleBackToHome}
        simulationData={{
          feedFlow: plantStatus.throughput,
          oilEff: plantStatus.oilEfficiency,
          isRunning: plantStatus.isRunning,
        }}
      />
    );
  }

  // Full simulator with back button
  return (
    <div className="relative">
      {/* Back to Home Button */}
      <button
        onClick={handleBackToHome}
        className="fixed top-4 left-4 z-[100] bg-white hover:bg-slate-50
                   text-slate-700 px-4 py-2 rounded-lg shadow-lg border border-slate-300
                   flex items-center gap-2 transition-all hover:scale-105 backdrop-blur-sm"
      >
        <span className="text-lg">←</span>
        <span className="font-medium">Home</span>
      </button>

      {/* Main Simulator */}
      <CentrifugeProcessControl initialTab={initialTab} />
    </div>
  );
}
