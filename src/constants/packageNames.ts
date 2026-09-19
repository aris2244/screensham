import { NemesisApp } from '../types';
import { NEMESIS_LABELS } from './nemesisLabels';

/**
 * Maps our internal NemesisApp keys to real Android package names.
 * Used by the UsageStatsManager native module to query per-app usage.
 */
export const ANDROID_PACKAGE_NAMES: Record<NemesisApp, string> = {
  instagram: 'com.instagram.android',
  tiktok:    'com.zhiliaoapp.musically',
  youtube:   'com.google.android.youtube',
  snapchat:  'com.snapchat.android',
  twitter:   'com.twitter.android',
};

export function getPackageName(app: NemesisApp): string {
  return ANDROID_PACKAGE_NAMES[app];
}

/** Human-readable app name from an Android package (e.g. com.google.android.youtube → YouTube). */
export function getAppLabelFromPackage(packageName: string): string | null {
  if (!packageName) return null;
  for (const [app, pkg] of Object.entries(ANDROID_PACKAGE_NAMES)) {
    if (pkg === packageName) return NEMESIS_LABELS[app as NemesisApp];
  }
  return null;
}
