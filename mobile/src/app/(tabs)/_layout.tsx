import { router, Tabs, usePathname } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { C, shadow } from '../../lib/theme';

// الشريط السفلي كما في التصميم: ملفاتي • المشاركات • (+) رفع • حسابي
function TabBar() {
  const { t, row } = useI18n();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const doctor = user?.role === 'doctor';
  const items = doctor
    ? [{ name: 'index', icon: 'inbox-arrow-down-outline', label: t('tab.inbox') }, { name: 'account', icon: 'account-outline', label: t('tab.account') }]
    : [
        { name: 'index', icon: 'folder-open-outline', label: t('tab.files') },
        { name: 'shares', icon: 'share-variant-outline', label: t('tab.shares') },
        { name: '+', icon: 'plus', label: t('tab.upload') },
        { name: 'account', icon: 'account-outline', label: t('tab.account') },
      ];
  const path = usePathname();
  const current = path === '/' ? 'index' : path.replace(/^\//, '');
  return (
    <View style={{ flexDirection: row, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line, paddingBottom: Math.max(insets.bottom, 8), paddingTop: 6, ...shadow }}>
      {items.map(it => {
        if (it.name === '+') {
          return (
            <Pressable key="+" accessibilityLabel={it.label} onPress={() => router.push('/upload')} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', marginTop: -26, borderWidth: 4, borderColor: '#fff', ...shadow }}>
                <Icon name="plus" size={30} color="#fff" />
              </View>
              <T size={12} w="bold" color={C.teal} center>{it.label}</T>
            </Pressable>
          );
        }
        const active = current === it.name;
        return (
          <Pressable key={it.name} onPress={() => router.navigate((it.name === 'index' ? '/' : '/' + it.name) as any)} style={{ flex: 1, alignItems: 'center', paddingVertical: 4, gap: 2 }}>
            <Icon name={it.icon} size={25} color={active ? C.teal : C.muted} />
            <T size={12} w={active ? 'bold' : 'medium'} color={active ? C.teal : C.muted} center>{it.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={() => <TabBar />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="shares" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
