// عارض الأشعة الاحترافي: نفس عارض الموقع (Cornerstone3D) داخل WebView بنفس الحساب
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Button, ErrorBox, Loading } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { C } from '../../lib/theme';
import { webUrl } from '../../lib/web';

export default function Viewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, errMsg } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    webUrl(`/m/view/${id}`).then(setUrl).catch(e => setErr(errMsg(e)));
  }, [id, errMsg]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.dark }} edges={['top', 'bottom']}>
      {err ? (
        <View style={{ padding: 16 }}><ErrorBox text={err} /><Button title={t('close')} onPress={() => router.back()} /></View>
      ) : !url ? <Loading /> : Platform.OS === 'web' ? (
        // على الويب (للاختبار فقط) نعرض الصفحة في إطار
        <iframe src={url} style={{ flex: 1, border: 0, width: '100%', height: '100%' } as any} />
      ) : (
        <WebView
          source={{ uri: url }}
          style={{ flex: 1, backgroundColor: C.dark }}
          originWhitelist={['https://*', 'http://*']}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          onMessage={e => { if (e.nativeEvent.data === 'close') router.back(); }}
          startInLoadingState
          renderLoading={() => <View style={{ position: 'absolute', inset: 0, backgroundColor: C.dark }}><Loading /></View>}
        />
      )}
    </SafeAreaView>
  );
}
