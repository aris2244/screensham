import { Platform } from 'react-native';
import {
  getNotificationPermissionGranted,
  openNotificationSettings,
  requestNotificationPermissions,
} from '../utils/notifications';
import {
  hasOverlayPermission,
  hasUsagePermission,
  openOverlaySettings,
  openUsageAccessSettings,
} from '../utils/usageStats';

export type PermissionSetupStep = {
  id: string;
  icon: string;
  title: string;
  instructions: string[];
  checkGranted: () => Promise<boolean>;
  openSettings: () => Promise<void>;
};

export const PERMISSION_SETUP_STEPS: PermissionSetupStep[] =
  Platform.OS === 'android'
    ? [
        {
          id: 'usage',
          icon: '📊',
          title: 'Usage Access',
          instructions: [
            'ScreenSham needs to see how long you use each app.',
            'In Settings, find ScreenSham in the list.',
            'Turn on Allow usage access.',
          ],
          checkGranted: hasUsagePermission,
          openSettings: openUsageAccessSettings,
        },
        {
          id: 'notifications',
          icon: '🔔',
          title: 'Notifications',
          instructions: [
            'ScreenSham sends roast alerts when you scroll too long.',
            'Allow notifications when asked.',
            'If you denied before, enable them in ScreenSham app settings.',
          ],
          checkGranted: getNotificationPermissionGranted,
          openSettings: async () => {
            const granted = await requestNotificationPermissions();
            if (!granted) await openNotificationSettings();
          },
        },
        {
          id: 'overlay',
          icon: '🔒',
          title: 'Display over other apps',
          instructions: [
            'ScreenSham shows a lock screen when a blocked app hits its limit.',
            'Open ScreenSham in app settings.',
            'Enable Display over other apps (or Display pop-up windows).',
          ],
          checkGranted: hasOverlayPermission,
          openSettings: openOverlaySettings,
        },
      ]
    : [];
