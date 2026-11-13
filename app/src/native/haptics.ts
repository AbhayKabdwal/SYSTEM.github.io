import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './platform';

export function hapticSuccess() {
  if (isNative) void Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
}

export function hapticTap() {
  if (isNative) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
}
