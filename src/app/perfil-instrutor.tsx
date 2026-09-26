import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { StarDisplay } from '@/components/ui/star-rating';

type Instrutor = {
  id: string;
  nome: string;
  regiao: string;
  valorHora: number;
  avaliacao: number;
  totalAvaliacoes: number;
  especialidade: string;
  credencial: string;
  bio: string;
  carro?: string;
  cambio?: string;
  categoria?: string;
  foto?: string;
};

type Depoimento = { id: string; alunoNome: string; nota: number; comentario?: string };

function idConversa(a: string, b: string) {
  return [a, b].sort().join('_');
}

export default function PerfilInstrutor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const [instrutor, setInstrutor] = useState<Instrutor | null>(null);
  const [depoimentos, setDepoimentos] = useState<Depoimento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarPerfil() {
      try {
        const snap = await getDoc(doc(db, 'instrutores', id));
        if (snap.exists()) setInstrutor({ id: snap.id, ...snap.data() } as Instrutor);
      } catch (error) {
        console.warn('[perfil-instrutor] erro ao carregar perfil:', error);
      } finally {
        setLoading(false);
      }

      try {
        const q = query(collection(db, 'avaliacoes'), where('instrutorId', '==', id));
        const snapshot = await getDocs(q);
        setDepoimentos(snapshot.docs.slice(0, 5).map((d) => ({ id: d.id, ...d.data() } as Depoimento)));
      } catch (error) {
        console.warn('[perfil-instrutor] erro ao carregar avaliações:', error);
      }
    }
    if (id) carregarPerfil();
  }, [id]);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </ThemedView>
    );
  }

  if (!instrutor) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText>Instrutor não encontrado.</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const uid = auth.currentUser?.uid;
  const conversaId = uid ? idConversa(uid, instrutor.id) : '';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Avatar nome={instrutor.nome} foto={instrutor.foto} size={88} />
            <ThemedText style={styles.nome}>{instrutor.nome}</ThemedText>
            {instrutor.especialidade ? (
              <ThemedText style={[styles.especialidade, { color: theme.textSecondary }]}>🎯 {instrutor.especialidade}</ThemedText>
            ) : null}
            {instrutor.avaliacao > 0 ? (
              <View style={styles.avaliacaoRow}>
                <StarDisplay nota={instrutor.avaliacao} size={16} />
                <ThemedText style={[styles.avaliacao, { color: theme.warning }]}>
                  {instrutor.avaliacao.toFixed(1)} ({instrutor.totalAvaliacoes})
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={[styles.semAvaliacao, { color: theme.textSecondary }]}>Sem avaliações ainda</ThemedText>
            )}
          </View>

          <Card style={styles.infoBox}>
            <InfoRow label="📍 Região" valor={instrutor.regiao} />
            {instrutor.categoria ? <InfoRow label="🪪 Categoria" valor={`Cat. ${instrutor.categoria}`} /> : null}
            {instrutor.carro ? <InfoRow label="🚗 Veículo" valor={`${instrutor.carro} | ${instrutor.cambio ?? '—'}`} /> : null}
            {instrutor.credencial ? <InfoRow label="📄 Credencial" valor={instrutor.credencial} /> : null}
            <InfoRow label="💰 Valor" valor={`R$ ${instrutor.valorHora}/aula`} destaque />
          </Card>

          {instrutor.bio ? (
            <Card style={styles.bioBox}>
              <ThemedText style={styles.bioTitulo}>Sobre o instrutor</ThemedText>
              <ThemedText style={[styles.bioTexto, { color: theme.textSecondary }]}>{instrutor.bio}</ThemedText>
            </Card>
          ) : null}

          <View style={styles.acoesRow}>
            <View style={styles.acaoFlex}>
              <Button
                title="📅 Agendar Aula"
                onPress={() => router.push(`/agendamento?instrutorId=${instrutor.id}&instrutor=${instrutor.nome}`)}
              />
            </View>
            <View style={styles.acaoFlex}>
              <Button
                title="💬 Mensagem"
                variant="secondary"
                onPress={() => router.push(`/chat/${conversaId}?instrutorId=${instrutor.id}&instrutorNome=${instrutor.nome}`)}
              />
            </View>
          </View>

          <ThemedText style={styles.secaoTitulo}>Avaliações Recebidas</ThemedText>
          {depoimentos.length === 0 ? (
            <ThemedText style={[styles.semDepoimentos, { color: theme.textSecondary }]}>Nenhuma avaliação recebida ainda.</ThemedText>
          ) : (
            <View style={{ gap: 12, marginBottom: 24 }}>
              {depoimentos.map((dep) => (
                <Card key={dep.id} style={styles.depoimentoCard}>
                  <Avatar nome={dep.alunoNome} size={40} />
                  <View style={styles.depoimentoInfo}>
                    <View style={styles.depoimentoTopo}>
                      <ThemedText style={styles.depoimentoNome}>{dep.alunoNome}</ThemedText>
                      <ThemedText style={[styles.depoimentoNota, { color: theme.warning }]}>{dep.nota.toFixed(1)}</ThemedText>
                    </View>
                    <StarDisplay nota={dep.nota} />
                    {dep.comentario ? (
                      <ThemedText style={[styles.depoimentoComentario, { color: theme.textSecondary }]}>{dep.comentario}</ThemedText>
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function InfoRow({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.infoRow}>
      <ThemedText style={{ color: theme.textSecondary }}>{label}</ThemedText>
      <ThemedText style={{ fontWeight: '700', color: destaque ? theme.success : theme.text }}>{valor}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 20, marginTop: 8, gap: 6 },
  nome: { fontSize: 22, fontWeight: '800', marginTop: 8 },
  especialidade: { fontSize: 13 },
  avaliacaoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avaliacao: { fontSize: 14, fontWeight: '700' },
  semAvaliacao: { fontSize: 13 },
  infoBox: { gap: 12, marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  bioBox: { marginBottom: 20 },
  bioTitulo: { fontWeight: '700', marginBottom: 8, fontSize: 15 },
  bioTexto: { lineHeight: 20, fontSize: 13 },
  acoesRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  acaoFlex: { flex: 1 },
  secaoTitulo: { fontWeight: '700', fontSize: 16, marginBottom: 12 },
  semDepoimentos: { fontSize: 13, marginBottom: 24 },
  depoimentoCard: { flexDirection: 'row', gap: 12 },
  depoimentoInfo: { flex: 1, gap: 4 },
  depoimentoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  depoimentoNome: { fontWeight: '700', fontSize: 14 },
  depoimentoNota: { fontWeight: '700' },
  depoimentoComentario: { fontSize: 13, lineHeight: 18 },
});
