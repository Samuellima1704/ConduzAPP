import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, addDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const horarios = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

function gerarProximosDias() {
  const dias = [];
  const hoje = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    dias.push({
      label: labels[d.getDay()],
      data: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      iso: d.toISOString().split('T')[0],
    });
  }
  return dias;
}

const dias = gerarProximosDias();

export default function Agendamento() {
  const { instrutorId, instrutor } = useLocalSearchParams<{ instrutorId: string; instrutor: string }>();
  const router = useRouter();
  const [diaSelecionado, setDiaSelecionado] = useState('');
  const [horarioSelecionado, setHorarioSelecionado] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleConfirmar() {
    if (!diaSelecionado || !horarioSelecionado) {
      Alert.alert('Atenção', 'Selecione um dia e horário!');
      return;
    }
    const alunoId = auth.currentUser?.uid;
    if (!alunoId) {
      Alert.alert('Erro', 'Você precisa estar logado para agendar.');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'agendamentos'), {
        alunoId,
        instrutorId,
        instrutorNome: instrutor,
        dia: diaSelecionado,
        horario: horarioSelecionado,
        status: 'pendente',
        criadoEm: new Date(),
      });
      Alert.alert(
        '✅ Aula Agendada!',
        `Sua aula com ${instrutor} foi agendada para ${diaSelecionado} às ${horarioSelecionado}.`,
        [{ text: 'OK', onPress: () => router.push('/busca-instrutores') }]
      );
    } catch (error: any) {
      Alert.alert('Erro', 'Não foi possível agendar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false}>

          <ThemedText type="title" style={styles.titulo}>📅 Agendar Aula</ThemedText>
          <ThemedText style={styles.subtitulo}>Instrutor: {instrutor}</ThemedText>

          <ThemedText style={styles.secaoTitulo}>Escolha o dia</ThemedText>
          <View style={styles.diasContainer}>
            {dias.map((dia) => (
              <TouchableOpacity
                key={dia.iso}
                style={[styles.diaCard, diaSelecionado === dia.data && styles.diaCardAtivo]}
                onPress={() => setDiaSelecionado(dia.data)}
              >
                <ThemedText style={[styles.diaLabel, diaSelecionado === dia.data && styles.textoAtivo]}>
                  {dia.label}
                </ThemedText>
                <ThemedText style={[styles.diaData, diaSelecionado === dia.data && styles.textoAtivo]}>
                  {dia.data}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <ThemedText style={styles.secaoTitulo}>Escolha o horário</ThemedText>
          <View style={styles.horariosContainer}>
            {horarios.map((h) => (
              <TouchableOpacity
                key={h}
                style={[styles.horarioCard, horarioSelecionado === h && styles.horarioCardAtivo]}
                onPress={() => setHorarioSelecionado(h)}
              >
                <ThemedText style={[styles.horarioTexto, horarioSelecionado === h && styles.textoAtivo]}>
                  {h}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {diaSelecionado && horarioSelecionado && (
            <View style={styles.resumo}>
              <ThemedText style={styles.resumoTitulo}>📋 Resumo</ThemedText>
              <ThemedText style={styles.resumoTexto}>📅 {diaSelecionado} às {horarioSelecionado}</ThemedText>
              <ThemedText style={styles.resumoTexto}>👨‍🏫 {instrutor}</ThemedText>
            </View>
          )}

          <TouchableOpacity style={[styles.botao, loading && styles.botaoDesabilitado]} onPress={handleConfirmar} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <ThemedText style={styles.textoBotao}>Confirmar Agendamento</ThemedText>
            }
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 24 },
  titulo: { fontSize: 28, fontWeight: 'bold', marginBottom: 4, marginTop: 8 },
  subtitulo: { opacity: 0.7, marginBottom: 24 },
  secaoTitulo: { fontWeight: 'bold', fontSize: 16, marginBottom: 12, marginTop: 8 },
  diasContainer: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  diaCard: {
    flex: 1, minWidth: 52, alignItems: 'center', padding: 10,
    borderRadius: 12, borderWidth: 1, borderColor: '#333', backgroundColor: '#1a1a1a'
  },
  diaCardAtivo: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  diaLabel: { fontWeight: 'bold', opacity: 0.7 },
  diaData: { fontSize: 12, opacity: 0.7 },
  textoAtivo: { color: '#fff', opacity: 1 },
  horariosContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  horarioCard: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: '#333', backgroundColor: '#1a1a1a'
  },
  horarioCardAtivo: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  horarioTexto: { fontWeight: 'bold', opacity: 0.7 },
  resumo: {
    backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16,
    marginBottom: 24, borderWidth: 1, borderColor: '#2563eb', gap: 6
  },
  resumoTitulo: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  resumoTexto: { opacity: 0.8 },
  botao: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 32 },
  botaoDesabilitado: { opacity: 0.6 },
  textoBotao: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
