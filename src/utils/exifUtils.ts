import piexif from 'piexifjs';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ParsedExifMetadata {
  date: string | null;
  time: string | null;
  coordinates: Coordinates | null;
  cameraMake: string | null;
  cameraModel: string | null;
  hasOriginalExif: boolean;
}

export type Rational = [number, number];
export type DmsRational = [Rational, Rational, Rational];

const JPEG_PREFIX = 'data:image/jpeg;base64,';
const JPG_ALT_PREFIX = 'data:image/jpg;base64,';

export function isJpegDataUrl(dataUrl: string): boolean {
  const lower = dataUrl.slice(0, 32).toLowerCase();
  return lower.startsWith(JPEG_PREFIX) || lower.startsWith(JPG_ALT_PREFIX);
}

export function normalizeJpegDataUrl(dataUrl: string): string {
  if (dataUrl.slice(0, 32).toLowerCase().startsWith(JPG_ALT_PREFIX)) {
    return JPEG_PREFIX + dataUrl.slice(JPG_ALT_PREFIX.length);
  }
  return dataUrl;
}

export function isValidDateInput(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function isValidTimeInput(timeStr: string): boolean {
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) return false;
  const parts = timeStr.split(':').map(Number);
  const [hh, mm, ss = 0] = parts;
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59 && ss >= 0 && ss <= 59;
}

export function isValidCoordinates(coords: Coordinates | null): coords is Coordinates {
  if (!coords) return false;
  return (
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng) &&
    coords.lat >= -90 &&
    coords.lat <= 90 &&
    coords.lng >= -180 &&
    coords.lng <= 180
  );
}

export function formatExifDateTime(dateStr: string, timeStr: string): string {
  if (!isValidDateInput(dateStr)) {
    throw new Error('Fecha no válida. Usa el formato AAAA-MM-DD.');
  }
  if (!isValidTimeInput(timeStr)) {
    throw new Error('Hora no válida. Usa el formato HH:MM.');
  }
  const exifDate = dateStr.replace(/-/g, ':');
  const timeParts = timeStr.split(':');
  const hh = timeParts[0].padStart(2, '0');
  const mm = timeParts[1].padStart(2, '0');
  const ss = (timeParts[2] ?? '00').padStart(2, '0');
  return `${exifDate} ${hh}:${mm}:${ss}`;
}

export function parseExifDateTime(
  rawValue: unknown
): { date: string; time: string } | null {
  if (typeof rawValue !== 'string') return null;
  const trimmed = rawValue.replace(/\0/g, '').trim();
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const [, y, m, d, hh, mm, ss] = match;
  const date = `${y}-${m}-${d}`;
  const time = `${hh}:${mm}:${ss}`;
  if (!isValidDateInput(date) || !isValidTimeInput(time)) return null;
  return { date, time };
}

export function decimalToDmsRational(decimal: number): DmsRational {
  const abs = Math.abs(decimal);
  let deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  let min = Math.floor(minFloat);
  let secScaled = Math.round((minFloat - min) * 60 * 10000);

  if (secScaled >= 600000) {
    secScaled -= 600000;
    min += 1;
  }
  if (min >= 60) {
    min -= 60;
    deg += 1;
  }

  return [
    [deg, 1],
    [min, 1],
    [secScaled, 10000],
  ];
}

export function dmsRationalToDecimal(
  dms: unknown,
  ref: unknown
): number | null {
  if (!Array.isArray(dms) || dms.length !== 3) return null;
  const values = dms.map((entry) => {
    if (!Array.isArray(entry) || entry.length !== 2) return NaN;
    const [num, den] = entry;
    if (typeof num !== 'number' || typeof den !== 'number' || den === 0) {
      return NaN;
    }
    return num / den;
  });
  if (values.some((v) => !Number.isFinite(v))) return null;
  const [deg, min, sec] = values;
  let result = deg + min / 60 + sec / 3600;
  const refStr = typeof ref === 'string' ? ref.replace(/\0/g, '').trim().toUpperCase() : '';
  if (refStr === 'S' || refStr === 'W') {
    result = -Math.abs(result);
  }
  return Number(result.toFixed(6));
}

export function buildOutputFilename(
  dateStr: string,
  timeStr: string,
  coords: Coordinates
): string {
  const safeDate = isValidDateInput(dateStr) ? dateStr : 'sin-fecha';
  const timeParts = timeStr.split(':');
  const safeTime =
    timeParts.length >= 3 && timeParts[2] !== '00'
      ? `${timeParts[0].padStart(2, '0')}-${timeParts[1].padStart(2, '0')}-${timeParts[2].padStart(2, '0')}`
      : isValidTimeInput(timeStr)
        ? `${timeParts[0].padStart(2, '0')}-${timeParts[1].padStart(2, '0')}`
        : 'sin-hora';
  const latStr = coords.lat.toFixed(6);
  const lngStr = coords.lng.toFixed(6);
  return `${safeDate}_${safeTime}_${latStr}_${lngStr}.jpg`;
}

