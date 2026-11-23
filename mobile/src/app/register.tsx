import { Link } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { AuthShell } from '../components/AuthShell';
import { Challenge, OtpStep } from '../components/OtpStep';
import { Button, Chip, ErrorBox, Field, Icon, Row, T } from '../components/ui';
import { api, API_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { C, R } from '../lib/theme';

export default function Register() {
  const { t, errMsg } = useI18n();
  const { signedIn } = useAuth();
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ch, setCh] = useState<Challenge | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.name.trim() || !f.email.trim() || !f.phone.trim() || !f.password) return setErr(t('err.missing_fields'));
    if (f.password.length < 8) return setErr(t('err.weak_password'));
    setErr(''); setBusy(true);
    try {
      // الخادم يستقبل التسجيل كنموذج (multipart) لأن تسجيل الطبيب يتضمن ملف الرخصة
      const fd = new FormData();
      fd.append('role', 'patient');
      fd.append('name', f.name.trim());
      fd.append('email', f.email.trim());
      fd.append('phone', f.phone.trim());
      fd.append('password', f.password);
      const r = await api<Challenge>('/api/auth/register', { body: fd });
      setCh(r);
    } catch (e: any) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  if (ch) return <AuthShell><OtpStep ch={ch} onDone={signedIn} onBack={() => setCh(null)} /></AuthShell>;
  return (
    <AuthShell>
      <T w="black" size={26} color={C.navy} style={{ marginBottom: 14 }}>{t('auth.register')}</T>
      <Row gap={8} style={{ marginBottom: 16 }}>
        <Chip label={t('auth.patient')} icon="account-outline" active={role === 'patient'} onPress={() => setRole('patient')} />
        <Chip label={t('auth.doctor')} icon="stethoscope" active={role === 'doctor'} onPress={() => setRole('doctor')} />
      </Row>
      {role === 'doctor' ? (
        <View style={{ backgroundColor: C.tealXL, borderRadius: R.md, padding: 14, gap: 12 }}>
          <Row center={false}><Icon name="shield-account-outline" color={C.teal} /><T style={{ flex: 1 }}>{t('auth.doctorWeb')}</T></Row>
          <Button title={t('auth.openSite')} icon="open-in-new" onPress={() => Linking.openURL(API_URL + '/#/register')} />
        </View>
      ) : (
        <>
          <Field label={t('auth.name')} value={f.name} onChangeText={set('name')} autoComplete="name" />
          <Field label={t('auth.email')} value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" ltr />
          <Field label={t('auth.mobile')} hint={t('auth.mobileHint')} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="05XXXXXXXX" ltr />
          <Field label={t('auth.password')} hint={t('auth.pwHint')} value={f.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password" ltr />
          <ErrorBox text={err} />
          <Button title={t('auth.register')} onPress={submit} loading={busy} />
        </>
      )}
      <Row style={{ justifyContent: 'center', marginTop: 18 }} gap={6}>
        <T color={C.muted}>{t('auth.haveAccount')}</T>
        <Link href="/login"><T w="bold" color={C.teal}>{t('auth.login')}</T></Link>
      </Row>
    </AuthShell>
  );
}
