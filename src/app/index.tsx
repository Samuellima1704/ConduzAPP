import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <View style={styles.hero}>
          <ThemedText type="title" style={styles.titulo}>🚗 ConduzAPP</ThemedText>
          <ThemedText style={styles.subtitulo}>
            Conectando alunos e instrutores de direção
          </ThemedText>
        </View>

        <View style={styles.botoes}>
          <TouchableOpacity style={styles.botaoAluno} onPress={() => router.push('/login-aluno')}>
            <ThemedText style={styles.textoBotao}>🎓 Sou Aluno</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.botaoInstrutor} onPress={() => router.push('/login-instrutor')}>
            <ThemedText style={styles.textoBotao}>👨‍🏫 Sou Instrutor</ThemedText>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  hero: { alignItems: 'center', marginBottom: 48 },
  titulo: { fontSize: 32, fontWeight: 'bold', marginBottom: 12 },
  subtitulo: { fontSize: 16, textAlign: 'center', opacity: 0.7 },
  botoes: { width: '100%', gap: 16 },
  botaoAluno: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center' },
  botaoInstrutor: { backgroundColor: '#16a34a', padding: 16, borderRadius: 12, alignItems: 'center' },
  textoBotao: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});