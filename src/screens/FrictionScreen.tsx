import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  pickRandomRoastSubtitle,
  pickRandomUnlockPhrase,
} from '../constants/frictionPhrases';
import { UserProfile } from '../types';
import { getUserProfile } from '../storage/userProfile';
import { decrementSosUses, getSosUsesLeft } from '../storage/sosStorage';
import { resolveBlockedAppLabel } from '../utils/blockedAppLabel';
import { getLastBlockedPackage } from '../utils/usageStats';

// ─── Colours (intimidation palette) ──────────────────────────────────────────
const R = {
  bg:         '#060000',
  bgCard:     '#110000',
  border:     '#2a0808',
  borderBright: '#5a1010',
  red:        '#ef4444',
  redDim:     '#7f1d1d',
  white:      '#ffffff',
  offWhite:   '#e5e5e5',
  gray:       '#888888',
  grayDark:   '#444444',
  green:      '#4ade80',
  greenDim:   '#14532d',
};

// ─── Match state helpers ──────────────────────────────────────────────────────
type MatchState = 'empty' | 'correct-so-far' | 'error' | 'complete';

function getMatchState(input: string, target: string): MatchState {
  if (input.length === 0)    return 'empty';
  if (input === target)      return 'complete';
  if (target.startsWith(input)) return 'correct-so-far';
  return 'error';
}

function getInputColor(state: MatchState): string {
  switch (state) {
    case 'complete':       return R.green;
    case 'error':          return R.red;
    case 'correct-so-far': return R.offWhite;
    default:               return R.gray;
  }
}

