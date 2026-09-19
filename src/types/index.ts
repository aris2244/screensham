export type ScreenTimeOption = 'under2' | '2to4' | '4to6' | '6plus';

export type NemesisApp = 'instagram' | 'tiktok' | 'youtube' | 'snapchat' | 'twitter';

/** Blocked app with per-app daily limit (sum <= dailyAllowanceMinutes). */
export interface BlockedApp {
  packageName: string;
  appName: string;
  limitMinutes: number;
}

export interface UserProfile {
  name: string;
  goal: string;
  seriousness: number;
  currentScreenTime: ScreenTimeOption;
  usesPhoneForWork: boolean;
  goesOutSaturday: boolean;
  nemesisApp: NemesisApp;
  dailyAllowanceMinutes: number;
  onboardingComplete: boolean;
  /** False until the post-onboarding permission walkthrough is finished. */
  permissionsSetupComplete?: boolean;
  createdAt: string;
}
