import { useState, useEffect } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

type Agendamento = {
  id: string;
  alunoId: string;
  alunoNome?: string;
  dia: string;
  horario: string;
  status: 'pendente' | 'confirmado' | 'cancelado';
};

function idConversa(a: string, b: string) {
  return [a, b].sort().join('_');
}

export default function DashboardInstrutor() {
  const router = useRouter();
  const theme = useTheme();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [nomeInstrutor, setNomeInstrutor] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      const instrutorSnap = await getDoc(doc(db, 'instrutores', uid));
      if (instrutorSnap.exists()) setNomeInstrutor(instrutorSnap.data().nome ?? '');

      const q = query(collection(db, 'agendamentos'), where('instrutorId', '==', uid));
      const snapshot = await getDocs(q);

      const lista: Agendamento[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Agendamento;
        let alunoNome = 'Aluno';
        try {
          const alunoSnap = await getDoc(doc(db, 'alunos', data.alunoId));
          if (alunoSnap.exists()) alunoNome = alunoSnap.data().nome ?? 'Aluno';
        } catch {}
        lista.push({ ...data, id: docSnap.id, alunoNome });
      }

      lista.sort((a, b) => a.dia.localeCompare(b.dia) || a.horario.localeCompare(b.horario));
      setAgendamentos(lista);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }

  async function atualizarStatus(id: string, status: 'confirmado' | 'cancelado') {
    try {
      await updateDoc(doc(db, 'agendamentos', id), { status });
      setAgendamentos((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar o status.');
    }
  }

  function handleLogout() {
    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          router.replace('/');
        },
      },
    ]);
  }

  const corStatus: Record<string, string> = {
    pendente: theme.warning,
    confirmado: theme.success,
    cancelado: theme.danger,
  };

  const uid = auth.currentUser?.uid;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.headerRow}>
          <View>
            <ThemedText type="title" style={styles.titulo}>
              Dashboard
            </ThemedText>
            {nomeInstrutor ? (
              <ThemedText style={[styles.subtitulo, { color: theme.textSecondary }]}>Olá, {nomeInstrutor}!</ThemedText>
            ) : null}
          </View>
          <View style={styles.headerBotoes}>
            <TouchableOpacity style={[styles.botaoIcone, { borderColor: theme.border }]} onPress={() => router.push('/relatorios-instrutor')}>
              <ThemedText style={{ fontSize: 16 }}>📊</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.botaoIcone, { borderColor: theme.border }]} onPress={handleLogout}>
              <ThemedText style={{ color: theme.danger, fontWeight: '700' }}>Sair</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <ThemedText style={styles.secaoTitulo}>Agendamentos ({agendamentos.length})</ThemedText>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : agendamentos.length === 0 ? (
          <EmptyState icon="📅" titulo="Nenhum agendamento ainda" subtitulo="Seus agendamentos aparecerão aqui quando alunos marcarem aulas." />
        ) : (
          <FlatList
            data={agendamentos}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <View style={styles.cardTop}>
                  <View>
                    <ThemedText style={styles.cardAluno}>🎓 {item.alunoNome}</ThemedText>
                    <ThemedText style={[styles.cardData, { color: theme.textSecondary }]}>
                      📅 {item.dia} às {item.horario}
                    </ThemedText>
                  </View>
                  <View style={[styles.badge, { backgroundColor: corStatus[item.status] + '22' }]}>
                    <ThemedText style={[styles.badgeTexto, { color: corStatus[item.status] }]}>{item.status}</ThemedText>
                  </View>
                </View>

                <View style={styles.acoes}>
                  {item.status === 'pendente' && (
                    <>
                      <TouchableOpacity
                        style={[styles.botaoAcao, { backgroundColor: theme.success }]}
                        onPress={() => atualizarStatus(item.id, 'confirmado')}>
                        <ThemedText style={styles.botaoAcaoTexto}>✅ Confirmar</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.botaoAcao, { backgroundColor: theme.danger }]}
                        onPress={() => atualizarStatus(item.id, 'cancelado')}>
                        <ThemedText style={styles.botaoAcaoTexto}>❌ Cancelar</ThemedText>
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity
                    style={[styles.botaoChat, { borderColor: theme.border }]}
                    onPress={() =>
                      uid &&
                      router.push(
                        `/chat/${idConversa(item.alunoId, uid)}?alunoId=${item.alunoId}&alunoNome=${item.alunoNome}`
                      )
                    }>
                    <ThemedText>💬</ThemedText>
                  </TouchableOpacity>
                </View>
              </Card>
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  titulo: { fontSize: 24, fontWeight: '800' },
  subtitulo: { marginTop: 2 },
  headerBotoes: { flexDirection: 'row', gap: 8 },
  botaoIcone: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center' },
  secaoTitulo: { fontWeight: '700', fontSize: 15, marginBottom: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lista: { paddingBottom: 24, gap: 12 },
  card: { gap: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardAluno: { fontWeight: '700', fontSize: 15, marginBottom: 4 },
  cardData: { fontSize: 13 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTexto: { fontWeight: '700', fontSize: 12, textTransform: 'capitalize' },
  acoes: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#00000010', paddingTop: 12 },
  botaoAcao: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  botaoAcaoTexto: { color: '#fff', fontWeight: '700' },
  botaoChat: { width: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
