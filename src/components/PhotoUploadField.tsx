import React, { useRef, useState } from 'react';
import { Camera, Upload, X, RefreshCw } from 'lucide-react';
import type { ParsedExifMetadata } from '../utils/exifUtils';
import { formatFileSize } from '../utils/exifUtils';
import type { LoadedPhoto } from '../utils/imageLoader';

interface PhotoUploadFieldProps {
  photo: LoadedPhoto | null;
  originalExif: ParsedExifMetadata | null;
  isLoadingPhoto: boolean;
  error: string | null;
  validationError: string | null;
  onSelectFile: (file: File) => void;
  onClearPhoto: () => void;
  onApplyOriginalExif?: () => void;
}

export const PhotoUploadField: React.FC<PhotoUploadFieldProps> = ({
  photo,
  originalExif,
  isLoadingPhoto,
  error,
  validationError,
  onSelectFile,
  onClearPhoto,
  onApplyOriginalExif,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onSelectFile(file);
    }
  };

  return (
    <div id="campo-fotografia" className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor="photo-file-input"
          className="text-sm font-semibold text-[#141413] tracking-tight"
        >
          3. Carga la fotografía
        </label>
        {photo && (
          <button
            type="button"
            onClick={onClearPhoto}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-2 text-xs font-medium text-[#5C5C57] hover:text-[#141413] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Quitar foto
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        id="photo-file-input"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="sr-only"
      />

      {!photo ? (
        <label
          htmlFor="photo-file-input"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-3 w-full min-h-[176px] px-5 py-6 rounded-xl border border-dashed transition-colors cursor-pointer text-center ${
            isDragging
              ? 'border-[#2563EB] bg-[#2563EB]/5'
              : validationError || error
                ? 'border-[#DC2626] bg-[#FEF2F2]/60'
                : 'border-[#D4D4CE] bg-[#FAFAF8] hover:border-[#2563EB]/60 hover:bg-white'
          }`}
        >
          <div className="w-11 h-11 rounded-xl bg-white border border-[#E4E4E0] flex items-center justify-center text-[#141413]">
            {isLoadingPhoto ? (
              <RefreshCw className="w-5 h-5 animate-spin text-[#2563EB]" aria-hidden="true" />
            ) : (
              <Upload className="w-5 h-5 text-[#2563EB]" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-[#141413]">
              {isLoadingPhoto
                ? 'Procesando fotografía...'
                : 'Toca para elegir o arrastra una fotografía'}
            </p>
            <p className="text-xs text-[#6B6B65]">
              JPG, PNG o WebP desde PC o galería de Android
            </p>
          </div>
        </label>
      ) : (
        <div className="rounded-xl border border-[#E4E4E0] bg-white overflow-hidden">
          <div className="relative bg-[#141413] flex items-center justify-center max-h-[220px] overflow-hidden">
            <img
              src={photo.jpegDataUrl}
              alt={`Vista previa de ${photo.originalName}`}
              referrerPolicy="no-referrer"
              className="w-full max-h-[220px] object-contain"
            />
          </div>

          <div className="p-3.5 space-y-2.5 border-t border-[#ECECE8]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#141413] truncate">
                  {photo.originalName}
                </p>
                <p className="text-xs text-[#6B6B65] font-mono tabular-nums mt-0.5">
                  {photo.width} × {photo.height} px
                  <span aria-hidden="true"> · </span>
                  {formatFileSize(photo.originalSizeBytes)}
                  {photo.wasConvertedToJpeg && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span>Convertida a JPEG</span>
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="min-h-[40px] px-3 py-1.5 rounded-lg border border-[#E4E4E0] bg-[#FAFAF8] hover:bg-[#F2F2EE] text-xs font-medium text-[#141413] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Cambiar
              </button>
            </div>

            <div className="pt-2 border-t border-[#F0F0EC] text-xs text-[#5C5C57] space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-[#141413] inline-flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-[#6B6B65]" aria-hidden="true" />
                  Metadatos originales detectados
                </span>
                {originalExif &&
                  (originalExif.date || originalExif.time || originalExif.coordinates) &&
                  onApplyOriginalExif && (
                    <button
                      type="button"
                      onClick={onApplyOriginalExif}
                      className="text-xs font-medium text-[#2563EB] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Copiar originales
                    </button>
                  )}
              </div>

              {originalExif && originalExif.hasOriginalExif ? (
                <div className="font-mono tabular-nums text-[12px] text-[#5C5C57] flex flex-wrap gap-x-2 gap-y-0.5">
                  <span>Fecha: {originalExif.date ?? 'Sin dato'}</span>
                  <span aria-hidden="true">·</span>
                  <span>Hora: {originalExif.time ?? 'Sin dato'}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    GPS:{' '}
                    {originalExif.coordinates
                      ? `${originalExif.coordinates.lat.toFixed(5)}, ${originalExif.coordinates.lng.toFixed(5)}`
                      : 'Sin coordenadas'}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-[#6B6B65]">
                  Sin datos EXIF previos de fecha o ubicación. Se escribirán los nuevos.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {(error || validationError) && (
        <p role="alert" className="text-xs font-medium text-[#DC2626]">
          {error || validationError}
        </p>
      )}
    </div>
  );
};
