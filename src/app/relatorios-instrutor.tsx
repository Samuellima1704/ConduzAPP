import { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type Stats = {
  totalAgendamentos: number;
  confirmados: number;
  cancelados: number;
  pendentes: number;
  mediaAvaliacao: number;
  totalAvaliacoes: number;
  alunosUnicos: number;
};

export default function RelatoriosInstrutor() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [nomeInstrutor, setNomeInstrutor] = useState('');

  useEffect(() => {
    carregarRelatorios();
  }, []);

  async function carregarRelatorios() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const instrutorSnap = await getDoc(doc(db, 'instrutores', uid));
      if (instrutorSnap.exists()) {
        const data = instrutorSnap.data();
        setNomeInstrutor(data.nome ?? '');
        const q = query(collection(db, 'agendamentos'), where('instrutorId', '==', uid));
        const snapshot = await getDocs(q);
        const agendamentos = snapshot.docs.map(d => d.data());

        const confirmados = agendamentos.filter(a => a.status === 'confirmado').length;
        const cancelados = agendamentos.filter(a => a.status === 'cancelado').length;
        const pendentes = agendamentos.filter(a => a.status === 'pendente').length;
        const alunosUnicos = new Set(agendamentos.map(a => a.alunoId)).size;

        setStats({
          totalAgendamentos: agendamentos.length,
          confirmados,
          cancelados,
          pendentes,
          mediaAvaliacao: data.avaliacao ?? 0,
          totalAvaliacoes: data.totalAvaliacoes ?? 0,
          alunosUnicos,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      </ThemedView>
    );
  }

  const taxaConfirmacao = stats && stats.totalAgendamentos > 0
    ? Math.round((stats.confirmados / stats.totalAgendamentos) * 100)
    : 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false}>

          <ThemedText type="title" style={styles.titulo}>📊 Relatórios</ThemedText>
          {nomeInstrutor ? <ThemedText style={styles.subtitulo}>{nomeInstrutor}</ThemedText> : null}

          <ThemedText style={styles.secao}>Visão geral</ThemedText>

          <View style={styles.gridDois}>
            <View style={[styles.card, styles.cardDestaque]}>
              <ThemedText style={styles.cardNumDestaque}>{stats?.totalAgendamentos ?? 0}</ThemedText>
              <ThemedText style={styles.cardLabelDestaque}>Total de agendamentos</ThemedText>
            </View>
            <View style={[styles.card, styles.cardDestaque]}>
              <ThemedText style={styles.cardNumDestaque}>{stats?.alunosUnicos ?? 0}</ThemedText>
              <ThemedText style={styles.cardLabelDestaque}>Alunos atendidos</ThemedText>
            </View>
          </View>

          <ThemedText style={styles.secao}>Status das aulas</ThemedText>

          <View style={styles.gridTres}>
            <View style={[styles.cardPequeno, { borderColor: '#16a34a' }]}>
              <ThemedText style={[styles.cardNumPequeno, { color: '#16a34a' }]}>{stats?.confirmados ?? 0}</ThemedText>
              <ThemedText style={styles.cardLabelPequeno}>Confirmadas</ThemedText>
            </View>
            <View style={[styles.cardPequeno, { borderColor: '#f59e0b' }]}>
              <ThemedText style={[styles.cardNumPequeno, { color: '#f59e0b' }]}>{stats?.pendentes ?? 0}</ThemedText>
              <ThemedText style={styles.cardLabelPequeno}>Pendentes</ThemedText>
            </View>
            <View style={[styles.cardPequeno, { borderColor: '#dc2626' }]}>
              <ThemedText style={[styles.cardNumPequeno, { color: '#dc2626' }]}>{stats?.cancelados ?? 0}</ThemedText>
              <ThemedText style={styles.cardLabelPequeno}>Canceladas</ThemedText>
            </View>
          </View>

          <ThemedText style={styles.secao}>Desempenho</ThemedText>

          <View style={styles.cardLargo}>
            <View style={styles.desempenhoRow}>
              <ThemedText style={styles.desempenhoLabel}>Taxa de confirmação</ThemedText>
              <ThemedText style={[styles.desempenhoValor, { color: '#16a34a' }]}>{taxaConfirmacao}%</ThemedText>
            </View>
            <View style={styles.barraFundo}>
              <View style={[styles.barraPreenchida, { width: `${taxaConfirmacao}%`, backgroundColor: '#16a34a' }]} />
            </View>
          </View>

          <ThemedText style={styles.secao}>Avaliação dos alunos</ThemedText>

          <View style={styles.cardAvaliacaoBox}>
            {stats?.totalAvaliacoes === 0 ? (
              <ThemedText style={styles.semAvaliacao}>Nenhuma avaliação recebida ainda.</ThemedText>
            ) : (
              <>
                <ThemedText style={styles.mediaGrande}>
                  {stats?.mediaAvaliacao.toFixed(1)}
                </ThemedText>
                <ThemedText style={styles.estrelasMedia}>
                  {'★'.repeat(Math.round(stats?.mediaAvaliacao ?? 0))}{'☆'.repeat(5 - Math.round(stats?.mediaAvaliacao ?? 0))}
                </ThemedText>
                <ThemedText style={styles.totalAvaliacoes}>
                  Baseado em {stats?.totalAvaliacoes} avaliação(ões)
                </ThemedText>
              </>
            )}
          </View>

        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titulo: { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  subtitulo: { opacity: 0.6, marginBottom: 24 },
  secao: { fontWeight: 'bold', fontSize: 14, opacity: 0.5, marginBottom: 10, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 },
  gridDois: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  card: { flex: 1, borderRadius: 16, padding: 16, borderWidth: 1 },
  cardDestaque: { backgroundColor: '#1a1a1a', borderColor: '#2563eb', alignItems: 'center' },
  cardNumDestaque: { fontSize: 36, fontWeight: 'bold', color: '#2563eb' },
  cardLabelDestaque: { opacity: 0.6, fontSize: 12, textAlign: 'center', marginTop: 4 },
  gridTres: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  cardPequeno: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1 },
  cardNumPequeno: { fontSize: 28, fontWeight: 'bold' },
  cardLabelPequeno: { opacity: 0.5, fontSize: 11, marginTop: 2, textAlign: 'center' },
  cardLargo: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#333', marginBottom: 16 },
  desempenhoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  desempenhoLabel: { opacity: 0.7 },
  desempenhoValor: { fontWeight: 'bold', fontSize: 16 },
  barraFundo: { height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden' },
  barraPreenchida: { height: '100%', borderRadius: 4 },
  cardAvaliacaoBox: {
    backgroundColor: '#1a1a1a', borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: '#333', alignItems: 'center', marginBottom: 32
  },
  semAvaliacao: { opacity: 0.5, textAlign: 'center' },
  mediaGrande: { fontSize: 56, fontWeight: 'bold', color: '#f59e0b' },
  estrelasMedia: { fontSize: 28, color: '#f59e0b', marginVertical: 8 },
  totalAvaliacoes: { opacity: 0.5, fontSize: 13 },
});
