// رفع فحص: الكاميرا أو الصور أو الملفات (PDF، أشعة DICOM، فيديو)
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { Button, Card, Chip, ErrorBox, Field, Icon, Row, Screen, T } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { CATS } from '../lib/files';
import { useI18n } from '../lib/i18n';
import { C, R } from '../lib/theme';

type Picked = { uri: string; name: string; type: string; size?: number; file?: File };

export default function Upload() {
  const { t, row, rtl, fmtSize, errMsg } = useI18n();
  const { user, refresh } = useAuth();
  const [items, setItems] = useState<Picked[]>([]);
  const [form, setForm] = useState({ title: '', category: 'imaging', examDate: '', center: '', notes: '' });
  const [terms, setTerms] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ files: number; skipped: number } | null>(null);
  const needTerms = !user?.termsAcceptedAt;
  const set = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }));
  const add = (list: Picked[]) => setItems(p => [...p, ...list.filter(x => !p.some(y => y.uri === x.uri))]);

  const fromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!r.canceled) add(r.assets.map((a, i) => ({ uri: a.uri, name: a.fileName || `photo-${Date.now()}-${i}.jpg`, type: a.mimeType || 'image/jpeg', size: a.fileSize, file: (a as any).file })));
  };
  const fromPhotos = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, quality: 1 });
    if (!r.canceled) add(r.assets.map((a, i) => ({ uri: a.uri, name: a.fileName || `media-${Date.now()}-${i}`, type: a.mimeType || (a.type === 'video' ? 'video/mp4' : 'image/jpeg'), size: a.fileSize, file: (a as any).file })));
  };
  const fromFiles = async () => {
    const r = await DocumentPicker.getDocumentAsync({ multiple: true, type: '*/*', copyToCacheDirectory: true });
    if (!r.canceled) add(r.assets.map(a => ({ uri: a.uri, name: a.name, type: a.mimeType || 'application/octet-stream', size: a.size, file: a.file })));
  };

  const send = async () => {
    if (!items.length) return setErr(t('up.pick'));
    if (needTerms && !terms) return setErr(t('err.terms_required'));
    setErr(''); setBusy(true);
    try {
      const fd = new FormData();
      for (const it of items) {
        // على الجوال يُرسل الملف بمساره، وعلى الويب بالكائن File نفسه
        if (Platform.OS === 'web' && it.file) fd.append('files', it.file, it.name);
        else fd.append('files', { uri: it.uri, name: it.name, type: it.type } as any);
      }
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append('acceptTerms', needTerms && terms ? '1' : '');
      fd.append('attachPdfToStudy', '1');
      const r = await api<{ files: unknown[]; skipped: unknown[] }>('/api/files', { body: fd });
      if (needTerms) refresh();
      setResult({ files: r.files.length, skipped: r.skipped.length });
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  if (result) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
          <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: C.greenL, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check-circle" size={56} color={C.green} />
          </View>
          <T w="black" size={22} color={C.navy} center>{t('up.done')}</T>
          {result.skipped ? <T color={C.amber} center>{t('up.skipped', { n: result.skipped })}</T> : null}
          <Button title={t('close')} onPress={() => router.back()} style={{ alignSelf: 'stretch', marginTop: 16 }} />
        </View>
      </Screen>
    );
  }

  const source = (icon: string, label: string, sub: string | null, onPress: () => void) => (
    <Pressable onPress={onPress} style={{ flex: 1, backgroundColor: '#fff', borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 14, alignItems: 'center', gap: 6 }}>
      <View style={{ width: 48, height: 48, borderRadius: R.md, backgroundColor: C.tealL, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={26} color={C.teal} />
      </View>
      <T w="bold" center size={14}>{label}</T>
      {sub ? <T size={11} color={C.muted} center>{sub}</T> : null}
    </Pressable>
  );

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <T w="black" size={24} color={C.navy}>{t('up.title')}</T>
        <Pressable onPress={() => router.back()} hitSlop={12}><Icon name="close" size={26} color={C.muted} /></Pressable>
      </Row>
      <Row gap={10} style={{ marginBottom: 8 }} center={false}>
        {Platform.OS !== 'web' ? source('camera-outline', t('up.camera'), null, fromCamera) : null}
        {source('image-multiple-outline', t('up.photos'), null, fromPhotos)}
        {source('file-upload-outline', t('up.files'), t('up.filesSub'), fromFiles)}
      </Row>
      <T size={12} color={C.muted} style={{ marginBottom: 14 }}>{t('up.cdHint')}</T>

      {items.length ? (
        <Card style={{ marginBottom: 16, gap: 8 }}>
          <T w="bold" color={C.navy}>{t('up.selected')} ({items.length})</T>
          {items.map(it => (
            <Row key={it.uri} gap={8}>
              <Icon name={it.type.startsWith('image') ? 'image-outline' : it.type.startsWith('video') ? 'video-outline' : 'file-outline'} size={20} color={C.teal} />
              <T size={13} style={{ flex: 1 }} numberOfLines={1}>{it.name}</T>
              {it.size ? <T size={12} color={C.muted}>{fmtSize(it.size)}</T> : null}
              <Pressable onPress={() => setItems(p => p.filter(x => x !== it))} hitSlop={8}><Icon name="close-circle" size={20} color={C.muted} /></Pressable>
            </Row>
          ))}
        </Card>
      ) : null}

      <Field label={t('up.name')} value={form.title} onChangeText={set('title')} />
      <T w="medium" size={14} color={C.navy} style={{ marginBottom: 6 }}>{t('up.category')}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8, flexDirection: row }}>
        {CATS.map(c => <Chip key={c} label={t('cat.' + c)} active={form.category === c} onPress={() => set('category')(c)} />)}
      </ScrollView>
      <Field label={t('up.date')} value={form.examDate} onChangeText={set('examDate')} placeholder={t('up.datePh')} ltr keyboardType="numbers-and-punctuation" />
      <Field label={t('up.center')} value={form.center} onChangeText={set('center')} />
      <Field label={t('up.notes')} value={form.notes} onChangeText={set('notes')} multiline style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }} />

      {needTerms ? (
        <Pressable onPress={() => setTerms(v => !v)} style={{ flexDirection: row, alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Icon name={terms ? 'checkbox-marked' : 'checkbox-blank-outline'} size={26} color={terms ? C.teal : C.muted} />
          <T style={{ flex: 1 }}>{t('up.terms')}</T>
        </Pressable>
      ) : null}
      <ErrorBox text={err} />
      <Button title={busy ? t('up.sending') : t('up.send', { n: items.length })} icon="cloud-upload-outline" onPress={send} loading={busy} disabled={!items.length} />
      <View style={{ height: rtl ? 0 : 0 }} />
    </Screen>
  );
}
