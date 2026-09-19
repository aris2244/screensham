import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sos_data';
const MAX_USES = 3;

interface SosData {
  usesLeft: number;
  month: string; // "YYYY-MM"
}

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function getSosUsesLeft(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY);

  if (!raw) {
    // First time ever — initialise
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ usesLeft: MAX_USES, month: getCurrentMonth() }),
    );
    return MAX_USES;
  }

  const data: SosData = JSON.parse(raw);

  // New month — reset automatically
  if (data.month !== getCurrentMonth()) {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ usesLeft: MAX_USES, month: getCurrentMonth() }),
    );
    return MAX_USES;
  }

  return data.usesLeft;
}

export async function decrementSosUses(): Promise<number> {
  const current = await getSosUsesLeft();
  if (current <= 0) return 0;

  const newValue = current - 1;
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify({ usesLeft: newValue, month: getCurrentMonth() }),
  );
  return newValue;
}
