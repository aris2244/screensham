import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../constants/colors';
import { calculateDailyAllowance } from '../../logic/calculateAllowance';
import {
  fitBlockedAppsToAllowance,
  getBlockedApps,
  saveBlockedApps,
} from '../../storage/blockedAppsStorage';
import { saveUserProfile } from '../../storage/userProfile';
import { BlockedApp, ScreenTimeOption, UserProfile } from '../../types';
import { syncWatchdogAllowance } from '../../utils/watchdog';

interface Props {
  visible: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSaved: (profile: UserProfile, blockedApps?: BlockedApp[]) => void;
  onBlockedAppsSave?: (apps: BlockedApp[]) => boolean | Promise<boolean>;
}

const SCREEN_TIME_OPTIONS: { key: ScreenTimeOption; label: string; sub: string }[] = [
  { key: 'under2', label: 'Under 2h', sub: 'The enlightened one' },
  { key: '2to4', label: '2 – 4h', sub: 'Borderline acceptable' },
  { key: '4to6', label: '4 – 6h', sub: 'Red flag territory' },
  { key: '6plus', label: '6h+', sub: 'We need to talk' },
];

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function AdjustDailyLimitModal({
  visible,
  profile,
  onClose,
  onSaved,
  onBlockedAppsSave,
}: Props) {
  const [screenTime, setScreenTime] = useState<ScreenTimeOption>(profile.currentScreenTime);
  const [usesPhoneForWork, setUsesPhoneForWork] = useState(profile.usesPhoneForWork);
  const [goesOutSaturday, setGoesOutSaturday] = useState(profile.goesOutSaturday);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setScreenTime(profile.currentScreenTime);
    setUsesPhoneForWork(profile.usesPhoneForWork);
    setGoesOutSaturday(profile.goesOutSaturday);
  }, [visible, profile]);

  const previewAllowance = useMemo(
    () =>
      calculateDailyAllowance({
        ...profile,
        currentScreenTime: screenTime,
        usesPhoneForWork,
      }),
    [profile, screenTime, usesPhoneForWork],
  );

  const hasChanges =
    screenTime !== profile.currentScreenTime ||
    usesPhoneForWork !== profile.usesPhoneForWork ||
    goesOutSaturday !== profile.goesOutSaturday;

  const handleSave = async () => {
    if (!hasChanges || saving) return;
    setSaving(true);
    try {
      const updated: UserProfile = {
        ...profile,
        currentScreenTime: screenTime,
        usesPhoneForWork,
        goesOutSaturday,
        dailyAllowanceMinutes: previewAllowance,
      };

      await saveUserProfile(updated);

      let blockedApps: BlockedApp[] | undefined;
      if (previewAllowance < profile.dailyAllowanceMinutes) {
        const current = await getBlockedApps();
        const fitted = fitBlockedAppsToAllowance(current, previewAllowance);
        if (fitted.some((a, i) => a.limitMinutes !== current[i]?.limitMinutes)) {
          await saveBlockedApps(fitted);
          blockedApps = fitted;
          await onBlockedAppsSave?.(fitted);
        }
      }

      await syncWatchdogAllowance().catch(() => {});
      onSaved(updated, blockedApps);
      onClose();
    } catch {
      Alert.alert('Could not save', 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.title}>Daily Limit</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!hasChanges || saving}
            activeOpacity={0.7}
          >
            <Text style={[s.saveText, (!hasChanges || saving) && s.saveTextDisabled]}>
              {saving ? '…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.previewCard}>
            <Text style={s.previewLabel}>Your new daily limit</Text>
            <Text style={s.previewValue}>{formatMinutes(previewAllowance)}</Text>
            {previewAllowance !== profile.dailyAllowanceMinutes && (
              <Text style={s.previewDelta}>
                Was {formatMinutes(profile.dailyAllowanceMinutes)}
              </Text>
            )}
          </View>

          <Text style={s.sectionLabel}>DAILY SCREEN TIME</Text>
          <Text style={s.hint}>How much do you usually use your phone?</Text>
          <View style={s.optionGroup}>
            {SCREEN_TIME_OPTIONS.map((opt, i) => (
              <View key={opt.key}>
                <TouchableOpacity
                  style={[s.optionRow, screenTime === opt.key && s.optionRowSelected]}
                  onPress={() => setScreenTime(opt.key)}
                  activeOpacity={0.75}
                >
                  <View>
                    <Text
                      style={[
                        s.optionLabel,
                        screenTime === opt.key && s.optionLabelSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <Text style={s.optionSub}>{opt.sub}</Text>
                  </View>
                  {screenTime === opt.key && <Text style={s.check}>✓</Text>}
                </TouchableOpacity>
                {i < SCREEN_TIME_OPTIONS.length - 1 && <View style={s.separator} />}
              </View>
            ))}
          </View>

          <Text style={s.sectionLabel}>EXTRAS</Text>
          <View style={s.toggleGroup}>
            <View style={s.toggleRow}>
              <View style={s.toggleTextWrap}>
                <Text style={s.toggleLabel}>Use phone for work</Text>
                <Text style={s.toggleSub}>Adds 60 min to your daily limit</Text>
              </View>
              <Switch
                value={usesPhoneForWork}
                onValueChange={setUsesPhoneForWork}
                trackColor={{ false: C.grayDeep, true: C.white }}
                thumbColor={usesPhoneForWork ? C.bg : C.gray}
              />
            </View>
            <View style={s.separator} />
            <View style={s.toggleRow}>
              <View style={s.toggleTextWrap}>
                <Text style={s.toggleLabel}>Go out on Saturdays</Text>
                <Text style={s.toggleSub}>+60 min bonus on Saturdays only</Text>
              </View>
              <Switch
                value={goesOutSaturday}
                onValueChange={setGoesOutSaturday}
                trackColor={{ false: C.grayDeep, true: C.white }}
                thumbColor={goesOutSaturday ? C.bg : C.gray}
              />
            </View>
          </View>

          {previewAllowance < profile.dailyAllowanceMinutes && (
            <Text style={s.warning}>
              Lowering your limit will shrink blocked-app limits to fit.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: { color: C.white, fontSize: 17, fontWeight: '800' },
  cancelText: { color: C.gray, fontSize: 16, fontWeight: '600', minWidth: 60 },
  saveText: { color: C.white, fontSize: 16, fontWeight: '700', minWidth: 60, textAlign: 'right' },
  saveTextDisabled: { opacity: 0.35 },
  previewCard: {
    backgroundColor: C.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 28,
  },
  previewLabel: { color: C.gray, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  previewValue: { color: C.white, fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  previewDelta: { color: C.grayDark, fontSize: 12, marginTop: 8 },
  sectionLabel: {
    color: C.grayDark,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  hint: { color: C.gray, fontSize: 13, marginBottom: 12, paddingHorizontal: 4 },
  optionGroup: {
    backgroundColor: C.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 24,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  optionRowSelected: { backgroundColor: 'rgba(255,255,255,0.04)' },
  optionLabel: { color: C.offWhite, fontSize: 15, fontWeight: '600' },
  optionLabelSelected: { color: C.white },
  optionSub: { color: C.grayDark, fontSize: 12, marginTop: 2 },
  check: { color: C.white, fontSize: 16, fontWeight: '800' },
  separator: { height: 1, backgroundColor: C.border, marginLeft: 16 },
  toggleGroup: {
    backgroundColor: C.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  toggleTextWrap: { flex: 1 },
  toggleLabel: { color: C.offWhite, fontSize: 15, fontWeight: '600' },
  toggleSub: { color: C.grayDark, fontSize: 12, marginTop: 2 },
  warning: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 16,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
});
