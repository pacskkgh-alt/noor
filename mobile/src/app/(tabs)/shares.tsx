import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { confirmAsk } from '../../lib/confirm';
import { Badge, Button, Card, Empty, ErrorBox, Icon, Loading, Row, Screen, T, TopBar } from '../../components/ui';
import { api, API_URL } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { C, R } from '../../lib/theme';

type Share = {
  id: string; recipientName: string; recipientType: string; token: string; pin: string; expiresAt: string; revoked: boolean;
  active: boolean; views: number; files: { id: string; title: string }[]; createdAt: string;
};

export default function Shares() {
  const { t, fmtDate, errMsg } = useI18n();
  const [shares, setShares] = useState<Share[] | null>(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { setShares((await api<{ shares: Share[] }>('/api/shares')).shares); setErr(''); } catch (e) { setErr(errMsg(e)); }
  }, [errMsg]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const revoke = async (s: Share) => {
    if (!(await confirmAsk(t('sh.confirmRevoke'), t('sh.revoke'), t('cancel')))) return;
    try { await api(`/api/shares/${s.id}/revoke`, { method: 'POST' }); load(); } catch (e) { setErr(errMsg(e)); }
  };
  const copy = async (s: Share) => {
    await Clipboard.setStringAsync(`${API_URL}/s/${s.token}`);
    setCopied(s.id); setTimeout(() => setCopied(''), 1500);
  };

  return (
    <Screen refresh={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <TopBar />
      <T w="black" size={24} color={C.navy} style={{ marginBottom: 14 }}>{t('sh.title')}</T>
      <ErrorBox text={err} />
      {!shares && !err ? <Loading /> : null}
      {shares && shares.length === 0 ? <Empty icon="share-variant-outline" title={t('sh.empty')} /> : null}
      <View style={{ gap: 12 }}>
        {shares?.map(s => {
          const st = s.revoked ? 'revoked' : s.active ? 'active' : 'expired';
          const col = { active: [C.green, C.greenL], expired: [C.muted, '#EDF1F3'], revoked: [C.red, C.redL] }[st];
          return (
            <Card key={s.id} style={{ gap: 10 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T w="bold" size={16} color={C.navy} style={{ flex: 1 }}>{s.recipientName}</T>
                <Badge label={t('sh.' + st)} color={col[0]} bg={col[1]} />
              </Row>
              <T size={13} color={C.muted}>{s.files.map(f => f.title).join('، ') || '—'}</T>
              <Row gap={14} style={{ flexWrap: 'wrap' }}>
                <Row gap={4}><Icon name="clock-outline" size={15} color={C.muted} /><T size={12} color={C.muted}>{t('sh.until', { date: fmtDate(s.expiresAt) })}</T></Row>
                <Row gap={4}><Icon name="eye-outline" size={15} color={C.muted} /><T size={12} color={C.muted}>{t('sh.views', { n: s.views })}</T></Row>
              </Row>
              {s.active ? (
                <>
                  <Row style={{ backgroundColor: C.tealXL, borderRadius: R.md, padding: 10, justifyContent: 'space-between' }}>
                    <T size={13} color={C.muted}>{t('sh.pin')}</T>
                    <T w="black" size={22} color={C.teal} ltr style={{ letterSpacing: 4 }}>{s.pin}</T>
                  </Row>
                  <Row gap={8}>
                    <Button small kind="secondary" icon={copied === s.id ? 'check' : 'content-copy'} title={copied === s.id ? t('sh.copied') : t('sh.copyLink')} onPress={() => copy(s)} style={{ flex: 1 }} />
                    <Button small kind="danger" icon="link-off" title={t('sh.revoke')} onPress={() => revoke(s)} />
                  </Row>
                </>
              ) : null}
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
