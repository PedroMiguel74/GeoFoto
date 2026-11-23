import { isJpegDataUrl, normalizeJpegDataUrl } from './exifUtils';

export interface LoadedPhoto {
  originalName: string;
  originalMimeType: string;
  originalSizeBytes: number;
  width: number;
  height: number;
  jpegDataUrl: string;
  wasConvertedToJpeg: boolean;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No se pudo leer el archivo de imagen.'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer la fotografía seleccionada.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('Formato de imagen no compatible con el navegador. Usa JPG, PNG o WebP.'));
    img.src = src;
  });
}

export async function loadPhotoAsJpeg(file: File): Promise<LoadedPhoto> {
  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(rawDataUrl);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  if (isJpegDataUrl(rawDataUrl)) {
    return {
      originalName: file.name,
      originalMimeType: file.type || 'image/jpeg',
      originalSizeBytes: file.size,
      width,
      height,
      jpegDataUrl: normalizeJpegDataUrl(rawDataUrl),
      wasConvertedToJpeg: false,
    };
  }

  // Convert PNG / WebP / BMP / etc. to high-quality JPEG so EXIF headers can be embedded
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo preparar el lienzo para convertir la imagen a JPEG.');
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const convertedDataUrl = canvas.toDataURL('image/jpeg', 0.96);

  return {
    originalName: file.name,
    originalMimeType: file.type || 'image/png',
    originalSizeBytes: file.size,
    width,
    height,
    jpegDataUrl: convertedDataUrl,
    wasConvertedToJpeg: true,
  };
}

export function triggerAutomaticDownload(blob: Blob, filename: string): string {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  return url;
}
