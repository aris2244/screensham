/**
 * Watchdog — thin TypeScript wrapper over the native WatchdogService.
 */
import { Platform } from 'react-native';
import { BlockedApp } from '../types';
import { getUserProfile } from '../storage/userProfile';
import {
  startNativeWatchdog,
  stopNativeWatchdog,
  updateWatchdogAllowance,
  type WatchdogConfig,
} from './usageStats';
import { syncRoastConfigToNative } from './roastSync';

/** Build JSON map: packageName -> limitMinutes */
export function blockedAppsToJson(apps: BlockedApp[]): string {
  const map: Record<string, number> = {};
  for (const { packageName, limitMinutes } of apps) {
    if (limitMinutes > 0 && packageName) {
      map[packageName] = limitMinutes;
    }
  }
  return JSON.stringify(map);
}

export async function resolveWatchdogConfig(): Promise<WatchdogConfig> {
  const profile = await getUserProfile();
  if (!profile) {
    return { dailyAllowanceMinutes: 120, goesOutSaturday: false };
  }
  return {
    dailyAllowanceMinutes: profile.dailyAllowanceMinutes,
    goesOutSaturday: profile.goesOutSaturday,
  };
}

export async function syncWatchdogAllowance(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const config = await resolveWatchdogConfig();
  await updateWatchdogAllowance(
    config.dailyAllowanceMinutes,
    config.goesOutSaturday,
  );
}

export async function startWatchdog(apps: BlockedApp[]): Promise<void> {
  if (Platform.OS !== 'android') return;
  await syncRoastConfigToNative();
  const config = await resolveWatchdogConfig();
  await startNativeWatchdog(
    blockedAppsToJson(apps),
    config.dailyAllowanceMinutes,
    config.goesOutSaturday,
  );
}

export async function stopWatchdog(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await stopNativeWatchdog();
}

export const FRICTION_TRIGGER_EVENT = 'onFrictionTrigger';
export const BLOCK_SCREEN_FAILED_EVENT = 'onBlockScreenFailed';

export interface FrictionTriggerPayload {
  packageName?: string;
}
