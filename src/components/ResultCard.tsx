import React from 'react';
import { CheckCircle2, Download, Share2 } from 'lucide-react';
import type { ParsedExifMetadata } from '../utils/exifUtils';
import { formatFileSize } from '../utils/exifUtils';

export interface ProcessedPhotoResult {
  filename: string;
  blob: Blob;
  previewUrl: string;
  verifiedExif: ParsedExifMetadata;
}

interface ResultCardProps {
  result: ProcessedPhotoResult;
  onDownloadAgain: () => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({ result, onDownloadAgain }) => {
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof File !== 'undefined';

  const handleShare = async () => {
    try {
      const file = new File([result.blob], result.filename, { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: result.filename,
        });
      }
    } catch {
      // User dismissed share sheet
    }
  };

  return (
    <section
      id="resultado-guardado"
      aria-live="polite"
      className="rounded-2xl border border-[#D1FAE5] bg-white p-5 sm:p-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#ECECE8]">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="w-6 h-6 text-[#059669] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-base font-semibold text-[#141413] tracking-tight">
              Fotografía procesada y guardada automáticamente
            </h2>
            <p className="text-xs text-[#5C5C57] mt-0.5">
              Los metadatos originales fueron reemplazados y la descarga comenzó con el nuevo nombre.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onDownloadAgain}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-[#141413] hover:bg-[#2A2A28] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Descargar de nuevo
          </button>

          {canShareFiles && (
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border border-[#DCDCD6] bg-white hover:bg-[#F5F5F2] text-[#141413] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Share2 className="w-4 h-4" aria-hidden="true" />
              Compartir
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
        <div>
          <p className="text-xs text-[#6B6B65]">Nombre del archivo guardado</p>
          <p className="text-xs sm:text-sm font-mono font-medium text-[#141413] break-all mt-1">
            {result.filename}
          </p>
        </div>

        <div>
          <p className="text-xs text-[#6B6B65]">Fecha grabada en EXIF</p>
          <p className="text-sm font-mono tabular-nums font-medium text-[#141413] mt-1">
            {result.verifiedExif.date ?? '—'}
          </p>
        </div>

        <div>
          <p className="text-xs text-[#6B6B65]">Hora grabada en EXIF</p>
          <p className="text-sm font-mono tabular-nums font-medium text-[#141413] mt-1">
            {result.verifiedExif.time ?? '—'}
          </p>
        </div>

        <div>
          <p className="text-xs text-[#6B6B65]">Coordenadas GPS grabadas ({formatFileSize(result.blob.size)})</p>
          <p className="text-sm font-mono tabular-nums font-medium text-[#141413] mt-1">
            {result.verifiedExif.coordinates
              ? `${result.verifiedExif.coordinates.lat.toFixed(6)}, ${result.verifiedExif.coordinates.lng.toFixed(6)}`
              : '—'}
          </p>
        </div>
      </div>
    </section>
  );
};
