import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types';

const KEY = 'user_profile';

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(profile));
  const { syncRoastConfigToNative } = await import('../utils/roastSync');
  await syncRoastConfigToNative().catch(() => {});
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  return JSON.parse(raw) as UserProfile;
}

export async function clearUserProfile(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

/** Legacy profiles without the field are treated as already set up. */
export function isPermissionsSetupComplete(profile: UserProfile): boolean {
  if (profile.permissionsSetupComplete === false) return false;
  return true;
}

export async function markPermissionsSetupComplete(): Promise<void> {
  const profile = await getUserProfile();
  if (!profile) return;
  await saveUserProfile({ ...profile, permissionsSetupComplete: true });
}
