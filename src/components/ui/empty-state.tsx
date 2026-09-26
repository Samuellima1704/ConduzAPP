import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';

type EmptyStateProps = {
  icon?: string;
  titulo: string;
  subtitulo?: string;
  cta?: { label: string; onPress: () => void };
};

export function EmptyState({ icon = '📭', titulo, subtitulo, cta }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <ThemedText style={styles.icon}>{icon}</ThemedText>
      <ThemedText style={styles.titulo}>{titulo}</ThemedText>
      {subtitulo ? (
        <ThemedText style={[styles.subtitulo, { color: theme.textSecondary }]}>{subtitulo}</ThemedText>
      ) : null}
      {cta ? (
        <View style={styles.cta}>
          <Button title={cta.label} onPress={cta.onPress} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  icon: { fontSize: 48, marginBottom: 4 },
  titulo: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  subtitulo: { fontSize: 13, textAlign: 'center' },
  cta: { marginTop: 16, alignSelf: 'stretch' },
});
