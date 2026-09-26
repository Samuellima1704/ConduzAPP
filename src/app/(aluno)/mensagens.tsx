import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';

type Conversa = {
  conversaId: string;
  instrutorId: string;
  instrutorNome: string;
  instrutorFoto?: string;
  ultimaMensagem?: string;
  ultimaData?: Date;
};

function idConversa(a: string, b: string) {
  return [a, b].sort().join('_');
}

export default function Mensagens() {
  const router = useRouter();
  const theme = useTheme();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarConversas();
  }, []);

  async function carregarConversas() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const q = query(collection(db, 'agendamentos'), where('alunoId', '==', uid));
      const snapshot = await getDocs(q);

      const porInstrutor = new Map<string, Conversa>();
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (!porInstrutor.has(data.instrutorId)) {
          porInstrutor.set(data.instrutorId, {
            conversaId: idConversa(uid, data.instrutorId),
            instrutorId: data.instrutorId,
            instrutorNome: data.instrutorNome,
          });
        }
      }

      const lista = Array.from(porInstrutor.values());
      for (const conversa of lista) {
        try {
          const msgQuery = query(collection(db, 'mensagens'), where('conversaId', '==', conversa.conversaId));
          const msgSnap = await getDocs(msgQuery);
          const mensagens = msgSnap.docs
            .map((d) => d.data())
            .sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0));
          if (mensagens[0]) {
            conversa.ultimaMensagem = mensagens[0].texto;
          }
        } catch {}
      }

      setConversas(lista);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="title" style={styles.titulo}>
          Mensagens
        </ThemedText>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : conversas.length === 0 ? (
          <EmptyState
            icon="💬"
            titulo="Nenhuma conversa ainda"
            subtitulo="Agende uma aula com um instrutor para começar a conversar."
          />
        ) : (
          <FlatList
            data={conversas}
            keyExtractor={(item) => item.conversaId}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() =>
                  router.push(`/chat/${item.conversaId}?instrutorId=${item.instrutorId}&instrutorNome=${item.instrutorNome}`)
                }>
                <Card style={styles.card}>
                  <Avatar nome={item.instrutorNome} foto={item.instrutorFoto} size={48} />
                  <View style={styles.cardInfo}>
                    <ThemedText style={styles.cardNome}>{item.instrutorNome}</ThemedText>
                    <ThemedText numberOfLines={1} style={[styles.cardMensagem, { color: theme.textSecondary }]}>
                      {item.ultimaMensagem ?? 'Toque para iniciar a conversa'}
                    </ThemedText>
                  </View>
                </Card>
              </TouchableOpacity>
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lista: { paddingBottom: 24, gap: 12 },
  card: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardInfo: { flex: 1, gap: 2 },
  cardNome: { fontSize: 15, fontWeight: '700' },
  cardMensagem: { fontSize: 13 },
});
