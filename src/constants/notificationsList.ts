/** Short roast notifications — one line, fits collapsed view. */

/** Pure static line — no placeholders at all. */
export const ROAST_STATIC_PURE = 'Go touch grass. For real now!!';

export const SCROLL_PACKAGE_HINTS = [
  'instagram',
  'tiktok',
  'zhiliaoapp',
  'youtube',
  'snapchat',
  'twitter',
  'reddit',
  'facebook',
  'fb.',
  'threads',
  'pinterest',
  'linkedin',
];

export const SCROLL_LABEL_HINTS = [
  'instagram',
  'tiktok',
  'youtube',
  'snapchat',
  'twitter',
  'reddit',
  'facebook',
  'threads',
  'pinterest',
];

export function isScrollStyleApp(packageName: string, appLabel: string): boolean {
  const pkg = packageName.toLowerCase();
  const label = appLabel.toLowerCase();
  return (
    SCROLL_PACKAGE_HINTS.some((h) => pkg.includes(h)) ||
    SCROLL_LABEL_HINTS.some((h) => label.includes(h))
  );
}

/** Blocked apps — short & funny (any trigger). */
export const ROAST_NOTIFICATIONS_BLOCKED: string[] = [
  '{name}, you blocked {app}. Act like it.',
  'Still on {app}? {goal} waits.',
  'You blocked {app}. So leave.',
  '{app} is winning. {goal} is not.',
  'Embarrassing, {name}. {app} again.',
  '{name}, touch {goal}. Not {app}.',
  'You literally blocked {app}.',
  '{goal} > {app}. You know this.',
  'Close {app}, {name}. Now.',
  '{app} has you. {goal} does not.',
  'Your limit on {app} exists.',
  'This is why you blocked {app}.',
  '{name}, {app} is not the plan.',
  '{app} again? Bold choice.',
  'Swap {app} for {goal}, {name}.',
  // 30 chars — no {name} / {goal}
  'You blocked {app}. Leave now!!',
  'Still on {app}? Close it, lol.',
  '{app} again? Shame spiral lol.',
  'Brain rot wave on {app}.......',
  'Touch grass not {app}. Please.',
  'Your block on {app} is a joke.',
  '{app} owns you. Fight back!!!!',
  'Close {app}. Save your soul!!!',
  'Peak {app} behavior. So gross.',
  'Block was set. You ignored it.',
  ROAST_STATIC_PURE,
];

export const ROAST_BLOCKED_USAGE: string[] = [
  '{minutes} min on {app}. You blocked it.',
  '{name}, {minutes} min on {app}. Leave.',
  '{goal} is dusty. {app} is not.',
  '{minutes} min on {app}. Nope!!',
  '{minutes} min on blocked {app}',
  '{minutes} min wasted on {app}.',
  '{minutes} min on {app}. Yikes!',
  '{minutes} min. Still on {app}.',
];

export const ROAST_BLOCKED_OPENS: string[] = [
  '{count} opens on {app}. Really?',
  '{app} x{count} today. Embarrassing.',
  '{name}, pick a personality.',
  '{count}x {app} today. Pathetic',
  '{count} taps. {app} again lol.',
  '{app} opened {count} times lol',
  '{count} opens. {app} again lol',
  '{count}x {app}. Way too many!!',
];

export const ROAST_BLOCKED_RAPID: string[] = [
  '{count}x {app} in {window} min. Chill.',
  'Slow down on {app}, {name}.',
  'Rapid {app} opens. Touch grass.',
  'Rapid {app} relapse. {count}x.',
  '{count}x {app} in {window} min',
  'Slow down: {count}x {app} ok!!',
  '{count}x {app}. Chill reopen!!',
  'Bouncing {app}? {count} hits!!',
];

export const ROAST_BLOCKED_SESSION: string[] = [
  '{minutes} min on {app} without closing.',
  '{name}, {minutes} min straight on {app}.',
  'Still on {app}? {minutes} min this session.',
  'Still on {app}? {minutes} min.',
  'Locked on {app} {minutes} min!',
  '{minutes} min. Still on {app}.',
  '{minutes} min stuck on {app}..',
  '{minutes} min on {app}. Locked',
];

export const ROAST_BLOCKED_EARLY: string[] = [
  'Scrolling {app} before 7 AM, {name}?',
  'Way too early for {app}, {name}.',
  'The sun is not up. {app} is. Wild.',
  '{name}, put {app} down. Go back to sleep.',
  'Too early for {app}. Go sleep.',
  '{app} before 7 AM? Unhinged!!!',
  'Dawn scroll on {app}. Really??',
  'Birds up. You on {app}. Wild!!',
  'Pre-7 AM scroll on {app}. Stop',
];

/** Unblocked scroll apps. */
export const ROAST_NOTIFICATIONS_UNBLOCKED: string[] = [
  'I see why you skipped blocking {app}.',
  'Hiding on {app}, {name}? Cute.',
  '{app} again. {goal} says hi.',
  'No block on {app}. Bold.',
  '{name}, block {app} already.',
  'The feed won again. Shocking.',
  '{app} unblocked. Discipline too.',
  '{goal} called. You ignored it.',
  'Nice priorities, {name}.',
  'Classic {app} scroll, {name}.',
  'You gave {app} a free pass.',
  '{app} is not the problem. You are.',
  'Still on {app}? Block it maybe.',
  '{name}, {goal} is waiting.',
  'Another {app} session. Classic.',
  // 30 chars — no {name} / {goal}
  '{app} unblocked. Discipline 0.',
  '{app} has no guardrails. Fun!!',
  'Free pass on {app}. Smart lol.',
  'No block on {app}. Bold move!!',
  'Scrolling {app} like a pro lol',
  'You chose {app} over sanity!!!',
  '{app} is winning. Block it now',
  'Classic unblocked {app} scroll',
  '{app} feed owns you again. Oof',
  'Block {app} before regret hits',
  ROAST_STATIC_PURE,
];

