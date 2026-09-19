import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { ALL_NEMESIS_APPS, NEMESIS_LABELS } from '../../constants/nemesisLabels';
import { ANDROID_PACKAGE_NAMES } from '../../constants/packageNames';
import { C } from '../../constants/colors';
import { tickHaptic } from '../../utils/haptics';
import {
  blockedAppFromPreset,
  canAddMinutes,
  isPackageBlocked,
  totalAllocatedMinutes,
} from '../../storage/blockedAppsStorage';
import { BlockedApp, NemesisApp } from '../../types';
import { SubscriptionTier } from '../../constants/subscriptionConfig';
import { canAddBlockedApp } from '../../storage/subscriptionStorage';
import {
  getInstalledAppsForBlocking,
  InstalledApp,
} from '../../utils/usageStats';

// ─── Semicircle selector ───────────────────────────────────────────────────────

const ICON_CENTER = 52;
const ICON_PEEK = 44;

function AppIconBubble({
  app,
  iconMap,
  size,
}: {
  app: BlockedApp;
  iconMap: Record<string, string | null>;
  size: number;
}) {
  const iconBase64 = iconMap[app.packageName];
  const radius = Math.round(size * 0.22);

  if (iconBase64) {
    return (
      <Image
        source={{ uri: `data:image/png;base64,${iconBase64}` }}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  return (
    <View style={[selector.iconFallback, { width: size, height: size, borderRadius: radius }]}>
      <Text style={selector.iconFallbackText}>
        {app.appName.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

interface SelectorProps {
  apps: BlockedApp[];
  selectedIndex: number;
  iconMap: Record<string, string | null>;
  onIndexChange: (index: number) => void;
  onPress: () => void;
}

function AppsBlockedSelector({
  apps,
  selectedIndex,
  iconMap,
  onIndexChange,
  onPress,
}: SelectorProps) {
  const indexRef = useRef(selectedIndex);
  const appsRef = useRef(apps);
  const gestureStartIdx = useRef(0);
  const lastEmittedIdx = useRef(0);

  React.useEffect(() => {
    indexRef.current = selectedIndex;
  }, [selectedIndex]);

  React.useEffect(() => {
    appsRef.current = apps;
  }, [apps]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        appsRef.current.length > 1 &&
        Math.abs(g.dx) > 6 &&
        Math.abs(g.dx) > Math.abs(g.dy),
      onMoveShouldSetPanResponderCapture: (_, g) =>
        appsRef.current.length > 1 &&
        Math.abs(g.dx) > 6 &&
        Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        gestureStartIdx.current = indexRef.current;
        lastEmittedIdx.current = indexRef.current;
      },
      onPanResponderMove: (_, g) => {
        const len = appsRef.current.length;
        if (len <= 1) return;

        const steps = Math.round(-g.dx / 48);
        const next = Math.max(0, Math.min(len - 1, gestureStartIdx.current + steps));
        if (next !== lastEmittedIdx.current) {
          tickHaptic();
          lastEmittedIdx.current = next;
          onIndexChange(next);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 12 && Math.abs(g.dy) < 12) {
          onPress();
        }
      },
    }),
  ).current;

  const current = apps[selectedIndex];
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex < apps.length - 1;
  const prevApp = hasPrev ? apps[selectedIndex - 1] : null;
  const nextApp = hasNext ? apps[selectedIndex + 1] : null;

  return (
    <View style={selector.container} {...panResponder.panHandlers}>
      <Text style={selector.eyebrow}>APPS BLOCKED</Text>

      <View style={selector.stage}>
        <Svg width="100%" height={40} viewBox="0 0 300 40" style={selector.arc}>
          <Path
            d="M 20 34 A 130 26 0 0 0 280 34"
            stroke={C.border}
            strokeWidth={2}
            fill="none"
          />
          <Path
            d="M 46 34 A 104 20 0 0 0 254 34"
            stroke="#ef4444"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>

        {hasPrev && prevApp && (
          <View style={[selector.sidePeek, selector.leftPeek]} pointerEvents="none">
            <View style={selector.leftPeekClip}>
              <AppIconBubble app={prevApp} iconMap={iconMap} size={ICON_PEEK} />
            </View>
          </View>
        )}

        {current ? (
          <View style={selector.centerIcon} pointerEvents="none">
            <AppIconBubble app={current} iconMap={iconMap} size={ICON_CENTER} />
          </View>
        ) : (
          <View style={selector.centerIcon} pointerEvents="none">
            <View style={[selector.iconFallback, { width: ICON_CENTER, height: ICON_CENTER, borderRadius: 12 }]}>
              <Text style={selector.iconFallbackText}>?</Text>
            </View>
          </View>
        )}

        {hasNext && nextApp && (
          <View style={[selector.sidePeek, selector.rightPeek]} pointerEvents="none">
            <AppIconBubble app={nextApp} iconMap={iconMap} size={ICON_PEEK} />
          </View>
        )}
      </View>

      {current && (
        <Text style={selector.limit}>
          {current.limitMinutes}m limit · tap to edit
        </Text>
      )}
      {apps.length > 1 && (
        <Text style={selector.hint}>← swipe →</Text>
      )}
    </View>
  );
}

// ─── Vertical minute wheel ─────────────────────────────────────────────────────

interface WheelProps {
  minutes: number;
  maxMinutes: number;
  onMinutesChange: (minutes: number) => void;
}

function LimitMinuteWheel({ minutes, maxMinutes, onMinutesChange }: WheelProps) {
  const startMinutes = useRef(minutes);
  const appliedSteps = useRef(0);
  const lastTickMinute = useRef(minutes);
  const minutesRef = useRef(minutes);

  React.useEffect(() => {
    minutesRef.current = minutes;
  }, [minutes]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startMinutes.current = minutesRef.current;
        appliedSteps.current = 0;
        lastTickMinute.current = minutesRef.current;
      },
      onPanResponderMove: (_, g) => {
        const speed = Math.abs(g.vy);
        const pxPerMinute = Math.max(6, Math.min(34, 26 - speed * 2.2));
        const steps = Math.round(-g.dy / pxPerMinute);
        if (steps === appliedSteps.current) return;

        appliedSteps.current = steps;
        const next = Math.max(1, Math.min(maxMinutes, startMinutes.current + steps));
        if (next !== lastTickMinute.current) {
          tickHaptic();
          lastTickMinute.current = next;
        }
        onMinutesChange(next);
      },
      onPanResponderRelease: () => {
        appliedSteps.current = 0;
      },
    }),
  ).current;

  const showBelow = minutes < maxMinutes;
  const showAbove = minutes > 1;

  return (
    <View style={wheel.container} {...panResponder.panHandlers}>
      <Text style={[wheel.adjacent, !showAbove && wheel.adjacentHidden]}>
        {showAbove ? `${minutes - 1}m` : ' '}
      </Text>
      <Text style={wheel.value}>{minutes}m</Text>
      <Text style={[wheel.adjacent, !showBelow && wheel.adjacentHidden]}>
        {showBelow ? `${minutes + 1}m` : ' '}
      </Text>
    </View>
  );
}

