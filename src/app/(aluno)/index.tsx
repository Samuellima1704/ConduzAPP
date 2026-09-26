import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
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
  carro?: string;
  cambio?: string;
  foto?: string;
};

const CATEGORIAS = [
  { icon: '🚗', label: 'Aulas Avulsas' },
  { icon: '📦', label: 'Pacotes' },
  { icon: '👥', label: 'Instrutores' },
];

export default function HomeAluno() {
  const router = useRouter();
  const theme = useTheme();
  const [busca, setBusca] = useState('');
  const [instrutores, setInstrutores] = useState<Instrutor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const snapshot = await getDocs(collection(db, 'instrutores'));
        setInstrutores(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Instrutor)));
      } catch (error) {
        console.error('Erro ao carregar instrutores:', error);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, []);

  const destaque = useMemo(() => {
    const filtrados = instrutores.filter(
      (i) =>
        i.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        i.regiao?.toLowerCase().includes(busca.toLowerCase())
    );
    return filtrados.slice(0, 5);
  }, [instrutores, busca]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerRow}>
          <View>
            <ThemedText style={styles.saudacao}>Olá, Aluno!</ThemedText>
            <ThemedText style={[styles.subtitulo, { color: theme.textSecondary }]}>
              Encontre o instrutor ideal para suas aulas
            </ThemedText>
          </View>
          <ThemedText style={styles.sino}>🔔</ThemedText>
        </View>

        <View style={styles.conteudoPadding}>
          <Input icon="🔍" placeholder="Buscar instrutor ou região..." value={busca} onChangeText={setBusca} />

          <ThemedText style={styles.secaoTitulo}>Categorias</ThemedText>
          <View style={styles.categorias}>
            {CATEGORIAS.map((cat) => (
              <TouchableOpacity key={cat.label} style={styles.categoriaItem} onPress={() => router.push('/busca-instrutores')}>
                <View style={[styles.categoriaIcone, { backgroundColor: theme.primary + '15' }]}>
                  <ThemedText style={{ fontSize: 22 }}>{cat.icon}</ThemedText>
                </View>
                <ThemedText style={styles.categoriaLabel}>{cat.label}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.destaqueHeader}>
            <ThemedText style={styles.secaoTitulo}>Instrutores em destaque</ThemedText>
            <ThemedText style={[styles.verTodos, { color: theme.primary }]} onPress={() => router.push('/busca-instrutores')}>
              Ver todos
            </ThemedText>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : destaque.length === 0 ? (
          <EmptyState icon="🔍" titulo="Nenhum instrutor encontrado" subtitulo="Tente buscar por outro nome ou região." />
        ) : (
          <FlatList
            data={destaque}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push(`/agendamento?instrutorId=${item.id}&instrutor=${item.nome}`)}>
                <Card style={styles.card}>
                  <Avatar nome={item.nome} foto={item.foto} size={52} />
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTopo}>
                      <ThemedText style={styles.cardNome}>{item.nome}</ThemedText>
                      {item.avaliacao > 0 ? (
                        <ThemedText style={[styles.cardNota, { color: theme.warning }]}>
                          {item.avaliacao.toFixed(1)} ★
                        </ThemedText>
                      ) : null}
                    </View>
                    <ThemedText style={[styles.cardDetalhe, { color: theme.textSecondary }]}>
                      Carro: {item.carro ?? '—'} | Câmbio: {item.cambio ?? '—'}
                    </ThemedText>
                    <ThemedText style={[styles.cardValor, { color: theme.success }]}>
                      R$ {item.valorHora} / aula
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
  safeArea: { flex: 1 },
  conteudoPadding: { paddingHorizontal: 20 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  saudacao: { fontSize: 22, fontWeight: '800' },
  subtitulo: { fontSize: 13, marginTop: 2 },
  sino: { fontSize: 22 },
  secaoTitulo: { fontSize: 15, fontWeight: '700', marginTop: 20, marginBottom: 12 },
  categorias: { flexDirection: 'row', justifyContent: 'space-between' },
  categoriaItem: { alignItems: 'center', gap: 6, flex: 1 },
  categoriaIcone: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  categoriaLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  destaqueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verTodos: { fontSize: 13, fontWeight: '700', marginTop: 20 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lista: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  card: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardInfo: { flex: 1, gap: 2 },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNome: { fontSize: 15, fontWeight: '700' },
  cardNota: { fontSize: 13, fontWeight: '700' },
  cardDetalhe: { fontSize: 12 },
  cardValor: { fontSize: 14, fontWeight: '700', marginTop: 2 },
});
