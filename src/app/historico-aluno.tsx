import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type Agendamento = {
  id: string;
  instrutorId: string;
  instrutorNome: string;
  dia: string;
  horario: string;
  status: 'pendente' | 'confirmado' | 'cancelado';
  avaliado?: boolean;
  nota?: number;
};

const corStatus: Record<string, string> = {
  pendente: '#f59e0b',
  confirmado: '#16a34a',
  cancelado: '#dc2626',
};

const iconeStatus: Record<string, string> = {
  pendente: '⏳',
  confirmado: '✅',
  cancelado: '❌',
};

export default function HistoricoAluno() {
  const router = useRouter();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarHistorico();
  }, []);

  async function carregarHistorico() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const q = query(collection(db, 'agendamentos'), where('alunoId', '==', uid));
      const snapshot = await getDocs(q);
      const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Agendamento));
      lista.sort((a, b) => b.dia.localeCompare(a.dia) || b.horario.localeCompare(a.horario));
      setAgendamentos(lista);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  }

  const confirmados = agendamentos.filter(a => a.status === 'confirmado');
  const pendentes = agendamentos.filter(a => a.status === 'pendente');
  const cancelados = agendamentos.filter(a => a.status === 'cancelado');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <ThemedText type="title" style={styles.titulo}>📋 Minhas Aulas</ThemedText>

        {!loading && agendamentos.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <ThemedText style={styles.statNum}>{confirmados.length}</ThemedText>
              <ThemedText style={styles.statLabel}>Confirmadas</ThemedText>
            </View>
            <View style={styles.statBox}>
              <ThemedText style={styles.statNum}>{pendentes.length}</ThemedText>
              <ThemedText style={styles.statLabel}>Pendentes</ThemedText>
            </View>
            <View style={styles.statBox}>
              <ThemedText style={styles.statNum}>{cancelados.length}</ThemedText>
              <ThemedText style={styles.statLabel}>Canceladas</ThemedText>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <ThemedText style={styles.loadingTexto}>Carregando histórico...</ThemedText>
          </View>
        ) : agendamentos.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ThemedText style={styles.emptyIcon}>📅</ThemedText>
            <ThemedText style={styles.loadingTexto}>Nenhuma aula agendada ainda.</ThemedText>
            <TouchableOpacity style={styles.botaoBuscar} onPress={() => router.push('/busca-instrutores')}>
              <ThemedText style={styles.botaoBuscarTexto}>Buscar Instrutores</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={agendamentos}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={[styles.card, { borderLeftColor: corStatus[item.status], borderLeftWidth: 4 }]}>
                <View style={styles.cardTop}>
                  <View style={styles.cardInfo}>
                    <ThemedText style={styles.cardInstrutor}>👨‍🏫 {item.instrutorNome}</ThemedText>
                    <ThemedText style={styles.cardData}>📅 {item.dia} às {item.horario}</ThemedText>
                  </View>
                  <View style={[styles.badge, { backgroundColor: corStatus[item.status] + '22' }]}>
                    <ThemedText style={[styles.badgeTexto, { color: corStatus[item.status] }]}>
                      {iconeStatus[item.status]} {item.status}
                    </ThemedText>
                  </View>
                </View>

                {item.status === 'confirmado' && !item.avaliado && (
                  <TouchableOpacity
                    style={styles.botaoAvaliar}
                    onPress={() => router.push(`/avaliacao?agendamentoId=${item.id}&instrutorId=${item.instrutorId}&instrutorNome=${item.instrutorNome}`)}
                  >
                    <ThemedText style={styles.botaoAvaliarTexto}>⭐ Avaliar instrutor</ThemedText>
                  </TouchableOpacity>
                )}

                {item.avaliado && item.nota && (
                  <ThemedText style={styles.notaTexto}>
                    {'★'.repeat(item.nota)}{'☆'.repeat(5 - item.nota)} Avaliado
                  </ThemedText>
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
  titulo: { fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statBox: {
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333'
  },
  statNum: { fontSize: 24, fontWeight: 'bold', color: '#2563eb' },
  statLabel: { fontSize: 11, opacity: 0.6, marginTop: 2 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingTexto: { opacity: 0.6, textAlign: 'center', fontSize: 16 },
  emptyIcon: { fontSize: 48 },
  botaoBuscar: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  botaoBuscarTexto: { color: '#fff', fontWeight: 'bold' },
  card: {
    backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#333'
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardInfo: { flex: 1, gap: 4 },
  cardInstrutor: { fontWeight: 'bold', fontSize: 15 },
  cardData: { opacity: 0.7, fontSize: 13 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeTexto: { fontWeight: 'bold', fontSize: 11, textTransform: 'capitalize' },
  botaoAvaliar: {
    backgroundColor: '#f59e0b22', borderWidth: 1, borderColor: '#f59e0b',
    borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 8
  },
  botaoAvaliarTexto: { color: '#f59e0b', fontWeight: 'bold' },
  notaTexto: { color: '#f59e0b', marginTop: 8, fontSize: 13 },
});
