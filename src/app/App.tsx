import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { DetectionProvider } from '@/context/DetectionContext';

export const App: React.FC = () => {
  return (
    <DetectionProvider>
      <RouterProvider router={router} />
    </DetectionProvider>
  );
};
