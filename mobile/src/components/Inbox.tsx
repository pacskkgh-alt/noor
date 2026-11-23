// صندوق الطبيب: الفحوصات التي شاركها المرضى معه
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { api } from '../lib/api';
import { NoorFile } from '../lib/files';
import { useI18n } from '../lib/i18n';
import { C, R } from '../lib/theme';
import { FileCard } from './FileCard';
import { Badge, Button, Card, Empty, ErrorBox, Icon, Loading, Row, Screen, T, TopBar } from './ui';

type Share = { id: string; patientName: string; message?: string; createdAt: string; expiresAt: string; files: (NoorFile & { myNotes?: number })[] };

export default function Inbox() {
  const { t, fmtDate, errMsg } = useI18n();
  const [data, setData] = useState<{ shares: Share[]; pending?: boolean; status?: string } | null>(null);
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { setData(await api('/api/doctor/inbox')); setErr(''); } catch (e) { setErr(errMsg(e)); }
  }, [errMsg]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen refresh={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <TopBar />
      <T w="black" size={24} color={C.navy} style={{ marginBottom: 14 }}>{t('in.title')}</T>
      <ErrorBox text={err} />
      {err ? <Button kind="secondary" title={t('retry')} onPress={load} /> : null}
      {!data && !err ? <Loading /> : null}
      {data?.pending ? (
        <View style={{ backgroundColor: C.amberL, borderRadius: R.lg, padding: 16, gap: 6 }}>
          <Row><Icon name="clock-outline" color={C.amber} /><T w="bold" color={C.amber}>{t('in.pending')}</T></Row>
          <T color={C.ink}>{t('in.pendingSub')}</T>
        </View>
      ) : null}
      {data && !data.pending && data.shares.length === 0 ? <Empty icon="inbox-outline" title={t('in.empty')} /> : null}
      <View style={{ gap: 16 }}>
        {data?.shares.map(s => (
          <Card key={s.id} style={{ gap: 12, backgroundColor: C.tealXL }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={8}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }}>
                  <T w="bold" color="#fff">{s.patientName.trim()[0]}</T>
                </View>
                <T w="bold" size={16} color={C.navy}>{t('in.from', { name: s.patientName })}</T>
              </Row>
              <Badge label={t('in.expires', { date: fmtDate(s.expiresAt) })} icon="clock-outline" color={C.amber} bg={C.goldL} />
            </Row>
            {s.message ? <T color={C.ink} style={{ backgroundColor: '#fff', padding: 10, borderRadius: R.md }}>“{s.message}”</T> : null}
            {s.files.map(f => <FileCard key={f.id} f={f} />)}
          </Card>
        ))}
      </View>
    </Screen>
  );
}
