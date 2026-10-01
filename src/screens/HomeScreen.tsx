import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  DeviceEventEmitter,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import CircularProgress from '../components/home/CircularProgress';
import AppsBlockedButton from '../components/home/AppsBlockedButton';
import SettingsModal from '../components/home/SettingsModal';
import ProPromoModal from '../components/home/ProPromoModal';
import { C } from '../constants/colors';
import { BLOCK_SCREEN_FAILED_EVENT, syncWatchdogAllowance } from '../utils/watchdog';
import {
  AppUsage,
  getBlockingStatus,
  getTodayAppUsageList,
  isWatchdogRunning,
} from '../utils/usageStats';
import FrictionScreen from './FrictionScreen';
import { getTodayAllowance } from '../logic/calculateAllowance';
import { ensureBlockedApps } from '../storage/blockedAppsStorage';
import { getUserProfile } from '../storage/userProfile';
import {
  DayUsage,
  getWeekDisplayData,
  saveTodayUsageSnapshot,
} from '../storage/weeklyUsageStorage';
import { BlockedApp, UserProfile } from '../types';
import { SubscriptionTier } from '../constants/subscriptionConfig';
import { refreshProFromReferrals } from '../storage/subscriptionStorage';
import ProPaywallModal from '../components/home/ProPaywallModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Fallback shown while real data loads or on iOS/simulator
const FALLBACK_MINUTES = 0;

type DayData = DayUsage;

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getTodayIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatMinutes(mins: number): string {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getProgressColor(progress: number): string {
  if (progress < 0.80) return C.white;
  if (progress < 1.00) return '#f59e0b';
  return '#ef4444';
}

function getRoastText(name: string, goal: string, progress: number, remaining: number): string {
  if (progress < 0.40) {
    return `${name}, you're actually doing okay.\nDon't ruin it.`;
  }
  if (progress < 0.70) {
    return `${formatMinutes(remaining)} left, ${name}.\n"${goal}" is still waiting for you.`;
  }
  if (progress < 0.90) {
    return `${name}. The phone won't build "${goal}".\nYou will. Put it down.`;
  }
  if (progress <= 1.00) {
    return `Almost gone, ${name}. Every minute now is stolen from "${goal}".`;
  }
  return `${name}. "${goal}" called.\nIt said you don't care anymore.`;
}

function getWastedRoast(goal: string, wastedMinutes: number): string {
  const t = formatMinutes(wastedMinutes);
  return `With ${t} of wasted screen time, you could have made real progress on "${goal}". Instead, you scrolled.`;
}

function getWeeklyRoast(name: string, goal: string, badDays: number, wastedMinutes: number): string {
  if (badDays === 0) {
    return `Respect, ${name}. You stayed under your limit every day this week. That's what discipline looks like.`;
  }
  if (badDays === 1) {
    return `One bad day this week, ${name}. That's ${formatMinutes(wastedMinutes)} you didn't spend on "${goal}". Don't make it two.`;
  }
  return `${badDays} days over your limit, ${name}. ${formatMinutes(wastedMinutes)} wasted this week. "${goal}" doesn't care about your excuses.`;
}

// ─── Animated Bottom Sheet ────────────────────────────────────────────────────

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function BottomSheet({ visible, onClose, children }: SheetProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      damping: 24,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible) return null;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            sheet.backdrop,
            { opacity: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
          ]}
        />
      </TouchableWithoutFeedback>
      <Animated.View style={[sheet.panel, { transform: [{ translateY }] }]}>
        <View style={sheet.handle} />
        {children}
      </Animated.View>
    </Modal>
  );
}

// ─── Day Detail Sheet ─────────────────────────────────────────────────────────

interface DaySheetProps {
  visible: boolean;
  dayIndex: number;
  dayData: DayData;
  allowedMinutes: number;
  goal: string;
  onClose: () => void;
}