// ─── Installed apps picker ─────────────────────────────────────────────────────

interface PickerProps {
  visible: boolean;
  apps: InstalledApp[];
  blockedPackages: Set<string>;
  onSelect: (app: InstalledApp) => void;
  onClose: () => void;
}

function InstalledAppsPicker({
  visible,
  apps,
  blockedPackages,
  onSelect,
  onClose,
}: PickerProps) {
  const [query, setQuery] = useState('');

  React.useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const available = apps.filter((app) => {
    if (blockedPackages.has(app.packageName)) return false;
    if (!query.trim()) return true;
    return app.appName.toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={picker.container} edges={['top', 'left', 'right']}>
        <View style={picker.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={picker.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={picker.title}>Choose App</Text>
          <View style={picker.headerSpacer} />
        </View>

        <TextInput
          style={picker.search}
          placeholder="Search your apps..."
          placeholderTextColor={C.grayDark}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />

        <ScrollView
          style={picker.scroll}
          contentContainerStyle={picker.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {available.length === 0 ? (
            <Text style={picker.empty}>
              {query.trim() ? 'No apps match your search.' : 'No more apps to add.'}
            </Text>
          ) : (
            available.map((app) => (
              <TouchableOpacity
                key={app.packageName}
                style={picker.row}
                onPress={() => onSelect(app)}
                activeOpacity={0.75}
              >
                {app.iconBase64 ? (
                  <Image
                    source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                    style={picker.icon}
                  />
                ) : (
                  <View style={picker.iconFallback} />
                )}
                <View style={picker.rowText}>
                  <Text style={picker.appName}>{app.appName}</Text>
                  <Text style={picker.pkg} numberOfLines={1}>{app.packageName}</Text>
                </View>
                <Text style={picker.addMark}>+</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Limits modal ──────────────────────────────────────────────────────────────

interface ModalProps {
  visible: boolean;
  apps: BlockedApp[];
  dailyAllowanceMinutes: number;
  subscriptionTier: SubscriptionTier;
  onUpgradeRequired: () => void;
  onClose: () => void;
  onSave: (apps: BlockedApp[]) => void;
}

function BlockedAppsModal({
  visible,
  apps,
  dailyAllowanceMinutes,
  subscriptionTier,
  onUpgradeRequired,
  onClose,
  onSave,
}: ModalProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<BlockedApp[]>(apps);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const footerBottomPad = insets.bottom + 34;

  React.useEffect(() => {
    if (!visible) {
      setShowPicker(false);
      return;
    }
    setDraft(apps);
    if (Platform.OS !== 'android') return;

    setLoadingInstalled(true);
    getInstalledAppsForBlocking()
      .then(setInstalledApps)
      .catch(() => setInstalledApps([]))
      .finally(() => setLoadingInstalled(false));
  }, [visible, apps]);

  const allocated = totalAllocatedMinutes(draft);
  const remaining = dailyAllowanceMinutes - allocated;
  const installedPackageSet = new Set(installedApps.map((a) => a.packageName));
  const blockedPackageSet = new Set(draft.map((a) => a.packageName));

  const updateLimit = (packageName: string, nextMinutes: number) => {
    const clamped = Math.max(1, Math.round(nextMinutes));
    setDraft((prev) => {
      const next = prev.map((a) =>
        a.packageName === packageName
          ? { ...a, limitMinutes: clamped }
          : a,
      );
      if (totalAllocatedMinutes(next) > dailyAllowanceMinutes) return prev;
      return next;
    });
  };

  const removeApp = (packageName: string) => {
    setDraft((prev) => prev.filter((a) => a.packageName !== packageName));
  };

  const tryAddApp = (entry: BlockedApp) => {
    if (isPackageBlocked(draft, entry.packageName)) return;
    if (!canAddBlockedApp(draft.length, subscriptionTier)) {
      Alert.alert(
        'Pro required',
        'Free plan includes 1 blocked app. Upgrade to Pro for unlimited apps.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'See Pro', onPress: onUpgradeRequired },
        ],
      );
      return;
    }
    if (!canAddMinutes(draft, dailyAllowanceMinutes, 1)) {
      Alert.alert(
        'Limit reached',
        `Total blocked time cannot exceed ${dailyAllowanceMinutes} minutes today.`,
      );
      return;
    }
    setDraft((prev) => [...prev, entry]);
  };

  const addPresetApp = (nemesis: NemesisApp) => {
    tryAddApp(blockedAppFromPreset(nemesis, 1));
  };

  const addCustomApp = (app: InstalledApp) => {
    tryAddApp({
      packageName: app.packageName,
      appName: app.appName,
      limitMinutes: 1,
    });
    setShowPicker(false);
  };

  const handleSave = () => {
    if (draft.length === 0) {
      Alert.alert('Add at least one app', 'You need at least one blocked app.');
      return;
    }
    onSave(draft);
    onClose();
  };

  const availablePresets = ALL_NEMESIS_APPS.filter((nemesis) => {
    const pkg = ANDROID_PACKAGE_NAMES[nemesis];
    return installedPackageSet.has(pkg) && !isPackageBlocked(draft, pkg);
  });

  const hasOtherApps = installedApps.some(
    (app) => !blockedPackageSet.has(app.packageName),
  );

  const showAddSection = loadingInstalled || availablePresets.length > 0 || hasOtherApps;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={modal.container} edges={['top', 'left', 'right']}>
        <View style={modal.header}>
          <Text style={modal.title}>Blocked Apps</Text>
          <TouchableOpacity
            style={modal.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={modal.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={modal.subtitle}>
          Allocated {allocated}m of {dailyAllowanceMinutes}m · {remaining}m left
        </Text>

        <ScrollView
          style={modal.scroll}
          contentContainerStyle={modal.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {draft.map((item) => (
            <View key={item.packageName} style={modal.row}>
              <View style={modal.rowLeft}>
                <Text style={modal.appLabel}>{item.appName}</Text>
                <Text style={modal.pkg} numberOfLines={1}>{item.packageName}</Text>
              </View>

              <LimitMinuteWheel
                minutes={item.limitMinutes}
                maxMinutes={remaining + item.limitMinutes}
                onMinutesChange={(next) => updateLimit(item.packageName, next)}
              />

              <TouchableOpacity
                onPress={() => removeApp(item.packageName)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={modal.remove}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {showAddSection && (
            <View style={modal.addSection}>
              <Text style={modal.addLabel}>Add app</Text>
              {loadingInstalled ? (
                <ActivityIndicator color={C.gray} style={modal.loading} />
              ) : (
                <View style={modal.addRow}>
                  {availablePresets.map((nemesis) => (
                    <TouchableOpacity
                      key={nemesis}
                      style={modal.addChip}
                      onPress={() => addPresetApp(nemesis)}
                    >
                      <Text style={modal.addChipText}>+ {NEMESIS_LABELS[nemesis]}</Text>
                    </TouchableOpacity>
                  ))}
                  {hasOtherApps && (
                    <TouchableOpacity
                      style={modal.otherChip}
                      onPress={() => setShowPicker(true)}
                    >
                      <Text style={modal.otherChipText}>+ Other apps…</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View style={[modal.footer, { paddingBottom: footerBottomPad }]}>
          <TouchableOpacity style={modal.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={modal.saveBtnText}>Save & Apply</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <InstalledAppsPicker
        visible={showPicker}
        apps={installedApps}
        blockedPackages={blockedPackageSet}
        onSelect={addCustomApp}
        onClose={() => setShowPicker(false)}
      />
    </Modal>
  );
}

// ─── Public component ──────────────────────────────────────────────────────────

interface Props {
  apps: BlockedApp[];
  dailyAllowanceMinutes: number;
  subscriptionTier: SubscriptionTier;
  onUpgradeRequired: () => void;
  onSave: (apps: BlockedApp[]) => void;
}

export default function AppsBlockedButton({
  apps,
  dailyAllowanceMinutes,
  subscriptionTier,
  onUpgradeRequired,
  onSave,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [iconMap, setIconMap] = useState<Record<string, string | null>>({});

  React.useEffect(() => {
    if (selectedIndex >= apps.length) {
      setSelectedIndex(Math.max(0, apps.length - 1));
    }
  }, [apps.length, selectedIndex]);

  React.useEffect(() => {
    if (Platform.OS !== 'android' || apps.length === 0) {
      setIconMap({});
      return;
    }

    getInstalledAppsForBlocking()
      .then((list) => {
        const map: Record<string, string | null> = {};
        for (const entry of list) {
          map[entry.packageName] = entry.iconBase64;
        }
        setIconMap(map);
      })
      .catch(() => setIconMap({}));
  }, [apps]);

  const safeIndex = apps.length === 0
    ? 0
    : Math.min(selectedIndex, apps.length - 1);

  return (
    <View style={styles.wrap}>
      <AppsBlockedSelector
        apps={apps}
        selectedIndex={safeIndex}
        iconMap={iconMap}
        onIndexChange={setSelectedIndex}
        onPress={() => setShowModal(true)}
      />

      <BlockedAppsModal
        visible={showModal}
        apps={apps}
        dailyAllowanceMinutes={dailyAllowanceMinutes}
        subscriptionTier={subscriptionTier}
        onUpgradeRequired={() => {
          setShowModal(false);
          onUpgradeRequired();
        }}
        onClose={() => setShowModal(false)}
        onSave={onSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 24, marginBottom: 32 },
});

const selector = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: C.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 16,
    minHeight: 120,
  },
  eyebrow: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    marginBottom: 6,
  },
  stage: {
    width: '100%',
    height: 96,
    alignItems: 'center',
    marginBottom: 4,
  },
  arc: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 1,
    pointerEvents: 'none',
  },
  centerIcon: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    zIndex: 3,
  },
  sidePeek: {
    position: 'absolute',
    top: 38,
    width: 30,
    height: 44,
    overflow: 'hidden',
    zIndex: 2,
  },
  leftPeek: {
    left: 6,
  },
  leftPeekClip: {
    width: 44,
    marginLeft: -14,
  },
  rightPeek: {
    right: 6,
    alignItems: 'flex-end',
  },
  iconFallback: {
    backgroundColor: C.grayDeep,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFallbackText: {
    color: C.white,
    fontSize: 18,
    fontWeight: '800',
  },
  limit: {
    color: C.gray,
    fontSize: 11,
    marginTop: 2,
  },
  hint: {
    color: C.grayDark,
    fontSize: 9,
    marginTop: 4,
    letterSpacing: 0.5,
  },
});

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
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
  subtitle: {
    color: C.gray,
    fontSize: 13,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 12,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  rowLeft: { flex: 1 },
  appLabel: { color: C.white, fontSize: 15, fontWeight: '700' },
  pkg: { color: C.grayDark, fontSize: 10, marginTop: 2 },
  remove: { color: '#ef4444', fontSize: 16, fontWeight: '700' },
  addSection: { marginTop: 4 },
  addLabel: { color: C.grayDark, fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addChip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addChipText: { color: C.gray, fontSize: 13, fontWeight: '600' },
  otherChip: {
    borderWidth: 1,
    borderColor: '#7f1d1d',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(127,29,29,0.15)',
  },
  otherChipText: { color: '#fca5a5', fontSize: 13, fontWeight: '700' },
  loading: { alignSelf: 'flex-start', marginTop: 4 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  saveBtn: {
    backgroundColor: '#7f1d1d',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: C.white, fontSize: 15, fontWeight: '700' },
});

const picker = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  back: { color: C.gray, fontSize: 15, fontWeight: '600', minWidth: 72 },
  title: { color: C.white, fontSize: 17, fontWeight: '800' },
  headerSpacer: { minWidth: 72 },
  search: {
    marginHorizontal: 24,
    marginTop: 14,
    marginBottom: 8,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.white,
    fontSize: 15,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },
  empty: { color: C.grayDark, fontSize: 14, marginTop: 24, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  icon: { width: 40, height: 40, borderRadius: 10 },
  iconFallback: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: C.grayDeep,
    borderWidth: 1,
    borderColor: C.border,
  },
  rowText: { flex: 1 },
  appName: { color: C.white, fontSize: 15, fontWeight: '700' },
  pkg: { color: C.grayDark, fontSize: 10, marginTop: 2 },
  addMark: { color: '#ef4444', fontSize: 22, fontWeight: '700' },
});

const wheel = StyleSheet.create({
  container: {
    width: 52,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  adjacent: {
    color: C.grayDark,
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 11,
  },
  adjacentHidden: {
    opacity: 0,
  },
  value: {
    color: C.white,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 17,
  },
});
