import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  VideoOff,
  Play,
  Pause,
  AlertCircle,
  Camera,
  Clock,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ClassBadge } from '@/components/detection/ClassBadge';
import { useDetection } from '@/context/DetectionContext';
import { DetectionItem, ClassCounts, ComplianceRecord } from '@/types/detection';
import { runInference, ApiError } from '@/services/api';
import { drawDetectionsOnCanvas } from '@/utils/canvasDrawer';
import { formatConfidence } from '@/utils/formatters';
import { clsx } from 'clsx';

export const LiveVideoPage: React.FC = () => {
  const { health, settings } = useDetection();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isDetectingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [liveDetections, setLiveDetections] = useState<DetectionItem[]>([]);
  const [liveCounts, setLiveCounts] = useState<ClassCounts>({
    helmet: 0,
    no_helmet: 0,
    number_plate: 0,
    pillion: 0,
    rider: 0,
  });
  const [liveRecords, setLiveRecords] = useState<ComplianceRecord[]>([]);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [isProcessingFrame, setIsProcessingFrame] = useState(false);

  // Stop camera and release media tracks
  const stopCamera = useCallback(() => {
    isDetectingRef.current = false;
    setIsDetecting(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    setLiveDetections([]);
    setLiveCounts({ helmet: 0, no_helmet: 0, number_plate: 0, pillion: 0, rider: 0 });
    setIsCameraOn(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    setInferenceError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API is not supported by your browser or in this environment.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setIsCameraOn(true);
    } catch (err: unknown) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError('Camera access was denied. Please allow camera permissions in your browser settings.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraError('No camera found on your device.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setCameraError('Camera is already in use by another application.');
        } else {
          setCameraError(`Unable to start camera: ${err.message}`);
        }
      } else {
        setCameraError('An unexpected error occurred while accessing your camera.');
      }
    }
  };

  // Capture frame and send to backend for inference
  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || isProcessingFrame) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 || h === 0) return;

    // Set canvas dimensions
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    setIsProcessingFrame(true);

    try {
      // Offscreen canvas to capture current video frame
      const offscreen = document.createElement('canvas');
      offscreen.width = w;
      offscreen.height = h;
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return;

      offCtx.drawImage(video, 0, 0, w, h);

      // Convert to blob
      const blob = await new Promise<Blob | null>((resolve) =>
        offscreen.toBlob(resolve, 'image/jpeg', 0.85)
      );

      if (!blob) return;

      // Run real inference against backend
      const result = await runInference(settings.apiBaseUrl, blob, {
        conf: settings.confidenceThreshold,
        iou: settings.iouThreshold,
        imgsz: 640,
        analysis_type: 'live',
        save_record: false,
      });

      setLiveDetections(result.detections);
      setLiveCounts(result.counts);
      setLiveRecords(result.records || []);
      setLastLatencyMs(result.inference_time_ms);
      setInferenceError(null);

      // Render bounding boxes on overlay canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawDetectionsOnCanvas(ctx, result.detections, w, h, {
          showLabels: true,
          showConfidence: true,
          boxThickness: 2,
        });
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setInferenceError(err.message);
      } else if (err instanceof Error) {
        setInferenceError(err.message);
      }
    } finally {
      setIsProcessingFrame(false);
    }
  }, [isProcessingFrame, settings.apiBaseUrl, settings.confidenceThreshold, settings.iouThreshold]);

  // Start Detection toggle
  const toggleDetection = () => {
    if (!isCameraOn) return;

    if (isDetecting) {
      // Pause
      isDetectingRef.current = false;
      setIsDetecting(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Clear overlay
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      setLiveDetections([]);
    } else {
      // Start
      if (health.status !== 'ok') {
        setInferenceError(
          'Backend is currently offline. Start FastAPI backend on port 8000 to enable live detection.'
        );
      }
      isDetectingRef.current = true;
      setIsDetecting(true);

      // Run frame inference every 700ms
      processFrame();
      timerRef.current = setInterval(() => {
        if (isDetectingRef.current) {
          processFrame();
        }
      }, 750);
    }
  };

  const totalDetections = liveDetections.length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
            Live Video Analysis
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Real-time motorcycle safety and helmet detection from your connected camera
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {!isCameraOn ? (
            <Button
              variant="primary"
              size="md"
              onClick={startCamera}
              leftIcon={<Camera className="w-4 h-4" />}
            >
              Start Camera
            </Button>
          ) : (
            <>
              <Button
                variant={isDetecting ? 'secondary' : 'primary'}
                size="md"
                onClick={toggleDetection}
                leftIcon={isDetecting ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              >
                {isDetecting ? 'Pause Detection' : 'Start Detection'}
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={stopCamera}
                leftIcon={<VideoOff className="w-4 h-4" />}
              >
                Stop Camera
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Backend Offline Warning if detecting */}
      {health.status !== 'ok' && isCameraOn && (
        <div className="p-3.5 rounded-xl bg-status-warning/10 border border-status-warning/30 text-xs text-status-warning flex items-start gap-2.5">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-text-primary">Camera Preview Active: </span>
            The live video feed is streaming locally. To run real-time YOLO11n object detection on live frames, ensure the FastAPI backend is running (<code className="text-text-primary">http://127.0.0.1:8000</code>).
          </div>
        </div>
      )}

      {/* Camera Error Message */}
      {cameraError && (
        <div className="p-4 rounded-xl bg-status-error/10 border border-status-error/30 text-xs text-status-error flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-text-primary mb-0.5">Camera Access Error</h4>
            <p className="text-status-error/90 leading-relaxed">{cameraError}</p>
          </div>
        </div>
      )}

      {/* Inference Error */}
      {inferenceError && (
        <div className="p-3.5 rounded-xl bg-status-error/10 border border-status-error/30 text-xs text-status-error flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{inferenceError}</span>
        </div>
      )}

      {/* Main Live Viewport & Side Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Live Camera Viewport (3 Cols) */}
        <div className="lg:col-span-3 bg-background-card border border-border rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-3 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  'w-2 h-2 rounded-full',
                  isCameraOn ? (isDetecting ? 'bg-status-success animate-pulse' : 'bg-status-warning') : 'bg-text-muted'
                )}
              />
              <span className="font-medium text-text-primary">
                {isCameraOn
                  ? isDetecting
                    ? 'Live Detection Active'
                    : 'Camera Ready (Detection Paused)'
                  : 'Camera Idle'}
              </span>
            </div>

            {lastLatencyMs !== null && isDetecting && (
              <span className="font-mono text-text-secondary text-[11px] flex items-center gap-1">
                <Clock className="w-3 h-3 text-accent-cyan" />
                {lastLatencyMs} ms
              </span>
            )}
          </div>

          {/* Camera Frame Container */}
          <div className="relative rounded-lg overflow-hidden bg-black/80 border border-border-subtle aspect-video flex items-center justify-center min-h-[360px]">
            {/* Native Video Element */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={clsx('w-full h-full object-contain', !isCameraOn && 'hidden')}
            />

            {/* Canvas Overlay for Live Bounding Boxes */}
            <canvas
              ref={canvasRef}
              className={clsx(
                'absolute inset-0 w-full h-full object-contain pointer-events-none',
                !isCameraOn && 'hidden'
              )}
            />

            {/* Offline / Idle Placeholder */}
            {!isCameraOn && (
              <div className="text-center p-6 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-background-secondary border border-border flex items-center justify-center mx-auto text-text-muted">
                  <Camera className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">Camera is Turned Off</h4>
                  <p className="text-xs text-text-secondary mt-1 max-w-sm">
                    Click "Start Camera" above to grant webcam access and begin live traffic detection.
                  </p>
                </div>
                <Button size="sm" variant="primary" onClick={startCamera}>
                  Start Camera
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Live Detections Side Panel (1 Col) */}
        <div className="space-y-4">
          <div className="bg-background-card border border-border rounded-xl p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
              Live Counts ({totalDetections})
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-background-secondary border border-border-subtle">
                <span className="text-text-secondary">Helmet</span>
                <span className="font-mono font-bold text-detection-helmet">{liveCounts.helmet || 0}</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-background-secondary border border-border-subtle">
                <span className="text-text-secondary">No Helmet</span>
                <span className="font-mono font-bold text-detection-no_helmet">{liveCounts.no_helmet || 0}</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-background-secondary border border-border-subtle">
                <span className="text-text-secondary">Number Plate</span>
                <span className="font-mono font-bold text-detection-number_plate">{liveCounts.number_plate || 0}</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-background-secondary border border-border-subtle">
                <span className="text-text-secondary">Rider</span>
                <span className="font-mono font-bold text-detection-rider">{liveCounts.rider || 0}</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-background-secondary border border-border-subtle">
                <span className="text-text-secondary">Pillion</span>
                <span className="font-mono font-bold text-detection-pillion">{liveCounts.pillion || 0}</span>
              </div>
            </div>
          </div>

          {/* Current Objects List */}
          <div className="bg-background-card border border-border rounded-xl p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2.5">
              Current Objects
            </h4>

            {liveDetections.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">
                {isDetecting ? 'No objects currently detected in view.' : 'Detection is paused.'}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                {liveDetections.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="flex items-center justify-between p-2 rounded bg-background-secondary border border-border-subtle text-xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <ClassBadge detectionClass={item.class_name} />
                      {item.class_name === 'number_plate' && item.ocr?.text && (
                        <span className="font-mono text-[10px] text-accent-cyan bg-accent-cyan/10 px-1.5 py-0.5 rounded border border-accent-cyan/20 font-bold">
                          {item.ocr.text}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-text-primary">
                      {formatConfidence(item.confidence)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Recognized Plates & Compliance */}
          {liveRecords.length > 0 && (
            <div className="bg-background-card border border-border rounded-xl p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2.5 flex items-center justify-between">
                <span>Recognized Plates</span>
                <span className="text-accent-cyan font-mono text-[10px]">{liveRecords.length} Active</span>
              </h4>
              <div className="space-y-2">
                {liveRecords.map((r, i) => (
                  <div
                    key={r.id || i}
                    className="p-2.5 rounded-lg bg-background-secondary border border-border text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-text-primary">
                        {r.registration_number || (r.ocr_status === 'unreadable' ? 'Unreadable Plate' : 'No Plate')}
                      </span>
                      <span
                        className={clsx(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium border',
                          r.helmet_status === 'helmet_detected'
                            ? 'bg-status-success/15 text-status-success border-status-success/30'
                            : r.helmet_status === 'no_helmet_detected'
                            ? 'bg-status-error/15 text-status-error border-status-error/30'
                            : 'bg-status-warning/15 text-status-warning border-status-warning/30'
                        )}
                      >
                        {r.helmet_status === 'helmet_detected'
                          ? 'Helmet'
                          : r.helmet_status === 'no_helmet_detected'
                          ? 'No Helmet'
                          : 'Uncertain'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-text-muted">
                      <span>OCR: {r.ocr_status === 'recognized' ? `${Math.round(r.ocr_confidence * 100)}%` : r.ocr_status}</span>
                      <span>{r.association_status === 'associated' ? 'Associated' : 'Uncertain'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
