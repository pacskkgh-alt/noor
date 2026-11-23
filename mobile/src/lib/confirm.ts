import { Alert, Platform } from 'react-native';

// نافذة تأكيد تعمل على الجوال والويب
export function confirmAsk(message: string, ok: string, cancel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm ? globalThis.confirm(message) : true);
  return new Promise(res =>
    Alert.alert('', message, [
      { text: cancel, style: 'cancel', onPress: () => res(false) },
      { text: ok, style: 'destructive', onPress: () => res(true) },
    ]),
  );
}
