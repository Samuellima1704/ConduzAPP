import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StarDisplay } from '@/components/ui/star-rating';

type Agendamento = {
  id: string;
  instrutorId: string;
  instrutorNome: string;
  dia: string;
  horario: string;
  status: 'pendente' | 'confirmado' | 'cancelado';
  avaliado?: boolean;
  nota?: number;
  categoria?: string;
  duracaoMin?: number;
};

export default function Agendamentos() {
  const router = useRouter();
  const theme = useTheme();
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
      const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Agendamento));
      lista.sort((a, b) => b.dia.localeCompare(a.dia) || b.horario.localeCompare(a.horario));
      setAgendamentos(lista);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  }

  const corStatus: Record<string, string> = {
    pendente: theme.warning,
    confirmado: theme.success,
    cancelado: theme.danger,
  };
  const iconeStatus: Record<string, string> = { pendente: '⏳', confirmado: '✅', cancelado: '❌' };

  const confirmados = agendamentos.filter((a) => a.status === 'confirmado').length;
  const pendentes = agendamentos.filter((a) => a.status === 'pendente').length;
  const cancelados = agendamentos.filter((a) => a.status === 'cancelado').length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="title" style={styles.titulo}>
          Meus Agendamentos
        </ThemedText>

        {!loading && agendamentos.length > 0 && (
          <View style={styles.statsRow}>
            <Card style={styles.statBox}>
              <ThemedText style={[styles.statNum, { color: theme.primary }]}>{confirmados}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Confirmadas</ThemedText>
            </Card>
            <Card style={styles.statBox}>
              <ThemedText style={[styles.statNum, { color: theme.warning }]}>{pendentes}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Pendentes</ThemedText>
            </Card>
            <Card style={styles.statBox}>
              <ThemedText style={[styles.statNum, { color: theme.danger }]}>{cancelados}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Canceladas</ThemedText>
            </Card>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : agendamentos.length === 0 ? (
          <EmptyState
            icon="📅"
            titulo="Nenhuma aula agendada ainda"
            cta={{ label: 'Buscar Instrutores', onPress: () => router.push('/busca-instrutores') }}
          />
        ) : (
          <FlatList
            data={agendamentos}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Card style={[styles.card, { borderLeftColor: corStatus[item.status], borderLeftWidth: 4 }]}>
                <View style={styles.cardTop}>
                  <View style={styles.cardInfo}>
                    <ThemedText style={styles.cardInstrutor}>👨‍🏫 {item.instrutorNome}</ThemedText>
                    <ThemedText style={[styles.cardData, { color: theme.textSecondary }]}>
                      📅 {item.dia} às {item.horario} · {item.duracaoMin ?? 50} min
                    </ThemedText>
                    {item.categoria ? (
                      <ThemedText style={[styles.cardCategoria, { color: theme.primary }]}>Cat. {item.categoria}</ThemedText>
                    ) : null}
                  </View>
                  <View style={[styles.badge, { backgroundColor: corStatus[item.status] + '22' }]}>
                    <ThemedText style={[styles.badgeTexto, { color: corStatus[item.status] }]}>
                      {iconeStatus[item.status]} {item.status}
                    </ThemedText>
                  </View>
                </View>

                {item.status === 'confirmado' && !item.avaliado && (
                  <TouchableOpacity
                    style={[styles.botaoAvaliar, { borderColor: theme.warning, backgroundColor: theme.warning + '15' }]}
                    onPress={() =>
                      router.push(
                        `/avaliacao?agendamentoId=${item.id}&instrutorId=${item.instrutorId}&instrutorNome=${item.instrutorNome}`
                      )
                    }>
                    <ThemedText style={{ color: theme.warning, fontWeight: '700' }}>⭐ Avaliar instrutor</ThemedText>
                  </TouchableOpacity>
                )}

                {item.avaliado && item.nota ? (
                  <View style={styles.avaliadoRow}>
                    <StarDisplay nota={item.nota} />
                    <ThemedText style={[styles.notaTexto, { color: theme.textSecondary }]}>Avaliado</ThemedText>
                  </View>
                ) : null}
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
  safeArea: { flex: 1, paddingHorizontal: 20 },
  titulo: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statBox: { flex: 1, alignItems: 'center', padding: 12 },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lista: { paddingBottom: 24, gap: 12 },
  card: { gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flex: 1, gap: 4 },
  cardInstrutor: { fontWeight: '700', fontSize: 15 },
  cardData: { fontSize: 13 },
  cardCategoria: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeTexto: { fontWeight: '700', fontSize: 11, textTransform: 'capitalize' },
  botaoAvaliar: { borderWidth: 1, borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 4 },
  avaliadoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  notaTexto: { fontSize: 12 },
});
