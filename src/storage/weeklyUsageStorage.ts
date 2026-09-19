import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'daily_usage_snapshots';
const RETENTION_DAYS = 90;

type SnapshotMap = Record<string, number>;

export interface DayUsage {
  usedMinutes: number;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMondayOfWeek(ref: Date = new Date()): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const todayIdx = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - todayIdx);
  return d;
}

export function getWeekDateKeys(ref: Date = new Date()): string[] {
  const monday = getMondayOfWeek(ref);
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    keys.push(formatDateKey(day));
  }
  return keys;
}

export function getTodayWeekIndex(ref: Date = new Date()): number {
  return (ref.getDay() + 6) % 7;
}

async function loadSnapshots(): Promise<SnapshotMap> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as SnapshotMap;
  } catch {
    return {};
  }
}

async function saveSnapshots(map: SnapshotMap): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffKey = formatDateKey(cutoff);
  const pruned: SnapshotMap = {};
  for (const [k, v] of Object.entries(map)) {
    if (k >= cutoffKey) pruned[k] = v;
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(pruned));
}

/** Persist today's total screen time (same number as the home circle). */
export async function saveTodayUsageSnapshot(usedMinutes: number): Promise<void> {
  const map = await loadSnapshots();
  map[formatDateKey(new Date())] = usedMinutes;
  await saveSnapshots(map);
}

/**
 * Mon=0 … Sun=6.
 * null = future day, or past day without a saved snapshot yet.
 * Today always uses live minutes from the usage query.
 */
export async function getWeekDisplayData(
  liveTodayMinutes: number,
): Promise<(DayUsage | null)[]> {
  const snapshots = await loadSnapshots();
  const keys = getWeekDateKeys();
  const todayKey = formatDateKey(new Date());
  const todayIdx = getTodayWeekIndex();

  return keys.map((key, i) => {
    if (i > todayIdx) return null;
    if (key === todayKey) return { usedMinutes: liveTodayMinutes };
    const stored = snapshots[key];
    if (stored === undefined) return null;
    return { usedMinutes: stored };
  });
}

export function getMonthDateKeys(ref: Date = new Date()): string[] {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const keys: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    keys.push(
      `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    );
  }
  return keys;
}

export function getMonthLabel(ref: Date = new Date()): string {
  return ref.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** One entry per calendar day this month; null = future or no snapshot yet. */
export async function getMonthDisplayData(
  liveTodayMinutes: number,
  ref: Date = new Date(),
): Promise<(DayUsage | null)[]> {
  const snapshots = await loadSnapshots();
  const keys = getMonthDateKeys(ref);
  const todayKey = formatDateKey(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return keys.map((key) => {
    const [y, mo, d] = key.split('-').map(Number);
    const dayDate = new Date(y, mo - 1, d);
    dayDate.setHours(0, 0, 0, 0);
    if (dayDate > today) return null;
    if (key === todayKey) return { usedMinutes: liveTodayMinutes };
    const stored = snapshots[key];
    if (stored === undefined) return null;
    return { usedMinutes: stored };
  });
}
