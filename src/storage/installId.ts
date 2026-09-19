import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'install_id';

/** Stable per-install ID — used to prevent duplicate referral credits. */
export async function getInstallId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY);
  if (existing) return existing;

  const id = `inst_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(KEY, id);
  return id;
}
