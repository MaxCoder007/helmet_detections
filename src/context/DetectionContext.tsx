import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  HealthStatus,
  AppSettings,
  PredictionResult,
  HistoryRecord,
} from '@/types/detection';
import { DEFAULT_SETTINGS } from '@/utils/constants';
import { checkBackendHealth, runInference, ApiError } from '@/services/api';
import { generateDemoPrediction } from '@/utils/mockData';

interface DetectionContextType {
  // Backend & System
  health: HealthStatus;
  checkHealth: () => Promise<void>;

  // Settings
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetSettings: () => void;

  // Active Workspace
  activeFile: File | null;
  activePreviewUrl: string | null;
  activeResult: PredictionResult | null;
  status: 'idle' | 'analyzing' | 'success' | 'error';
  errorMessage: string | null;
  highlightedDetectionId: string | null;

  // Actions
  setActiveImage: (file: File) => void;
  clearActiveImage: () => void;
  runActiveAnalysis: () => Promise<void>;
  cancelAnalysis: () => void;
  setHighlightedDetectionId: (id: string | null) => void;

  // Session History
  history: HistoryRecord[];
  clearHistory: () => void;
  loadHistoryRecord: (record: HistoryRecord) => void;
}

const DetectionContext = createContext<DetectionContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = 'roadvision_settings';

export const DetectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load settings from localStorage if available
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_SETTINGS;
  });

  // Backend Health
  const [health, setHealth] = useState<HealthStatus>({
    status: 'offline',
    model_loaded: false,
    lastChecked: undefined,
  });

  // Active Analysis State
  const [activeFile, setActiveFileState] = useState<File | null>(null);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<PredictionResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [highlightedDetectionId, setHighlightedDetectionId] = useState<string | null>(null);

  // Session-only History
  const [history, setHistory] = useState<HistoryRecord[]>([]);

  // Abort controller ref
  const abortControllerRef = useRef<AbortController | null>(null);

  // Health check function
  const checkHealth = useCallback(async () => {
    const res = await checkBackendHealth(settings.apiBaseUrl);
    setHealth(res);
  }, [settings.apiBaseUrl]);

  // Periodic health check every 15 seconds
  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // Update Settings
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  // Set active image with proper URL lifecycle management
  const setActiveImage = (file: File) => {
    // Revoke previous URL to prevent memory leaks
    if (activePreviewUrl && activePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(activePreviewUrl);
    }

    const newUrl = URL.createObjectURL(file);
    setActiveFileState(file);
    setActivePreviewUrl(newUrl);
    setActiveResult(null);
    setStatus('idle');
    setErrorMessage(null);
    setHighlightedDetectionId(null);
  };

  // Clear active image
  const clearActiveImage = () => {
    if (activePreviewUrl && activePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(activePreviewUrl);
    }
    setActiveFileState(null);
    setActivePreviewUrl(null);
    setActiveResult(null);
    setStatus('idle');
    setErrorMessage(null);
    setHighlightedDetectionId(null);
  };

  // Cancel inference
  const cancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('idle');
    setErrorMessage('Inference was canceled by user.');
  };

  // Run analysis on active image
  const runActiveAnalysis = async () => {
    if (!activeFile || !activePreviewUrl) {
      setErrorMessage('Please select an image first.');
      return;
    }

    setStatus('analyzing');
    setErrorMessage(null);

    abortControllerRef.current = new AbortController();

    try {
      let result: PredictionResult;

      // Check if Demo Mode is explicitly enabled or if backend is offline and user has demo mode on
      if (settings.demoMode) {
        // Load image natural dimensions for accurate box scaling
        const img = new Image();
        img.src = activePreviewUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });

        const w = img.naturalWidth || 1280;
        const h = img.naturalHeight || 720;

        // Simulate 400ms processing delay
        await new Promise((r) => setTimeout(r, 450));
        result = generateDemoPrediction(activeFile.name, w, h);
      } else {
        // Real API Inference
        result = await runInference(settings.apiBaseUrl, activeFile, {
          conf: settings.confidenceThreshold,
          iou: settings.iouThreshold,
          imgsz: settings.imageSize,
          signal: abortControllerRef.current.signal,
        });
      }

      setActiveResult(result);
      setStatus('success');

      // Add to session history
      const historyRecord: HistoryRecord = {
        id: `hist-${Date.now()}`,
        timestamp: Date.now(),
        filename: activeFile.name,
        fileSize: activeFile.size,
        originalImageUrl: activePreviewUrl,
        result,
      };

      setHistory((prev) => [historyRecord, ...prev]);
    } catch (err: unknown) {
      setStatus('error');
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred during inference.');
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  // Load a record from history into workspace
  const loadHistoryRecord = (record: HistoryRecord) => {
    setActiveFileState(null); // File object cannot be restored from URL, but preview remains
    setActivePreviewUrl(record.originalImageUrl);
    setActiveResult(record.result);
    setStatus('success');
    setErrorMessage(null);
    setHighlightedDetectionId(null);
  };

  // Clear session history
  const clearHistory = () => {
    setHistory([]);
  };

  return (
    <DetectionContext.Provider
      value={{
        health,
        checkHealth,
        settings,
        updateSettings,
        resetSettings,
        activeFile,
        activePreviewUrl,
        activeResult,
        status,
        errorMessage,
        highlightedDetectionId,
        setActiveImage,
        clearActiveImage,
        runActiveAnalysis,
        cancelAnalysis,
        setHighlightedDetectionId,
        history,
        clearHistory,
        loadHistoryRecord,
      }}
    >
      {children}
    </DetectionContext.Provider>
  );
};

export const useDetection = (): DetectionContextType => {
  const context = useContext(DetectionContext);
  if (!context) {
    throw new Error('useDetection must be used within a DetectionProvider');
  }
  return context;
};
