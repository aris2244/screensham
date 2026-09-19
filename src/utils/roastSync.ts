import { NativeModules, Platform } from 'react-native';
import { getRoastTemplateSyncPayload } from '../constants/notificationsList';
import { getUserProfile } from '../storage/userProfile';

const { UsageStats } = NativeModules;

/** Push profile + roast templates to native Watchdog for background notifications. */
export async function syncRoastConfigToNative(): Promise<void> {
  if (Platform.OS !== 'android' || !UsageStats?.syncRoastConfig) return;

  const profile = await getUserProfile();
  if (!profile) return;

  await UsageStats.syncRoastConfig(
    profile.name,
    profile.goal,
    getRoastTemplateSyncPayload(),
  );
}
