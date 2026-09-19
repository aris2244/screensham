/**
 * TypeScript bridge for the UsageStats native Android module.
 * Only works after `npx expo prebuild` + `npx expo run:android`.
 */
import { NativeModules, Platform } from 'react-native';

const { UsageStats } = NativeModules;

function assertAndroid(): void {
  if (Platform.OS !== 'android') throw new Error('UsageStats is Android-only.');
  if (!UsageStats) throw new Error(
    'UsageStats native module not found. Build with `npx expo run:android`.',
  );
}

// ── Permission ────────────────────────────────────────────────────────────────

export async function hasUsagePermission(): Promise<boolean> {
  assertAndroid();
  return UsageStats.hasUsagePermission();
}

export async function openUsageAccessSettings(): Promise<void> {
  assertAndroid();
  await UsageStats.openUsageSettings();
}

export async function hasOverlayPermission(): Promise<boolean> {
  assertAndroid();
  return UsageStats.hasOverlayPermission();
}

export interface BlockedAppStatus {
  packageName: string;
  limitMinutes: number;
  usageMinutes: number;
  overLimit: boolean;
  perAppOverLimit?: boolean;
}

export interface BlockingStatus {
  usageGranted: boolean;
  overlayWorks: boolean;
  overlayBlockFailed: boolean;
  watchdogRunning: boolean;
  needsOverlaySetup: boolean;
  anyOverLimit: boolean;
  dailyOverLimit: boolean;
  todayAllowanceMinutes: number;
  blockedApps: BlockedAppStatus[];
}

export interface WatchdogConfig {
  dailyAllowanceMinutes: number;
  goesOutSaturday: boolean;
}

export async function getBlockingStatus(): Promise<BlockingStatus> {
  assertAndroid();
  return UsageStats.getBlockingStatus();
}

export async function openOverlaySettings(): Promise<void> {
  assertAndroid();
  await UsageStats.openOverlaySettings();
}

export async function getDeviceManufacturer(): Promise<string> {
  assertAndroid();
  return UsageStats.getDeviceManufacturer() ?? '';
}

export async function hasNotificationPermission(): Promise<boolean> {
  assertAndroid();
  return UsageStats.hasNotificationPermission();
}

export async function openNotificationSettingsNative(): Promise<void> {
  assertAndroid();
  await UsageStats.openNotificationSettings();
}

// ── Usage time ────────────────────────────────────────────────────────────────

export async function getTodayUsageMinutes(packageName: string): Promise<number> {
  assertAndroid();
  return UsageStats.getTodayUsageForPackage(packageName);
}

export async function safeGetTodayUsage(packageName: string): Promise<{
  permissionGranted: boolean;
  minutes: number;
}> {
  assertAndroid();
  const permissionGranted = await hasUsagePermission();
  if (!permissionGranted) return { permissionGranted: false, minutes: 0 };
  const minutes = await getTodayUsageMinutes(packageName);
  return { permissionGranted: true, minutes };
}

// ── All apps used today ───────────────────────────────────────────────────────

export interface AppUsage {
  packageName: string;
  appName: string;
  minutes: number;
  /** PNG icon encoded as base64, or null if unavailable */
  iconBase64: string | null;
}

/**
 * Returns every launchable app used today (minutes > 0), sorted by
 * usage descending, each with its real icon as a base64 PNG.
 */
export async function getTodayAppUsageList(): Promise<AppUsage[]> {
  assertAndroid();
  return UsageStats.getTodayAppUsageList();
}

export interface InstalledApp {
  packageName: string;
  appName: string;
  iconBase64: string | null;
}

/** All launchable apps on the device — for the "Other" blocked-apps picker. */
export async function getInstalledAppsForBlocking(): Promise<InstalledApp[]> {
  assertAndroid();
  return UsageStats.getInstalledAppsForBlocking();
}

export async function getAppLabel(packageName: string): Promise<string> {
  assertAndroid();
  return UsageStats.getAppLabel(packageName);
}

// ── Foreground detection ──────────────────────────────────────────────────────

/**
 * Returns the package name of the app currently in the foreground,
 * based on the most recent UsageEvents.ACTIVITY_RESUMED event in the
 * last 10 seconds. Returns null if nothing is detected.
 */
export async function getCurrentForegroundApp(): Promise<string | null> {
  assertAndroid();
  return UsageStats.getCurrentForegroundApp();
}

// ── Bring ScreenSham to front ─────────────────────────────────────────────────

export async function bringToFront(): Promise<void> {
  assertAndroid();
  await UsageStats.bringToFront();
}

// ── Native ForegroundService watchdog ────────────────────────────────────────

/**
 * Starts the native WatchdogService. This runs in Kotlin on a background
 * thread — completely independent of the JS runtime — so it stays alive
 * when the user leaves ScreenSham. Shows a small persistent notification.
 */
export async function startNativeWatchdog(
  blockedAppsJson: string,
  dailyAllowanceMinutes: number,
  goesOutSaturday: boolean,
): Promise<void> {
  assertAndroid();
  await UsageStats.startNativeWatchdog(
    blockedAppsJson,
    dailyAllowanceMinutes,
    goesOutSaturday,
  );
}

export async function updateWatchdogAllowance(
  dailyAllowanceMinutes: number,
  goesOutSaturday: boolean,
): Promise<void> {
  assertAndroid();
  await UsageStats.updateWatchdogAllowance(dailyAllowanceMinutes, goesOutSaturday);
}

/** Stops the WatchdogService and removes its persistent notification. */
export async function stopNativeWatchdog(): Promise<void> {
  assertAndroid();
  await UsageStats.stopNativeWatchdog();
}

/** True while the native foreground watchdog service is running. */
export async function isWatchdogRunning(): Promise<boolean> {
  assertAndroid();
  return UsageStats.isWatchdogRunning();
}

/** Opens another app by Android package name. */
export async function launchApp(packageName: string): Promise<void> {
  assertAndroid();
  await UsageStats.launchApp(packageName);
}

/**
 * Session bypass: user can keep using the app until they leave it.
 * Next open requires the typing challenge again.
 */
export async function grantSessionBypass(packageName: string): Promise<void> {
  assertAndroid();
  await UsageStats.grantSessionBypass(packageName);
}

/** True if the native watchdog is waiting to show the friction screen. */
export async function consumePendingFriction(): Promise<boolean> {
  assertAndroid();
  return UsageStats.consumePendingFriction();
}

/** Re-arm blocking after friction is dismissed without unlock. */
export async function resetBlockState(): Promise<void> {
  assertAndroid();
  await UsageStats.resetBlockState();
}

export async function getLastBlockedPackage(): Promise<string> {
  assertAndroid();
  return UsageStats.getLastBlockedPackage() ?? '';
}

export async function syncRoastConfig(
  name: string,
  goal: string,
  templatesJson: string,
): Promise<void> {
  assertAndroid();
  await UsageStats.syncRoastConfig(name, goal, templatesJson);
}

export async function finishFrictionLock(): Promise<void> {
  assertAndroid();
  await UsageStats.finishFrictionLock();
}
