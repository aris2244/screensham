import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FREE_BLOCKED_APP_LIMIT,
  SubscriptionTier,
} from '../constants/subscriptionConfig';
import { fetchReferrerProStatus } from '../services/referralApi';

const KEY = 'subscription_state';

export interface SubscriptionState {
  tier: SubscriptionTier;
  /** Unique code this user shares with friends. */
  referralCode: string;
  /** Active Pro from referral rewards (ISO date). */
  proExpiresAt?: string;
  email?: string;
  waitlistJoinedAt?: string;
  /** Friend code entered when joining waitlist. */
  referredByCode?: string;
}

function randomReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function loadState(): Promise<SubscriptionState | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SubscriptionState;
  } catch {
    return null;
  }
}

async function saveState(state: SubscriptionState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

export async function getSubscriptionState(): Promise<SubscriptionState> {
  const existing = await loadState();
  if (existing) return existing;

  const initial: SubscriptionState = {
    tier: 'free',
    referralCode: randomReferralCode(),
  };
  await saveState(initial);
  return initial;
}

export async function getSubscriptionTier(): Promise<SubscriptionTier> {
  const state = await getSubscriptionState();
  return state.tier;
}

export async function isProUser(): Promise<boolean> {
  const state = await getSubscriptionState();
  if (state.proExpiresAt) {
    return new Date(state.proExpiresAt) > new Date();
  }
  return state.tier === 'pro';
}

export async function applyServerProUntil(
  proUntil: string | null,
): Promise<SubscriptionState> {
  const state = await getSubscriptionState();
  const active = proUntil != null && new Date(proUntil) > new Date();
  const next: SubscriptionState = {
    ...state,
    tier: active ? 'pro' : 'free',
    proExpiresAt: active ? proUntil! : undefined,
  };
  await saveState(next);
  return next;
}

/** Call on app open — sync Pro from referral rewards. */
export async function refreshProFromReferrals(): Promise<SubscriptionState> {
  const state = await getSubscriptionState();
  const status = await fetchReferrerProStatus(state.referralCode);

  if (status.ok) {
    return applyServerProUntil(status.proUntil);
  }

  if (state.proExpiresAt && new Date(state.proExpiresAt) <= new Date()) {
    return applyServerProUntil(null);
  }

  return state;
}

/** Dev / future: grant Pro after real purchase verification. */
export async function setSubscriptionTier(tier: SubscriptionTier): Promise<void> {
  const state = await getSubscriptionState();
  await saveState({ ...state, tier });
}

export async function markWaitlistJoined(
  email: string,
): Promise<SubscriptionState> {
  const state = await getSubscriptionState();
  const next: SubscriptionState = {
    ...state,
    email: email.trim().toLowerCase(),
    waitlistJoinedAt: new Date().toISOString(),
  };
  await saveState(next);
  return next;
}

/** Dev only — clears local joined flag so you can re-test Get Pro. Supabase row unchanged. */
export async function clearLocalWaitlistStatus(): Promise<SubscriptionState> {
  const state = await getSubscriptionState();
  const next: SubscriptionState = {
    ...state,
    email: undefined,
    waitlistJoinedAt: undefined,
  };
  await saveState(next);
  return next;
}

export function canAddBlockedApp(
  currentAppCount: number,
  tier: SubscriptionTier,
): boolean {
  if (tier === 'pro') return true;
  return currentAppCount < FREE_BLOCKED_APP_LIMIT;
}
