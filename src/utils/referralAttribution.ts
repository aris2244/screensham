import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPendingReferrerCode, setPendingReferrerCode } from '../storage/pendingReferral';
import { getPlayInstallReferrerCode, sanitizeReferrerCode } from './installReferrer';

const INSTALL_REFERRER_CHECKED_KEY = 'install_referrer_checked';

/** Parse ?ref=CODE from URL or screensham://open?ref=CODE */
export function parseReferrerFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const ref = parsed.searchParams.get('ref');
    return sanitizeReferrerCode(ref);
  } catch {
    const match = url.match(/[?&]ref=([A-Za-z0-9]{1,32})/i);
    return sanitizeReferrerCode(match?.[1]);
  }
}

/** Capture referral from cold start or deep link. */
export async function captureInitialReferralLink(): Promise<void> {
  const initial = await Linking.getInitialURL();
  if (initial) {
    const ref = parseReferrerFromUrl(initial);
    if (ref) await setPendingReferrerCode(ref);
  }
}

export function listenForReferralLinks(): () => void {
  const sub = Linking.addEventListener('url', ({ url }) => {
    const ref = parseReferrerFromUrl(url);
    if (ref) setPendingReferrerCode(ref);
  });
  return () => sub.remove();
}

/**
 * Capture referral code from Google Play's install referrer — the free,
 * official way to attribute a Play Store install to a friend's link
 * (no domain, landing page, or paid attribution SDK needed).
 *
 * Runs at most once per install (flagged in AsyncStorage) since the Play
 * Store only keeps this data around briefly after install. Skips if a
 * pending referral was already captured via deep link.
 */
export async function captureInstallReferrer(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const alreadyChecked = await AsyncStorage.getItem(INSTALL_REFERRER_CHECKED_KEY);
  if (alreadyChecked) return;
  await AsyncStorage.setItem(INSTALL_REFERRER_CHECKED_KEY, '1');

  const existingPending = await getPendingReferrerCode();
  if (existingPending) return;

  const ref = await getPlayInstallReferrerCode();
  if (ref) await setPendingReferrerCode(ref);
}
