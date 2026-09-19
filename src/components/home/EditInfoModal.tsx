import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { BlockedApp, UserProfile } from '../../types';
import { syncWatchdogAllowance } from '../../utils/watchdog';

interface Props {
  visible: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSaved: (profile: UserProfile, blockedApps?: BlockedApp[]) => void;
  onBlockedAppsSave?: (apps: BlockedApp[]) => boolean | Promise<boolean>;
}

function seriousnessReaction(n: number): string {
  if (n <= 2) return "We'll take it easy on you. For now.";
  if (n <= 4) return 'Casual mode. Limits will be generous.';
  if (n <= 6) return 'Motivated. Solid middle ground.';
  if (n <= 8) return 'Serious. Limits will tighten up.';
  if (n === 9) return 'No mercy incoming.';
  return 'Maximum discipline. You asked for this.';
}

export default function EditInfoModal({
  visible,
  profile,
  onClose,
  onSaved,
  onBlockedAppsSave,
}: Props) {
  const [name, setName] = useState(profile.name);
  const [goal, setGoal] = useState(profile.goal);
  const [seriousness, setSeriousness] = useState(profile.seriousness);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(profile.name);
    setGoal(profile.goal);
    setSeriousness(profile.seriousness);
  }, [visible, profile]);

  const canSave = name.trim().length >= 2 && goal.trim().length >= 3;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const seriousnessChanged = seriousness !== profile.seriousness;
      const nextAllowance = seriousnessChanged
        ? calculateDailyAllowance({ ...profile, seriousness })
        : profile.dailyAllowanceMinutes;

      const updated: UserProfile = {
        ...profile,
        name: name.trim(),
        goal: goal.trim(),
        seriousness,
        dailyAllowanceMinutes: nextAllowance,
      };

      await saveUserProfile(updated);

      let blockedApps: BlockedApp[] | undefined;
      if (seriousnessChanged && nextAllowance < profile.dailyAllowanceMinutes) {
        const current = await getBlockedApps();
        const fitted = fitBlockedAppsToAllowance(current, nextAllowance);
        const changed = fitted.some(
          (a, i) => a.limitMinutes !== current[i]?.limitMinutes,
        );
        if (changed) {
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
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.topBar}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.title}>Edit Info</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave || saving}
              activeOpacity={0.7}
            >
              <Text style={[s.saveText, (!canSave || saving) && s.saveTextDisabled]}>
                {saving ? '…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.label}>NAME</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={C.grayDark}
              autoCapitalize="words"
              maxLength={40}
            />

            <Text style={s.label}>GOAL</Text>
            <TextInput
              style={s.input}
              value={goal}
              onChangeText={setGoal}
              placeholder="What are you working toward?"
              placeholderTextColor={C.grayDark}
              maxLength={80}
            />

            <Text style={s.label}>SERIOUSNESS</Text>
            <Text style={s.hint}>How hard should we push you? (1–10)</Text>
            <View style={s.numberGrid}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[s.numberCell, seriousness === n && s.numberCellSelected]}
                  onPress={() => setSeriousness(n)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      s.numberCellText,
                      seriousness === n && s.numberCellTextSelected,
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.reaction}>{seriousnessReaction(seriousness)}</Text>
            {seriousness !== profile.seriousness && (
              <Text style={s.allowanceNote}>
                Changing seriousness will recalculate your daily limit.
              </Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
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
  label: {
    color: C.grayDark,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
  },
  hint: { color: C.gray, fontSize: 13, marginBottom: 14 },
  input: {
    backgroundColor: C.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    color: C.white,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  numberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  numberCell: {
    width: '17%',
    minWidth: 52,
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberCellSelected: {
    backgroundColor: C.white,
    borderColor: C.white,
  },
  numberCellText: { color: C.gray, fontSize: 18, fontWeight: '700' },
  numberCellTextSelected: { color: C.bg },
  reaction: {
    color: C.gray,
    fontSize: 13,
    marginTop: 14,
    lineHeight: 19,
  },
  allowanceNote: {
    color: '#f59e0b',
    fontSize: 12,
    marginTop: 10,
    fontWeight: '600',
  },
});
