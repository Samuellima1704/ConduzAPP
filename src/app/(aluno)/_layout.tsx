import { useEffect, useState } from 'react';
import { ActivityIndicator, ColorValue, Text } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { useTheme } from '@/hooks/use-theme';
import { ThemedView } from '@/components/themed-view';

export default function AlunoTabsLayout() {
  const router = useRouter();
  const theme = useTheme();
  const [checando, setChecando] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/');
      } else {
        setChecando(false);
      }
    });
    return unsubscribe;
  }, []);

  if (checando) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Início', tabBarIcon: ({ color }) => <TabIcon icon="🏠" color={color} /> }}
      />
      <Tabs.Screen
        name="agendamentos"
        options={{ title: 'Agendamentos', tabBarIcon: ({ color }) => <TabIcon icon="📅" color={color} /> }}
      />
      <Tabs.Screen
        name="mensagens"
        options={{ title: 'Mensagens', tabBarIcon: ({ color }) => <TabIcon icon="💬" color={color} /> }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: ({ color }) => <TabIcon icon="👤" color={color} /> }}
      />
    </Tabs>
  );
}

function TabIcon({ icon }: { icon: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20 }}>{icon}</Text>;
}
