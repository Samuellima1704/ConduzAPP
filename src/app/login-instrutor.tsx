import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginInstrutor() {
  const router = useRouter();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setErro('');
    if (!email || !senha) {
      setErro('Preencha email e senha!');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      router.replace('/dashboard-instrutor');
    } catch (error: any) {
      setErro(error.code === 'auth/invalid-credential' ? 'Email ou senha incorretos.' : error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.titulo}>
          👨‍🏫 Login do Instrutor
        </ThemedText>
        <ThemedText style={[styles.subtitulo, { color: theme.textSecondary }]}>
          Entre na sua conta para gerenciar suas aulas
        </ThemedText>

        <View style={styles.form}>
          <Input
            icon="✉️"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input icon="🔒" placeholder="Senha" value={senha} onChangeText={setSenha} isPassword error={erro} />

          <Button title="Entrar" onPress={handleLogin} loading={loading} />

          <ThemedText style={[styles.cadastro, { color: theme.primary }]} onPress={() => router.push('/cadastro-instrutor')}>
            Não tem conta? Cadastre-se
          </ThemedText>
          <ThemedText style={[styles.voltar, { color: theme.textSecondary }]} onPress={() => router.replace('/')}>
            ← Entrar como aluno
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center', padding: 24 },
  titulo: { fontSize: 26, fontWeight: '800', marginBottom: 8 },
  subtitulo: { fontSize: 14, marginBottom: 28 },
  form: { gap: 16 },
  cadastro: { textAlign: 'center', fontWeight: '700', marginTop: 4 },
  voltar: { textAlign: 'center', marginTop: 16 },
});