export const ROAST_UNBLOCKED_USAGE: string[] = [
  '{minutes} min on {app}. Block it?',
  '{name}, {minutes} min on {app}.',
  '{goal} sends regards from {app}.',
  '{minutes} min scrolling {app}.',
  '{minutes} min on {app}. Yikes.',
  '{minutes} min on {app}. Block?',
  '{minutes} min on {app}. Chill!',
  '{minutes} min. Still on {app}.',
];

export const ROAST_UNBLOCKED_OPENS: string[] = [
  '{app} open #{count}. Classic.',
  '{count} opens. You can block it.',
  'Hiding on {app}? Open #{count}.',
  '{count} opens on {app}. Block?',
  '{count}x {app} today? Block!!!',
  '{app} x{count} today. Block!!!',
  '{count} taps on {app}. Block!!',
  '{count}x {app}. Way too many!!',
];

export const ROAST_UNBLOCKED_RAPID: string[] = [
  '{count}x {app} in {window} min.',
  'Slow down, {name}. {app} again.',
  'Rapid {app} hopping. Yikes.',
  'Rapid {app} hopping. {count}x.',
  '{count}x {app} in {window} min',
  'Slow down: {count}x {app} ok!!',
  '{count}x {app}. Chill reopen!!',
  'Bouncing {app}? {count} hits!!',
];

export const ROAST_UNBLOCKED_SESSION: string[] = [
  '{minutes} min on {app} without closing.',
  'Still scrolling {app} — {minutes} min.',
  '{name}, {minutes} min straight on {app}.',
  'Still on {app}? {minutes} min.',
  'Locked on {app} {minutes} min!',
  '{minutes} min. Still on {app}.',
  '{minutes} min stuck on {app}..',
  '{minutes} min on {app}. Locked',
];

export const ROAST_UNBLOCKED_EARLY: string[] = [
  'Doomscrolling {app} before 7 AM, {name}?',
  'It is too early for {app}, {name}.',
  '{app} before breakfast? Really?',
  '{name}, the feed can wait until morning.',
  'Too early for {app}. Go sleep.',
  '{app} before 7 AM? Unhinged!!!',
  'Dawn scroll on {app}. Really??',
  'Birds up. You on {app}. Wild!!',
  'Pre-7 AM {app} scroll. Block??',
];

export type RoastTriggerTemplates = {
  general: string[];
  usage: string[];
  opens: string[];
  rapid: string[];
  session: string[];
  earlyMorning: string[];
};

export type RoastTemplateSync = {
  blocked: RoastTriggerTemplates;
  unblockedScroll: RoastTriggerTemplates;
  scrollPackageHints: string[];
  scrollLabelHints: string[];
};

export function getRoastTemplateSyncPayload(): string {
  const payload: RoastTemplateSync = {
    blocked: {
      general: ROAST_NOTIFICATIONS_BLOCKED,
      usage: ROAST_BLOCKED_USAGE,
      opens: ROAST_BLOCKED_OPENS,
      rapid: ROAST_BLOCKED_RAPID,
      session: ROAST_BLOCKED_SESSION,
      earlyMorning: ROAST_BLOCKED_EARLY,
    },
    unblockedScroll: {
      general: ROAST_NOTIFICATIONS_UNBLOCKED,
      usage: ROAST_UNBLOCKED_USAGE,
      opens: ROAST_UNBLOCKED_OPENS,
      rapid: ROAST_UNBLOCKED_RAPID,
      session: ROAST_UNBLOCKED_SESSION,
      earlyMorning: ROAST_UNBLOCKED_EARLY,
    },
    scrollPackageHints: SCROLL_PACKAGE_HINTS,
    scrollLabelHints: SCROLL_LABEL_HINTS,
  };
  return JSON.stringify(payload);
}

export function formatRoastTemplate(
  template: string,
  args: {
    name: string;
    goal: string;
    app: string;
    minutes?: number;
    count?: number;
    window?: number;
  },
): string {
  return template
    .replace(/\{name\}/g, args.name)
    .replace(/\{goal\}/g, args.goal)
    .replace(/\{app\}/g, args.app)
    .replace(/\{minutes\}/g, String(args.minutes ?? ''))
    .replace(/\{count\}/g, String(args.count ?? ''))
    .replace(/\{window\}/g, String(args.window ?? ''));
}

/** @deprecated Manual test helper — roasts fire from native Watchdog now. */
export const getRoasts = (name: string, goal: string): string[] =>
  ROAST_NOTIFICATIONS_BLOCKED.map((t) =>
    formatRoastTemplate(t, { name, goal, app: 'this app' }),
  );

/** @deprecated Manual test helper — roasts fire from native Watchdog now. */
export const getRandomRoast = (name: string, goal: string): string => {
  const roasts = getRoasts(name, goal);
  return roasts[Math.floor(Math.random() * roasts.length)];
};
