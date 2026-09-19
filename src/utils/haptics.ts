import { Platform, Vibration } from 'react-native';

/** Very short tick — used when a minute or carousel step changes. */
export function tickHaptic(): void {
  if (Platform.OS !== 'android') return;
  Vibration.vibrate(8);
}
