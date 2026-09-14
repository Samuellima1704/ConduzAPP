import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function LoginAluno() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !senha) {
      Alert.alert('Atenção', 'Preencha email e senha!');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      router.push('/busca-instrutores');
    } catch (error: any) {
      const msg = error.code === 'auth/invalid-credential'
        ? 'Email ou senha incorretos.'
        : error.message;
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <ThemedText type="title" style={styles.titulo}>🎓 Login do Aluno</ThemedText>
        <ThemedText style={styles.subtitulo}>Entre na sua conta para buscar instrutores</ThemedText>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor="#888"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
          />

          <TouchableOpacity style={[styles.botao, loading && styles.botaoDesabilitado]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.textoBotao}>Entrar</ThemedText>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/cadastro-aluno')}>
            <ThemedText style={styles.cadastro}>Não tem conta? Cadastre-se</ThemedText>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center', padding: 24 },
  titulo: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  subtitulo: { opacity: 0.7, marginBottom: 32 },
  form: { gap: 16 },
  input: {
    borderWidth: 1, borderColor: '#333', borderRadius: 12,
    padding: 16, fontSize: 16, color: '#fff', backgroundColor: '#1a1a1a'
  },
  botao: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center' },
  botaoDesabilitado: { opacity: 0.6 },
  textoBotao: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  cadastro: { textAlign: 'center', color: '#2563eb', marginTop: 8 },
});
