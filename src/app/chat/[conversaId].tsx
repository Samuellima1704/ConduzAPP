import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Input } from '@/components/ui/input';

type Mensagem = {
  id: string;
  texto: string;
  remetenteId: string;
  criadoEm?: { toMillis: () => number };
};

export default function Chat() {
  const { conversaId, instrutorId, instrutorNome, alunoId, alunoNome } = useLocalSearchParams<{
    conversaId: string;
    instrutorId?: string;
    instrutorNome?: string;
    alunoId?: string;
    alunoNome?: string;
  }>();
  const router = useRouter();
  const theme = useTheme();
  const uid = auth.currentUser?.uid;
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const listRef = useRef<FlatList>(null);

  const souInstrutor = uid === instrutorId;
  const nomeOutro = souInstrutor ? alunoNome ?? 'Aluno' : instrutorNome ?? 'Instrutor';
  const alunoIdFinal = souInstrutor ? alunoId : uid;
  const instrutorIdFinal = souInstrutor ? uid : instrutorId;

  useEffect(() => {
    if (!conversaId) return;
    const q = query(collection(db, 'mensagens'), where('conversaId', '==', conversaId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Mensagem));
        lista.sort((a, b) => (a.criadoEm?.toMillis?.() ?? 0) - (b.criadoEm?.toMillis?.() ?? 0));
        setMensagens(lista);
      },
      (error) => console.warn('[chat] erro ao ouvir mensagens:', error)
    );
    return unsubscribe;
  }, [conversaId]);

  async function handleEnviar() {
    if (!texto.trim() || !uid || !alunoIdFinal || !instrutorIdFinal) return;
    setEnviando(true);
    const textoParaEnviar = texto.trim();
    setTexto('');
    try {
      await addDoc(collection(db, 'mensagens'), {
        conversaId,
        alunoId: alunoIdFinal,
        instrutorId: instrutorIdFinal,
        remetenteId: uid,
        texto: textoParaEnviar,
        criadoEm: serverTimestamp(),
      });
    } catch (error) {
      console.warn('[chat] erro ao enviar mensagem:', error);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <ThemedText style={styles.voltar} onPress={() => router.back()}>
            ←
          </ThemedText>
          <ThemedText style={styles.headerTitulo}>{nomeOutro}</ThemedText>
        </View>

        <FlatList
          ref={listRef}
          data={mensagens}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const minha = item.remetenteId === uid;
            return (
              <View
                style={[
                  styles.bolha,
                  minha
                    ? { backgroundColor: theme.primary, alignSelf: 'flex-end' }
                    : { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, alignSelf: 'flex-start' },
                ]}>
                <ThemedText style={{ color: minha ? '#fff' : theme.text }}>{item.texto}</ThemedText>
              </View>
            );
          }}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.inputRow, { borderTopColor: theme.border }]}>
            <View style={styles.inputFlex}>
              <Input placeholder="Digite uma mensagem..." value={texto} onChangeText={setTexto} />
            </View>
            <TouchableOpacity
              style={[styles.enviarBotao, { backgroundColor: theme.primary, opacity: enviando ? 0.6 : 1 }]}
              onPress={handleEnviar}
              disabled={enviando}>
              <ThemedText style={{ color: '#fff', fontSize: 18 }}>➤</ThemedText>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  voltar: { fontSize: 22 },
  headerTitulo: { fontSize: 17, fontWeight: '700' },
  lista: { padding: 16, gap: 8 },
  bolha: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  inputRow: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, alignItems: 'center' },
  inputFlex: { flex: 1 },
  enviarBotao: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
