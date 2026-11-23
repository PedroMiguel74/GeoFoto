declare module 'piexifjs' {
  export type Rational = [number, number];

  export interface ExifData {
    '0th': Record<number, unknown>;
    Exif: Record<number, unknown>;
    GPS: Record<number, unknown>;
    Interop: Record<number, unknown>;
    '1st': Record<number, unknown>;
    thumbnail: string | null;
  }

  export const ImageIFD: Record<string, number>;
  export const ExifIFD: Record<string, number>;
  export const GPSIFD: Record<string, number>;

  export function load(jpegDataUrlOrBinary: string): ExifData;
  export function dump(exifObj: ExifData): string;
  export function insert(exifBytes: string, jpegDataUrlOrBinary: string): string;
  export function remove(jpegDataUrlOrBinary: string): string;

  export const GPSHelper: {
    degToDmsRational(degFloat: number): [Rational, Rational, Rational];
    dmsRationalToDeg(dmsArray: [Rational, Rational, Rational], ref: string): number;
  };
}
