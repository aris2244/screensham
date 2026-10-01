import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { C } from '../../constants/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onGoToPro: () => void;
}

export default function ProPromoModal({ visible, onClose, onGoToPro }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <Text style={s.emoji}>🎁</Text>

          <Text style={s.title}>
            Pro is{' '}
            <Text style={s.free}>FREE</Text>
          </Text>

          <Text style={s.body}>
            Invite a friend — when they install and finish setup, you get{' '}
            <Text style={s.highlight}>1 free Pro month</Text>.
          </Text>

          <Text style={s.noCard}>No credit card. No payment. Just share.</Text>

          <TouchableOpacity style={s.cta} onPress={onGoToPro} activeOpacity={0.85}>
            <Text style={s.ctaText}>Get free Pro →</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    backgroundColor: C.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.borderLight,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 14,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.grayDeep,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: C.gray, fontSize: 13, fontWeight: '700' },
  emoji: { fontSize: 40, marginBottom: 14 },
  title: {
    color: C.white,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
  },
  free: {
    color: '#ff4444',
    fontSize: 28,
    fontWeight: '900',
  },
  body: {
    color: C.gray,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 10,
  },
  noCard: {
    color: '#4ade80',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 0.2,
  },
  highlight: {
    color: C.white,
    fontWeight: '700',
  },
  cta: {
    backgroundColor: C.white,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  ctaText: { color: C.bg, fontSize: 16, fontWeight: '800' },
});
