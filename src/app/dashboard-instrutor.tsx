import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type Agendamento = {
  id: string;
  alunoId: string;
  alunoNome?: string;
  dia: string;
  horario: string;
  status: 'pendente' | 'confirmado' | 'cancelado';
};

export default function DashboardInstrutor() {
  const router = useRouter();
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
      if (instrutorSnap.exists()) {
        setNomeInstrutor(instrutorSnap.data().nome ?? '');
      }

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
      setAgendamentos(prev =>
        prev.map(a => a.id === id ? { ...a, status } : a)
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar o status.');
    }
  }

  async function handleLogout() {
    await signOut(auth);
    router.replace('/');
  }

  const corStatus: Record<string, string> = {
    pendente: '#f59e0b',
    confirmado: '#16a34a',
    cancelado: '#dc2626',
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <View style={styles.headerRow}>
          <View>
            <ThemedText type="title" style={styles.titulo}>👨‍🏫 Dashboard</ThemedText>
            {nomeInstrutor ? <ThemedText style={styles.subtitulo}>Olá, {nomeInstrutor}!</ThemedText> : null}
          </View>
          <View style={styles.headerBotoes}>
            <TouchableOpacity style={styles.botaoRelatorios} onPress={() => router.push('/relatorios-instrutor')}>
              <ThemedText style={styles.botaoRelatoriosTexto}>📊</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botaoSair} onPress={handleLogout}>
              <ThemedText style={styles.botaoSairTexto}>Sair</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <ThemedText style={styles.secaoTitulo}>
          Agendamentos ({agendamentos.length})
        </ThemedText>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#16a34a" />
            <ThemedText style={styles.loadingTexto}>Carregando agendamentos...</ThemedText>
          </View>
        ) : agendamentos.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ThemedText style={styles.loadingTexto}>Nenhum agendamento ainda.</ThemedText>
            <ThemedText style={styles.loadingSubTexto}>Seus agendamentos aparecerão aqui quando alunos marcarem aulas.</ThemedText>
          </View>
        ) : (
          <FlatList
            data={agendamentos}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View>
                    <ThemedText style={styles.cardAluno}>🎓 {item.alunoNome}</ThemedText>
                    <ThemedText style={styles.cardData}>📅 {item.dia} às {item.horario}</ThemedText>
                  </View>
                  <View style={[styles.badge, { backgroundColor: corStatus[item.status] + '33' }]}>
                    <ThemedText style={[styles.badgeTexto, { color: corStatus[item.status] }]}>
                      {item.status}
                    </ThemedText>
                  </View>
                </View>

                {item.status === 'pendente' && (
                  <View style={styles.acoes}>
                    <TouchableOpacity style={styles.botaoConfirmar} onPress={() => atualizarStatus(item.id, 'confirmado')}>
                      <ThemedText style={styles.botaoAcaoTexto}>✅ Confirmar</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.botaoCancelar} onPress={() => atualizarStatus(item.id, 'cancelado')}>
                      <ThemedText style={styles.botaoAcaoTexto}>❌ Cancelar</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          />
        )}

      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  titulo: { fontSize: 28, fontWeight: 'bold' },
  subtitulo: { opacity: 0.7, marginTop: 2 },
  headerBotoes: { flexDirection: 'row', gap: 8 },
  botaoRelatorios: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center' },
  botaoRelatoriosTexto: { fontSize: 16 },
  botaoSair: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  botaoSairTexto: { color: '#dc2626', fontWeight: 'bold' },
  secaoTitulo: { fontWeight: 'bold', fontSize: 16, marginBottom: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingTexto: { opacity: 0.6, textAlign: 'center', fontSize: 16 },
  loadingSubTexto: { opacity: 0.4, textAlign: 'center', fontSize: 13 },
  card: {
    backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#333'
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardAluno: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  cardData: { opacity: 0.7 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTexto: { fontWeight: 'bold', fontSize: 12, textTransform: 'capitalize' },
  acoes: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 12 },
  botaoConfirmar: { flex: 1, backgroundColor: '#16a34a', padding: 10, borderRadius: 10, alignItems: 'center' },
  botaoCancelar: { flex: 1, backgroundColor: '#dc2626', padding: 10, borderRadius: 10, alignItems: 'center' },
  botaoAcaoTexto: { color: '#fff', fontWeight: 'bold' },
});
