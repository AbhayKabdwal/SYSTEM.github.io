import { useSession } from '../state/session';
import { cloudEnabled } from './client';
import { DEMO_ME, demoNet } from './demoNetwork';

/** Your user id, or the sample "You" while the sample network is on. */
export function useMeId(): string | undefined {
  const id = useSession((s) => s.user?.id);
  return demoNet() ? DEMO_ME : id;
}

/** Whether Hunters features can run: signed in, or the sample network is on. */
export function useNetworkOnline(): boolean {
  const user = useSession((s) => s.user);
  return demoNet() || (cloudEnabled && !!user);
}
