import Constants from 'expo-constants';
import { Linking, View } from 'react-native';
import { Badge, Button, Card, Chip, Icon, Row, Screen, T, TopBar } from '../../components/ui';
import { API_URL } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { C } from '../../lib/theme';
import { confirmAsk } from '../../lib/confirm';

export default function Account() {
  const { t, lang, setLang } = useI18n();
  const { user, signOut } = useAuth();
  if (!user) return null;
  const line = (icon: string, label: string, value: React.ReactNode) => (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <Row gap={10}><Icon name={icon} size={20} color={C.teal} /><T color={C.muted}>{label}</T></Row>
      {value}
    </Row>
  );
  return (
    <Screen>
      <TopBar />
      <Card style={{ alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: C.tealL, alignItems: 'center', justifyContent: 'center' }}>
          <T w="black" size={30} color={C.teal} center>{user.name.replace(/^د\.\s*/, '').trim()[0]}</T>
        </View>
        <T w="black" size={20} color={C.navy} center>{user.name}</T>
        <T size={13} color={C.muted} center>{user.email}</T>
        <Badge label={t('role.' + user.role)} />
      </Card>
      <Card style={{ paddingVertical: 4, marginBottom: 16 }}>
        {line('cellphone-check', t('acc.phone'), (
          <Row gap={6}>
            <T w="bold" ltr>{user.phone || '—'}</T>
            {user.phoneVerified ? <Badge label={t('acc.verified')} icon="check" color={C.green} bg={C.greenL} /> : null}
          </Row>
        ))}
        {line('translate', t('acc.lang'), (
          <Row gap={6}>
            <Chip label="العربية" active={lang === 'ar'} onPress={() => setLang('ar')} />
            <Chip label="English" active={lang === 'en'} onPress={() => setLang('en')} />
          </Row>
        ))}
        <Row style={{ justifyContent: 'space-between', paddingVertical: 12 }}>
          <Row gap={10}><Icon name="file-document-outline" size={20} color={C.teal} /><T color={C.muted}>{t('acc.terms')}</T></Row>
          <Button small kind="ghost" icon="open-in-new" title="" onPress={() => Linking.openURL(API_URL + '/#/terms')} />
        </Row>
      </Card>
      <Button kind="danger" icon="logout" title={t('acc.logout')} onPress={async () => { if (await confirmAsk(t('acc.confirmLogout'), t('acc.logout'), t('cancel'))) signOut(); }} />
      <T size={12} color={C.muted} center style={{ marginTop: 16 }}>{t('acc.version', { v: Constants.expoConfig?.version || '1.0.0' })}</T>
    </Screen>
  );
}
