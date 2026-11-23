import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';
import { fileSubtitle } from '../../components/FileCard';
import { Badge, Button, Card, CatTile, Empty, ErrorBox, Icon, Loading, Row, Screen, T } from '../../components/ui';
import { api, fileSource } from '../../lib/api';
import { confirmAsk } from '../../lib/confirm';
import { NoorFile } from '../../lib/files';
import { useI18n } from '../../lib/i18n';
import { C, R } from '../../lib/theme';
import { webUrl } from '../../lib/web';

type Note = { id: string; text: string; doctorName: string; specialty?: string; createdAt: string };

export default function FileDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, fmtDate, fmtSize, errMsg, rtl } = useI18n();
  const [f, setF] = useState<NoorFile | null>(null);
  const [own, setOwn] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ file: NoorFile; own: boolean }>(`/api/files/${id}`);
      setF(r.file); setOwn(r.own);
      setNotes((await api<{ notes: Note[] }>(`/api/files/${id}/notes`)).notes);
    } catch (e) { setErr(errMsg(e)); }
  }, [id, errMsg]);
  useEffect(() => { load(); }, [load]);

  const openInBrowser = async (q = '') => {
    try { Linking.openURL(await webUrl(`/api/files/${id}/content`) + q); } catch (e) { setErr(errMsg(e)); }
  };
  const del = async () => {
    if (!f || !(await confirmAsk(t('file.confirmDelete', { title: f.title }), t('file.delete'), t('cancel')))) return;
    setBusy(true);
    try { await api(`/api/files/${id}`, { method: 'DELETE' }); router.back(); } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };

  const info = (icon: string, label: string, value?: string) => value ? (
    <Row style={{ paddingVertical: 8 }} gap={10}>
      <Icon name={icon} size={18} color={C.muted} />
      <T size={13} color={C.muted} style={{ width: 90 }}>{label}</T>
      <T w="medium" style={{ flex: 1 }}>{value}</T>
    </Row>
  ) : null;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }}>
          <Icon name={rtl ? 'arrow-right' : 'arrow-left'} color={C.navy} />
        </Pressable>
        <T w="bold" size={17} color={C.navy}>{t('file.details')}</T>
        <View style={{ width: 42 }} />
      </Row>
      <ErrorBox text={err} />
      {!f && !err ? <Loading /> : null}
      {f ? (
        <View style={{ gap: 14 }}>
          <Card style={{ gap: 6 }}>
            <Row center={false} gap={12}>
              <CatTile category={f.category} size={52} />
              <View style={{ flex: 1, gap: 4 }}>
                <Badge label={t('cat.' + f.category)} />
                <T w="black" size={19} color={C.navy}>{f.title}</T>
                <T size={13} color={C.muted}>{fileSubtitle(f, t, fmtSize)}</T>
              </View>
            </Row>
            <View style={{ height: 1, backgroundColor: C.line, marginVertical: 6 }} />
            {info('hospital-building', t('file.center'), f.center)}
            {info('calendar-blank-outline', t('file.date'), fmtDate(f.examDate || f.createdAt))}
            {info('database-outline', t('file.size'), fmtSize(f.size))}
            {info('text', own ? t('file.notesField') : t('file.patientNotes'), f.notes)}
          </Card>

          {f.kind === 'dicom' ? (
            <Card style={{ backgroundColor: C.dark, borderColor: C.dark, gap: 12 }}>
              <Row gap={10}>
                <Icon name="radiology-box-outline" size={26} color={C.overlay} />
                <T w="bold" color="#fff" size={16} style={{ flex: 1 }}>{t('file.series')}</T>
              </Row>
              {(f.series || []).map(s => (
                <Row key={s.idx} style={{ backgroundColor: C.darkPanel, borderRadius: R.md, padding: 10, justifyContent: 'space-between' }}>
                  <T color="#fff" w="medium" size={14} style={{ flex: 1 }} numberOfLines={1}>{s.description || s.modality || '—'}</T>
                  <T color={C.overlay} size={13}>{t('home.images', { n: s.images })}</T>
                </Row>
              ))}
              <Button title={t('file.openViewer')} icon="arrow-expand-all" onPress={() => router.push(`/viewer/${f.id}`)} />
              {(f.attachments || []).map(a => (
                <Button key={a.id} kind="secondary" icon="file-pdf-box" title={t('file.report')} onPress={() => openInBrowser(`?attachment=${a.id}`)} />
              ))}
            </Card>
          ) : f.kind === 'image' ? (
            <Card style={{ padding: 8 }}>
              <Image source={fileSource(f.id)} style={{ width: '100%', aspectRatio: 1, borderRadius: R.md }} resizeMode="contain" />
            </Card>
          ) : (
            <Button title={t('file.open')} icon={f.kind === 'pdf' ? 'file-pdf-box' : 'play-circle-outline'} onPress={() => openInBrowser()} />
          )}

          <Card style={{ gap: 10 }}>
            <Row gap={8}><Icon name="note-text-outline" color={C.teal} /><T w="bold" size={16} color={C.navy}>{t('file.notes')}</T></Row>
            {notes.length === 0 ? <T color={C.muted}>{t('file.noNotes')}</T> : notes.map(n => (
              <View key={n.id} style={{ backgroundColor: C.tealXL, borderRadius: R.md, padding: 12, gap: 4 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T w="bold" color={C.navy}>{n.doctorName}</T>
                  <T size={12} color={C.muted}>{fmtDate(n.createdAt)}</T>
                </Row>
                {n.specialty ? <T size={12} color={C.muted}>{n.specialty}</T> : null}
                <T>{n.text}</T>
              </View>
            ))}
          </Card>

          {own ? <Button kind="danger" icon="trash-can-outline" title={t('file.delete')} onPress={del} loading={busy} /> : null}
        </View>
      ) : null}
      {f === null && err ? <Empty icon="alert-circle-outline" title={err} /> : null}
    </Screen>
  );
}
