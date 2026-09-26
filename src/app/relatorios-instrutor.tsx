import { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/components/ui/card';
import { StarDisplay } from '@/components/ui/star-rating';

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
  const theme = useTheme();
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
        const agendamentos = snapshot.docs.map((d) => d.data());

        const confirmados = agendamentos.filter((a) => a.status === 'confirmado').length;
        const cancelados = agendamentos.filter((a) => a.status === 'cancelado').length;
        const pendentes = agendamentos.filter((a) => a.status === 'pendente').length;
        const alunosUnicos = new Set(agendamentos.map((a) => a.alunoId)).size;

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
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </ThemedView>
    );
  }

  const taxaConfirmacao =
    stats && stats.totalAgendamentos > 0 ? Math.round((stats.confirmados / stats.totalAgendamentos) * 100) : 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ThemedText type="title" style={styles.titulo}>
            Relatórios
          </ThemedText>
          {nomeInstrutor ? <ThemedText style={[styles.subtitulo, { color: theme.textSecondary }]}>{nomeInstrutor}</ThemedText> : null}

          <ThemedText style={[styles.secao, { color: theme.textSecondary }]}>Visão geral</ThemedText>
          <View style={styles.gridDois}>
            <Card style={styles.cardDestaque}>
              <ThemedText style={[styles.cardNumDestaque, { color: theme.primary }]}>{stats?.totalAgendamentos ?? 0}</ThemedText>
              <ThemedText style={[styles.cardLabelDestaque, { color: theme.textSecondary }]}>Total de agendamentos</ThemedText>
            </Card>
            <Card style={styles.cardDestaque}>
              <ThemedText style={[styles.cardNumDestaque, { color: theme.primary }]}>{stats?.alunosUnicos ?? 0}</ThemedText>
              <ThemedText style={[styles.cardLabelDestaque, { color: theme.textSecondary }]}>Alunos atendidos</ThemedText>
            </Card>
          </View>

          <ThemedText style={[styles.secao, { color: theme.textSecondary }]}>Status das aulas</ThemedText>
          <View style={styles.gridTres}>
            <Card style={[styles.cardPequeno, { borderColor: theme.success }]}>
              <ThemedText style={[styles.cardNumPequeno, { color: theme.success }]}>{stats?.confirmados ?? 0}</ThemedText>
              <ThemedText style={[styles.cardLabelPequeno, { color: theme.textSecondary }]}>Confirmadas</ThemedText>
            </Card>
            <Card style={[styles.cardPequeno, { borderColor: theme.warning }]}>
              <ThemedText style={[styles.cardNumPequeno, { color: theme.warning }]}>{stats?.pendentes ?? 0}</ThemedText>
              <ThemedText style={[styles.cardLabelPequeno, { color: theme.textSecondary }]}>Pendentes</ThemedText>
            </Card>
            <Card style={[styles.cardPequeno, { borderColor: theme.danger }]}>
              <ThemedText style={[styles.cardNumPequeno, { color: theme.danger }]}>{stats?.cancelados ?? 0}</ThemedText>
              <ThemedText style={[styles.cardLabelPequeno, { color: theme.textSecondary }]}>Canceladas</ThemedText>
            </Card>
          </View>

          <ThemedText style={[styles.secao, { color: theme.textSecondary }]}>Desempenho</ThemedText>
          <Card style={styles.cardLargo}>
            <View style={styles.desempenhoRow}>
              <ThemedText style={{ color: theme.textSecondary }}>Taxa de confirmação</ThemedText>
              <ThemedText style={[styles.desempenhoValor, { color: theme.success }]}>{taxaConfirmacao}%</ThemedText>
            </View>
            <View style={[styles.barraFundo, { backgroundColor: theme.border }]}>
              <View style={[styles.barraPreenchida, { width: `${taxaConfirmacao}%`, backgroundColor: theme.success }]} />
            </View>
          </Card>

          <ThemedText style={[styles.secao, { color: theme.textSecondary }]}>Avaliação dos alunos</ThemedText>
          <Card style={styles.cardAvaliacaoBox}>
            {stats?.totalAvaliacoes === 0 ? (
              <ThemedText style={{ color: theme.textSecondary }}>Nenhuma avaliação recebida ainda.</ThemedText>
            ) : (
              <>
                <ThemedText style={[styles.mediaGrande, { color: theme.warning }]}>{stats?.mediaAvaliacao.toFixed(1)}</ThemedText>
                <StarDisplay nota={stats?.mediaAvaliacao ?? 0} size={22} />
                <ThemedText style={[styles.totalAvaliacoes, { color: theme.textSecondary }]}>
                  Baseado em {stats?.totalAvaliacoes} avaliação(ões)
                </ThemedText>
              </>
            )}
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titulo: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subtitulo: { marginBottom: 20 },
  secao: { fontWeight: '700', fontSize: 13, marginBottom: 10, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 },
  gridDois: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  cardDestaque: { flex: 1, alignItems: 'center' },
  cardNumDestaque: { fontSize: 32, fontWeight: '800' },
  cardLabelDestaque: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  gridTres: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  cardPequeno: { flex: 1, alignItems: 'center' },
  cardNumPequeno: { fontSize: 24, fontWeight: '800' },
  cardLabelPequeno: { fontSize: 11, marginTop: 2, textAlign: 'center' },
  cardLargo: { marginBottom: 16, gap: 10 },
  desempenhoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  desempenhoValor: { fontWeight: '800', fontSize: 16 },
  barraFundo: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barraPreenchida: { height: '100%', borderRadius: 4 },
  cardAvaliacaoBox: { alignItems: 'center', gap: 8, marginBottom: 32 },
  mediaGrande: { fontSize: 48, fontWeight: '800' },
  totalAvaliacoes: { fontSize: 13 },
});
