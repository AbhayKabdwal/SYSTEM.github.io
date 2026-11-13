import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNative } from './platform';

/**
 * Native camera or gallery picker. Returns undefined if the user backs out.
 * On the website this isn't used: the hidden <input type="file"> does the job.
 */
export async function pickNativePhoto(source: 'camera' | 'prompt' = 'prompt'): Promise<File | undefined> {
  if (!isNative) return undefined;
  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      width: 1600,
      resultType: CameraResultType.Uri,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Prompt,
      correctOrientation: true,
    });
    if (!photo.webPath) return undefined;
    const blob = await (await fetch(photo.webPath)).blob();
    return new File([blob], `photo.${photo.format || 'jpg'}`, { type: blob.type || 'image/jpeg' });
  } catch (e) {
    // Cancelling the camera or picker rejects; that's not an error worth showing.
    if (/cancel/i.test(String((e as Error)?.message ?? e))) return undefined;
    throw e;
  }
}

/** Opens the native picker in the app, or clicks the file input on the web. */
export async function choosePhoto(input: HTMLInputElement | null, onFile: (f: File | undefined) => void, source: 'camera' | 'prompt' = 'prompt') {
  if (!isNative) {
    input?.click();
    return;
  }
  onFile(await pickNativePhoto(source));
}
