// مكونات الواجهة المشتركة بهوية نور
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps,
  TextProps, TextStyle, View, ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { C, CAT, F, R, shadow } from '../lib/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export const Icon = (p: { name: string; size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <MaterialCommunityIcons name={p.name as IconName} size={p.size ?? 22} color={p.color ?? C.ink} style={p.style} />
);

type TProps = TextProps & { w?: 'regular' | 'medium' | 'bold' | 'black'; size?: number; color?: string; center?: boolean; ltr?: boolean };
// نص بمحاذاة تتبع اللغة؛ ltr للأرقام والبريد والجوال
export function T({ w = 'regular', size = 15, color = C.ink, center, ltr, style, ...rest }: TProps) {
  const { align, rtl } = useI18n();
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: F[w], fontSize: size, color, lineHeight: Math.round(size * 1.5), textAlign: center ? 'center' : align },
        ltr && rtl ? { writingDirection: 'ltr' } : null,
        style,
      ]}
    />
  );
}

export function Row({ children, style, gap = 8, center = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number; center?: boolean }) {
  const { row } = useI18n();
  return <View style={[{ flexDirection: row, alignItems: center ? 'center' : 'flex-start', gap }, style]}>{children}</View>;
}

export function Screen({ children, scroll = true, padded = true, style, refresh }: {
  children: ReactNode; scroll?: boolean; padded?: boolean; style?: StyleProp<ViewStyle>; refresh?: ReactNode;
}) {
  const inner = <View style={[padded && { padding: 16, paddingBottom: 120 }, style]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" refreshControl={refresh as any}>{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const body = <View style={[s.card, style]}>{children}</View>;
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85 }}>{body}</Pressable> : body;
}

type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost' | 'navy';
export function Button({ title, onPress, kind = 'primary', icon, loading, disabled, style, small }: {
  title: string; onPress?: () => void; kind?: BtnKind; icon?: string; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const { row } = useI18n();
  const k = {
    primary: { bg: C.teal, fg: '#fff', border: C.teal },
    navy: { bg: C.navy, fg: '#fff', border: C.navy },
    secondary: { bg: '#fff', fg: C.ink, border: C.line },
    danger: { bg: C.redL, fg: C.red, border: C.redL },
    ghost: { bg: 'transparent', fg: C.teal, border: 'transparent' },
  }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        s.btn, small && s.btnSm,
        { backgroundColor: k.bg, borderColor: k.border, flexDirection: row, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={k.fg} /> : (
        <>
          {icon ? <Icon name={icon} size={small ? 18 : 20} color={k.fg} /> : null}
          <Text style={{ fontFamily: F.bold, fontSize: small ? 14 : 16, color: k.fg }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, ltr, style, ...rest }: TextInputProps & { label: string; hint?: string; ltr?: boolean }) {
  const { align } = useI18n();
  return (
    <View style={{ gap: 6, marginBottom: 14 }}>
      <T w="medium" size={14} color={C.navy}>{label}</T>
      <TextInput
        placeholderTextColor="#9AA8B1"
        {...rest}
        style={[s.input, { textAlign: ltr ? 'left' : align, writingDirection: ltr ? 'ltr' : undefined }, style]}
      />
      {hint ? <T size={12} color={C.muted}>{hint}</T> : null}
    </View>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: string }) {
  const { row } = useI18n();
  return (
    <Pressable onPress={onPress} style={[s.chip, { flexDirection: row }, active && { backgroundColor: C.navy, borderColor: C.navy }]}>
      {icon ? <Icon name={icon} size={16} color={active ? '#fff' : C.muted} /> : null}
      <Text style={{ fontFamily: F.bold, fontSize: 14, color: active ? '#fff' : C.ink }}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, color = C.teal, bg = C.tealL, icon }: { label: string; color?: string; bg?: string; icon?: string }) {
  const { row } = useI18n();
  return (
    <View style={[s.badge, { backgroundColor: bg, flexDirection: row }]}>
      {icon ? <Icon name={icon} size={13} color={color} /> : null}
      <Text style={{ fontFamily: F.bold, fontSize: 12, color }}>{label}</Text>
    </View>
  );
}

export function CatTile({ category, size = 44 }: { category: string; size?: number }) {
  const c = CAT[category] || CAT.other;
  return (
    <View style={{ width: size, height: size, borderRadius: R.md, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={c.icon} size={size * 0.52} color={c.fg} />
    </View>
  );
}

export function Empty({ icon, title, sub, action }: { icon: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.tealL, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={34} color={C.teal} />
      </View>
      <T w="bold" size={17} center color={C.navy}>{title}</T>
      {sub ? <T center color={C.muted}>{sub}</T> : null}
      {action}
    </View>
  );
}

export function ErrorBox({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <View style={{ backgroundColor: C.redL, borderRadius: R.md, padding: 12, marginBottom: 12 }}>
      <T size={14} color={C.red} w="medium">{text}</T>
    </View>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="white-balance-sunny" size={size * 0.6} color="#fff" />
    </View>
  );
}

export function Loading() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}><ActivityIndicator color={C.teal} size="large" /></View>;
}

export function TopBar({ title, right }: { title?: string; right?: ReactNode }) {
  const { t } = useI18n();
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
      <Row gap={10}>
        <Logo size={34} />
        <T w="black" size={20} color={C.teal}>{title || t('brand')}</T>
      </Row>
      {right}
    </Row>
  );
}

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: 16, ...shadow, borderWidth: 1, borderColor: '#EEF3F6' },
  btn: { minHeight: 50, borderRadius: R.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  btnSm: { minHeight: 40, paddingHorizontal: 12, borderRadius: R.sm },
  input: { minHeight: 50, borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingHorizontal: 14, fontFamily: F.regular, fontSize: 16, color: C.ink, backgroundColor: '#fff' },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', borderRadius: R.full, paddingHorizontal: 14, height: 38, alignItems: 'center', gap: 6 },
  badge: { borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 2, alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
});
