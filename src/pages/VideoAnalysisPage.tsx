import React, { useRef, useState } from 'react';
import {
  Film,
  UploadCloud,
  FileVideo,
  RotateCcw,
  AlertCircle,
  Info,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatFileSize, sanitizeFilename } from '@/utils/formatters';
import { clsx } from 'clsx';

export const VideoAnalysisPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'analyzing' | 'unsupported'>('idle');

  const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];
  const ACCEPTED_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];

  const handleFile = (file: File) => {
    setValidationError(null);
    setAnalysisStatus('idle');

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const isValid = ACCEPTED_VIDEO_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.includes(ext);

    if (!isValid) {
      setValidationError(`Unsupported video format. Please upload MP4, WEBM, MOV, or AVI files.`);
      return;
    }

    // Size limit: 100MB
    if (file.size > 100 * 1024 * 1024) {
      setValidationError('Video file size exceeds the 100 MB limit.');
      return;
    }

    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }

    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setVideoPreviewUrl(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleReset = () => {
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setSelectedFile(null);
    setVideoPreviewUrl(null);
    setVideoDuration(null);
    setValidationError(null);
    setAnalysisStatus('idle');
  };

  const handleAnalyzeClick = () => {
    // Honest status: video processing requires a dedicated backend video pipeline
    setAnalysisStatus('unsupported');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
            Video Analysis
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Upload traffic surveillance or dashcam footage to analyze motorcycle helmet compliance and number plates
          </p>
        </div>

        {selectedFile && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reset
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={handleAnalyzeClick}
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              Analyze Video
            </Button>
          </div>
        )}
      </div>

      {/* Honest Capability Notice */}
      <div className="p-4 rounded-xl bg-background-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center shrink-0 text-accent-cyan">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-semibold text-text-primary">Video Processing Status</h4>
            <p className="text-text-secondary mt-0.5 leading-relaxed">
              Video ingestion and preview are fully functional below. Continuous video inference requires the upcoming backend video worker (OpenCV frame extraction + ByteTrack tracking).
            </p>
          </div>
        </div>
      </div>

      {/* Main Content: Upload Area or Video Player */}
      {!selectedFile || !videoPreviewUrl ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={clsx(
            'border-2 border-dashed rounded-xl p-10 sm:p-14 text-center cursor-pointer flex flex-col items-center justify-center transition-all min-h-[300px]',
            isDragOver
              ? 'border-accent-cyan bg-accent-cyan/5'
              : 'border-border hover:border-accent-cyan/50 bg-background-card/40'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          <div className="w-16 h-16 rounded-2xl bg-background-secondary border border-border flex items-center justify-center mb-4 text-text-secondary">
            <UploadCloud className="w-8 h-8 text-accent-cyan" />
          </div>

          <h3 className="text-base font-semibold text-text-primary mb-1">
            Click to upload or drag & drop video
          </h3>
          <p className="text-xs text-text-secondary max-w-sm mb-4">
            Upload road traffic or motorcycle clips in MP4, WEBM, MOV, or AVI format (up to 100 MB).
          </p>

          <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Select Video File
          </Button>

          {validationError && (
            <div className="mt-4 p-3 rounded-lg bg-status-error/10 border border-status-error/30 text-xs text-status-error flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
        </div>
      ) : (
        /* Video Selected Workspace */
        <div className="space-y-4">
          <div className="bg-background-card border border-border rounded-xl p-4">
            {/* Metadata bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border mb-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-background-secondary border border-border flex items-center justify-center text-accent-cyan shrink-0">
                  <FileVideo className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-text-primary">{sanitizeFilename(selectedFile.name)}</h4>
                  <div className="flex items-center gap-2 text-[11px] text-text-secondary mt-0.5">
                    <span>{formatFileSize(selectedFile.size)}</span>
                    {videoDuration && (
                      <>
                        <span>•</span>
                        <span>{videoDuration}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Replace Video
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </div>
            </div>

            {/* Video Player */}
            <div className="relative rounded-lg overflow-hidden bg-black/80 border border-border-subtle aspect-video flex items-center justify-center max-h-[500px]">
              <video
                src={videoPreviewUrl}
                controls
                playsInline
                onLoadedMetadata={(e) => {
                  const duration = e.currentTarget.duration;
                  const mins = Math.floor(duration / 60);
                  const secs = Math.floor(duration % 60);
                  setVideoDuration(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
                }}
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Analysis Status Notice when user clicks Analyze */}
          {analysisStatus === 'unsupported' && (
            <div className="p-4 rounded-xl bg-background-card border border-border text-xs space-y-2">
              <div className="flex items-center gap-2 text-status-warning font-semibold">
                <Info className="w-4 h-4" />
                <span>Backend Video Inference Pipeline Required</span>
              </div>
              <p className="text-text-secondary leading-relaxed">
                The uploaded video is ready. In this release, the backend FastAPI service is configured for single-image inference (`POST /predict`). The video batch pipeline (OpenCV video frame extraction, batch tensor inference, and ByteTrack multi-object tracking) will be supported in an upcoming release. To test live AI predictions right now, please use the <strong>Image Analysis</strong> or <strong>Live Video Analysis</strong> pages.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
