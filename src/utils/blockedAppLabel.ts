import { getAppLabelFromPackage } from '../constants/packageNames';
import { getBlockedApps } from '../storage/blockedAppsStorage';
import { getAppLabel } from './usageStats';

/** Human-readable label for the app that triggered the block screen. */
export async function resolveBlockedAppLabel(packageName: string): Promise<string> {
  if (!packageName) return 'This app';

  const preset = getAppLabelFromPackage(packageName);
  if (preset) return preset;

  const blocked = await getBlockedApps();
  const match = blocked.find((a) => a.packageName === packageName);
  if (match?.appName) return match.appName;

  try {
    return await getAppLabel(packageName);
  } catch {
    return packageName;
  }
}
