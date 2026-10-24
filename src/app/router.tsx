import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { OverviewPage } from '@/pages/OverviewPage';
import { ImageDetectionPage } from '@/pages/ImageDetectionPage';
import { VideoAnalysisPage } from '@/pages/VideoAnalysisPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { ModelInfoPage } from '@/pages/ModelInfoPage';
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
        path: 'detect',
        element: <ImageDetectionPage />,
      },
      {
        path: 'video',
        element: <VideoAnalysisPage />,
      },
      {
        path: 'history',
        element: <HistoryPage />,
      },
      {
        path: 'model-info',
        element: <ModelInfoPage />,
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
