import * as Notifications from 'expo-notifications';
import { Linking, NativeModules, Platform } from 'react-native';
import { getRandomRoast } from '../constants/notificationsList';

const { UsageStats } = NativeModules;

// ─── Handler (call once at app startup in App.tsx) ───────────────────────────
// Controls how notifications behave when the app is in the foreground.
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  false,
    }),
  });
}

// ─── Android channel setup ───────────────────────────────────────────────────
// Android requires a channel before any notification can appear.
export async function setupAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('roasts', {
      name:               'Roast Notifications',
      importance:         Notifications.AndroidImportance.HIGH,
      vibrationPattern:   [0, 250, 250, 250],
      lightColor:         '#FFFFFF',
      sound:              'default',
    });
  }
}

// ─── Permission request ───────────────────────────────────────────────────────
// Returns true if permission was granted (either now or previously).
export async function getNotificationPermissionGranted(): Promise<boolean> {
  if (Platform.OS === 'android' && UsageStats?.hasNotificationPermission) {
    return UsageStats.hasNotificationPermission();
  }
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Opens this app's notification settings (needed after user taps Deny). */
export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS === 'android' && UsageStats?.openNotificationSettings) {
    await UsageStats.openNotificationSettings();
    return;
  }
  await Linking.openSettings();
}

// ─── Fire a single roast immediately ─────────────────────────────────────────
// trigger: null  → fires the notification instantly.
export async function fireRoastNow(name: string, goal: string): Promise<void> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.warn('ScreenSham: notification permission not granted.');
    return;
  }

  const body = getRandomRoast(name, goal);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📵 ScreenSham',
      body,
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: 'roasts' }),
    },
    trigger: null, // null = fire immediately
  });
}

// ─── Schedule recurring roasts (for future use) ───────────────────────────────
// Call this to schedule a roast every N seconds (good for testing) or
// replace with a real time-based trigger for production.
export async function scheduleRepeatingRoast(
  name: string,
  goal: string,
  intervalSeconds: number,
): Promise<string> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return '';

  const body = getRandomRoast(name, goal);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '📵 ScreenSham',
      body,
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: 'roasts' }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: intervalSeconds,
      repeats: false,
    },
  });

  return id;
}

// ─── Cancel all scheduled notifications ──────────────────────────────────────
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
