import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOutputFilename,
  decimalToDmsRational,
  dmsRationalToDecimal,
  formatExifDateTime,
  parseExifDateTime,
  readExifFromJpegDataUrl,
  replaceExifInJpegDataUrl,
} from './exifUtils';

// Minimal valid 1x1 JPEG image encoded in base64 (no EXIF header)
const MINIMAL_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const MINIMAL_JPEG_DATA_URL = `data:image/jpeg;base64,${MINIMAL_JPEG_BASE64}`;

test('formatExifDateTime and parseExifDateTime round-trip cleanly', () => {
  const formatted = formatExifDateTime('2026-11-18', '14:35');
  assert.equal(formatted, '2026:11:18 14:35:00');

  const parsed = parseExifDateTime(formatted);
  assert.deepEqual(parsed, { date: '2026-11-18', time: '14:35:00' });
});

test('formatExifDateTime rejects invalid date or time', () => {
  assert.throws(() => formatExifDateTime('2026-02-30', '12:00'));
  assert.throws(() => formatExifDateTime('2026-11-18', '25:00'));
});

test('decimalToDmsRational and dmsRationalToDecimal round-trip N/S/E/W coordinates', () => {
  // Madrid: 40.416775, -3.703790
  const latDms = decimalToDmsRational(40.416775);
  const lngDms = decimalToDmsRational(-3.70379);

  const decodedLat = dmsRationalToDecimal(latDms, 'N');
  const decodedLng = dmsRationalToDecimal(lngDms, 'W');

  assert.ok(decodedLat !== null && Math.abs(decodedLat - 40.416775) < 0.0001);
  assert.ok(decodedLng !== null && Math.abs(decodedLng - -3.70379) < 0.0001);

  // Southern hemisphere: Buenos Aires -34.603722, -58.381592
  const southLat = dmsRationalToDecimal(decimalToDmsRational(-34.603722), 'S');
  assert.ok(southLat !== null && Math.abs(southLat - -34.603722) < 0.0001);
});

test('buildOutputFilename combines date, time, and coordinates safely', () => {
  const filename = buildOutputFilename('2026-11-18', '09:05', {
    lat: 40.416775,
    lng: -3.70379,
  });
  assert.equal(filename, '2026-11-18_09-05_40.416775_-3.703790.jpg');
  assert.equal(filename.includes(':'), false);
});

test('replaceExifInJpegDataUrl replaces original EXIF date, time, and GPS and reads back accurately', () => {
  // First write an "original" location & date (Paris, 2020-01-01 08:00)
  const originalTagged = replaceExifInJpegDataUrl(MINIMAL_JPEG_DATA_URL, {
    date: '2020-01-01',
    time: '08:00',
    coordinates: { lat: 48.856613, lng: 2.352222 },
  });

  const before = readExifFromJpegDataUrl(originalTagged);
  assert.equal(before.date, '2020-01-01');
  assert.equal(before.time, '08:00:00');
  assert.ok(before.coordinates && Math.abs(before.coordinates.lat - 48.856613) < 0.0001);

  // Now replace with new date, time, and coordinates (Tokyo, 2026-11-18 19:42)
  const replaced = replaceExifInJpegDataUrl(originalTagged, {
    date: '2026-11-18',
    time: '19:42',
    coordinates: { lat: 35.676192, lng: 139.650311 },
  });

  const after = readExifFromJpegDataUrl(replaced);
  assert.equal(after.date, '2026-11-18');
  assert.equal(after.time, '19:42:00');
  assert.equal(after.hasOriginalExif, true);
  assert.ok(after.coordinates && Math.abs(after.coordinates.lat - 35.676192) < 0.0001);
  assert.ok(after.coordinates && Math.abs(after.coordinates.lng - 139.650311) < 0.0001);
});