export function readExifFromJpegDataUrl(dataUrl: string): ParsedExifMetadata {
  if (!isJpegDataUrl(dataUrl)) {
    return {
      date: null,
      time: null,
      coordinates: null,
      cameraMake: null,
      cameraModel: null,
      hasOriginalExif: false,
    };
  }

  try {
    const normalized = normalizeJpegDataUrl(dataUrl);
    const exif = piexif.load(normalized);

    const rawDateTime =
      exif.Exif?.[piexif.ExifIFD.DateTimeOriginal] ??
      exif.Exif?.[piexif.ExifIFD.DateTimeDigitized] ??
      exif['0th']?.[piexif.ImageIFD.DateTime];
    const parsedDt = parseExifDateTime(rawDateTime);

    const lat = dmsRationalToDecimal(
      exif.GPS?.[piexif.GPSIFD.GPSLatitude],
      exif.GPS?.[piexif.GPSIFD.GPSLatitudeRef]
    );
    const lng = dmsRationalToDecimal(
      exif.GPS?.[piexif.GPSIFD.GPSLongitude],
      exif.GPS?.[piexif.GPSIFD.GPSLongitudeRef]
    );

    const coordinates =
      lat !== null && lng !== null && isValidCoordinates({ lat, lng })
        ? { lat, lng }
        : null;

    const rawMake = exif['0th']?.[piexif.ImageIFD.Make];
    const rawModel = exif['0th']?.[piexif.ImageIFD.Model];
    const cameraMake =
      typeof rawMake === 'string' && rawMake.replace(/\0/g, '').trim()
        ? rawMake.replace(/\0/g, '').trim()
        : null;
    const cameraModel =
      typeof rawModel === 'string' && rawModel.replace(/\0/g, '').trim()
        ? rawModel.replace(/\0/g, '').trim()
        : null;

    const hasOriginalExif = Boolean(
      parsedDt || coordinates || cameraMake || cameraModel
    );

    return {
      date: parsedDt?.date ?? null,
      time: parsedDt?.time ?? null,
      coordinates,
      cameraMake,
      cameraModel,
      hasOriginalExif,
    };
  } catch {
    return {
      date: null,
      time: null,
      coordinates: null,
      cameraMake: null,
      cameraModel: null,
      hasOriginalExif: false,
    };
  }
}

function createCleanExifObject(): piexif.ExifData {
  return {
    '0th': {},
    Exif: {},
    GPS: {},
    Interop: {},
    '1st': {},
    thumbnail: null,
  };
}

export function replaceExifInJpegDataUrl(
  jpegDataUrl: string,
  params: {
    date: string;
    time: string;
    coordinates: Coordinates;
  }
): string {
  if (!isJpegDataUrl(jpegDataUrl)) {
    throw new Error('La imagen debe estar en formato JPEG antes de escribir EXIF.');
  }
  if (!isValidCoordinates(params.coordinates)) {
    throw new Error('Las coordenadas seleccionadas no son válidas.');
  }

  const normalized = normalizeJpegDataUrl(jpegDataUrl);
  const exifDateTime = formatExifDateTime(params.date, params.time);
  const [dateStamp, timeStamp] = exifDateTime.split(' ');
  const [hh, mm, ss] = timeStamp.split(':').map(Number);

  let exifObj = createCleanExifObject();
  try {
    const loaded = piexif.load(normalized);
    exifObj = {
      '0th': { ...(loaded['0th'] ?? {}) },
      Exif: { ...(loaded.Exif ?? {}) },
      GPS: {}, // Replace all original GPS tags completely
      Interop: { ...(loaded.Interop ?? {}) },
      '1st': { ...(loaded['1st'] ?? {}) },
      thumbnail: loaded.thumbnail ?? null,
    };
  } catch {
    exifObj = createCleanExifObject();
  }

  const applyNewTags = (target: piexif.ExifData) => {
    target['0th'][piexif.ImageIFD.DateTime] = exifDateTime;
    target.Exif[piexif.ExifIFD.DateTimeOriginal] = exifDateTime;
    target.Exif[piexif.ExifIFD.DateTimeDigitized] = exifDateTime;

    // Clear sub-second tags from original photo so time is consistent
    delete target.Exif[piexif.ExifIFD.SubSecTime];
    delete target.Exif[piexif.ExifIFD.SubSecTimeOriginal];
    delete target.Exif[piexif.ExifIFD.SubSecTimeDigitized];

    target.GPS = {
      [piexif.GPSIFD.GPSVersionID]: [2, 2, 0, 0],
      [piexif.GPSIFD.GPSLatitudeRef]: params.coordinates.lat >= 0 ? 'N' : 'S',
      [piexif.GPSIFD.GPSLatitude]: decimalToDmsRational(params.coordinates.lat),
      [piexif.GPSIFD.GPSLongitudeRef]: params.coordinates.lng >= 0 ? 'E' : 'W',
      [piexif.GPSIFD.GPSLongitude]: decimalToDmsRational(params.coordinates.lng),
      [piexif.GPSIFD.GPSDateStamp]: dateStamp,
      [piexif.GPSIFD.GPSTimeStamp]: [
        [hh, 1],
        [mm, 1],
        [ss, 1],
      ],
    };
  };

  applyNewTags(exifObj);

  let exifBytes: string;
  try {
    exifBytes = piexif.dump(exifObj);
  } catch {
    // Fallback if original camera maker-notes/tags aren't serializable by piexifjs
    const safeObj = createCleanExifObject();
    const preserve0thTags = [
      piexif.ImageIFD.Make,
      piexif.ImageIFD.Model,
      piexif.ImageIFD.Orientation,
      piexif.ImageIFD.Software,
    ];
    for (const tag of preserve0thTags) {
      if (exifObj['0th'][tag] !== undefined) {
        safeObj['0th'][tag] = exifObj['0th'][tag];
      }
    }
    applyNewTags(safeObj);
    exifBytes = piexif.dump(safeObj);
  }

  const stripped = piexif.remove(normalized);
  return piexif.insert(exifBytes, stripped);
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = /data:([^;]+);/.exec(header);
  const mime = mimeMatch?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
