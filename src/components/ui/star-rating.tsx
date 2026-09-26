import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const LABELS = ['', 'Muito ruim', 'Ruim', 'Regular', 'Muito bom', 'Excelente!'];

type StarRatingProps = {
  nota: number;
  onChange?: (nota: number) => void;
  size?: number;
  showLabel?: boolean;
};

export function StarRating({ nota, onChange, size = 40, showLabel }: StarRatingProps) {
  const theme = useTheme();
  const interativo = !!onChange;

  return (
    <View style={styles.wrapper}>
      <View style={styles.linha}>
        {[1, 2, 3, 4, 5].map((estrela) => {
          const Estrela = interativo ? TouchableOpacity : View;
          return (
            <Estrela key={estrela} onPress={interativo ? () => onChange?.(estrela) : undefined}>
              <ThemedText style={{ fontSize: size, color: nota >= estrela ? theme.warning : theme.border }}>
                ★
              </ThemedText>
            </Estrela>
          );
        })}
      </View>
      {showLabel && nota > 0 ? (
        <ThemedText style={[styles.label, { color: theme.warning }]}>{LABELS[nota]}</ThemedText>
      ) : null}
    </View>
  );
}

export function StarDisplay({ nota, size = 14 }: { nota: number; size?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.linha}>
      {[1, 2, 3, 4, 5].map((estrela) => (
        <ThemedText key={estrela} style={{ fontSize: size, color: estrela <= Math.round(nota) ? theme.warning : theme.border }}>
          ★
        </ThemedText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 8 },
  linha: { flexDirection: 'row', gap: 4 },
  label: { fontWeight: '700', fontSize: 16 },
});
