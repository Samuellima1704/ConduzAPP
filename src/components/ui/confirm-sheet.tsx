import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';

type ConfirmSheetProps = {
  visible: boolean;
  titulo: string;
  onCancelar: () => void;
  onConfirmar: () => void;
  loading?: boolean;
  children: React.ReactNode;
};

export function ConfirmSheet({ visible, titulo, onCancelar, onConfirmar, loading, children }: ConfirmSheetProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancelar}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancelar} />
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <ThemedText style={styles.titulo}>{titulo}</ThemedText>
          <View style={styles.conteudo}>{children}</View>
          <View style={styles.acoes}>
            <View style={styles.botaoFlex}>
              <Button title="Cancelar" variant="secondary" onPress={onCancelar} />
            </View>
            <View style={styles.botaoFlex}>
              <Button title="Confirmar" onPress={onConfirmar} loading={loading} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  titulo: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  conteudo: { gap: 10 },
  acoes: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 8 },
  botaoFlex: { flex: 1 },
});
