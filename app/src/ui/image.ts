const MAX_EDGE = 1080;
const QUALITY = 0.72;

/** Downscale and re-encode a photo. Re-encoding also strips EXIF data such as GPS location. */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(MAX_EDGE / bitmap.width, MAX_EDGE / bitmap.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', QUALITY),
  );
}
