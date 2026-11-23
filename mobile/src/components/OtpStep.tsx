// إدخال رمز التحقق المرسل بالجوال (Authentica) — مشترك بين الدخول والتسجيل واستعادة كلمة المرور
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { api } from '../lib/api';
import { User } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { C, F, R } from '../lib/theme';
import { Button, ErrorBox, Field, T } from './ui';

export type Challenge = { challengeId: string; purpose: string; phoneMasked?: string; resendIn?: number; devCode?: string };

export function OtpStep({ ch, onDone, onBack, withPassword }: {
  ch: Challenge; onDone: (u: User) => void; onBack: () => void; withPassword?: boolean;
}) {
  const { t, errMsg } = useI18n();
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(ch.resendIn ?? 60);
  const [dev, setDev] = useState(ch.devCode);

  useEffect(() => {
    const id = setInterval(() => setWait(w => Math.max(0, w - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const verify = async () => {
    if (code.length !== 6) return setErr(t('err.otp_invalid'));
    if (withPassword && pw.length < 8) return setErr(t('err.weak_password'));
    setErr(''); setBusy(true);
    try {
      const r = await api<{ user: User }>('/api/auth/otp/verify', { body: { challengeId: ch.challengeId, code, newPassword: withPassword ? pw : undefined } });
      onDone(r.user);
    } catch (e: any) {
      setErr(e.code === 'otp_invalid' && e.data?.remaining != null ? t('err.otp_invalid') : errMsg(e));
    } finally { setBusy(false); }
  };
  const resend = async () => {
    setErr('');
    try {
      const r = await api<Challenge>('/api/auth/otp/resend', { body: { challengeId: ch.challengeId } });
      setWait(r.resendIn ?? 60); setDev(r.devCode);
    } catch (e: any) { setErr(errMsg(e)); }
  };

  return (
    <View>
      <T w="black" size={24} color={C.navy}>{ch.purpose === 'login' ? t('otp.titleLogin') : t('otp.title')}</T>
      <T color={C.muted} style={{ marginTop: 6, marginBottom: 20 }}>
        {ch.phoneMasked ? t('otp.sentTo', { phone: ch.phoneMasked }) : t('otp.sentGeneric')}
      </T>
      {dev ? <View style={{ backgroundColor: C.goldL, borderRadius: R.md, padding: 10, marginBottom: 12 }}><T w="bold" color={C.amber}>{t('otp.dev', { code: dev })}</T></View> : null}
      <TextInput
        value={code}
        onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        autoFocus
        placeholder="••••••"
        placeholderTextColor="#B8C4CB"
        style={{
          height: 64, borderWidth: 1.5, borderColor: code.length === 6 ? C.teal : C.line, borderRadius: R.lg, backgroundColor: '#fff',
          textAlign: 'center', fontSize: 30, letterSpacing: 12, fontFamily: F.bold, color: C.navy, writingDirection: 'ltr', marginBottom: 16,
        }}
      />
      {withPassword ? <Field label={t('auth.newPassword')} hint={t('auth.pwHint')} value={pw} onChangeText={setPw} secureTextEntry ltr autoComplete="new-password" /> : null}
      <ErrorBox text={err} />
      <Button title={t('otp.verify')} onPress={verify} loading={busy} />
      <View style={{ alignItems: 'center', marginTop: 16, gap: 6 }}>
        {wait > 0 ? <T color={C.muted}>{t('otp.resendIn', { s: wait })}</T> : <Button kind="ghost" title={t('otp.resend')} onPress={resend} />}
        <Button kind="ghost" title={t('otp.back')} onPress={onBack} />
      </View>
    </View>
  );
}
