import { registerReferralInstall } from './referralApi';
import { getInstallId } from '../storage/installId';
import {
  clearPendingReferrerCode,
  getPendingReferrerCode,
} from '../storage/pendingReferral';
import { getSubscriptionState } from '../storage/subscriptionStorage';

/** Call once when NEW user finishes onboarding. */
export async function processReferralAfterOnboarding(): Promise<void> {
  const pending = await getPendingReferrerCode();
  if (!pending) return;

  const state = await getSubscriptionState();
  const installId = await getInstallId();

  await registerReferralInstall(pending, installId, state.referralCode);
  await clearPendingReferrerCode();
}
