import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { OverviewPage } from '@/pages/OverviewPage';
import { ImageDetectionPage } from '@/pages/ImageDetectionPage';
import { VideoAnalysisPage } from '@/pages/VideoAnalysisPage';
import { LiveVideoPage } from '@/pages/LiveVideoPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { ViolationsPage } from '@/pages/ViolationsPage';
import { SettingsPage } from '@/pages/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <OverviewPage />,
      },
      {
        path: 'image-analysis',
        element: <ImageDetectionPage />,
      },
      {
        path: 'detect',
        element: <Navigate to="/image-analysis" replace />,
      },
      {
        path: 'video-analysis',
        element: <VideoAnalysisPage />,
      },
      {
        path: 'video',
        element: <Navigate to="/video-analysis" replace />,
      },
      {
        path: 'live-analysis',
        element: <LiveVideoPage />,
      },
      {
        path: 'live-video',
        element: <Navigate to="/live-analysis" replace />,
      },
      {
        path: 'history',
        element: <HistoryPage />,
      },
      {
        path: 'violations',
        element: <ViolationsPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