function DayDetailSheet({ visible, dayIndex, dayData, allowedMinutes, goal, onClose }: DaySheetProps) {
  if (!dayData) return null;

  const usedMinutes   = dayData.usedMinutes;
  const wasted        = Math.max(0, usedMinutes - allowedMinutes);
  const isOver        = wasted > 0;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={sheet.sheetTitle}>{DAY_NAMES[dayIndex]}</Text>

      <View style={sheet.statsBlock}>
        {[
          { label: 'Total time',  value: formatMinutes(usedMinutes), danger: false },
          { label: 'Allowed',     value: formatMinutes(allowedMinutes), danger: false },
          { label: 'Wasted',      value: isOver ? `+${formatMinutes(wasted)}` : 'None 🎉', danger: isOver },
        ].map((row, i, arr) => (
          <View key={row.label}>
            <View style={sheet.statRow}>
              <Text style={sheet.statLabel}>{row.label}</Text>
              <Text style={[sheet.statValue, row.danger && sheet.dangerText]}>{row.value}</Text>
            </View>
            {i < arr.length - 1 && <View style={sheet.divider} />}
          </View>
        ))}
      </View>

      <Text style={[sheet.verdictText, !isOver && { color: '#4ade80' }]}>
        {isOver
          ? getWastedRoast(goal, wasted)
          : `You stayed under your limit on ${DAY_NAMES[dayIndex]}. That's what discipline looks like.`
        }
      </Text>

      <TouchableOpacity style={sheet.closeBtn} onPress={onClose} activeOpacity={0.8}>
        <Text style={sheet.closeBtnText}>Close</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ─── Weekly Stats Sheet ───────────────────────────────────────────────────────

interface WeeklySheetProps {
  visible: boolean;
  weekData: (DayData | null)[];
  allowedMinutes: number;
  name: string;
  goal: string;
  onClose: () => void;
}

function WeeklyStatsSheet({ visible, weekData, allowedMinutes, name, goal, onClose }: WeeklySheetProps) {
  const daysWithData  = weekData.filter((d): d is DayData => d !== null);
  const totalUsed     = daysWithData.reduce((sum, d) => sum + d.usedMinutes, 0);
  const avgMinutes    = daysWithData.length > 0 ? Math.round(totalUsed / daysWithData.length) : 0;
  const totalWasted   = daysWithData.reduce((sum, d) => sum + Math.max(0, d.usedMinutes - allowedMinutes), 0);
  const badDays       = daysWithData.filter(d => d.usedMinutes > allowedMinutes).length;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={sheet.sheetTitle}>This Week</Text>

      <View style={sheet.statsBlock}>
        {[
          { label: 'Daily average',    value: formatMinutes(avgMinutes),  danger: false },
          { label: 'Your daily limit', value: formatMinutes(allowedMinutes), danger: false },
          { label: 'Days over limit',  value: `${badDays} / ${daysWithData.length}`, danger: badDays > 0 },
          { label: 'Total wasted',     value: totalWasted > 0 ? formatMinutes(totalWasted) : 'None 🎉', danger: totalWasted > 0 },
        ].map((row, i, arr) => (
          <View key={row.label}>
            <View style={sheet.statRow}>
              <Text style={sheet.statLabel}>{row.label}</Text>
              <Text style={[sheet.statValue, row.danger && sheet.dangerText]}>{row.value}</Text>
            </View>
            {i < arr.length - 1 && <View style={sheet.divider} />}
          </View>
        ))}
      </View>

      <Text style={[sheet.verdictText, badDays === 0 && { color: '#4ade80' }]}>
        {getWeeklyRoast(name, goal, badDays, totalWasted)}
      </Text>

      <TouchableOpacity style={sheet.closeBtn} onPress={onClose} activeOpacity={0.8}>
        <Text style={sheet.closeBtnText}>Close</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

interface HomeScreenProps {
  onReset: () => void;
  /** Set to true by App.tsx watchdog to force-show the FrictionScreen */
  frictionTrigger?: boolean;
  /** Package name of the blocked app that triggered friction */
  blockedPackage?: string;
  /** Called when FrictionScreen is dismissed */
  onFrictionDismiss?: () => void;
  /** Called when user completes typing challenge — returns to blocked app */
  onFrictionUnlock?: () => void | Promise<void>;
  /** Called when blocked apps list/limits are saved. Returns true if watchdog started. */
  onBlockedAppsSave?: (apps: BlockedApp[]) => boolean | Promise<boolean>;
}

export default function HomeScreen({
  onReset,
  frictionTrigger,
  blockedPackage,
  onFrictionDismiss,
  onFrictionUnlock,
  onBlockedAppsSave,
}: HomeScreenProps) {
  const [profile,                setProfile]         = useState<UserProfile | null>(null);
  const [selectedDayIndex,       setSelected]        = useState<number | null>(null);
  const [showWeekly,             setShowWeekly]      = useState(false);
  const [showSettings,           setShowSettings]    = useState(false);
  const [showFriction,           setShowFriction]    = useState(false);
  const [usedMinutes,            setUsedMinutes]      = useState(FALLBACK_MINUTES);
  const [appUsageList,           setAppUsageList]     = useState<AppUsage[]>([]);
  const [rotatingIndex,          setRotatingIndex]    = useState(0);
  const [showAppList,            setShowAppList]      = useState(false);
  const [blockedApps,            setBlockedApps]      = useState<BlockedApp[]>([]);
  const [subscriptionTier,       setSubscriptionTier] = useState<SubscriptionTier>('free');
  const [showProPaywall,         setShowProPaywall]   = useState(false);
  const [showProPromo,           setShowProPromo]     = useState(false);
  const [weekData,               setWeekData]         = useState<(DayData | null)[]>(
    Array.from({ length: 7 }, () => null),
  );
  const rotateOpacity            = useRef(new Animated.Value(1)).current;

  // React to the external watchdog trigger from App.tsx
  useEffect(() => {
    if (frictionTrigger) setShowFriction(true);
  }, [frictionTrigger]);

  // Loads permission + full app list; total = sum of all apps
  const loadUsageData = async () => {
    if (Platform.OS !== 'android') return;

    let usageGranted = false;

    try {
      const status = await getBlockingStatus();
      usageGranted = status.usageGranted;
    } catch {
      usageGranted = false;
    }

    if (!usageGranted) return;

    try {
      const list = await getTodayAppUsageList();
      const total = list.reduce((sum, app) => sum + app.minutes, 0);
      setAppUsageList(list);
      setUsedMinutes(total);
      await saveTodayUsageSnapshot(total);
      const week = await getWeekDisplayData(total);
      setWeekData(week);
    } catch {
      // native module not ready
    }
  };

  useEffect(() => {
    getUserProfile().then(async (p) => {
      setProfile(p);
      const sub = await refreshProFromReferrals();
      setSubscriptionTier(sub.tier);

      // Show promo popup to free users: max 3 times, at least 2 days apart
      if (sub.tier === 'free') {
        try {
          const COUNT_KEY = 'promo_popup_count';
          const LAST_KEY  = 'promo_popup_last_shown';
          const TWO_DAYS  = 2 * 24 * 60 * 60 * 1000;

          const [rawCount, rawLast] = await Promise.all([
            AsyncStorage.getItem(COUNT_KEY),
            AsyncStorage.getItem(LAST_KEY),
          ]);
          const count    = rawCount ? parseInt(rawCount, 10) : 0;
          const lastShown = rawLast ? parseInt(rawLast, 10) : 0;
          const now      = Date.now();

          if (count < 3 && (lastShown === 0 || now - lastShown >= TWO_DAYS)) {
            await Promise.all([
              AsyncStorage.setItem(COUNT_KEY, String(count + 1)),
              AsyncStorage.setItem(LAST_KEY, String(now)),
            ]);
            setTimeout(() => setShowProPromo(true), 1500);
          }
        } catch {
          // never crash HomeScreen over a promo
        }
      }
      if (p) {
        const apps = await ensureBlockedApps(p);
        setBlockedApps(apps);
        await syncWatchdogAllowance().catch(() => {});
        await loadUsageData();
        // Watchdog often failed to start silently on launch — retry once.
        if (Platform.OS === 'android' && apps.length > 0) {
          try {
            const status = await getBlockingStatus();
            if (status.usageGranted && !status.watchdogRunning) {
              await onBlockedAppsSave?.(apps);
              await loadUsageData();
            }
          } catch { /* ignore */ }
        }
      } else {
        loadUsageData();
      }
    });

    let blockFailSub: ReturnType<typeof DeviceEventEmitter.addListener> | undefined;
    let appStateSub: ReturnType<typeof AppState.addEventListener> | undefined;

    if (Platform.OS === 'android') {
      blockFailSub = DeviceEventEmitter.addListener(
        BLOCK_SCREEN_FAILED_EVENT,
        () => {
          loadUsageData();
        },
      );

      appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          syncWatchdogAllowance().catch(() => {});
          loadUsageData();
          refreshProFromReferrals()
            .then((sub) => setSubscriptionTier(sub.tier))
            .catch(() => {});
        }
      });
    }

    const refreshTimer = setInterval(() => {
      if (AppState.currentState === 'active') loadUsageData();
    }, 15_000);

    return () => {
      blockFailSub?.remove();
      appStateSub?.remove();
      clearInterval(refreshTimer);
    };
  }, []);

  // Rotate through top 4 apps inside the circle with fade
  const topApps = appUsageList.slice(0, 4);
  useEffect(() => {
    if (topApps.length < 2) return;
    const timer = setInterval(() => {
      Animated.timing(rotateOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setRotatingIndex((i) => (i + 1) % topApps.length);
        Animated.timing(rotateOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [topApps.length, rotateOpacity]);

  if (!profile) return <View style={styles.container} />;

  const allowedMinutes = getTodayAllowance(profile);
  const progress       = allowedMinutes > 0 ? usedMinutes / allowedMinutes : 0;
  const progressColor  = getProgressColor(progress);
  const todayIndex     = getTodayIndex();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >

        {/* ── Header ─────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.appName}>SCREENSHAM</Text>
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.greeting}>{getGreeting()}, {profile.name}</Text>

        {/* ── Circular Progress (tap to see all apps) ────── */}
        <View style={styles.circleSection}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => appUsageList.length > 0 && setShowAppList(true)}
          >
            <CircularProgress
              size={240}
              strokeWidth={8}
              progress={progress}
              color={progressColor}
            >
              <Text style={[styles.circleTime, { color: progressColor }]}>
                {formatMinutes(usedMinutes)}
              </Text>
              <Text style={styles.circleLabel}>total today</Text>

              {topApps.length > 0 && (
                <Animated.View style={[styles.rotatingApp, { opacity: rotateOpacity }]}>
                  {topApps[rotatingIndex % topApps.length]?.iconBase64 ? (
                    <Image
                      source={{
                        uri: `data:image/png;base64,${topApps[rotatingIndex % topApps.length].iconBase64}`,
                      }}
                      style={styles.rotatingAppIcon}
                    />
                  ) : (
                    <View style={[styles.rotatingAppIcon, styles.rotatingAppIconFallback]} />
                  )}
                  <View>
                    <Text style={styles.rotatingAppName} numberOfLines={1}>
                      {topApps[rotatingIndex % topApps.length]?.appName}
                    </Text>
                    <Text style={styles.rotatingAppTime}>
                      {formatMinutes(topApps[rotatingIndex % topApps.length]?.minutes ?? 0)}
                    </Text>
                  </View>
                </Animated.View>
              )}
            </CircularProgress>
          </TouchableOpacity>

          <Text style={styles.allowanceLine}>
            of{' '}
            <Text style={styles.allowanceAmount}>{formatMinutes(allowedMinutes)}</Text>
            {' '}allowed
          </Text>
        </View>

        {/* ── Apps Blocked selector ── */}
        <AppsBlockedButton
          apps={blockedApps}
          dailyAllowanceMinutes={allowedMinutes}
          subscriptionTier={subscriptionTier}
          onUpgradeRequired={() => setShowProPaywall(true)}
          onSave={async (apps) => {
            setBlockedApps(apps);
            await onBlockedAppsSave?.(apps);
            await loadUsageData();
          }}
        />

        {/* ── Calendar Section ───────────────────────────── */}
        <View style={styles.calendarSection}>
          <Text style={styles.sectionTitle}>THIS WEEK</Text>

          <View style={styles.dayRow}>
            {DAY_LABELS.map((label, i) => {
              const isToday    = i === todayIndex;
              const isPast     = i < todayIndex;
              const dayData    = weekData[i];
              const isOver     = dayData ? dayData.usedMinutes > allowedMinutes : false;
              const isSelected = selectedDayIndex === i;
              const isTappable = (isPast || isToday) && dayData !== null;

              // Determine pill background
              let pillBg     = C.cardBg;
              let pillBorder = C.border;
              let letterColor = C.gray;

              if (isSelected) {
                pillBg = C.white;
                pillBorder = C.white;
                letterColor = C.bg;
              } else if (isToday) {
                pillBorder = C.white;
                letterColor = C.white;
              } else if (isPast && dayData) {
                pillBg     = isOver ? 'rgba(239,68,68,0.12)' : 'rgba(74,222,128,0.10)';
                pillBorder = isOver ? 'rgba(239,68,68,0.35)' : 'rgba(74,222,128,0.30)';
                letterColor = isOver ? '#ef4444' : '#4ade80';
              }

              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.dayPill, { backgroundColor: pillBg, borderColor: pillBorder }]}
                  onPress={() => isTappable ? setSelected(isSelected ? null : i) : null}
                  activeOpacity={isTappable ? 0.7 : 1}
                >
                  <Text style={[styles.dayPillLetter, { color: letterColor }]}>
                    {label}
                  </Text>
                  {/* Status dot at bottom of pill */}
                  <View style={[
                    styles.dayPillDot,
                    isToday    && { backgroundColor: C.white },
                    isPast && dayData && !isOver  && { backgroundColor: '#4ade80' },
                    isPast && dayData && isOver   && { backgroundColor: '#ef4444' },
                    !isPast && !isToday           && { backgroundColor: 'transparent' },
                  ]} />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* View Weekly Stats button */}
          <TouchableOpacity
            style={styles.weeklyBtn}
            onPress={() => setShowWeekly(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.weeklyBtnText}>View Weekly Stats →</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Day Detail Sheet ──────────────────────────────── */}
      {selectedDayIndex !== null && weekData[selectedDayIndex] && (
        <DayDetailSheet
          visible={selectedDayIndex !== null}
          dayIndex={selectedDayIndex}
          dayData={weekData[selectedDayIndex]!}
          allowedMinutes={allowedMinutes}
          goal={profile.goal}
          onClose={() => setSelected(null)}
        />
      )}

      {/* ── Weekly Stats Sheet ────────────────────────────── */}
      <WeeklyStatsSheet
        visible={showWeekly}
        weekData={weekData}
        allowedMinutes={allowedMinutes}
        name={profile.name}
        goal={profile.goal}
        onClose={() => setShowWeekly(false)}
      />

      {/* ── Settings Modal ────────────────────────────────── */}
      <SettingsModal
        visible={showSettings}
        profile={profile}
        liveTodayMinutes={usedMinutes}
        allowedMinutes={allowedMinutes}
        onClose={() => setShowSettings(false)}
        onReset={onReset}
        onProfileUpdate={setProfile}
        onBlockedAppsUpdate={setBlockedApps}
        onBlockedAppsSave={onBlockedAppsSave}
      />

      <ProPaywallModal
        visible={showProPaywall}
        onClose={() => setShowProPaywall(false)}
        source="blocked_limit"
      />

      <ProPromoModal
        visible={showProPromo}
        onClose={() => setShowProPromo(false)}
        onGoToPro={() => {
          setShowProPromo(false);
          setShowProPaywall(true);
        }}
      />

      {/* ── Friction / Lock Screen ────────────────────────── */}
      <FrictionScreen
        visible={showFriction}
        blockedPackage={blockedPackage}
        onUnlockSuccess={async () => {
          if (onFrictionUnlock) await onFrictionUnlock();
          setShowFriction(false);
        }}
        onClose={() => {
          setShowFriction(false);
          onFrictionDismiss?.();
        }}
      />

      {/* ── Full App Usage List ───────────────────────────── */}
      <Modal
        visible={showAppList}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAppList(false)}
      >
        <SafeAreaView style={appList.container} edges={['top', 'left', 'right', 'bottom']}>
          <View style={appList.topBar}>
            <Text style={appList.title}>Today's Apps</Text>
            <TouchableOpacity
              style={appList.closeBtn}
              onPress={() => setShowAppList(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={appList.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={appList.scroll}
            showsVerticalScrollIndicator={false}
          >
            {appUsageList.map((app, i) => (
              <View key={app.packageName}>
                <View style={appList.row}>
                  {app.iconBase64 ? (
                    <Image
                      source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                      style={appList.icon}
                    />
                  ) : (
                    <View style={[appList.icon, appList.iconFallback]} />
                  )}
                  <Text style={appList.appName} numberOfLines={1}>
                    {app.appName}
                  </Text>
                  <Text style={appList.time}>{formatMinutes(app.minutes)}</Text>
                </View>
                {i < appUsageList.length - 1 && <View style={appList.divider} />}
              </View>
            ))}

            {appUsageList.length === 0 && (
              <Text style={appList.empty}>No app usage recorded today.</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 64 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
  },
  appName:      { color: C.grayDark, fontSize: 10, fontWeight: '700', letterSpacing: 3 },
  settingsIcon: { fontSize: 18 },

  greeting: {
    color: C.gray,
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 24,
  },

  // Message card
  messageCard: {
    marginHorizontal: 24,
    marginBottom: 28,
    backgroundColor: C.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  messageText: {
    color: C.white,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
    letterSpacing: -0.3,
  },

  // Circle
  circleSection: { alignItems: 'center', marginBottom: 20 },
  circleTime: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  circleLabel: {
    color: C.gray,
    fontSize: 9,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  allowanceLine:   { color: C.gray, fontSize: 13, marginTop: 16 },
  allowanceAmount: { color: C.offWhite, fontWeight: '600' },

  rotatingApp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    maxWidth: 140,
  },
  rotatingAppIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  rotatingAppIconFallback: {
    backgroundColor: C.border,
  },
  rotatingAppName: {
    color: C.gray,
    fontSize: 10,
    fontWeight: '500',
    maxWidth: 100,
  },
  rotatingAppTime: {
    color: C.offWhite,
    fontSize: 13,
    fontWeight: '700',
  },

  // Calendar
  calendarSection: { paddingHorizontal: 24 },
  sectionTitle: {
    color: C.grayDark,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 16,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 20,
  },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 6,
  },
  dayPillLetter: {
    fontSize: 13,
    fontWeight: '700',
  },
  dayPillDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.borderLight,
  },

  // Weekly button
  weeklyBtn: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  weeklyBtnText: {
    color: C.gray,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

});

const sheet = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111111',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingBottom: 48,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.borderLight,
    alignSelf: 'center',
    marginBottom: 28,
  },
  sheetTitle: {
    color: C.white,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  statsBlock: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 24,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statLabel:   { color: C.gray,  fontSize: 14, fontWeight: '500' },
  statValue:   { color: C.white, fontSize: 15, fontWeight: '700' },
  dangerText:  { color: '#ef4444' },
  divider:     { height: 1, backgroundColor: C.border, marginHorizontal: 20 },
  verdictText: {
    color: C.offWhite,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 23,
    marginBottom: 28,
  },
  closeBtn: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  closeBtnText: { color: C.gray, fontSize: 15, fontWeight: '600' },
});

// ─── Full App List Modal styles ───────────────────────────────────────────────

const appList = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
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

  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  iconFallback: {
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
  },
  appName: {
    flex: 1,
    color: C.offWhite,
    fontSize: 15,
    fontWeight: '600',
  },
  time: {
    color: C.gray,
    fontSize: 14,
    fontWeight: '700',
  },
  divider: { height: 1, backgroundColor: C.border },
  empty: {
    color: C.grayDark,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
});
