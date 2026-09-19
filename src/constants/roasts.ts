export const DAILY_ROASTS = [
  "4 hours on TikTok? Your attention span is officially shorter than a goldfish's.",
  "You've spent more time on Instagram today than you have on your own life goals. Congrats.",
  "3 hours of YouTube. You didn't even finish ONE video, did you?",
  "Your phone's battery is more tired than your ambitions.",
  "Screen time report: You unlocked your phone 87 times. Your ex didn't even text back once.",
  "6 hours of scrolling. You could have learned a language. You chose memes. Bold choice.",
  "Your screen time is the only thing in your life that's consistently going up.",
];

export const getDailyRoast = (): string => {
  const dayIndex = new Date().getDay();
  return DAILY_ROASTS[dayIndex % DAILY_ROASTS.length];
};
