import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Save } from 'lucide-react';
import { CoordinateMapPicker } from './components/CoordinateMapPicker';
import { PhotoUploadField } from './components/PhotoUploadField';
import { type ProcessedPhotoResult, ResultCard } from './components/ResultCard';
import {
  type Coordinates,
  type ParsedExifMetadata,
  buildOutputFilename,
  dataUrlToBlob,
  isValidCoordinates,
  isValidDateInput,
  isValidTimeInput,
  readExifFromJpegDataUrl,
  replaceExifInJpegDataUrl,
} from './utils/exifUtils';
import {
  type LoadedPhoto,
  loadPhotoAsJpeg,
  triggerAutomaticDownload,
} from './utils/imageLoader';

interface ValidationErrors {
  date?: string;
  time?: string;
  photo?: string;
  coordinates?: string;
}

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCurrentTimeString(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // 4 core user inputs
  const [dateValue, setDateValue] = useState('');
  const [timeValue, setTimeValue] = useState('');
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null);
  const [originalExif, setOriginalExif] = useState<ParsedExifMetadata | null>(null);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);

  // UI & processing states
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [photoLoadError, setPhotoLoadError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [processError, setProcessError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessedPhotoResult | null>(null);

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  useEffect(() => {
    return () => {
      if (result?.previewUrl) {
        URL.revokeObjectURL(result.previewUrl);
      }
    };
  }, [result]);

  const previewFilename = useMemo(() => {
    if (
      isValidDateInput(dateValue) &&
      isValidTimeInput(timeValue) &&
      isValidCoordinates(coordinates)
    ) {
      return buildOutputFilename(dateValue, timeValue, coordinates);
    }
    return null;
  }, [dateValue, timeValue, coordinates]);

  const handleSelectFile = useCallback(async (file: File) => {
    setIsLoadingPhoto(true);
    setPhotoLoadError(null);
    setProcessError(null);
    setValidationErrors((prev) => ({ ...prev, photo: undefined }));

    try {
      const loaded = await loadPhotoAsJpeg(file);
      const parsed = readExifFromJpegDataUrl(loaded.jpegDataUrl);
      setPhoto(loaded);
      setOriginalExif(parsed);
      setResult(null);
    } catch (err) {
      setPhotoLoadError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar la fotografía seleccionada.'
      );
      setPhoto(null);
      setOriginalExif(null);
    } finally {
      setIsLoadingPhoto(false);
    }
  }, []);

  const handleClearPhoto = useCallback(() => {
    setPhoto(null);
    setOriginalExif(null);
    setPhotoLoadError(null);
    setResult(null);
  }, []);

  const handleApplyOriginalExif = useCallback(() => {
    if (!originalExif) return;
    if (originalExif.date) {
      setDateValue(originalExif.date);
      setValidationErrors((prev) => ({ ...prev, date: undefined }));
    }
    if (originalExif.time) {
      setTimeValue(originalExif.time.slice(0, 5));
      setValidationErrors((prev) => ({ ...prev, time: undefined }));
    }
    if (originalExif.coordinates) {
      setCoordinates(originalExif.coordinates);
      setValidationErrors((prev) => ({ ...prev, coordinates: undefined }));
    }
  }, [originalExif]);

  const handleResetAll = useCallback(() => {
    setDateValue('');
    setTimeValue('');
    setPhoto(null);
    setOriginalExif(null);
    setCoordinates(null);
    setPhotoLoadError(null);
    setValidationErrors({});
    setProcessError(null);
    setResult(null);
  }, []);

  const handleCoordinatesChange = useCallback((coords: Coordinates) => {
    setCoordinates(coords);
    setValidationErrors((prev) => ({ ...prev, coordinates: undefined }));
  }, []);

  const handleSavePhoto = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      setProcessError(null);

      const nextErrors: ValidationErrors = {};
      if (!isValidDateInput(dateValue)) {
        nextErrors.date = 'Introduce una fecha válida en el campo 1.';
      }
      if (!isValidTimeInput(timeValue)) {
        nextErrors.time = 'Introduce una hora válida en el campo 2.';
      }
      if (!photo) {
        nextErrors.photo = 'Carga una fotografía en el campo 3.';
      }
      if (!isValidCoordinates(coordinates)) {
        nextErrors.coordinates =
          'Selecciona unas coordenadas en el mapa (campo 4).';
      }

      if (Object.keys(nextErrors).length > 0) {
        setValidationErrors(nextErrors);
        return;
      }

      if (!photo || !coordinates) return;

      setIsProcessing(true);
      try {
        const updatedDataUrl = replaceExifInJpegDataUrl(photo.jpegDataUrl, {
          date: dateValue,
          time: timeValue,
          coordinates,
        });
        const verifiedExif = readExifFromJpegDataUrl(updatedDataUrl);
        const filename = buildOutputFilename(dateValue, timeValue, coordinates);
        const blob = dataUrlToBlob(updatedDataUrl);
        const objectUrl = triggerAutomaticDownload(blob, filename);

        setResult({
          filename,
          blob,
          previewUrl: objectUrl,
          verifiedExif,
        });

        window.setTimeout(() => {
          document
            .getElementById('resultado-guardado')
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 80);
      } catch (err) {
        setProcessError(
          err instanceof Error
            ? err.message
            : 'Ocurrió un error al escribir los metadatos EXIF en la fotografía.'
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [dateValue, timeValue, photo, coordinates]
  );

  const handleDownloadAgain = useCallback(() => {
    if (!result) return;
    triggerAutomaticDownload(result.blob, result.filename);
  }, [result]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F5] text-[#141413] pb-24 md:pb-12">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <header className="bg-white border-b border-[#E4E4E0] md:sticky md:top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-base sm:text-lg font-bold tracking-tight text-[#141413] whitespace-nowrap shrink-0"
          >
            GeoFoto EXIF
          </a>

          <nav
            aria-label="Campos del formulario"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-[#5C5C57]"
          >
            <a
              href="#campo-fecha"
              className="hover:text-[#141413] transition-colors whitespace-nowrap shrink-0"
            >
              1. Fecha
            </a>
            <a
              href="#campo-hora"
              className="hover:text-[#141413] transition-colors whitespace-nowrap shrink-0"
            >
              2. Hora
            </a>
            <a
              href="#campo-fotografia"
              className="hover:text-[#141413] transition-colors whitespace-nowrap shrink-0"
            >
              3. Fotografía
            </a>
            <a
              href="#campo-mapa"
              className="hover:text-[#141413] transition-colors whitespace-nowrap shrink-0"
            >
              4. Mapa
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleResetAll}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#141413] bg-[#F2F2EE] hover:bg-[#E7E7E1] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Limpiar todo
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        <section className="max-w-3xl space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141413] [text-wrap:balance]">
            Cambia la fecha, hora y lugar de tu fotografía
          </h1>
          <p className="text-sm sm:text-base text-[#5C5C57]">
            Completa los 4 campos para reemplazar los metadatos EXIF originales y guardar automáticamente la nueva foto en tu PC o Android.
          </p>
        </section>

        <form onSubmit={handleSavePhoto} noValidate className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left column: Fields 1, 2, 3 + Filename preview + Save action */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E4E4E0] p-5 sm:p-6 flex flex-col justify-between gap-6">
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Campo 1: Fecha */}
                  <div id="campo-fecha" className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="date-input"
                        className="text-sm font-semibold text-[#141413] tracking-tight"
                      >
                        1. Introduce la fecha
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setDateValue(getTodayDateString());
                          setValidationErrors((prev) => ({ ...prev, date: undefined }));
                        }}
                        className="text-xs font-medium text-[#2563EB] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Hoy
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <Calendar
                        className="w-4 h-4 text-[#6B6B65] absolute left-3 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="date-input"
                        type="date"
                        required
                        value={dateValue}
                        onChange={(e) => {
                          setDateValue(e.target.value);
                          setValidationErrors((prev) => ({ ...prev, date: undefined }));
                        }}
                        className={`w-full min-h-[44px] pl-9 pr-3 py-2 rounded-lg border bg-white font-mono text-sm tabular-nums text-[#141413] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 ${
                          validationErrors.date ? 'border-[#DC2626]' : 'border-[#DCDCD6]'
                        }`}
                      />
                    </div>
                    {validationErrors.date && (
                      <p role="alert" className="text-xs font-medium text-[#DC2626]">
                        {validationErrors.date}
                      </p>
                    )}
                  </div>

                  {/* Campo 2: Hora */}
                  <div id="campo-hora" className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="time-input"
                        className="text-sm font-semibold text-[#141413] tracking-tight"
                      >
                        2. Introduce la hora
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setTimeValue(getCurrentTimeString());
                          setValidationErrors((prev) => ({ ...prev, time: undefined }));
                        }}
                        className="text-xs font-medium text-[#2563EB] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Ahora
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <Clock
                        className="w-4 h-4 text-[#6B6B65] absolute left-3 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="time-input"
                        type="time"
                        required
                        value={timeValue}
                        onChange={(e) => {
                          setTimeValue(e.target.value);
                          setValidationErrors((prev) => ({ ...prev, time: undefined }));
                        }}
                        className={`w-full min-h-[44px] pl-9 pr-3 py-2 rounded-lg border bg-white font-mono text-sm tabular-nums text-[#141413] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 ${
                          validationErrors.time ? 'border-[#DC2626]' : 'border-[#DCDCD6]'
                        }`}
                      />
                    </div>
                    {validationErrors.time && (
                      <p role="alert" className="text-xs font-medium text-[#DC2626]">
                        {validationErrors.time}
                      </p>
                    )}
                  </div>
                </div>

                {/* Campo 3: Carga la fotografía */}
                <PhotoUploadField
                  photo={photo}
                  originalExif={originalExif}
                  isLoadingPhoto={isLoadingPhoto}
                  error={photoLoadError}
                  validationError={validationErrors.photo ?? null}
                  onSelectFile={handleSelectFile}
                  onClearPhoto={handleClearPhoto}
                  onApplyOriginalExif={handleApplyOriginalExif}
                />
              </div>

              {/* Output filename preview & Desktop Save CTA */}
              <div className="pt-4 border-t border-[#ECECE8] space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[#5C5C57]">
                    Nombre automático de la nueva foto
                  </p>
                  <p
                    data-testid="filename-preview"
                    className="text-xs font-mono tabular-nums text-[#141413] bg-[#FAFAF8] border border-[#E4E4E0] rounded-lg px-3 py-2 break-all"
                  >
                    {previewFilename ??
                      'Completa fecha, hora y coordenadas para generar el nombre...'}
                  </p>
                </div>

                {processError && (
                  <p role="alert" className="text-xs font-medium text-[#DC2626]">
                    {processError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isProcessing || isLoadingPhoto}
                  className="hidden md:inline-flex w-full items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.99] text-white text-sm font-semibold transition-all cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  {isProcessing
                    ? 'Guardando fotografía...'
                    : 'Guardar fotografía con nuevos datos'}
                </button>
              </div>
            </div>

            {/* Right column: Campo 4 Interactive Map */}
            <section
              id="campo-mapa"
              className="lg:col-span-7 bg-white rounded-2xl border border-[#E4E4E0] p-5 sm:p-6 flex flex-col"
            >
              <CoordinateMapPicker
                coordinates={coordinates}
                onChange={handleCoordinatesChange}
                validationError={validationErrors.coordinates ?? null}
              />
            </section>
          </div>

          {/* Mobile sticky bottom CTA (respecting <= 15% mobile viewport height) */}
          <div className="fixed bottom-0 left-0 right-0 z-30 p-3 bg-white/95 backdrop-blur-md border-t border-[#E4E4E0] md:hidden">
            <button
              type="submit"
              disabled={isProcessing || isLoadingPhoto}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              {isProcessing
                ? 'Guardando fotografía...'
                : 'Guardar fotografía con nuevos datos'}
            </button>
          </div>
        </form>

        {result && (
          <ResultCard result={result} onDownloadAgain={handleDownloadAgain} />
        )}

        <footer className="pt-4 pb-2 border-t border-[#E4E4E0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[#6B6B65]">
          <p>
            Todo el procesamiento EXIF ocurre localmente en tu navegador (PC o Android) sin subir tus fotos a servidores externos.
          </p>
          <p className="font-mono tabular-nums">
            Formato de salida: FECHA_HORA_LATITUD_LONGITUD.jpg
          </p>
        </footer>
      </main>
    </div>
  );
}
