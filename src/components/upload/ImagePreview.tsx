import React, { useRef, useState, useEffect } from 'react';
import { Image as ImageIcon, Trash2, RefreshCw } from 'lucide-react';
import { formatFileSize, sanitizeFilename } from '@/utils/formatters';
import { Button } from '@/components/ui/Button';
import { ACCEPTED_IMAGE_EXTENSIONS } from '@/utils/constants';

interface ImagePreviewProps {
  file: File | null;
  previewUrl: string;
  onRemove: () => void;
  onReplace: (file: File) => void;
  disabled?: boolean;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  file,
  previewUrl,
  onRemove,
  onReplace,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = previewUrl;
    img.onload = () => {
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onReplace(e.target.files[0]);
    }
  };

  const displayName = file ? sanitizeFilename(file.name) : 'Selected Image';
  const displaySize = file ? formatFileSize(file.size) : null;

  return (
    <div className="bg-background-card border border-border rounded-xl p-4 overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_EXTENSIONS.join(',')}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-border mb-3">
        {/* File Metadata */}
        <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-lg bg-background-hover border border-border flex items-center justify-center shrink-0 text-accent-cyan">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-text-primary truncate" title={displayName}>
              {displayName}
            </h4>
            <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
              {displaySize && <span>{displaySize}</span>}
              {dimensions && (
                <>
                  <span>•</span>
                  <span>
                    {dimensions.width} × {dimensions.height} px
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: Replace & Remove */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Replace
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={onRemove}
            disabled={disabled}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Remove
          </Button>
        </div>
      </div>

      {/* Image Preview Container */}
      <div className="relative rounded-lg overflow-hidden bg-black/40 border border-border-subtle flex items-center justify-center max-h-[380px]">
        <img
          src={previewUrl}
          alt={displayName}
          className="max-h-[380px] w-auto max-w-full object-contain rounded"
        />
      </div>
    </div>
  );
};
