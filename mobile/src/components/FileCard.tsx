import { router } from 'expo-router';
import { Image, Pressable, View } from 'react-native';
import { fileSource } from '../lib/api';
import { NoorFile } from '../lib/files';
import { useI18n } from '../lib/i18n';
import { C, R } from '../lib/theme';
import { Badge, Card, CatTile, Icon, Row, T } from './ui';

export function fileSubtitle(f: NoorFile, t: (k: string, v?: any) => string, fmtSize: (n?: number) => string) {
  if (f.kind === 'dicom' && f.imageCount) {
    return [f.modalities?.join('/') || 'DICOM', f.seriesCount && f.seriesCount > 1 ? t('home.series', { n: f.seriesCount }) : '', t('home.images', { n: f.imageCount })]
      .filter(Boolean).join(' • ');
  }
  return [t('kind.' + f.kind), fmtSize(f.size)].join(' • ');
}

export function FileCard({ f, onOpen }: { f: NoorFile; onOpen?: () => void }) {
  const { t, fmtDate, fmtSize, row } = useI18n();
  const open = onOpen || (() => router.push(`/file/${f.id}`));
  return (
    <Card onPress={open} style={{ gap: 12 }}>
      <Row center={false} gap={12}>
        <CatTile category={f.category} />
        <View style={{ flex: 1, gap: 2 }}>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {f.notesCount ? <Badge label={t('home.hasNotes')} icon="note-text-outline" color={C.amber} bg={C.goldL} /> : null}
            {f.processing ? <Badge label={t('home.processing')} icon="progress-clock" color={C.muted} bg="#EDF1F3" /> : null}
          </Row>
          <T w="bold" size={16} color={C.navy} numberOfLines={2}>{f.title}</T>
          <T size={13} color={C.muted}>{fileSubtitle(f, t, fmtSize)}</T>
          <Row gap={6}>
            <Icon name="calendar-blank-outline" size={14} color={C.muted} />
            <T size={12} color={C.muted} numberOfLines={1} style={{ flex: 1 }}>
              {[fmtDate(f.examDate || f.createdAt), f.center].filter(Boolean).join(' • ')}
            </T>
          </Row>
        </View>
      </Row>
      {f.kind === 'dicom' ? (
        <Pressable onPress={() => router.push(`/viewer/${f.id}`)} style={{ backgroundColor: C.dark, borderRadius: R.md, padding: 12, flexDirection: row, alignItems: 'center', gap: 12 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#2D4A5C', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="radiology-box-outline" size={26} color={C.overlay} />
          </View>
          <View style={{ flex: 1 }}>
            <T w="bold" color="#fff" size={14}>{t('home.dicomPreview')}</T>
            <T size={12} color={C.overlay}>{t('home.images', { n: f.imageCount || 1 })}</T>
          </View>
          <View style={{ backgroundColor: C.teal, borderRadius: R.sm, paddingHorizontal: 12, height: 36, justifyContent: 'center', flexDirection: row, alignItems: 'center', gap: 6 }}>
            <Icon name="eye-outline" size={18} color="#fff" />
            <T w="bold" color="#fff" size={14}>{t('home.open')}</T>
          </View>
        </Pressable>
      ) : f.kind === 'image' ? (
        <Image source={fileSource(f.id)} style={{ width: '100%', height: 150, borderRadius: R.md, backgroundColor: C.bg }} resizeMode="cover" />
      ) : null}
    </Card>
  );
}
