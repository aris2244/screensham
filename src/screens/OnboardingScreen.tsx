import React, { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../constants/colors';
import { calculateDailyAllowance } from '../logic/calculateAllowance';
import { saveUserProfile } from '../storage/userProfile';
import { NemesisApp, ScreenTimeOption, UserProfile } from '../types';

const { width: W } = Dimensions.get('window');
const TOTAL_STEPS = 6;

// Makes "01 / 06", "02 / 06", etc. automatically
const stepLabel = (current: number) =>
  `${String(current + 1).padStart(2, '0')} / ${String(TOTAL_STEPS).padStart(2, '0')}`;

const SCREEN_TIME_OPTIONS: { key: ScreenTimeOption; label: string; sub: string }[] = [
  { key: 'under2', label: 'Under 2h', sub: 'The enlightened one' },
  { key: '2to4',   label: '2 – 4h',   sub: 'Borderline acceptable' },
  { key: '4to6',   label: '4 – 6h',   sub: 'Red flag territory' },
  { key: '6plus',  label: '6h+',      sub: 'We need to talk' },
];

const NEMESIS_OPTIONS: { key: NemesisApp; label: string; sub: string }[] = [
  { key: 'instagram', label: 'Instagram', sub: 'The highlight reel trap' },
  { key: 'tiktok',    label: 'TikTok',    sub: 'The infinite scroll machine' },
  { key: 'youtube',   label: 'YouTube',   sub: 'One more video syndrome' },
  { key: 'snapchat',  label: 'Snapchat',  sub: 'The FOMO factory' },
  { key: 'twitter',   label: 'Twitter / X', sub: 'The outrage engine' },
];

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const slideX = useRef(new Animated.Value(0)).current;

  const [name,             setName]             = useState('');
  const [goal,             setGoal]             = useState('');
  const [seriousness,      setSeriousness]      = useState<number | null>(null);
  const [screenTime,       setScreenTime]       = useState<ScreenTimeOption | null>(null);
  const [usesPhoneForWork, setUsesPhoneForWork] = useState(false);
  const [goesOutSaturday,  setGoesOutSaturday]  = useState<boolean | null>(null);
  const [nemesisApp,       setNemesisApp]       = useState<NemesisApp | null>(null);

  const canContinue = (): boolean => {
    switch (step) {
      case 0: return name.trim().length >= 2;
      case 1: return goal.trim().length >= 3;
      case 2: return seriousness !== null;
      case 3: return screenTime !== null;
      case 4: return goesOutSaturday !== null;
      case 5: return nemesisApp !== null;
      default: return false;
    }
  };

  const slideToNext = (callback: () => void) => {
    Animated.timing(slideX, {
      toValue: -W,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      callback();
      slideX.setValue(W * 0.25);
      Animated.spring(slideX, {
        toValue: 0,
        damping: 20,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = async () => {
    if (!canContinue() || isSaving) return;

    if (step < TOTAL_STEPS - 1) {
      slideToNext(() => setStep((s) => s + 1));
      return;
    }

    setIsSaving(true);
    try {
      const profileData = {
        name:              name.trim(),
        goal:              goal.trim(),
        seriousness:       seriousness!,
        currentScreenTime: screenTime!,
        usesPhoneForWork,
        goesOutSaturday:   goesOutSaturday!,
        nemesisApp:        nemesisApp!,
      };

      const profile: UserProfile = {
        ...profileData,
        dailyAllowanceMinutes: calculateDailyAllowance(profileData),
        onboardingComplete: true,
        permissionsSetupComplete: false,
        createdAt: new Date().toISOString(),
      };

      await saveUserProfile(profile);
      onComplete();
    } catch (e) {
      Alert.alert(
        'Something went wrong',
        e instanceof Error ? e.message : 'Could not save your plan. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const getSeriousnessReaction = (n: number): string => {
    if (n <= 2) return "👀  We'll take it easy on you. For now.";
    if (n <= 4) return "👍  Okay. Let's see if that's true.";
    if (n <= 6) return "🔥  Now we're talking.";
    if (n <= 8) return '💪  Serious mode activated.';
    return '💀  No mercy. You asked for this.';
  };

  const renderStep = () => {
    switch (step) {

      // ── Step 1: Name ─────────────────────────────────────
      case 0:
        return (
          <View style={styles.stepWrap}>
            <Text style={styles.stepNum}>{stepLabel(step)}</Text>
            <Text style={styles.question}>What's your name?</Text>
            <Text style={styles.questionSub}>We'll use it to hold you accountable.</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name..."
              placeholderTextColor={C.grayDark}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
          </View>
        );

      // ── Step 2: Goal ─────────────────────────────────────
      case 1:
        return (
          <View style={styles.stepWrap}>
            <Text style={styles.stepNum}>{stepLabel(step)}</Text>
            <Text style={styles.question}>
              What's the one thing{'\n'}you want to achieve?
            </Text>
            <Text style={styles.questionSub}>"Be happy" doesn't count. Be specific.</Text>
            <TextInput
              style={styles.input}
              value={goal}
              onChangeText={setGoal}
              placeholder="e.g. Launch my startup..."
              placeholderTextColor={C.grayDark}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
          </View>
        );

      // ── Step 3: Seriousness ──────────────────────────────
      case 2:
        return (
          <View style={styles.stepWrap}>
            <Text style={styles.stepNum}>{stepLabel(step)}</Text>
            <Text style={styles.question}>
              How serious are you{'\n'}about this goal?
            </Text>
            <Text style={styles.questionSub}>
              1 = "Kind of" {'  ·  '} 10 = "I'll die for it"
            </Text>
            <View style={styles.numberGrid}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.numberCell, seriousness === n && styles.numberCellSelected]}
                  onPress={() => setSeriousness(n)}
                >
                  <Text style={[styles.numberCellText, seriousness === n && styles.numberCellTextSelected]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {seriousness !== null && (
              <Text style={styles.reactionText}>{getSeriousnessReaction(seriousness)}</Text>
            )}
          </View>
        );

      // ── Step 4: Screen time + work ───────────────────────
      case 3:
        return (
          <View style={styles.stepWrap}>
            <Text style={styles.stepNum}>{stepLabel(step)}</Text>
            <Text style={styles.question}>
              How much screen time{'\n'}per day on average?
            </Text>
            <Text style={styles.questionSub}>Be honest. We already know.</Text>
            <View style={styles.optionList}>
              {SCREEN_TIME_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.optionCard, screenTime === opt.key && styles.optionCardSelected]}
                  onPress={() => setScreenTime(opt.key)}
                >
                  <Text style={[styles.optionLabel, screenTime === opt.key && styles.optionLabelSelected]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.optionSub, screenTime === opt.key && styles.optionSubSelected]}>
                    {opt.sub}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleLabel}>I use my phone for work</Text>
                <Text style={styles.toggleSub}>We'll add a buffer for that</Text>
              </View>
              <Switch
                value={usesPhoneForWork}
                onValueChange={setUsesPhoneForWork}
                trackColor={{ false: C.borderLight, true: C.white }}
                thumbColor={usesPhoneForWork ? C.bg : C.gray}
              />
            </View>
          </View>
        );

      // ── Step 5: Saturday ─────────────────────────────────
      case 4:
        return (
          <View style={styles.stepWrap}>
            <Text style={styles.stepNum}>{stepLabel(step)}</Text>
            <Text style={styles.question}>
              Do you go out{'\n'}on Saturdays?
            </Text>
            <Text style={styles.questionSub}>Social life = less doom-scrolling time.</Text>
            <View style={styles.bigChoiceRow}>
              <TouchableOpacity
                style={[styles.bigChoice, goesOutSaturday === true && styles.bigChoiceSelected]}
                onPress={() => setGoesOutSaturday(true)}
              >
                <Text style={styles.bigChoiceEmoji}>🎉</Text>
                <Text style={[styles.bigChoiceLabel, goesOutSaturday === true && styles.bigChoiceLabelSelected]}>
                  Yes
                </Text>
                <Text style={styles.bigChoiceSub}>I have a life</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.bigChoice, goesOutSaturday === false && styles.bigChoiceSelected]}
                onPress={() => setGoesOutSaturday(false)}
              >
                <Text style={styles.bigChoiceEmoji}>🛋️</Text>
                <Text style={[styles.bigChoiceLabel, goesOutSaturday === false && styles.bigChoiceLabelSelected]}>
                  No
                </Text>
                <Text style={styles.bigChoiceSub}>Classic homebody</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      // ── Step 6: Nemesis App ──────────────────────────────
      case 5:
        return (
          <View style={styles.stepWrap}>
            <Text style={styles.stepNum}>{stepLabel(step)}</Text>
            <Text style={styles.question}>
              Which app is{'\n'}ruining your life?
            </Text>
            <Text style={styles.questionSub}>
              Your nemesis. We'll roast you specifically for this one.
            </Text>
            <View style={styles.optionList}>
              {NEMESIS_OPTIONS.map((opt) => {
                const isSelected = nemesisApp === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.nemesisCard, isSelected && styles.nemesisCardSelected]}
                    onPress={() => setNemesisApp(opt.key)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.nemesisCardLeft}>
                      <Text style={[styles.nemesisLabel, isSelected && styles.nemesisLabelSelected]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.nemesisSub, isSelected && styles.nemesisSubSelected]}>
                        {opt.sub}
                      </Text>
                    </View>
                    {/* Checkmark appears on selection */}
                    <View style={[styles.nemesisCheck, isSelected && styles.nemesisCheckSelected]}>
                      {isSelected && <Text style={styles.nemesisCheckMark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const progressPct = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ transform: [{ translateX: slideX }] }}>
            {renderStep()}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueBtn, (!canContinue() || isSaving) && styles.continueBtnDisabled]}
            onPress={handleContinue}
            activeOpacity={0.85}
            disabled={!canContinue() || isSaving}
          >
            <Text style={[styles.continueBtnText, (!canContinue() || isSaving) && styles.continueBtnTextDisabled]}>
              {isSaving ? 'Building...' : step === TOTAL_STEPS - 1 ? 'Build my plan →' : 'Continue →'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  flex:      { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },

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

  stepWrap:    { paddingHorizontal: 28, paddingTop: 40 },
  stepNum:     { color: C.grayDark, fontSize: 12, fontWeight: '600', letterSpacing: 2, marginBottom: 20 },
  question:    { color: C.white, fontSize: 30, fontWeight: '800', lineHeight: 38, marginBottom: 10 },
  questionSub: { color: C.gray, fontSize: 14, lineHeight: 20, marginBottom: 24 },

  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: C.borderLight,
    color: C.white,
    fontSize: 22,
    fontWeight: '600',
    paddingVertical: 12,
    paddingHorizontal: 0,
  },

  numberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  numberCell: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberCellSelected:     { backgroundColor: C.white, borderColor: C.white },
  numberCellText:         { color: C.gray, fontSize: 17, fontWeight: '600' },
  numberCellTextSelected: { color: C.bg },
  reactionText: {
    color: C.offWhite,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 24,
    letterSpacing: 0.2,
  },

  // Shared option card (screen time + nemesis)
  optionList: { gap: 10 },
  optionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  optionCardSelected:  { backgroundColor: C.white, borderColor: C.white },
  optionLabel:         { color: C.offWhite, fontSize: 16, fontWeight: '700' },
  optionLabelSelected: { color: C.bg },
  optionSub:           { color: C.grayDark, fontSize: 13 },
  optionSubSelected:   { color: '#555' },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  toggleTextWrap: { flex: 1, marginRight: 16 },
  toggleLabel:    { color: C.offWhite, fontSize: 15, fontWeight: '600' },
  toggleSub:      { color: C.grayDark, fontSize: 12, marginTop: 3 },

  bigChoiceRow: { flexDirection: 'row', gap: 14, marginTop: 8 },
  bigChoice: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 20,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  bigChoiceSelected:      { backgroundColor: C.white, borderColor: C.white },
  bigChoiceEmoji:         { fontSize: 28 },
  bigChoiceLabel:         { color: C.offWhite, fontSize: 22, fontWeight: '800' },
  bigChoiceLabelSelected: { color: C.bg },
  bigChoiceSub:           { color: C.grayDark, fontSize: 12 },

  // ── Nemesis App step ───────────────────────────────────
  nemesisCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  nemesisCardSelected: {
    backgroundColor: C.white,
    borderColor: C.white,
  },
  nemesisCardLeft:         { flex: 1 },
  nemesisLabel:            { color: C.offWhite, fontSize: 16, fontWeight: '700' },
  nemesisLabelSelected:    { color: C.bg },
  nemesisSub:              { color: C.grayDark, fontSize: 13, marginTop: 2 },
  nemesisSubSelected:      { color: '#555' },
  nemesisCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  nemesisCheckSelected: {
    backgroundColor: C.bg,
    borderColor: C.bg,
  },
  nemesisCheckMark: {
    color: C.white,
    fontSize: 13,
    fontWeight: '800',
  },

  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  continueBtn: {
    backgroundColor: C.white,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  continueBtnDisabled:     { backgroundColor: C.grayDeep },
  continueBtnText:         { color: C.bg, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  continueBtnTextDisabled: { color: C.grayDark },
});
