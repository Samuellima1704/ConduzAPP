import { StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/ui/empty-state';

export default function EmBreve() {
  const { titulo } = useLocalSearchParams<{ titulo: string }>();

  return (
    <ThemedView style={styles.container}>
      <EmptyState icon="🚧" titulo={titulo ?? 'Em breve'} subtitulo="Essa funcionalidade ainda está em desenvolvimento." />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
