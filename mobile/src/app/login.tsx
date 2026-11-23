import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AuthShell } from '../components/AuthShell';
import { Challenge, OtpStep } from '../components/OtpStep';
import { Button, ErrorBox, Field, Row, T } from '../components/ui';
import { api } from '../lib/api';
import { useAuth, User } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { C } from '../lib/theme';

type LoginRes = { user?: User } & Partial<Challenge> & { otpRequired?: boolean; needPhone?: boolean; phone?: string };

export default function Login() {
  const { t, errMsg } = useI18n();
  const { signedIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ch, setCh] = useState<Challenge | null>(null);
  const [needPhone, setNeedPhone] = useState<string | null>(null);

  const done = (u: User) => {
    if (u.role === 'admin') { setErr(t('err.invalid_credentials')); return; }
    signedIn(u);
  };
  const submit = async () => {
    if (!email.trim() || !password) return setErr(t('err.missing_fields'));
    setErr(''); setBusy(true);
    try {
      const r = await api<LoginRes>('/api/auth/login', { body: { email: email.trim(), password } });
      if (r.user) done(r.user);
      else if (r.needPhone) { setNeedPhone(r.challengeId!); setPhone(r.phone || ''); }
      else if (r.otpRequired) setCh(r as Challenge);
    } catch (e: any) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const sendPhone = async () => {
    setErr(''); setBusy(true);
    try {
      const r = await api<Challenge>('/api/auth/otp/phone', { body: { challengeId: needPhone, phone } });
      setCh(r); setNeedPhone(null);
    } catch (e: any) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  if (ch) return <AuthShell><OtpStep ch={ch} onDone={done} onBack={() => setCh(null)} /></AuthShell>;
  if (needPhone) {
    return (
      <AuthShell>
        <T w="black" size={24} color={C.navy}>{t('otp.addPhone')}</T>
        <T color={C.muted} style={{ marginTop: 6, marginBottom: 18 }}>{t('otp.addPhoneSub')}</T>
        <Field label={t('auth.mobile')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="05XXXXXXXX" ltr />
        <ErrorBox text={err} />
        <Button title={t('auth.send')} onPress={sendPhone} loading={busy} />
        <Button kind="ghost" title={t('otp.back')} onPress={() => setNeedPhone(null)} style={{ marginTop: 8 }} />
      </AuthShell>
    );
  }
  return (
    <AuthShell>
      <T w="black" size={26} color={C.navy} style={{ marginBottom: 18 }}>{t('auth.login')}</T>
      <Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" ltr />
      <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" ltr onSubmitEditing={submit} />
      <Link href="/forgot" style={{ marginBottom: 16 }}><T w="bold" color={C.teal} size={14}>{t('auth.forgot')}</T></Link>
      <ErrorBox text={err} />
      <Button title={t('auth.login')} onPress={submit} loading={busy} />
      <Row style={{ justifyContent: 'center', marginTop: 18 }} gap={6}>
        <T color={C.muted}>{t('auth.noAccount')}</T>
        <Link href="/register"><T w="bold" color={C.teal}>{t('auth.register')}</T></Link>
      </Row>
      <View />
    </AuthShell>
  );
}
