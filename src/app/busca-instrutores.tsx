import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type Instrutor = {
  id: string;
  nome: string;
  regiao: string;
  valorHora: number;
  avaliacao: number;
  especialidade: string;
};

export default function BuscaInstrutores() {
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [instrutores, setInstrutores] = useState<Instrutor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarInstrutores() {
      try {
        const snapshot = await getDocs(collection(db, 'instrutores'));
        const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Instrutor));
        setInstrutores(lista);
      } catch (error) {
        console.error('Erro ao carregar instrutores:', error);
      } finally {
        setLoading(false);
      }
    }
    carregarInstrutores();
  }, []);

  const filtrados = instrutores.filter(i =>
    i.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    i.regiao?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <View style={styles.headerRow}>
          <ThemedText type="title" style={styles.titulo}>🔍 Buscar Instrutores</ThemedText>
          <TouchableOpacity style={styles.botaoHistorico} onPress={() => router.push('/historico-aluno')}>
            <ThemedText style={styles.botaoHistoricoTexto}>📋 Minhas aulas</ThemedText>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Buscar por nome ou região..."
          placeholderTextColor="#888"
          value={busca}
          onChangeText={setBusca}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <ThemedText style={styles.loadingTexto}>Carregando instrutores...</ThemedText>
          </View>
        ) : filtrados.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ThemedText style={styles.loadingTexto}>
              {busca ? 'Nenhum instrutor encontrado.' : 'Nenhum instrutor cadastrado ainda.'}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={filtrados}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} onPress={() => router.push(`/perfil-instrutor?id=${item.id}`)}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <ThemedText style={styles.avatarTexto}>{item.nome?.[0] ?? '?'}</ThemedText>
                  </View>
                  <View style={styles.cardInfo}>
                    <ThemedText style={styles.cardNome}>{item.nome}</ThemedText>
                    <ThemedText style={styles.cardRegiao}>📍 {item.regiao}</ThemedText>
                    {item.especialidade ? (
                      <ThemedText style={styles.cardEspecialidade}>🎯 {item.especialidade}</ThemedText>
                    ) : null}
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <ThemedText style={styles.cardValor}>R$ {item.valorHora}/hora</ThemedText>
                  {item.avaliacao > 0 && (
                    <ThemedText style={styles.cardAvaliacao}>⭐ {item.avaliacao.toFixed(1)}</ThemedText>
                  )}
                </View>
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
  safeArea: { flex: 1, padding: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titulo: { fontSize: 22, fontWeight: 'bold', flex: 1 },
  botaoHistorico: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  botaoHistoricoTexto: { fontSize: 12, fontWeight: 'bold', color: '#2563eb' },
  input: {
    borderWidth: 1, borderColor: '#333', borderRadius: 12,
    padding: 16, fontSize: 16, color: '#fff', backgroundColor: '#1a1a1a', marginBottom: 16
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingTexto: { opacity: 0.6, textAlign: 'center' },
  card: {
    backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#333'
  },
  cardHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center'
  },
  avatarTexto: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  cardInfo: { flex: 1, gap: 4 },
  cardNome: { fontSize: 16, fontWeight: 'bold' },
  cardRegiao: { opacity: 0.7, fontSize: 13 },
  cardEspecialidade: { opacity: 0.7, fontSize: 13 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 12 },
  cardValor: { color: '#16a34a', fontWeight: 'bold', fontSize: 15 },
  cardAvaliacao: { fontWeight: 'bold', fontSize: 15 },
});
