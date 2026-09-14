import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, updateDoc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function Avaliacao() {
  const { agendamentoId, instrutorId, instrutorNome } = useLocalSearchParams<{
    agendamentoId: string;
    instrutorId: string;
    instrutorNome: string;
  }>();
  const router = useRouter();
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEnviar() {
    if (nota === 0) {
      Alert.alert('Atenção', 'Selecione uma nota de 1 a 5 estrelas!');
      return;
    }
    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const instrutorRef = doc(db, 'instrutores', instrutorId);
        const instrutorSnap = await transaction.get(instrutorRef);
        if (!instrutorSnap.exists()) throw new Error('Instrutor não encontrado');

        const data = instrutorSnap.data();
        const totalAnterior = data.totalAvaliacoes ?? 0;
        const mediaAnterior = data.avaliacao ?? 0;
        const novaMedia = ((mediaAnterior * totalAnterior) + nota) / (totalAnterior + 1);

        transaction.update(instrutorRef, {
          avaliacao: Math.round(novaMedia * 10) / 10,
          totalAvaliacoes: totalAnterior + 1,
        });

        const agendamentoRef = doc(db, 'agendamentos', agendamentoId);
        transaction.update(agendamentoRef, {
          avaliado: true,
          nota,
          comentario,
        });
      });

      Alert.alert('✅ Avaliação enviada!', `Obrigado por avaliar ${instrutorNome}!`, [
        { text: 'OK', onPress: () => router.push('/historico-aluno') }
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível enviar a avaliação.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <ThemedText type="title" style={styles.titulo}>⭐ Avaliar Instrutor</ThemedText>
        <ThemedText style={styles.subtitulo}>Como foi sua aula com {instrutorNome}?</ThemedText>

        <View style={styles.estrelasContainer}>
          {[1, 2, 3, 4, 5].map((estrela) => (
            <TouchableOpacity key={estrela} onPress={() => setNota(estrela)}>
              <ThemedText style={[styles.estrela, nota >= estrela && styles.estrelaAtiva]}>
                ★
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {nota > 0 && (
          <ThemedText style={styles.notaTexto}>
            {['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente!'][nota]}
          </ThemedText>
        )}

        <TextInput
          style={styles.input}
          placeholder="Deixe um comentário (opcional)"
          placeholderTextColor="#888"
          value={comentario}
          onChangeText={setComentario}
          multiline
          numberOfLines={4}
        />

        <TouchableOpacity
          style={[styles.botao, (loading || nota === 0) && styles.botaoDesabilitado]}
          onPress={handleEnviar}
          disabled={loading || nota === 0}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <ThemedText style={styles.textoBotao}>Enviar Avaliação</ThemedText>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <ThemedText style={styles.pular}>Pular avaliação</ThemedText>
        </TouchableOpacity>

      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 24, justifyContent: 'center' },
  titulo: { fontSize: 28, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitulo: { opacity: 0.7, marginBottom: 32, textAlign: 'center' },
  estrelasContainer: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 12 },
  estrela: { fontSize: 48, opacity: 0.3 },
  estrelaAtiva: { opacity: 1, color: '#f59e0b' },
  notaTexto: { textAlign: 'center', fontWeight: 'bold', fontSize: 16, marginBottom: 24, color: '#f59e0b' },
  input: {
    borderWidth: 1, borderColor: '#333', borderRadius: 12,
    padding: 16, fontSize: 16, color: '#fff', backgroundColor: '#1a1a1a',
    marginBottom: 24, height: 100, textAlignVertical: 'top',
  },
  botao: { backgroundColor: '#f59e0b', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  botaoDesabilitado: { opacity: 0.4 },
  textoBotao: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  pular: { textAlign: 'center', opacity: 0.5, marginTop: 4 },
});
