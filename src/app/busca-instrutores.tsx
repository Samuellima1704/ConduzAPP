import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';

type Instrutor = {
  id: string;
  nome: string;
  regiao: string;
  valorHora: number;
  avaliacao: number;
  especialidade: string;
  carro?: string;
  cambio?: string;
  foto?: string;
};

export default function BuscaInstrutores() {
  const router = useRouter();
  const theme = useTheme();
  const [busca, setBusca] = useState('');
  const [instrutores, setInstrutores] = useState<Instrutor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarInstrutores() {
      try {
        const snapshot = await getDocs(collection(db, 'instrutores'));
        setInstrutores(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Instrutor)));
      } catch (error) {
        console.error('Erro ao carregar instrutores:', error);
      } finally {
        setLoading(false);
      }
    }
    carregarInstrutores();
  }, []);

  const filtrados = instrutores.filter(
    (i) =>
      i.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      i.regiao?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ThemedText type="title" style={styles.titulo}>
          Buscar Instrutores
        </ThemedText>

        <Input icon="🔍" placeholder="Buscar por nome ou região..." value={busca} onChangeText={setBusca} />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon="🔍"
            titulo={busca ? 'Nenhum instrutor encontrado.' : 'Nenhum instrutor cadastrado ainda.'}
          />
        ) : (
          <FlatList
            data={filtrados}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => router.push(`/perfil-instrutor?id=${item.id}`)}>
                <Card style={styles.card}>
                  <Avatar nome={item.nome} foto={item.foto} size={52} />
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTopo}>
                      <ThemedText style={styles.cardNome}>{item.nome}</ThemedText>
                      {item.avaliacao > 0 && (
                        <ThemedText style={[styles.cardAvaliacao, { color: theme.warning }]}>
                          {item.avaliacao.toFixed(1)} ★
                        </ThemedText>
                      )}
                    </View>
                    <ThemedText style={[styles.cardRegiao, { color: theme.textSecondary }]}>📍 {item.regiao}</ThemedText>
                    <ThemedText style={[styles.cardDetalhe, { color: theme.textSecondary }]}>
                      Carro: {item.carro ?? '—'} | Câmbio: {item.cambio ?? '—'}
                    </ThemedText>
                    <ThemedText style={[styles.cardValor, { color: theme.success }]}>R$ {item.valorHora} / aula</ThemedText>
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
  safeArea: { flex: 1, padding: 20 },
  titulo: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lista: { paddingTop: 16, paddingBottom: 24, gap: 12 },
  card: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardInfo: { flex: 1, gap: 2 },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNome: { fontSize: 15, fontWeight: '700' },
  cardRegiao: { fontSize: 12 },
  cardDetalhe: { fontSize: 12 },
  cardAvaliacao: { fontWeight: '700', fontSize: 14 },
  cardValor: { fontSize: 14, fontWeight: '700', marginTop: 2 },
});
