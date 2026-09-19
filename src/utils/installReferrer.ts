/**
 * TypeScript bridge for the native InstallReferrer module.
 * Reads Google Play's "install referrer" string — set only when the app
 * was installed via a Play Store link containing &referrer=... .
 * Free, Google-official, no account or SDK cost.
 *
 * Only works after `npx expo run:android` (native rebuild) and only for
 * real Play Store installs (not `adb install`, not dev client sideload).
 *
 * Setup + testing: docs/PLAY_INSTALL_REFERRER_SETUP.md
 */
import { NativeModules, Platform } from 'react-native';

const { InstallReferrer } = NativeModules;

/** Raw referrer string, e.g. "ref=ABC123&utm_source=friend_invite". */
export async function getRawPlayInstallReferrer(): Promise<string | null> {
  if (Platform.OS !== 'android' || !InstallReferrer) return null;
  try {
    const value = await InstallReferrer.getReferrer();
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * Strips everything that isn't A–Z or 0–9 and enforces exactly 6 chars.
 * Exported so both installReferrer and referralAttribution use the same rule.
 */
export function sanitizeReferrerCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return clean.length === 6 ? clean : null;
}

/** Parses `ref=CODE` out of the raw referrer string (URL-decoded query string). */
export function parseReferrerCode(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const params = new URLSearchParams(raw);
    const ref = params.get('ref');
    return sanitizeReferrerCode(ref);
  } catch {
    const match = raw.match(/[?&]?ref=([A-Za-z0-9]{1,32})/i);
    return sanitizeReferrerCode(match?.[1]);
  }
}

/** Convenience: read + parse in one call. */
export async function getPlayInstallReferrerCode(): Promise<string | null> {
  const raw = await getRawPlayInstallReferrer();
  return parseReferrerCode(raw);
}
