import { router } from 'expo-router';
import { useState } from 'react';
import { AuthShell } from '../components/AuthShell';
import { Challenge, OtpStep } from '../components/OtpStep';
import { Button, ErrorBox, Field, T } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { C } from '../lib/theme';

export default function Forgot() {
  const { t, errMsg } = useI18n();
  const { signedIn } = useAuth();
  const [id, setId] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ch, setCh] = useState<Challenge | null>(null);

  const send = async () => {
    if (!id.trim()) return setErr(t('err.missing_fields'));
    setErr(''); setBusy(true);
    try { setCh(await api<Challenge>('/api/auth/forgot', { body: { identifier: id.trim() } })); }
    catch (e: any) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  if (ch) return <AuthShell><OtpStep ch={ch} withPassword onDone={signedIn} onBack={() => setCh(null)} /></AuthShell>;
  return (
    <AuthShell>
      <T w="black" size={24} color={C.navy}>{t('auth.forgotTitle')}</T>
      <T color={C.muted} style={{ marginTop: 6, marginBottom: 18 }}>{t('auth.forgotSub')}</T>
      <Field label={t('auth.identifier')} value={id} onChangeText={setId} autoCapitalize="none" ltr />
      <ErrorBox text={err} />
      <Button title={t('auth.send')} onPress={send} loading={busy} />
      <Button kind="ghost" title={t('otp.back')} onPress={() => router.back()} style={{ marginTop: 8 }} />
    </AuthShell>
  );
}
