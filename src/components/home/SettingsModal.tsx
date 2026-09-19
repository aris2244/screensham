import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../constants/colors';
import { clearUserProfile } from '../../storage/userProfile';
import { BlockedApp, UserProfile } from '../../types';
import AdjustDailyLimitModal from './AdjustDailyLimitModal';
import EditInfoModal from './EditInfoModal';
import MonthlyOverviewModal from './MonthlyOverviewModal';
import ProPaywallModal from './ProPaywallModal';

interface Props {
  visible: boolean;
  profile: UserProfile;
  liveTodayMinutes: number;
  allowedMinutes: number;
  onClose: () => void;
  onReset: () => void;
  onProfileUpdate: (profile: UserProfile) => void;
  onBlockedAppsUpdate?: (apps: BlockedApp[]) => void;
  onBlockedAppsSave?: (apps: BlockedApp[]) => boolean | Promise<boolean>;
}

// ─── Reusable row components ──────────────────────────────────────────────────

interface RowProps {
  icon: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  disabled?: boolean;
  badge?: string;
  danger?: boolean;
}

function SettingsRow({ icon, label, sublabel, onPress, disabled, badge, danger }: RowProps) {
  return (
    <TouchableOpacity
      style={[s.row, disabled && s.rowDisabled]}
      onPress={onPress}
      activeOpacity={disabled ? 1 : 0.65}
      disabled={disabled}
    >
      <View style={s.rowLeft}>
        <View style={[s.iconBox, disabled && s.iconBoxDisabled]}>
          <Text style={s.iconText}>{icon}</Text>
        </View>
        <View>
          <Text style={[s.rowLabel, disabled && s.rowLabelDisabled, danger && s.dangerText]}>
            {label}
          </Text>
          {sublabel ? (
            <Text style={s.rowSublabel}>{sublabel}</Text>
          ) : null}
        </View>
      </View>
      <View style={s.rowRight}>
        {badge ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{badge}</Text>
          </View>
        ) : null}
        {!disabled && <Text style={[s.arrow, danger && s.dangerText]}>›</Text>}
      </View>
    </TouchableOpacity>
  );
}

function SectionLabel({ title }: { title: string }) {
  return <Text style={s.sectionLabel}>{title}</Text>;
}

