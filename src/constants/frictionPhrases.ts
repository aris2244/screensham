/** Typing challenge phrases — ~3 short lines on a small phone screen. */

/** Works for any blocked app (games, Messenger, etc.) */
const UNLOCK_PHRASES_GENERIC: string[] = [
  'I am wasting my time right now. My goals matter more than this app. I choose to stop.',
  'This app is stealing minutes from my life. I promised myself I would focus. I stop here.',
  'I do not need this right now. My future self will thank me. I am putting my phone down.',
  'Every minute here is stolen time. I care about my goal more than this app. I leave now.',
  'I know this is a trap. I have better things to do today. I am closing this app.',
  'This is not how I want to spend my day. I am in control, not my phone. I choose to stop.',
  'I am better than this urge. My goal deserves my energy, not this app. I walk away now.',
  'Enough for today. I made a promise to myself. I keep that promise now.',
  'I opened this app on autopilot. That ends right here. I choose my goal instead.',
  'This urge will pass. My discipline will not. I am done with this app for now.',
  'I set a limit for a reason. I respect that limit now. I close this and move on.',
  'Nothing in this app is urgent. My goal is. I stop here and do what matters.',
  'I am not bored. I am avoiding something important. I face it instead of this app.',
  'One more minute here costs me later. I refuse to pay that price. I am done.',
  'My time is limited. I will not spend what is left on this. I choose to stop.',
  'I blocked this app because I meant it. I prove that now. I walk away.',
  'My thumb opened this. My brain is not impressed. Brain wins. I close this app.',
  'This app will not pay my bills or fix my life. My goal might. I log off now.',
  'I am not a raccoon digging through digital trash. I have standards. I stop here.',
  'I did not block this app for decoration. I meant it. Time to touch grass.',
  'This is not self-care. This is procrastination in a nice icon. I choose my goal.',
];

/** Only for feed / scroll-style apps (Instagram, TikTok, YouTube, etc.) */
const UNLOCK_PHRASES_SCROLL: string[] = [
  'Every minute here is stolen time. I care about my goal more than this feed. I leave now.',
  'I know this is a trap. I have better things to do today. I will not keep scrolling.',
  'Enough scrolling for today. I made a promise to myself. I keep that promise now.',
  'This feed can wait. My goals matter more than one more scroll. I choose to stop.',
  'The algorithm does not care about me. I care about my goal. I stop scrolling now.',
  'I have seen enough for today. Nothing new is worth my time. I close this feed.',
  'This endless scroll is designed to trap me. I see through it. I put my phone down.',
  'One more video will not change my life. Working on my goal might. I stop here.',
  'I am not an infinite scroll machine. I am a person with a goal. I stop here.',
  'This feed is mostly strangers, ads, and opinions. My goal is actually mine. I log off.',
  'Another reel will not fix my life. Neither will this sentence, but I am done.',
  'I am doomscrolling again. That is my villain origin story. I choose the hero ending.',
];

const SCROLL_PACKAGE_HINTS = [
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

const SCROLL_LABEL_HINTS = [
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

export function pickRandomUnlockPhrase(opts?: {
  packageName?: string;
  appLabel?: string;
}): string {
  const pool =
    opts?.packageName || opts?.appLabel
      ? isScrollStyleApp(opts.packageName ?? '', opts.appLabel ?? '')
        ? [...UNLOCK_PHRASES_GENERIC, ...UNLOCK_PHRASES_SCROLL]
        : UNLOCK_PHRASES_GENERIC
      : UNLOCK_PHRASES_GENERIC;

  return pool[Math.floor(Math.random() * pool.length)];
}

type RoastArgs = { name: string; goal: string; app: string };

const ROAST_SUBTITLES: ((args: RoastArgs) => string)[] = [
  ({ name, goal, app }) =>
    `${name}, your limit on ${app} is up. "${goal}" is still waiting for you.`,
  ({ name, goal, app }) =>
    `You were about to open ${app} again. "${goal}" does not build itself, ${name}.`,
  ({ name, app, goal }) =>
    `${app} can wait. ${name}, every minute here is a minute stolen from "${goal}".`,
  ({ name, goal, app }) =>
    `Hold up, ${name}. ${app} is blocked — and "${goal}" needs you more right now.`,
  ({ name, app }) =>
    `${name}, you already burned your ${app} time today. Go do something that counts.`,
  ({ name, goal, app }) =>
    `You chose to block ${app} for a reason. "${goal}" is that reason, ${name}.`,
  ({ name, app, goal }) =>
    `${app} is locked. ${name}, prove you care about "${goal}" and type this out.`,
  ({ name, goal, app }) =>
    `No more ${app} for now, ${name}. "${goal}" called — it said you still have work to do.`,
];

export function pickRandomRoastSubtitle(args: RoastArgs): string {
  const fn = ROAST_SUBTITLES[Math.floor(Math.random() * ROAST_SUBTITLES.length)];
  return fn(args);
}