function getInputBorderColor(state: MatchState): string {
  switch (state) {
    case 'complete': return R.green;
    case 'error':    return R.red;
    default:         return '#5a1010'; // bright enough to see clearly
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  /** Package name of the app that triggered this lock (from watchdog). */
  blockedPackage?: string;
  onClose: () => void;
  /** Called when user completes the typing challenge (not SOS bypass). */
  onUnlockSuccess?: () => void | Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function FrictionScreen({
  visible,
  blockedPackage,
  onClose,
  onUnlockSuccess,
}: Props) {
  const [profile,       setProfile]       = useState<UserProfile | null>(null);
  const [appLabel,      setAppLabel]        = useState<string | null>(null);
  const [targetPhrase,  setTargetPhrase]    = useState('');
  const [subtitleText,  setSubtitleText]    = useState('');
  const [inputText,     setInputText]       = useState('');
  const [sosUsesLeft,   setSosUsesLeft]     = useState(3);
  const [shakeAnim]                         = useState(new Animated.Value(0));
  const lastLengthRef                         = useRef(0);
  const inputRef                            = useRef<TextInput>(null);

  // Fresh phrase + correct app label every time the lock opens
  useEffect(() => {
    if (!visible) return;

    setInputText('');
    lastLengthRef.current = 0;
    setAppLabel(null);
    setTargetPhrase('');
    setSubtitleText('');

    getUserProfile().then((p) => {
      setProfile(p);
      if (!p) return;

      const loadLabel = async () => {
        let pkg = blockedPackage ?? '';
        if (!pkg && Platform.OS === 'android') {
          pkg = await getLastBlockedPackage().catch(() => '');
        }
        const label = await resolveBlockedAppLabel(pkg);
        setAppLabel(label);
        setTargetPhrase(pickRandomUnlockPhrase({ packageName: pkg, appLabel: label }));
        setSubtitleText(
          pickRandomRoastSubtitle({ name: p.name, goal: p.goal, app: label }),
        );
      };

      loadLabel().catch(() => {
        setAppLabel('This app');
        setTargetPhrase(pickRandomUnlockPhrase());
        setSubtitleText(
          pickRandomRoastSubtitle({ name: p.name, goal: p.goal, app: 'This app' }),
        );
      });
    });

    getSosUsesLeft().then(setSosUsesLeft);
  }, [visible, blockedPackage]);

  // Shake animation on typo
  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 30, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleTextChange = (text: string) => {
    // ── Paste prevention ──────────────────────────────────────────────────
    // If more than 1 character was added in one event, it's a paste or
    // autocomplete injection — reject it and shake the input.
    if (text.length > lastLengthRef.current + 1) {
      triggerShake();
      return; // discard the pasted text, keep previous value
    }
    lastLengthRef.current = text.length;

    // Clamp: never let the user type beyond the target phrase length
    if (text.length > targetPhrase.length) return;

    setInputText(text);

    const newState = getMatchState(text, targetPhrase);
    if (newState === 'error') triggerShake();
  };

  const handleUnlock = async () => {
    const state = getMatchState(inputText, targetPhrase);
    if (state !== 'complete') return;
    try {
      if (onUnlockSuccess) {
        await onUnlockSuccess();
        return;
      }
      onClose();
    } catch {
      Alert.alert('Unlock failed', 'Something went wrong. Please try again.');
    }
  };

  const handleSos = () => {
    if (sosUsesLeft <= 0) return;

    Alert.alert(
      'Use Emergency Bypass?',
      `Are you sure? This uses 1 of your ${sosUsesLeft} monthly lifelines. You only get 3 per month.`,
      [
        { text: 'No, I\'ll type it', style: 'cancel' },
        {
          text: 'Yes, bypass',
          style: 'destructive',
          onPress: async () => {
            const remaining = await decrementSosUses();
            setSosUsesLeft(remaining);
            if (onUnlockSuccess) {
              await onUnlockSuccess();
              return;
            }
            onClose();
          },
        },
      ],
    );
  };

  if (!profile || !appLabel || !targetPhrase) return null;

  const matchState     = getMatchState(inputText, targetPhrase);
  const isComplete     = matchState === 'complete';
  const charsCorrect   = targetPhrase.startsWith(inputText) ? inputText.length : 0;
  const progressPct    = targetPhrase.length > 0
    ? (charsCorrect / targetPhrase.length) * 100
    : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {}} // intentionally block hardware back button
    >
      <SafeAreaView style={s.container} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={R.bg} />

        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── Top label ──────────────────────────────── */}
            <Text style={s.topLabel}>SCREENSHAM · FRICTION LOCK</Text>

            {/* ── Main heading ───────────────────────────── */}
            <View style={s.headingBlock}>
              {/* "HOLD UP," and badge on the same row */}
              <View style={s.holdUpRow}>
                <Text style={s.holdUp}>HOLD UP,</Text>
                <View style={s.limitBadge}>
                  <Text style={s.limitBadgeText}>⏱ LIMIT REACHED</Text>
                </View>
              </View>
              <Text style={s.name}>{profile.name.toUpperCase()}.</Text>
            </View>

            {/* ── Roast subtitle ─────────────────────────── */}
            <Text style={s.subtitle}>{subtitleText}</Text>

            {/* ── Target phrase ──────────────────────────── */}
            <View style={s.phraseSection}>
              <Text style={s.phraseLabel}>TYPE THIS TO UNLOCK</Text>
              <View style={s.phraseBox}>
                <Text style={s.phraseText}>"{targetPhrase}"</Text>
              </View>

              {/* Progress bar */}
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${progressPct}%` }]} />
              </View>
              <Text style={s.progressLabel}>
                {charsCorrect} / {targetPhrase.length} characters
              </Text>
            </View>

            {/* ── Typing input ───────────────────────────── */}
            <Animated.View
              style={[
                s.inputWrap,
                {
                  borderColor: getInputBorderColor(matchState),
                  transform:   [{ translateX: shakeAnim }],
                },
              ]}
            >
              <TextInput
                ref={inputRef}
                style={[s.input, { color: getInputColor(matchState) }]}
                value={inputText}
                onChangeText={handleTextChange}
                placeholder='Start typing here...'
                placeholderTextColor="#666666"
                multiline
                autoCorrect={false}
                autoCapitalize="none"
                spellCheck={false}
                contextMenuHidden={true}  // disables copy/paste menu on iOS
                textContentType="none"
                keyboardAppearance="dark"
              />
            </Animated.View>

            {/* ── Status feedback ────────────────────────── */}
            {matchState === 'error' && (
              <Text style={s.feedbackError}>✗  Typo detected. Keep going — no shortcuts.</Text>
            )}
            {matchState === 'correct-so-far' && inputText.length > 0 && (
              <Text style={s.feedbackOk}>→  Keep typing...</Text>
            )}
            {isComplete && (
              <Text style={s.feedbackComplete}>✓  Phrase complete. You may proceed.</Text>
            )}

            {/* ── Unlock button ──────────────────────────── */}
            <TouchableOpacity
              style={[s.unlockBtn, !isComplete && s.unlockBtnDisabled]}
              onPress={handleUnlock}
              disabled={!isComplete}
              activeOpacity={0.8}
            >
              <Text style={[s.unlockBtnText, !isComplete && s.unlockBtnTextDisabled]}>
                {isComplete ? `Unlock ${appLabel}` : 'Finish typing to unlock'}
              </Text>
            </TouchableOpacity>

            {/* ── SOS escape hatch ───────────────────────── */}
            <View style={s.sosSection}>
              {sosUsesLeft > 0 ? (
                <TouchableOpacity onPress={handleSos} activeOpacity={0.6}>
                  <Text style={s.sosText}>
                    Emergency Bypass ({sosUsesLeft}/3 remaining this month)
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={s.sosTextDisabled}>
                  No bypasses left this month. You're on your own.
                </Text>
              )}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: R.bg },
  flex:      { flex: 1 },
  scroll:    { paddingHorizontal: 26, paddingTop: 28, paddingBottom: 56 },

  topLabel: {
    color:         R.redDim,
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 2.5,
    marginBottom:  28,
  },

  // ── Heading ────────────────────────────────────────────
  headingBlock: { marginBottom: 20 },

  holdUpRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    marginBottom:   6,
  },
  limitBadge: {
    backgroundColor: '#2d0000',
    borderWidth:      1.5,
    borderColor:      R.red,
    borderRadius:     8,
    paddingHorizontal: 10,
    paddingVertical:   5,
  },
  limitBadgeText: {
    color:         R.red,
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 1.5,
  },

  holdUp: {
    color:         R.red,
    fontSize:      20,
    fontWeight:    '900',
    letterSpacing: 5,
    marginBottom:  4,
  },
  name: {
    color:         R.white,
    fontSize:      60,
    fontWeight:    '900',
    letterSpacing: -2,
    lineHeight:    64,
  },

  // ── Subtitle ───────────────────────────────────────────
  subtitle: {
    color:             '#c0c0c0',
    fontSize:          14,
    fontWeight:        '500',
    lineHeight:        21,
    textAlign:         'center',
    marginBottom:      28,
    paddingHorizontal: 4,
  },

  // ── Target phrase ─────────────────────────────────────
  phraseSection: { marginBottom: 24 },
  phraseLabel: {
    color:         R.red,
    fontSize:      22,
    fontWeight:    '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom:  16,
  },
  phraseBox: {
    backgroundColor: '#1a0000',
    borderRadius:    16,
    borderWidth:     1.5,
    borderColor:     R.borderBright,
    paddingHorizontal: 16,
    paddingVertical:   16,
    marginBottom:    14,
    minHeight:       84,
    justifyContent:  'center',
  },
  phraseText: {
    color:      R.white,
    fontSize:   16,
    fontWeight: '700',
    lineHeight: 24,
    fontStyle:  'italic',
    textAlign:  'center',
  },

  // ── Progress ──────────────────────────────────────────
  progressTrack: {
    height:          3,
    backgroundColor: R.border,
    borderRadius:    2,
    marginBottom:    7,
  },
  progressFill: {
    height:          3,
    backgroundColor: R.red,
    borderRadius:    2,
  },
  progressLabel: {
    color:      R.grayDark,
    fontSize:   11,
    fontWeight: '500',
    textAlign:  'right',
  },

  // ── Input ─────────────────────────────────────────────
  inputWrap: {
    borderWidth:     0,
    borderBottomWidth: 2,
    borderColor:     R.border,      // overridden dynamically
    borderRadius:    0,
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginBottom:    10,
    backgroundColor: 'transparent',
    minHeight:       80,
  },
  input: {
    fontSize:   16,
    fontWeight: '600',
    lineHeight: 24,
  },

  // ── Feedback ──────────────────────────────────────────
  feedbackError: {
    color:        R.red,
    fontSize:     13,
    fontWeight:   '600',
    marginBottom: 20,
  },
  feedbackOk: {
    color:        R.grayDark,
    fontSize:     13,
    fontWeight:   '500',
    marginBottom: 20,
  },
  feedbackComplete: {
    color:        R.green,
    fontSize:     13,
    fontWeight:   '700',
    marginBottom: 20,
  },

  // ── Unlock button ─────────────────────────────────────
  unlockBtn: {
    backgroundColor: R.red,
    borderRadius:    16,
    paddingVertical: 19,
    alignItems:      'center',
    marginBottom:    40,
    marginTop:       8,
  },
  unlockBtnDisabled: {
    backgroundColor: 'transparent',
    borderWidth:     1,
    borderColor:     R.border,
  },
  unlockBtnText: {
    color:         R.white,
    fontSize:      16,
    fontWeight:    '800',
    letterSpacing: 0.3,
  },
  unlockBtnTextDisabled: {
    color: R.grayDark,
  },

  // ── SOS ───────────────────────────────────────────────
  sosSection: {
    alignItems: 'center',
    paddingTop: 4,
  },
  sosText: {
    color:               R.redDim,
    fontSize:            12,
    fontWeight:          '500',
    textAlign:           'center',
    textDecorationLine:  'underline',
    textDecorationColor: R.redDim,
  },
  sosTextDisabled: {
    color:      R.grayDark,
    fontSize:   12,
    fontWeight: '500',
    textAlign:  'center',
  },
});
