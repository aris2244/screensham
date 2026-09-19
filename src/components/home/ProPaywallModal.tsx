import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../constants/colors';
import {
  BillingPeriod,
  PLAN_FEATURES,
  PRO_ANNUAL_FIRST,
  PRO_ANNUAL_PER_MONTH,
  PRO_ANNUAL_TOTAL,
  PRO_LAUNCH_COPY,
  PRO_MONTHLY_FIRST,
  PRO_MONTHLY_PRICE,
  REFERRAL_COPY,
  WAITLIST_DISCOUNT_PERCENT,
} from '../../constants/subscriptionConfig';
import { submitProInterest } from '../../services/proInterestApi';
import {
  getSubscriptionState,
  markWaitlistJoined,
  SubscriptionState,
} from '../../storage/subscriptionStorage';

interface Props {
  visible: boolean;
  onClose: () => void;
  source?: 'settings' | 'blocked_limit';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function fmt(n: number): string {
  return n % 1 === 0 ? `€${n}` : `€${n.toFixed(2)}`;
}

// Play Store link with an appended install referrer — read by the native
// InstallReferrer module right after the friend installs. This is what
// actually attributes the install back to this referral code (free,
// Google-official; no Branch.io or paid attribution SDK needed).
const PLAY_STORE_INSTALL_URL =
  'https://play.google.com/store/apps/details?id=com.screensham.app&referrer=ref%3D';

export default function ProPaywallModal({ visible, onClose, source = 'settings' }: Props) {
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [billing, setBilling] = useState<BillingPeriod>('annual');
  const [showWaitlistPopup, setShowWaitlistPopup] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!visible) return;
    getSubscriptionState().then((s) => {
      setState(s);
      setEmail(s.email ?? '');
      setJoined(!!s.waitlistJoinedAt);
      setShowWaitlistPopup(false);
    });
  }, [visible]);

  const isAnnual = billing === 'annual';

  const bigPrice = isAnnual ? `${fmt(PRO_ANNUAL_PER_MONTH)}/mo` : `${fmt(PRO_MONTHLY_PRICE)}/mo`;
  const annualNote = isAnnual ? `Billed annually · ${fmt(PRO_ANNUAL_TOTAL)}/year` : null;

  const discountedFirst = isAnnual ? PRO_ANNUAL_FIRST : PRO_MONTHLY_FIRST;
  const discountedLabel = isAnnual
    ? `${fmt(discountedFirst)} for your first year`
    : `${fmt(discountedFirst)} for your first month`;

  const handleGetPro = () => setShowWaitlistPopup(true);

  const closeWaitlistPopup = () => setShowWaitlistPopup(false);

  const handleJoinWaitlist = async () => {
    if (!state || submitting) return;
    if (!isValidEmail(email)) {
      Alert.alert('Invalid email', 'Enter a valid email so we can send your discount code.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitProInterest({
        email,
        eventType: 'pay_attempt',
        referralCode: state.referralCode,
        referredByCode: state.referredByCode,
      });
      if (!result.ok) {
        Alert.alert(
          'Could not submit',
          result.error ?? 'Check your connection and try again.',
        );
        return;
      }

      const updated = await markWaitlistJoined(email);
      setState(updated);
      setJoined(true);
      setShowWaitlistPopup(false);

      if (result.alreadyJoined) {
        Alert.alert('Already on the list', `${email.trim()} is already on the waitlist.`);
        return;
      }
      Alert.alert(
        "You're on the list",
        `We'll email ${email.trim()} your ${WAITLIST_DISCOUNT_PERCENT}% off code at launch.\n\n${discountedLabel} (was ${isAnnual ? fmt(PRO_ANNUAL_TOTAL) : fmt(PRO_MONTHLY_PRICE)}).\n\nNo charge today.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    if (!state) return;
    const msg =
      `I'm using ScreenSham to cut my screen time. Install it with my link — when you finish setup I get 1 free Pro month (max 3):\n\n${PLAY_STORE_INSTALL_URL}${state.referralCode}`;
    try {
      await Share.share({ message: msg, title: REFERRAL_COPY.shareTitle });
    } catch {
      // cancelled
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={s.topBar}>
          <Text style={s.title}>ScreenSham Pro</Text>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <Text style={s.hero}>Block every app that steals your time — not just one.</Text>

          <View style={s.plansRow}>
            <View style={s.freeCard}>
              <Text style={s.freeName}>Free</Text>
              <Text style={s.freePrice}>€0</Text>
              {PLAN_FEATURES.free.map((f) => (
                <Text key={f} style={s.freeFeature}>· {f}</Text>
              ))}
            </View>

            <View style={s.proCard}>
              <View style={s.proCardTop}>
                <View style={s.proBadge}><Text style={s.proBadgeText}>PRO</Text></View>
                <View style={s.billingToggleRow}>
                  <Text style={[s.billingLabel, !isAnnual && s.billingLabelActive]}>Monthly</Text>
                  <Switch
                    value={isAnnual}
                    onValueChange={(v) => setBilling(v ? 'annual' : 'monthly')}
                    trackColor={{ false: C.grayDeep, true: C.white }}
                    thumbColor={isAnnual ? C.bg : C.gray}
                    style={s.billingSwitch}
                  />
                  <View>
                    <Text style={[s.billingLabel, isAnnual && s.billingLabelActive]}>Annual</Text>
                    <Text style={s.saveBadge}>−60%</Text>
                  </View>
                </View>
              </View>

              <Text style={s.bigPrice}>{bigPrice}</Text>
              {annualNote && <Text style={s.annualNote}>{annualNote}</Text>}

              <View style={s.divider} />

              {PLAN_FEATURES.pro.map((f) => (
                <View key={f} style={s.featureRow}>
                  <Text style={s.featureCheck}>✓</Text>
                  <Text style={s.featureText}>{f}</Text>
                </View>
              ))}
            </View>
          </View>

          {joined ? (
            <View style={s.joinedPill}>
              <Text style={s.joinedPillText}>✓ You're on the waitlist</Text>
              {state?.email ? (
                <Text style={s.joinedPillEmail}>{state.email}</Text>
              ) : null}
            </View>
          ) : (
            <TouchableOpacity style={s.primaryBtn} onPress={handleGetPro} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>
                Get Pro — {isAnnual ? `${fmt(PRO_ANNUAL_PER_MONTH)}/mo` : `${fmt(PRO_MONTHLY_PRICE)}/mo`}
              </Text>
            </TouchableOpacity>
          )}

          <View style={s.referralBox}>
            <Text style={s.referralTitle}>{REFERRAL_COPY.title}</Text>
            <Text style={s.noCardNote}>No credit card needed.</Text>
            <Text style={s.referralBody}>{REFERRAL_COPY.body}</Text>
            {state?.referralCode && (
              <View style={s.codeBox}>
                <Text style={s.codeLabel}>YOUR INVITE CODE</Text>
                <Text style={s.codeValue} numberOfLines={1} adjustsFontSizeToFit>
                  {state.referralCode}
                </Text>
              </View>
            )}
            <TouchableOpacity style={s.secondaryBtn} onPress={handleShare} activeOpacity={0.85}>
              <Text style={s.secondaryBtnText}>Share invite link</Text>
            </TouchableOpacity>
          </View>

          {source === 'blocked_limit' && (
            <Text style={s.footerHint}>Free plan: 1 blocked app. Pro: unlimited.</Text>
          )}
        </ScrollView>

        {/* Waitlist popup — covers paywall until submit or ✕ */}
        {showWaitlistPopup && (
          <View style={s.popupOverlay}>
            <Pressable style={s.popupBackdrop} onPress={closeWaitlistPopup} />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={s.popupKeyboard}
            >
              <View style={s.popupCard}>
                <View style={s.popupTopBar}>
                  <Text style={s.popupTitle}>Join the waitlist</Text>
                  <TouchableOpacity
                    style={s.popupCloseBtn}
                    onPress={closeWaitlistPopup}
                    activeOpacity={0.7}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={s.popupCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={s.popupHeadline}>
                  {PRO_LAUNCH_COPY.title}. {PRO_LAUNCH_COPY.body}
                </Text>

                <View style={s.discountCallout}>
                  <Text style={s.discountCalloutText}>
                    {WAITLIST_DISCOUNT_PERCENT}% off your first payment — {discountedLabel}
                  </Text>
                </View>

                <Text style={s.inputLabel}>YOUR EMAIL</Text>
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@email.com"
                  placeholderTextColor={C.grayDark}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  style={[s.primaryBtn, submitting && s.primaryBtnDisabled, { marginBottom: 0 }]}
                  onPress={handleJoinWaitlist}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting
                    ? <ActivityIndicator color={C.bg} />
                    : <Text style={s.primaryBtnText}>{PRO_LAUNCH_COPY.cta}</Text>
                  }
                </TouchableOpacity>
                <Text style={s.noChargeNote}>{PRO_LAUNCH_COPY.paywallNote}</Text>
              </View>
            </KeyboardAvoidingView>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { color: C.white, fontSize: 18, fontWeight: '800' },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: C.gray, fontSize: 14, fontWeight: '700' },
  hero: {
    color: C.offWhite, fontSize: 15, lineHeight: 22, fontWeight: '600',
    marginTop: 20, marginBottom: 16, textAlign: 'center',
  },

  plansRow: { flexDirection: 'row', gap: 10, marginBottom: 16, alignItems: 'flex-start' },

  freeCard: {
    width: 100,
    backgroundColor: C.cardBg, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, padding: 12,
  },
  freeName: { color: C.gray, fontSize: 13, fontWeight: '800', marginBottom: 2 },
  freePrice: { color: C.gray, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  freeFeature: { color: C.grayDark, fontSize: 10, lineHeight: 16 },

  proCard: {
    flex: 1,
    backgroundColor: '#141414', borderRadius: 20,
    borderWidth: 1.5, borderColor: C.white, padding: 18,
  },
  proCardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 12,
  },
  proBadge: {
    backgroundColor: C.white, borderRadius: 6,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  proBadgeText: { color: C.bg, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  billingToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  billingSwitch: { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] },
  billingLabel: { color: C.grayDark, fontSize: 11, fontWeight: '700' },
  billingLabelActive: { color: C.white },
  saveBadge: { color: '#4ade80', fontSize: 9, fontWeight: '700', textAlign: 'center', marginTop: 1 },

  bigPrice: { color: C.white, fontSize: 34, fontWeight: '900', letterSpacing: -1, marginBottom: 2 },
  annualNote: { color: C.gray, fontSize: 12, marginBottom: 12 },
  divider: { height: 1, backgroundColor: C.border, marginBottom: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  featureCheck: { color: '#4ade80', fontSize: 13, fontWeight: '700' },
  featureText: { color: C.offWhite, fontSize: 13, flex: 1 },

  primaryBtn: {
    backgroundColor: C.white, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 10,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: C.bg, fontSize: 16, fontWeight: '800' },
  noChargeNote: {
    color: C.grayDark, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 12,
  },

  joinedPill: {
    backgroundColor: 'rgba(74,222,128,0.10)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  joinedPillText: { color: '#4ade80', fontSize: 15, fontWeight: '700' },
  joinedPillEmail: { color: '#4ade80', fontSize: 12, opacity: 0.75, marginTop: 4 },

  // Popup overlay
  popupOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  popupBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  popupKeyboard: {
    width: '100%',
    zIndex: 101,
  },
  popupCard: {
    backgroundColor: C.cardBg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.borderLight,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  popupTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  popupTitle: { color: C.white, fontSize: 18, fontWeight: '800', flex: 1 },
  popupCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.grayDeep,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupCloseText: { color: C.gray, fontSize: 14, fontWeight: '700' },
  popupHeadline: {
    color: C.gray,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    marginBottom: 14,
  },
  discountCallout: {
    backgroundColor: 'rgba(74,222,128,0.10)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.25)',
    paddingVertical: 10, paddingHorizontal: 14, marginBottom: 18,
  },
  discountCalloutText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  inputLabel: {
    color: C.grayDark, fontSize: 10, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 8,
  },
  input: {
    backgroundColor: C.grayDeep, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, color: C.white,
    fontSize: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },

  referralBox: {
    backgroundColor: C.cardBg, borderRadius: 18,
    borderWidth: 1, borderColor: C.border, padding: 18,
    marginTop: 6,
  },
  referralTitle: { color: C.white, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  noCardNote: { color: '#4ade80', fontSize: 12, fontWeight: '600', marginBottom: 10 },
  referralBody: { color: C.gray, fontSize: 13, lineHeight: 20, marginBottom: 16 },
  codeBox: {
    backgroundColor: C.grayDeep, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', marginBottom: 14,
  },
  codeLabel: { color: C.grayDark, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 3 },
  codeValue: { color: C.white, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  secondaryBtn: {
    borderRadius: 14, borderWidth: 1, borderColor: C.borderLight,
    paddingVertical: 14, alignItems: 'center',
  },
  secondaryBtnText: { color: C.white, fontSize: 15, fontWeight: '700' },
  footerHint: { color: C.grayDark, fontSize: 12, textAlign: 'center', marginTop: 16 },
});
