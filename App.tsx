import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  DeviceEventEmitter,
  Platform,
  View,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getPackageName } from './src/constants/packageNames';
import { getUserProfile, isPermissionsSetupComplete } from './src/storage/userProfile';
import { ensureBlockedApps, getBlockedApps, saveBlockedApps } from './src/storage/blockedAppsStorage';
import OnboardingScreen from './src/screens/OnboardingScreen';
import PermissionSetupScreen from './src/screens/PermissionSetupScreen';
import HomeScreen from './src/screens/HomeScreen';
import { C } from './src/constants/colors';
import { setupNotificationHandler, setupAndroidChannel } from './src/utils/notifications';
import {
  consumePendingFriction,
  finishFrictionLock,
  getLastBlockedPackage,
  grantSessionBypass,
  hasUsagePermission,
  isWatchdogRunning,
  launchApp,
  resetBlockState,
} from './src/utils/usageStats';
import { requestNotificationPermissions } from './src/utils/notifications';
import {
  FRICTION_TRIGGER_EVENT,
  FrictionTriggerPayload,
  startWatchdog,
  stopWatchdog,
} from './src/utils/watchdog';
import { BlockedApp } from './src/types';
import { safeAlert } from './src/utils/safeAlert';
import {
  captureInitialReferralLink,
  captureInstallReferrer,
  listenForReferralLinks,
} from './src/utils/referralAttribution';
import { processReferralAfterOnboarding } from './src/services/referralService';

setupNotificationHandler();

async function waitForWatchdogRunning(maxAttempts = 6, delayMs = 400): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isWatchdogRunning()) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function restartWatchdog(apps: BlockedApp[]): Promise<void> {
  if (Platform.OS !== 'android') return;

  const permitted = await hasUsagePermission();
  if (!permitted) {
    throw new Error('Grant Usage Access in Android settings first.');
  }

  await requestNotificationPermissions().catch(() => {});

  const running = await isWatchdogRunning();
  if (running) await stopWatchdog();
  await startWatchdog(apps);

  const started = await waitForWatchdogRunning();
  if (!started) {
    throw new Error('Watchdog failed to start. Try again or restart the app.');
  }
}

async function resolveBlockedPackage(stored: string): Promise<string> {
  if (stored) return stored;
  const fromNative = await getLastBlockedPackage();
  if (fromNative) return fromNative;
  const apps = await getBlockedApps();
  if (apps.length > 0) return apps[0].packageName;
  const profile = await getUserProfile();
  if (profile) return getPackageName(profile.nemesisApp);
  return '';
}

export default function App() {
  const [isLoading,        setIsLoading]        = useState(true);
  const [onboardingDone,   setOnboardingDone]   = useState(false);
  const [permissionsDone,  setPermissionsDone]  = useState(false);
  const [frictionTrigger,  setFrictionTrigger]  = useState(false);
  const [blockedPackage,   setBlockedPackage]   = useState('');
  const frictionActiveRef = useRef(false);
  const unlockingRef = useRef(false);

  useEffect(() => {
    frictionActiveRef.current = frictionTrigger;
  }, [frictionTrigger]);

  const checkPendingFriction = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    const pending = await consumePendingFriction();
    if (pending) {
      const pkg = await getLastBlockedPackage();
      if (pkg) setBlockedPackage(pkg);
      setFrictionTrigger(true);
    }
  }, []);

  useEffect(() => {
    setupAndroidChannel();
    captureInitialReferralLink().catch(() => {});
    captureInstallReferrer().catch(() => {});
    const removeReferralListener = listenForReferralLinks();

    getUserProfile().then(async (profile) => {
      setOnboardingDone(profile?.onboardingComplete === true);
      setPermissionsDone(profile ? isPermissionsSetupComplete(profile) : false);
      setIsLoading(false);
      if (profile?.onboardingComplete && isPermissionsSetupComplete(profile)) {
        const apps = await ensureBlockedApps(profile);
        try {
          await restartWatchdog(apps);
        } catch {
          // Permissions were set up during onboarding flow.
        }
      }
    });

    checkPendingFriction();

    const eventSub = DeviceEventEmitter.addListener(
      FRICTION_TRIGGER_EVENT,
      (payload?: FrictionTriggerPayload) => {
        if (payload?.packageName) setBlockedPackage(payload.packageName);
        setFrictionTrigger(true);
      },
    );

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkPendingFriction();
        return;
      }

      // Re-arm only if user left without unlocking (not after successful unlock → YouTube).
      if (state === 'background' && frictionActiveRef.current && !unlockingRef.current) {
        setFrictionTrigger(false);
        setBlockedPackage('');
        resetBlockState();
      }
    });

    return () => {
      eventSub.remove();
      appStateSub.remove();
      removeReferralListener();
    };
  }, [checkPendingFriction]);

  const handleFrictionDismiss = async () => {
    setFrictionTrigger(false);
    setBlockedPackage('');
    await resetBlockState();
  };

  const handleFrictionUnlock = async () => {
    if (Platform.OS !== 'android') return;

    unlockingRef.current = true;
    frictionActiveRef.current = false;

    try {
      const fromNative = await getLastBlockedPackage();
      const pkg = fromNative || (await resolveBlockedPackage(blockedPackage));
      if (!pkg) {
        safeAlert('Unlock failed', 'Could not determine which app to open.');
        return;
      }

      await grantSessionBypass(pkg);
      await finishFrictionLock();

      setFrictionTrigger(false);
      setBlockedPackage('');

      try {
        await launchApp(pkg);
      } catch {
        safeAlert(
          'Unlocked',
          'Bypass granted. Open the app manually from your home screen.',
        );
      }
    } catch (e) {
      safeAlert(
        'Unlock failed',
        e instanceof Error ? e.message : 'Could not open the app. Try again.',
      );
    } finally {
      setTimeout(() => {
        unlockingRef.current = false;
      }, 5000);
    }
  };

  const handleOnboardingComplete = async () => {
    await processReferralAfterOnboarding().catch(() => {});
    setOnboardingDone(true);
    setPermissionsDone(false);
  };

  const handlePermissionsComplete = async () => {
    setPermissionsDone(true);
    const profile = await getUserProfile();
    if (profile) {
      const apps = await ensureBlockedApps(profile);
      try {
        await restartWatchdog(apps);
      } catch {
        // User can retry from app after fixing permissions.
      }
    }
  };

  const handleBlockedAppsSave = async (apps: BlockedApp[]): Promise<boolean> => {
    await saveBlockedApps(apps);
    try {
      await restartWatchdog(apps);
      return true;
    } catch (e) {
      safeAlert(
        'Protection not active',
        e instanceof Error
          ? e.message
          : 'Could not start app blocking. Check permissions and try again.',
      );
      return false;
    }
  };

  return (
    <SafeAreaProvider>
      {isLoading ? (
        <View style={styles.splash}>
          <ActivityIndicator color={C.white} />
        </View>
      ) : !onboardingDone ? (
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      ) : !permissionsDone ? (
        <PermissionSetupScreen onComplete={handlePermissionsComplete} />
      ) : (
        <HomeScreen
          onReset={() => {
            setOnboardingDone(false);
            setPermissionsDone(false);
          }}
          frictionTrigger={frictionTrigger}
          blockedPackage={blockedPackage}
          onFrictionDismiss={handleFrictionDismiss}
          onFrictionUnlock={handleFrictionUnlock}
          onBlockedAppsSave={handleBlockedAppsSave}
        />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