function Separator() {
  return <View style={s.separator} />;
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function SettingsModal({
  visible,
  profile,
  liveTodayMinutes,
  allowedMinutes,
  onClose,
  onReset,
  onProfileUpdate,
  onBlockedAppsUpdate,
  onBlockedAppsSave,
}: Props) {
  const [showMonthly, setShowMonthly] = useState(false);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [showAdjustLimit, setShowAdjustLimit] = useState(false);
  const [showProPaywall, setShowProPaywall] = useState(false);

  const seriousnessLabel = (n: number) => {
    if (n <= 3) return 'Casual';
    if (n <= 6) return 'Motivated';
    if (n <= 8) return 'Serious';
    return 'No Mercy';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.container} edges={['top', 'left', 'right', 'bottom']}>

        {/* ── Top bar ──────────────────────────────────── */}
        <View style={s.topBar}>
          <Text style={s.title}>Settings</Text>
          <TouchableOpacity
            style={s.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ── Profile Card ─────────────────────────── */}
          <View style={s.profileCard}>
            <View style={s.profileAvatar} />
            <View style={s.profileInfo}>
              <Text style={s.profileName}>{profile.name}</Text>
              <Text style={s.profileGoal} numberOfLines={1}>"{profile.goal}"</Text>
              <View style={s.profileBadgeRow}>
                <View style={s.profileBadge}>
                  <Text style={s.profileBadgeText}>
                    Seriousness {profile.seriousness}/10 · {seriousnessLabel(profile.seriousness)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Section: Stats ───────────────────────── */}
          <SectionLabel title="STATS" />
          <View style={s.group}>
            <SettingsRow
              icon="📅"
              label="Monthly Overview"
              sublabel="See your full month breakdown"
              onPress={() => setShowMonthly(true)}
            />
          </View>

          {/* ── Section: Account ─────────────────────── */}
          <SectionLabel title="ACCOUNT" />
          <View style={s.group}>
            <SettingsRow
              icon="✏️"
              label="Edit Info"
              sublabel="Name, goal, seriousness level"
              onPress={() => setShowEditInfo(true)}
            />
            <Separator />
            <SettingsRow
              icon="⏱️"
              label="Adjust Daily Limit"
              sublabel="Recalculate your allowed screen time"
              onPress={() => setShowAdjustLimit(true)}
            />
          </View>

          {/* ── Section: Subscription ────────────────── */}
          {/* Future: RevenueCat Paywall / Payments */}
          <SectionLabel title="SUBSCRIPTION" />
          <View style={s.group}>
            <SettingsRow
              icon="⭐️"
              label="Manage Subscription"
              onPress={() => setShowProPaywall(true)}
            />
          </View>

          {/* ── Section: Danger Zone ─────────────────── */}
          <SectionLabel title="DANGER ZONE" />
          <View style={s.group}>
            <SettingsRow
              icon="🔄"
              label="Reset Onboarding"
              sublabel="Clear all data and start over"
              danger
              onPress={() =>
                Alert.alert(
                  'Reset everything?',
                  'This will delete your profile and restart the onboarding. This cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reset',
                      style: 'destructive',
                      onPress: async () => {
                        await clearUserProfile();
                        onClose();
                        onReset();
                      },
                    },
                  ],
                )
              }
            />
          </View>

          <Text style={s.version}>ScreenSham · v1.0.0</Text>

        </ScrollView>
      </SafeAreaView>

      <MonthlyOverviewModal
        visible={showMonthly}
        liveTodayMinutes={liveTodayMinutes}
        allowedMinutes={allowedMinutes}
        name={profile.name}
        goal={profile.goal}
        onClose={() => setShowMonthly(false)}
      />

      <EditInfoModal
        visible={showEditInfo}
        profile={profile}
        onClose={() => setShowEditInfo(false)}
        onBlockedAppsSave={onBlockedAppsSave}
        onSaved={(updated, blockedApps) => {
          onProfileUpdate(updated);
          if (blockedApps) onBlockedAppsUpdate?.(blockedApps);
        }}
      />

      <AdjustDailyLimitModal
        visible={showAdjustLimit}
        profile={profile}
        onClose={() => setShowAdjustLimit(false)}
        onBlockedAppsSave={onBlockedAppsSave}
        onSaved={(updated, blockedApps) => {
          onProfileUpdate(updated);
          if (blockedApps) onBlockedAppsUpdate?.(blockedApps);
        }}
      />

      <ProPaywallModal
        visible={showProPaywall}
        onClose={() => setShowProPaywall(false)}
        source="settings"
      />
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll:    { paddingHorizontal: 20, paddingBottom: 48 },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: { color: C.white, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: C.gray, fontSize: 14, fontWeight: '700' },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    marginTop: 20,
    marginBottom: 28,
    gap: 16,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.grayDeep,
    borderWidth: 1,
    borderColor: C.border,
    flexShrink: 0,
  },
  profileInfo:   { flex: 1 },
  profileName:   { color: C.white,   fontSize: 17, fontWeight: '800', marginBottom: 3 },
  profileGoal:   { color: C.gray,    fontSize: 13, fontWeight: '400', marginBottom: 8 },
  profileBadgeRow: { flexDirection: 'row' },
  profileBadge: {
    backgroundColor: C.grayDeep,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  profileBadgeText: { color: C.gray, fontSize: 11, fontWeight: '600' },

  // Section label
  sectionLabel: {
    color: C.grayDark,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
    marginBottom: 10,
    marginTop: 4,
    paddingHorizontal: 4,
  },

  // Group container
  group: {
    backgroundColor: C.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 24,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowDisabled: { opacity: 0.45 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.grayDeep,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxDisabled: { opacity: 0.5 },
  iconText:         { fontSize: 16 },
  rowLabel:         { color: C.offWhite, fontSize: 15, fontWeight: '600' },
  rowLabelDisabled: { color: C.gray },
  rowSublabel:      { color: C.grayDark, fontSize: 12, marginTop: 2 },
  dangerText:       { color: '#ef4444' },

  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow:    { color: C.grayDark, fontSize: 22, fontWeight: '300' },

  badge: {
    backgroundColor: C.grayDeep,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  badgeText: { color: C.grayDark, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  separator: { height: 1, backgroundColor: C.border, marginLeft: 66 },

  version: {
    color: C.grayDark,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
});
