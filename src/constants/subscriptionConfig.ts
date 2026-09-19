/** Subscription tiers — no real billing yet (waitlist / validation phase). */

export type SubscriptionTier = 'free' | 'pro';
export type BillingPeriod = 'annual' | 'monthly';

export const FREE_BLOCKED_APP_LIMIT = 1;

/** Pricing */
export const PRO_MONTHLY_PRICE = 5.0;             // €5/mo billed monthly
export const PRO_ANNUAL_PER_MONTH = 1.99;         // €1.99/mo when billed annually
export const PRO_ANNUAL_TOTAL = +(PRO_ANNUAL_PER_MONTH * 12).toFixed(2); // €23.88

export const WAITLIST_DISCOUNT_PERCENT = 50;

/** Legacy export — kept so stale bundles / hot reload don't crash on `.paywallNote`. */
export const PRO_LAUNCH_COPY = {
  title: 'Pro isn\'t available yet',
  body: `Join the waitlist for ${WAITLIST_DISCOUNT_PERCENT}% off your first payment.`,
  cta: `Join waitlist — ${WAITLIST_DISCOUNT_PERCENT}% off`,
  paywallNote: 'No charge today. We\'ll email your discount code at launch.',
} as const;

/** @deprecated Use PRO_MONTHLY_PRICE / PRO_ANNUAL_PER_MONTH instead */
export const PRO_PRICE_LABEL = `€${PRO_ANNUAL_PER_MONTH.toFixed(2)}/mo`;

/** First-purchase discounted prices */
export const PRO_MONTHLY_FIRST = +(PRO_MONTHLY_PRICE * (1 - WAITLIST_DISCOUNT_PERCENT / 100)).toFixed(2); // €2.50
export const PRO_ANNUAL_FIRST  = +(PRO_ANNUAL_TOTAL  * (1 - WAITLIST_DISCOUNT_PERCENT / 100)).toFixed(2); // €11.94

export const PLAN_FEATURES = {
  free: [
    '1 blocked app',
    'Daily limit & roasts',
    'Weekly stats',
  ],
  pro: [
    'Unlimited blocked apps',
    'Daily limit & roasts',
    'Weekly & monthly stats',
    'Early access & priority support',
  ],
} as const;

export const MAX_REFERRAL_FREE_MONTHS = 3;

export const REFERRAL_COPY = {
  title: 'Invite a friend — get 1 free Pro month',
  body: 'Share your link. When a friend installs and finishes setup, you get 1 month Pro. Max 3 months total. Pro is only available through invites right now.',
  shareTitle: 'ScreenSham — cut your screen time',
} as const;
