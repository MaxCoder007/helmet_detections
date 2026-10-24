import React, { useRef, useState, useCallback } from 'react';
import { UploadCloud, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useDetection } from '@/context/DetectionContext';
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_IMAGE_EXTENSIONS } from '@/utils/constants';
import { formatFileSize } from '@/utils/formatters';

interface ImageDropzoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export const ImageDropzone: React.FC<ImageDropzoneProps> = ({ onFileSelect, disabled = false }) => {
  const { settings } = useDetection();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateAndProcessFile = useCallback(
    (file: File) => {
      setValidationError(null);

      // 1. Check file type / extension
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const isValidType =
        ACCEPTED_IMAGE_TYPES.includes(file.type) || ACCEPTED_IMAGE_EXTENSIONS.includes(ext);

      if (!isValidType) {
        setValidationError(
          `Unsupported file format "${file.type || ext}". Only JPEG, JPG, PNG, and WEBP images are supported.`
        );
        return;
      }

      // 2. Check file size
      const maxSizeBytes = settings.maxFileSizeMb * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        setValidationError(
          `File size (${formatFileSize(file.size)}) exceeds the maximum allowed limit of ${settings.maxFileSizeMb} MB.`
        );
        return;
      }

      // Valid
      onFileSelect(file);
    },
    [onFileSelect, settings.maxFileSizeMb]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          'relative border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-center min-h-[260px]',
          isDragOver
            ? 'border-accent-cyan bg-accent-cyan/5 shadow-glow-cyan/20 scale-[0.99]'
            : 'border-border hover:border-accent-cyan/50 hover:bg-background-card/50 bg-background-card/30',
          disabled && 'opacity-50 cursor-not-allowed hover:border-border hover:bg-transparent'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_EXTENSIONS.join(',')}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        {/* Upload Icon with subtle pulsing glow */}
        <div
          className={clsx(
            'w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-200',
            isDragOver ? 'bg-accent-cyan/20 scale-110' : 'bg-background-hover border border-border'
          )}
        >
          <UploadCloud
            className={clsx('w-8 h-8', isDragOver ? 'text-accent-cyan' : 'text-text-secondary')}
          />
        </div>

        <h4 className="text-base font-semibold text-text-primary mb-1">
          {isDragOver ? 'Drop image here' : 'Click to upload or drag & drop'}
        </h4>

        <p className="text-xs text-text-secondary max-w-sm mb-4">
          Upload traffic, road, or motorcycle photos to detect helmets, violations, number plates, and riders
        </p>

        {/* Accepted Formats Badges */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-text-muted">
          <span className="px-2 py-0.5 rounded bg-background-hover border border-border">JPEG</span>
          <span className="px-2 py-0.5 rounded bg-background-hover border border-border">PNG</span>
          <span className="px-2 py-0.5 rounded bg-background-hover border border-border">WEBP</span>
          <span className="text-text-muted px-1">•</span>
          <span>Max {settings.maxFileSizeMb}MB</span>
        </div>
      </div>

      {/* Validation Error Message */}
      {validationError && (
        <div className="mt-3 p-3 rounded-lg bg-status-error/10 border border-status-error/30 text-xs text-status-error flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
};
