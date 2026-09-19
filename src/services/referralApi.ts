/**
 * Referral Pro grants via Supabase RPC.
 * Setup: docs/REFERRAL_PRO_SETUP.md + docs/supabase-referrals.sql
 */

export interface ReferralRegisterResult {
  ok: boolean;
  granted?: boolean;
  reason?: string;
  error?: string;
  proUntil?: string;
}

export interface ReferralProStatus {
  ok: boolean;
  proUntil: string | null;
  successfulReferrals: number;
  error?: string;
}

function getSupabaseConfig(): { baseUrl: string; key: string } | null {
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
  const key =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.EXPO_PUBLIC_PRO_INTEREST_KEY?.trim();
  if (!baseUrl || !key) return null;
  return { baseUrl, key };
}

async function callRpc<T>(fn: string, body: Record<string, string>): Promise<T | null> {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;

  const res = await fetch(`${cfg.baseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `RPC ${fn} failed (${res.status})`);
  }

  return (await res.json()) as T;
}

/** New user finished onboarding — credit referrer (if valid). */
export async function registerReferralInstall(
  referrerCode: string,
  referredInstallId: string,
  newUserReferralCode: string,
): Promise<ReferralRegisterResult> {
  try {
    const data = await callRpc<{
      ok: boolean;
      granted?: boolean;
      reason?: string;
      error?: string;
      pro_until?: string;
    }>('register_referral', {
      p_referrer_code: referrerCode,
      p_referred_install_id: referredInstallId,
      p_new_user_code: newUserReferralCode,
    });

    if (!data) {
      return { ok: false, error: 'Supabase not configured' };
    }

    if (!data.ok) {
      return { ok: false, error: data.error ?? 'register_failed' };
    }

    return {
      ok: true,
      granted: data.granted,
      reason: data.reason,
      proUntil: data.pro_until ?? undefined,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Network error',
    };
  }
}

/** Poll referrer Pro expiry (call on app open). */
export async function fetchReferrerProStatus(
  referralCode: string,
): Promise<ReferralProStatus> {
  try {
    const data = await callRpc<{
      ok: boolean;
      pro_until: string | null;
      successful_referrals: number;
    }>('get_referrer_pro_status', {
      p_referral_code: referralCode,
    });

    if (!data) {
      return { ok: false, proUntil: null, successfulReferrals: 0, error: 'not_configured' };
    }

    return {
      ok: true,
      proUntil: data.pro_until,
      successfulReferrals: data.successful_referrals ?? 0,
    };
  } catch (e) {
    return {
      ok: false,
      proUntil: null,
      successfulReferrals: 0,
      error: e instanceof Error ? e.message : 'Network error',
    };
  }
}

export function isReferralApiConfigured(): boolean {
  return getSupabaseConfig() !== null;
}
