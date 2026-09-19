import AsyncStorage from '@react-native-async-storage/async-storage';
import { ANDROID_PACKAGE_NAMES } from '../constants/packageNames';
import { NEMESIS_LABELS } from '../constants/nemesisLabels';
import { BlockedApp, NemesisApp, UserProfile } from '../types';

const KEY = 'blocked_apps';

function normalizeBlockedApp(raw: unknown): BlockedApp | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.limitMinutes !== 'number' || obj.limitMinutes < 1) return null;

  if (typeof obj.packageName === 'string' && typeof obj.appName === 'string') {
    return {
      packageName: obj.packageName,
      appName: obj.appName,
      limitMinutes: obj.limitMinutes,
    };
  }

  if (typeof obj.app === 'string' && obj.app in ANDROID_PACKAGE_NAMES) {
    const nemesis = obj.app as NemesisApp;
    return {
      packageName: ANDROID_PACKAGE_NAMES[nemesis],
      appName: NEMESIS_LABELS[nemesis],
      limitMinutes: obj.limitMinutes,
    };
  }

  return null;
}

export async function getBlockedApps(): Promise<BlockedApp[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeBlockedApp)
      .filter((app): app is BlockedApp => app !== null);
  } catch {
    return [];
  }
}

export async function saveBlockedApps(apps: BlockedApp[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(apps));
}

export function blockedAppFromPreset(
  nemesis: NemesisApp,
  limitMinutes = 1,
): BlockedApp {
  return {
    packageName: ANDROID_PACKAGE_NAMES[nemesis],
    appName: NEMESIS_LABELS[nemesis],
    limitMinutes,
  };
}

/** First launch: seed from onboarding nemesis app. */
export async function ensureBlockedApps(profile: UserProfile): Promise<BlockedApp[]> {
  const existing = await getBlockedApps();
  if (existing.length > 0) return existing;

  const defaultLimit = __DEV__ ? 2 : profile.dailyAllowanceMinutes;
  const seeded: BlockedApp[] = [
    blockedAppFromPreset(profile.nemesisApp, defaultLimit),
  ];
  await saveBlockedApps(seeded);
  return seeded;
}

export function totalAllocatedMinutes(apps: BlockedApp[]): number {
  return apps.reduce((sum, a) => sum + a.limitMinutes, 0);
}

export function canAddMinutes(
  apps: BlockedApp[],
  dailyAllowanceMinutes: number,
  extraMinutes = 0,
): boolean {
  return totalAllocatedMinutes(apps) + extraMinutes <= dailyAllowanceMinutes;
}

/** Scale per-app limits down when daily allowance shrinks. */
export function fitBlockedAppsToAllowance(
  apps: BlockedApp[],
  dailyAllowanceMinutes: number,
): BlockedApp[] {
  if (apps.length === 0) return apps;
  const total = totalAllocatedMinutes(apps);
  if (total <= dailyAllowanceMinutes) return apps;

  let scaled = apps.map((a) => ({
    ...a,
    limitMinutes: Math.max(
      1,
      Math.floor((a.limitMinutes / total) * dailyAllowanceMinutes),
    ),
  }));

  while (totalAllocatedMinutes(scaled) > dailyAllowanceMinutes) {
    const richest = scaled.reduce(
      (bestIdx, app, idx, arr) =>
        app.limitMinutes > arr[bestIdx].limitMinutes ? idx : bestIdx,
      0,
    );
    if (scaled[richest].limitMinutes <= 1) break;
    scaled = scaled.map((a, i) =>
      i === richest ? { ...a, limitMinutes: a.limitMinutes - 1 } : a,
    );
  }

  return scaled;
}

export function isPackageBlocked(
  apps: BlockedApp[],
  packageName: string,
): boolean {
  return apps.some((a) => a.packageName === packageName);
}

/** @deprecated Use isPackageBlocked with preset package name */
export function isAppAlreadyBlocked(apps: BlockedApp[], app: NemesisApp): boolean {
  return isPackageBlocked(apps, ANDROID_PACKAGE_NAMES[app]);
}
