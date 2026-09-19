import { Alert, AppState, InteractionManager } from 'react-native';

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

/** Avoid "Tried to show an alert while not attached to an Activity". */
export function safeAlert(
  title: string,
  message: string,
  buttons?: AlertButton[],
): void {
  const show = () => {
    InteractionManager.runAfterInteractions(() => {
      if (AppState.currentState === 'active') {
        Alert.alert(title, message, buttons);
      }
    });
  };

  if (AppState.currentState === 'active') {
    show();
  } else {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sub.remove();
        setTimeout(show, 300);
      }
    });
  }
}
