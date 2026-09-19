import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'pending_referrer_code';

export async function setPendingReferrerCode(code: string): Promise<void> {
  await AsyncStorage.setItem(KEY, code.trim().toUpperCase());
}

export async function getPendingReferrerCode(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? raw.trim().toUpperCase() : null;
}

export async function clearPendingReferrerCode(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
