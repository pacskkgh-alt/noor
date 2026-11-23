import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { FileCard } from '../../components/FileCard';
import Inbox from '../../components/Inbox';
import { Button, Card, Chip, Empty, ErrorBox, Icon, Loading, Row, Screen, T, TopBar } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { CATS, NoorFile } from '../../lib/files';
import { useI18n } from '../../lib/i18n';
import { C, F, R } from '../../lib/theme';

export default function Home() {
  const { user } = useAuth();
  return user?.role === 'doctor' ? <Inbox /> : <Files />;
}

function Files() {
  const { t, fmtSize, row, align, errMsg } = useI18n();
  const { user } = useAuth();
  const [files, setFiles] = useState<NoorFile[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setFiles((await api<{ files: NoorFile[] }>('/api/files')).files); setErr(''); }
    catch (e) { setErr(errMsg(e)); }
  }, [errMsg]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (files || [])
      .filter(f => (cat === 'all' || f.category === cat) && (!s || `${f.title} ${f.center || ''}`.toLowerCase().includes(s)))
      .sort((a, b) => (b.examDate || b.createdAt).localeCompare(a.examDate || a.createdAt));
  }, [files, q, cat]);

  const stats = files ? [
    { icon: 'folder-outline', value: String(files.length), label: t('home.files') },
    { icon: 'radiology-box-outline', value: String(files.filter(f => f.kind === 'dicom').length), label: t('home.imaging') },
    { icon: 'database-outline', value: fmtSize(files.reduce((a, f) => a + (f.size || 0), 0)), label: t('home.storage') },
    { icon: 'note-text-outline', value: String(files.reduce((a, f) => a + (f.notesCount || 0), 0)), label: t('home.notes') },
  ] : [];

  return (
    <Screen refresh={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <TopBar />
      <T w="black" size={26} color={C.navy}>{t('home.hello', { name: user?.name.split(' ')[0] || '' })} 👋</T>
      <Row gap={6} style={{ marginTop: 2, marginBottom: 16 }}>
        <Icon name="shield-check-outline" size={16} color={C.green} />
        <T size={13} color={C.muted} style={{ flex: 1 }}>{t('home.safe')}</T>
      </Row>

      {files === null && !err ? <Loading /> : null}
      <ErrorBox text={err} />
      {err ? <Button kind="secondary" title={t('retry')} onPress={load} /> : null}

      {files ? (
        <>
          <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            {stats.map(s => (
              <Card key={s.label} style={{ width: '48%', flexGrow: 1, padding: 14 }}>
                <Row gap={10}>
                  <View style={{ width: 40, height: 40, borderRadius: R.md, backgroundColor: C.tealL, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={s.icon} size={22} color={C.teal} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T w="black" size={18} color={C.navy}>{s.value}</T>
                    <T size={12} color={C.muted}>{s.label}</T>
                  </View>
                </Row>
              </Card>
            ))}
          </View>

          <View style={{ flexDirection: row, alignItems: 'center', backgroundColor: '#fff', borderRadius: R.md, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, height: 50, gap: 8, marginBottom: 12 }}>
            <Icon name="magnify" size={22} color={C.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder={t('home.search')} placeholderTextColor="#9AA8B1"
              style={{ flex: 1, fontFamily: F.regular, fontSize: 15, color: C.ink, textAlign: align }} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}
            contentContainerStyle={{ gap: 8, flexDirection: row }}>
            {['all', ...CATS].map(c => <Chip key={c} label={t('cat.' + c)} active={cat === c} onPress={() => setCat(c)} />)}
          </ScrollView>

          <T w="bold" size={18} color={C.navy} style={{ marginBottom: 10 }}>{t('home.latest')}</T>
          {files.length === 0 ? <Empty icon="folder-plus-outline" title={t('home.empty')} sub={t('home.emptySub')} /> : null}
          {files.length > 0 && list.length === 0 ? <Empty icon="magnify" title={t('home.noResults')} /> : null}
          <View style={{ gap: 12 }}>{list.map(f => <FileCard key={f.id} f={f} />)}</View>
        </>
      ) : null}
    </Screen>
  );
}
