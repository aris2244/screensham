import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../constants/colors';
import { PERMISSION_SETUP_STEPS } from '../constants/permissionSetupSteps';
import { markPermissionsSetupComplete } from '../storage/userProfile';

interface Props {
  onComplete: () => void;
}

export default function PermissionSetupScreen({ onComplete }: Props) {
  const steps = PERMISSION_SETUP_STEPS;
  const totalSteps = steps.length;

  const [stepIndex, setStepIndex] = useState(0);
  const [granted, setGranted] = useState(false);
  const [openedSettings, setOpenedSettings] = useState(false);
  const [returnedWithoutGrant, setReturnedWithoutGrant] = useState(false);
  const stepIndexRef = useRef(stepIndex);
  stepIndexRef.current = stepIndex;

  const step = steps[stepIndex];

  const finishSetup = useCallback(async () => {
    await markPermissionsSetupComplete();
    onComplete();
  }, [onComplete]);

  const advance = useCallback(() => {
    setOpenedSettings(false);
    setReturnedWithoutGrant(false);
    if (stepIndexRef.current >= totalSteps - 1) {
      finishSetup();
      return;
    }
    setStepIndex((i) => i + 1);
    setGranted(false);
  }, [finishSetup, totalSteps]);

  const refreshGranted = useCallback(async () => {
    const current = steps[stepIndexRef.current];
    if (!current) return false;
    const ok = await current.checkGranted().catch(() => false);
    setGranted(ok);
    return ok;
  }, [steps]);

  useEffect(() => {
    if (Platform.OS !== 'android' || totalSteps === 0) {
      finishSetup();
      return;
    }
    setReturnedWithoutGrant(false);
    setOpenedSettings(false);
    refreshGranted();
  }, [stepIndex, refreshGranted, finishSetup, totalSteps]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !openedSettings) return;
      refreshGranted().then((ok) => {
        if (ok) {
          advance();
        } else {
          setReturnedWithoutGrant(true);
          setOpenedSettings(false);
        }
      });
    });
    return () => sub.remove();
  }, [openedSettings, refreshGranted, advance]);

  const handleOk = async () => {
    if (!step) return;

    if (await refreshGranted()) {
      advance();
      return;
    }

    setReturnedWithoutGrant(false);
    setOpenedSettings(true);
    try {
      await step.openSettings();
    } catch {
      setOpenedSettings(false);
    }
  };

  const okLabel = granted
    ? 'Continue'
    : openedSettings || returnedWithoutGrant
      ? 'Open Settings again'
      : 'OK — open Settings';

  if (!step) return null;

  const progressPct = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>

      <View style={styles.content}>
        <Text style={styles.stepNum}>
          Setup {String(stepIndex + 1).padStart(2, '0')} / {String(totalSteps).padStart(2, '0')}
        </Text>
        <Text style={styles.icon}>{step.icon}</Text>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.required}>Required for ScreenSham to work</Text>

        <View style={styles.instructionsBox}>
          {step.instructions.map((line) => (
            <View key={line} style={styles.instructionRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.instructionText}>{line}</Text>
            </View>
          ))}
        </View>

        {granted ? (
          <Text style={styles.grantedText}>✓ Enabled — tap Continue</Text>
        ) : returnedWithoutGrant ? (
          <Text style={styles.pendingText}>
            Not enabled yet. Tap the button below to open Settings again.
          </Text>
        ) : (
          <Text style={styles.pendingText}>
            Tap the button below — you will be taken to Settings to enable this.
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.okBtn} onPress={handleOk} activeOpacity={0.85}>
          <Text style={styles.okBtnText}>{okLabel}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  progressTrack: {
    height: 2,
    backgroundColor: C.borderLight,
    marginHorizontal: 24,
    marginTop: 12,
    borderRadius: 1,
  },
  progressFill: {
    height: 2,
    backgroundColor: C.white,
    borderRadius: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 36,
  },
  stepNum: {
    color: C.grayDark,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 24,
  },
  icon: { fontSize: 40, marginBottom: 16 },
  title: {
    color: C.white,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    marginBottom: 8,
  },
  required: {
    color: C.gray,
    fontSize: 14,
    marginBottom: 28,
  },
  instructionsBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bullet: { color: C.white, fontSize: 16, lineHeight: 22 },
  instructionText: {
    flex: 1,
    color: C.offWhite,
    fontSize: 15,
    lineHeight: 22,
  },
  grantedText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
  },
  pendingText: {
    color: C.gray,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  okBtn: {
    backgroundColor: C.white,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  okBtnText: {
    color: C.bg,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
