/**
 * Waitlist email collection via Supabase REST API.
 * Setup: docs/WAITLIST_SUPABASE.md
 */

export interface WaitlistSubmitResult {
  ok: boolean;
  alreadyJoined?: boolean;
  error?: string;
}

function getConfig(): { url: string; key: string } | null {
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
  const key =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.EXPO_PUBLIC_PRO_INTEREST_KEY?.trim();
  const table =
    process.env.EXPO_PUBLIC_WAITLIST_TABLE?.trim() || 'waitlist_emails';

  if (!baseUrl || !key) return null;

  return {
    url: `${baseUrl}/rest/v1/${table}`,
    key,
  };
}

export function isWaitlistConfigured(): boolean {
  return getConfig() !== null;
}

/** @deprecated use isWaitlistConfigured */
export function isProInterestApiConfigured(): boolean {
  return isWaitlistConfigured();
}

/** Save email to Supabase waitlist table. */
export async function submitWaitlistEmail(email: string): Promise<WaitlistSubmitResult> {
  const cfg = getConfig();
  const normalized = email.trim().toLowerCase();

  if (!cfg) {
    if (__DEV__) {
      console.warn(
        '[waitlist] Supabase not configured — email NOT saved. Add .env (see docs/WAITLIST_SUPABASE.md)',
        normalized,
      );
    }
    return {
      ok: false,
      error: 'Waitlist is not connected yet. Try again later.',
    };
  }

  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ email: normalized }),
    });

    if (res.ok) return { ok: true };

    const text = await res.text().catch(() => '');

    // Postgres unique violation (duplicate email)
    if (res.status === 409 || text.includes('duplicate') || text.includes('23505')) {
      return { ok: true, alreadyJoined: true };
    }

    return { ok: false, error: text || `HTTP ${res.status}` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Network error',
    };
  }
}

/** Legacy shape — still used by ProPaywallModal */
export type ProInterestEvent = 'pay_attempt' | 'waitlist';

export interface ProInterestPayload {
  email: string;
  eventType: ProInterestEvent;
  referralCode: string;
  referredByCode?: string;
}

export interface ProInterestResult {
  ok: boolean;
  alreadyJoined?: boolean;
  error?: string;
}

export async function submitProInterest(
  payload: ProInterestPayload,
): Promise<ProInterestResult> {
  const result = await submitWaitlistEmail(payload.email);
  return result;
}
