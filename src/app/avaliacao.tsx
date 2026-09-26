import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { StarRating, StarDisplay } from '@/components/ui/star-rating';

type AvaliacaoRecebida = {
  id: string;
  alunoNome: string;
  nota: number;
  comentario?: string;
};

export default function Avaliacao() {
  const { agendamentoId, instrutorId, instrutorNome } = useLocalSearchParams<{
    agendamentoId: string;
    instrutorId: string;
    instrutorNome: string;
  }>();
  const router = useRouter();
  const theme = useTheme();
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [loading, setLoading] = useState(false);
  const [recebidas, setRecebidas] = useState<AvaliacaoRecebida[]>([]);

  useEffect(() => {
    carregarRecebidas();
  }, [instrutorId]);

  async function carregarRecebidas() {
    if (!instrutorId) return;
    try {
      const q = query(collection(db, 'avaliacoes'), where('instrutorId', '==', instrutorId));
      const snapshot = await getDocs(q);
      setRecebidas(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AvaliacaoRecebida)));
    } catch (error) {
      console.warn('[avaliacao] erro ao carregar avaliações recebidas:', error);
    }
  }

  async function handleEnviar() {
    if (nota === 0) return;
    setLoading(true);
    try {
      const alunoUid = auth.currentUser?.uid;
      let alunoNome = 'Aluno';
      if (alunoUid) {
        const alunoSnap = await getDoc(doc(db, 'alunos', alunoUid));
        if (alunoSnap.exists()) alunoNome = alunoSnap.data().nome ?? 'Aluno';
      }

      await runTransaction(db, async (transaction) => {
        const instrutorRef = doc(db, 'instrutores', instrutorId);
        const instrutorSnap = await transaction.get(instrutorRef);
        if (!instrutorSnap.exists()) throw new Error('Instrutor não encontrado');

        const data = instrutorSnap.data();
        const totalAnterior = data.totalAvaliacoes ?? 0;
        const mediaAnterior = data.avaliacao ?? 0;
        const novaMedia = (mediaAnterior * totalAnterior + nota) / (totalAnterior + 1);

        transaction.update(instrutorRef, {
          avaliacao: Math.round(novaMedia * 10) / 10,
          totalAvaliacoes: totalAnterior + 1,
        });

        const agendamentoRef = doc(db, 'agendamentos', agendamentoId);
        transaction.update(agendamentoRef, { avaliado: true, nota, comentario });
      });

      await addDoc(collection(db, 'avaliacoes'), {
        instrutorId,
        alunoId: alunoUid,
        alunoNome,
        nota,
        comentario,
        criadoEm: new Date(),
      });

      router.push('/(aluno)/agendamentos');
    } catch (error) {
      console.warn('[avaliacao] erro ao enviar avaliação:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <ThemedText style={styles.voltar} onPress={() => router.back()}>
            ←
          </ThemedText>
          <ThemedText style={styles.headerTitulo}>Avaliações</ThemedText>
        </View>

        <FlatList
          data={recebidas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <ThemedText style={styles.tituloForm}>Avalie seu instrutor</ThemedText>
              <ThemedText style={[styles.subtitulo, { color: theme.textSecondary }]}>
                Como foi sua aula com {instrutorNome}?
              </ThemedText>

              <StarRating nota={nota} onChange={setNota} showLabel />

              <View style={styles.comentarioBox}>
                <Input
                  placeholder="Deixe um comentário (opcional) — conte como foi sua experiência..."
                  value={comentario}
                  onChangeText={setComentario}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <Button title="Enviar Avaliação" onPress={handleEnviar} loading={loading} disabled={nota === 0} />

              <ThemedText style={styles.secaoTitulo}>Avaliações Recebidas</ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={styles.depoimentoCard}>
              <Avatar nome={item.alunoNome} size={40} />
              <View style={styles.depoimentoInfo}>
                <View style={styles.depoimentoTopo}>
                  <ThemedText style={styles.depoimentoNome}>{item.alunoNome}</ThemedText>
                  <ThemedText style={[styles.depoimentoNota, { color: theme.warning }]}>{item.nota.toFixed(1)}</ThemedText>
                </View>
                <StarDisplay nota={item.nota} />
                {item.comentario ? (
                  <ThemedText style={[styles.depoimentoComentario, { color: theme.textSecondary }]}>
                    {item.comentario}
                  </ThemedText>
                ) : null}
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <ThemedText style={[styles.semAvaliacoes, { color: theme.textSecondary }]}>
              Nenhuma avaliação recebida ainda.
            </ThemedText>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12 },
  voltar: { fontSize: 22 },
  headerTitulo: { fontSize: 18, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
  tituloForm: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  subtitulo: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  comentarioBox: { marginVertical: 20 },
  secaoTitulo: { fontWeight: '700', fontSize: 16, marginTop: 28, marginBottom: 12 },
  depoimentoCard: { flexDirection: 'row', gap: 12 },
  depoimentoInfo: { flex: 1, gap: 4 },
  depoimentoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  depoimentoNome: { fontWeight: '700', fontSize: 14 },
  depoimentoNota: { fontWeight: '700' },
  depoimentoComentario: { fontSize: 13, lineHeight: 18 },
  semAvaliacoes: { textAlign: 'center', marginTop: 8 },
});
