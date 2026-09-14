import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

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
};

export default function PerfilInstrutor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [instrutor, setInstrutor] = useState<Instrutor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarPerfil() {
      try {
        const snap = await getDoc(doc(db, 'instrutores', id));
        if (snap.exists()) {
          setInstrutor({ id: snap.id, ...snap.data() } as Instrutor);
        }
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
      } finally {
        setLoading(false);
      }
    }
    if (id) carregarPerfil();
  }, [id]);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false}>

          <View style={styles.header}>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarTexto}>{instrutor.nome[0]}</ThemedText>
            </View>
            <ThemedText style={styles.nome}>{instrutor.nome}</ThemedText>
            {instrutor.especialidade ? (
              <ThemedText style={styles.especialidade}>🎯 {instrutor.especialidade}</ThemedText>
            ) : null}
            {instrutor.avaliacao > 0 ? (
              <ThemedText style={styles.avaliacao}>⭐ {instrutor.avaliacao.toFixed(1)} / 5.0</ThemedText>
            ) : (
              <ThemedText style={styles.semAvaliacao}>Sem avaliações ainda</ThemedText>
            )}
          </View>

          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>📍 Região</ThemedText>
              <ThemedText style={styles.infoValor}>{instrutor.regiao}</ThemedText>
            </View>
            {instrutor.credencial ? (
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>📄 Credencial</ThemedText>
                <ThemedText style={styles.infoValor}>{instrutor.credencial}</ThemedText>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>💰 Valor</ThemedText>
              <ThemedText style={[styles.infoValor, styles.valor]}>R$ {instrutor.valorHora}/hora</ThemedText>
            </View>
          </View>

          {instrutor.bio ? (
            <View style={styles.bioBox}>
              <ThemedText style={styles.bioTitulo}>Sobre o instrutor</ThemedText>
              <ThemedText style={styles.bioTexto}>{instrutor.bio}</ThemedText>
            </View>
          ) : null}

          <TouchableOpacity style={styles.botao} onPress={() => router.push(`/agendamento?instrutorId=${instrutor.id}&instrutor=${instrutor.nome}`)}>
            <ThemedText style={styles.textoBotao}>📅 Agendar Aula</ThemedText>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginBottom: 12
  },
  avatarTexto: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  nome: { fontSize: 24, fontWeight: 'bold', marginBottom: 6 },
  especialidade: { opacity: 0.7, marginBottom: 4 },
  avaliacao: { fontSize: 16, fontWeight: 'bold', color: '#f59e0b' },
  semAvaliacao: { opacity: 0.5, fontSize: 14 },
  infoBox: {
    backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#333', gap: 12
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { opacity: 0.7 },
  infoValor: { fontWeight: 'bold' },
  valor: { color: '#16a34a' },
  bioBox: {
    backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16,
    marginBottom: 24, borderWidth: 1, borderColor: '#333'
  },
  bioTitulo: { fontWeight: 'bold', marginBottom: 8, fontSize: 16 },
  bioTexto: { opacity: 0.8, lineHeight: 22 },
  botao: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 32 },
  textoBotao: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
