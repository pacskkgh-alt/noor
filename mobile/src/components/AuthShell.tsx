import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { C } from '../lib/theme';
import { Icon, Logo, Row, T } from './ui';

// غلاف شاشات الدخول: الشعار، وتبديل اللغة، وسطر الأمان
export function AuthShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Row style={{ justifyContent: 'space-between', marginBottom: 24 }}>
            <Row gap={10}>
              <Logo size={40} />
              <View>
                <T w="black" size={22} color={C.teal}>{t('brand')}</T>
                <T size={12} color={C.muted}>{t('tagline')}</T>
              </View>
            </Row>
            <Pressable
              onPress={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              style={{ borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, height: 38, justifyContent: 'center' }}
            >
              <Row gap={6}><Icon name="translate" size={18} color={C.navy} /><T w="bold" size={14}>{lang === 'ar' ? 'EN' : 'ع'}</T></Row>
            </Pressable>
          </Row>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#EEF3F6' }}>{children}</View>
          <Row gap={6} style={{ justifyContent: 'center', marginTop: 20 }}>
            <Icon name="shield-check-outline" size={16} color={C.green} />
            <T size={12} color={C.muted}>{t('auth.secure')}</T>
          </Row>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
