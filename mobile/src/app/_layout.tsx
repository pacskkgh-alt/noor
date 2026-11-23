import { Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold, useFonts } from '@expo-google-fonts/tajawal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Loading } from '../components/ui';
import { AuthProvider, useAuth } from '../lib/auth';
import { I18nProvider } from '../lib/i18n';
import { C } from '../lib/theme';

function Root() {
  const { user, ready } = useAuth();
  if (!ready) return <View style={{ flex: 1, backgroundColor: C.bg }}><Loading /></View>;
  const inside = !!user;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Protected guard={!inside}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot" />
      </Stack.Protected>
      <Stack.Protected guard={inside}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="file/[id]" />
        <Stack.Screen name="viewer/[id]" options={{ contentStyle: { backgroundColor: C.dark } }} />
        <Stack.Screen name="upload" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function Layout() {
  const [loaded] = useFonts({ Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Root />
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
