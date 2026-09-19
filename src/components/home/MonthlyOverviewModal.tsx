import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../constants/colors';
import {
  DayUsage,
  getMonthDisplayData,
  getMonthLabel,
} from '../../storage/weeklyUsageStorage';

interface Props {
  visible: boolean;
  liveTodayMinutes: number;
  allowedMinutes: number;
  name: string;
  goal: string;
  onClose: () => void;
}

function formatMinutes(mins: number): string {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getMonthlyRoast(
  name: string,
  goal: string,
  badDays: number,
  wastedMinutes: number,
  trackedDays: number,
): string {
  if (trackedDays === 0) {
    return 'No usage data yet this month. Open the app daily so we can track your progress.';
  }
  if (badDays === 0) {
    return `Solid month so far, ${name}. Every tracked day stayed under your limit. Keep building "${goal}".`;
  }
  if (badDays === 1) {
    return `One over-limit day this month, ${name}. That's ${formatMinutes(wastedMinutes)} that could've gone to "${goal}".`;
  }
  return `${badDays} days over your limit, ${name}. ${formatMinutes(wastedMinutes)} wasted this month. "${goal}" is still waiting.`;
}

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const GRID_PADDING = 20;
const CELL_SIZE = (Dimensions.get('window').width - GRID_PADDING * 2) / 7;

export default function MonthlyOverviewModal({
  visible,
  liveTodayMinutes,
  allowedMinutes,
  name,
  goal,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [monthData, setMonthData] = useState<(DayUsage | null)[]>([]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getMonthDisplayData(liveTodayMinutes)
      .then(setMonthData)
      .finally(() => setLoading(false));
  }, [visible, liveTodayMinutes]);

  const daysWithData = monthData.filter((d): d is DayUsage => d !== null);
  const totalUsed = daysWithData.reduce((sum, d) => sum + d.usedMinutes, 0);
  const avgMinutes =
    daysWithData.length > 0 ? Math.round(totalUsed / daysWithData.length) : 0;
  const totalWasted = daysWithData.reduce(
    (sum, d) => sum + Math.max(0, d.usedMinutes - allowedMinutes),
    0,
  );
  const badDays = daysWithData.filter((d) => d.usedMinutes > allowedMinutes).length;

  const now = new Date();
  const firstWeekday = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7;
  const todayDate = now.getDate();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={s.topBar}>
          <Text style={s.title}>Monthly Overview</Text>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={C.white} />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
            <Text style={s.monthLabel}>{getMonthLabel()}</Text>

            <View style={s.statsBlock}>
              {[
                { label: 'Daily average', value: formatMinutes(avgMinutes), danger: false },
                { label: 'Your daily limit', value: formatMinutes(allowedMinutes), danger: false },
                {
                  label: 'Days over limit',
                  value: `${badDays} / ${daysWithData.length}`,
                  danger: badDays > 0,
                },
                {
                  label: 'Total wasted',
                  value: totalWasted > 0 ? formatMinutes(totalWasted) : 'None 🎉',
                  danger: totalWasted > 0,
                },
              ].map((row, i, arr) => (
                <View key={row.label}>
                  <View style={s.statRow}>
                    <Text style={s.statLabel}>{row.label}</Text>
                    <Text style={[s.statValue, row.danger && s.dangerText]}>{row.value}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={s.divider} />}
                </View>
              ))}
            </View>

            <Text style={s.calendarTitle}>This month</Text>
            <View style={s.weekdayRow}>
              {WEEKDAY_LABELS.map((label, i) => (
                <Text key={`${label}-${i}`} style={s.weekdayLabel}>
                  {label}
                </Text>
              ))}
            </View>
            <View style={s.calendarGrid}>
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <View key={`pad-${i}`} style={s.dayCell} />
              ))}
              {monthData.map((day, i) => {
                const dayNum = i + 1;
                const isToday = dayNum === todayDate;
                const isOver = day !== null && day.usedMinutes > allowedMinutes;
                const isUnder = day !== null && day.usedMinutes <= allowedMinutes;
                return (
                  <View
                    key={dayNum}
                    style={[
                      s.dayCell,
                      isToday && s.dayCellToday,
                      isOver && s.dayCellOver,
                      isUnder && s.dayCellUnder,
                    ]}
                  >
                    <Text
                      style={[
                        s.dayNum,
                        isOver && s.dayNumOver,
                        isUnder && s.dayNumUnder,
                      ]}
                    >
                      {dayNum}
                    </Text>
                  </View>
                );
              })}
            </View>

            <Text style={[s.verdict, badDays === 0 && daysWithData.length > 0 && s.verdictGood]}>
              {getMonthlyRoast(name, goal, badDays, totalWasted, daysWithData.length)}
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  monthLabel: {
    color: C.gray,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  statsBlock: {
    backgroundColor: C.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 18,
    paddingVertical: 6,
    marginBottom: 24,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  statLabel: { color: C.gray, fontSize: 14, fontWeight: '500' },
  statValue: { color: C.white, fontSize: 15, fontWeight: '700' },
  dangerText: { color: '#ef4444' },
  divider: { height: 1, backgroundColor: C.border },
  calendarTitle: {
    color: C.grayDark,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    color: C.grayDark,
    fontSize: 11,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayCellToday: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  dayCellOver: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 10,
  },
  dayCellUnder: {
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderRadius: 10,
  },
  dayNum: { color: C.grayDark, fontSize: 13, fontWeight: '600' },
  dayNumOver: { color: '#ef4444' },
  dayNumUnder: { color: '#4ade80' },
  verdict: {
    color: C.offWhite,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  verdictGood: { color: '#4ade80' },
});
