import { ScreenTimeOption, UserProfile } from '../types';

type ProfileInput = Omit<UserProfile, 'dailyAllowanceMinutes' | 'onboardingComplete' | 'createdAt'>;

const BASE_MINUTES: Record<ScreenTimeOption, number> = {
  under2: 90,
  '2to4': 120,
  '4to6': 150,
  '6plus': 180,
};

export function calculateDailyAllowance(profile: ProfileInput): number {
  let minutes = BASE_MINUTES[profile.currentScreenTime];

  if (profile.seriousness === 10)     minutes *= 0.60;
  else if (profile.seriousness >= 8)  minutes *= 0.75;
  else if (profile.seriousness >= 6)  minutes *= 0.88;
  else if (profile.seriousness >= 4)  minutes *= 1.00;
  else                                minutes *= 1.25;

  if (profile.usesPhoneForWork) minutes += 60;

  return Math.max(45, Math.round(minutes));
}

export function getTodayAllowance(profile: UserProfile): number {
  const isSaturday = new Date().getDay() === 6;
  const bonus = isSaturday && profile.goesOutSaturday ? 60 : 0;
  return profile.dailyAllowanceMinutes + bonus;
}
