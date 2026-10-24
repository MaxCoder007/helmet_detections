import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useDetection } from '@/context/DetectionContext';
import { AlertCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { health, settings } = useDetection();
  const [dismissOfflineWarning, setDismissOfflineWarning] = useState(false);

  const isBackendOffline = health.status === 'offline';
  const showOfflineBanner = isBackendOffline && !settings.demoMode && !dismissOfflineWarning;

  return (
    <div className="min-h-screen bg-background text-text-primary flex">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Navigation */}
        <Topbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

        {/* Backend Offline Warning Banner */}
        {showOfflineBanner && (
          <div className="bg-status-error/15 border-b border-status-error/30 px-4 py-2.5 flex items-center justify-between text-xs text-status-error">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                <strong>FastAPI backend is offline.</strong> To test real inference, run{' '}
                <code className="bg-background/80 px-1.5 py-0.5 rounded font-mono text-[11px] text-text-primary">
                  uvicorn backend.main:app --reload
                </code>{' '}
                or enable{' '}
                <Link to="/settings" className="underline font-semibold hover:text-white">
                  Demo Mode in Settings
                </Link>{' '}
                to test the UI with simulated predictions.
              </span>
            </div>
            <button
              onClick={() => setDismissOfflineWarning(true)}
              className="p-1 hover:bg-status-error/20 rounded text-status-error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
