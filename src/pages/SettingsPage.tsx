import React, { useState } from 'react';
import { useDetection } from '@/context/DetectionContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  RotateCcw,
  Check,
  RefreshCw,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, resetSettings, checkHealth, health } = useDetection();

  const [formState, setFormState] = useState(settings);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formState);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleReset = () => {
    resetSettings();
    setFormState(settings);
  };

  const handleTestConnection = async () => {
    setIsTestingApi(true);
    updateSettings({ apiBaseUrl: formState.apiBaseUrl });
    await checkHealth();
    setIsTestingApi(false);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
            System & Inference Settings
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Configure backend connection parameters, detector thresholds, and display preferences
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Reset Defaults
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            leftIcon={
              saveSuccess ? (
                <Check className="w-3.5 h-3.5 text-background" />
              ) : undefined
            }
          >
            {saveSuccess ? 'Saved Successfully' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Backend API Configuration */}
      <Card>
        <CardHeader
          title="Backend FastAPI Configuration"
          subtitle="Point the client to your running FastAPI server endpoint"
        />

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">
              Backend API Base URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formState.apiBaseUrl}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, apiBaseUrl: e.target.value }))
                }
                placeholder="http://127.0.0.1:8000"
                className="flex-1 bg-background-secondary border border-border rounded-lg px-3.5 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-cyan"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleTestConnection}
                isLoading={isTestingApi}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Test Connection
              </Button>
            </div>
            <p className="text-[11px] text-text-muted mt-1.5">
              Default is <code className="text-accent-cyan">http://127.0.0.1:8000</code>. Endpoints expected: <code className="text-text-secondary">GET /health</code> and <code className="text-text-secondary">POST /predict</code>.
            </p>
          </div>

          {/* Connection Test Result */}
          <div className="p-3 rounded-lg bg-background-secondary border border-border flex items-center justify-between text-xs">
            <span className="text-text-secondary">Backend Health Status:</span>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  health.status === 'ok'
                    ? 'bg-status-success'
                    : health.status === 'degraded'
                    ? 'bg-status-warning'
                    : 'bg-status-error'
                }`}
              />
              <span className="font-semibold capitalize text-text-primary">
                {health.status}
              </span>
              {health.latency_ms !== undefined && (
                <span className="text-text-muted">({health.latency_ms} ms ping)</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Demo Mode Toggle */}
      <Card>
        <CardHeader
          title="Demo / UI Evaluation Mode"
          subtitle="Enable simulated predictions for interface demonstration when backend is offline"
        />

        <div className="flex items-center justify-between p-3 rounded-lg bg-background-secondary border border-border">
          <div className="pr-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-primary">Enable Demo Mode</span>
              {formState.demoMode && (
                <Badge variant="pink" size="sm">
                  Active
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-text-secondary mt-1">
              Simulates realistic YOLO11n predictions locally in the browser. Useful for offline presentations and UI testing.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={formState.demoMode}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, demoMode: e.target.checked }))
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-pink"></div>
          </label>
        </div>
      </Card>

      {/* Inference Parameters */}
      <Card>
        <CardHeader
          title="Inference Parameters (YOLO11n)"
          subtitle="Fine-tune confidence thresholds and non-maximum suppression (NMS)"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Confidence Threshold */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-text-primary">
                Confidence Threshold (conf)
              </label>
              <span className="font-mono text-xs font-bold text-accent-cyan">
                {Math.round(formState.confidenceThreshold * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.95"
              step="0.05"
              value={formState.confidenceThreshold}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  confidenceThreshold: parseFloat(e.target.value),
                }))
              }
              className="w-full h-1.5 bg-background-secondary rounded-lg appearance-none cursor-pointer accent-accent-cyan"
            />
            <p className="text-[11px] text-text-muted mt-1">
              Detections with confidence below this value will be filtered out. Default: 25%.
            </p>
          </div>

          {/* IoU Threshold */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-text-primary">
                IoU / NMS Threshold (iou)
              </label>
              <span className="font-mono text-xs font-bold text-accent-cyan">
                {Math.round(formState.iouThreshold * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={formState.iouThreshold}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  iouThreshold: parseFloat(e.target.value),
                }))
              }
              className="w-full h-1.5 bg-background-secondary rounded-lg appearance-none cursor-pointer accent-accent-cyan"
            />
            <p className="text-[11px] text-text-muted mt-1">
              Controls overlap suppression for duplicate bounding boxes. Default: 45%.
            </p>
          </div>

          {/* Image Size */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">
              Inference Resolution (imgsz)
            </label>
            <select
              value={formState.imageSize}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  imageSize: parseInt(e.target.value, 10),
                }))
              }
              className="w-full bg-background-secondary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-cyan"
            >
              <option value={320}>320 × 320 px (Fastest)</option>
              <option value={640}>640 × 640 px (Standard / Model Default)</option>
              <option value={768}>768 × 768 px (High Precision)</option>
              <option value={1024}>1024 × 1024 px (Small Objects / License Plates)</option>
            </select>
          </div>

          {/* Max Upload Size */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">
              Maximum File Size Limit
            </label>
            <select
              value={formState.maxFileSizeMb}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  maxFileSizeMb: parseInt(e.target.value, 10),
                }))
              }
              className="w-full bg-background-secondary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-cyan"
            >
              <option value={5}>5 Megabytes (MB)</option>
              <option value={10}>10 Megabytes (MB)</option>
              <option value={15}>15 Megabytes (MB) - Recommended</option>
              <option value={25}>25 Megabytes (MB)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Visual Canvas Preferences */}
      <Card>
        <CardHeader
          title="Visualization Preferences"
          subtitle="Customize bounding box rendering styles"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center justify-between p-3 rounded-lg bg-background-secondary border border-border cursor-pointer">
            <div>
              <span className="text-xs font-semibold text-text-primary">Show Class Labels</span>
              <p className="text-[11px] text-text-muted mt-0.5">Render pill badges above bounding boxes</p>
            </div>
            <input
              type="checkbox"
              checked={formState.showLabels}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, showLabels: e.target.checked }))
              }
              className="rounded bg-background border-border text-accent-cyan focus:ring-accent-cyan"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg bg-background-secondary border border-border cursor-pointer">
            <div>
              <span className="text-xs font-semibold text-text-primary">Show Confidence Scores</span>
              <p className="text-[11px] text-text-muted mt-0.5">Append percentage (e.g. 94%) to labels</p>
            </div>
            <input
              type="checkbox"
              checked={formState.showConfidence}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, showConfidence: e.target.checked }))
              }
              className="rounded bg-background border-border text-accent-cyan focus:ring-accent-cyan"
            />
          </label>
        </div>
      </Card>

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={handleReset}
        >
          Reset Defaults
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          leftIcon={saveSuccess ? <Check className="w-4 h-4 text-background" /> : undefined}
        >
          {saveSuccess ? 'Saved' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
};
