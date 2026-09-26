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

// O login por CPF exigiria consultar o Firestore antes da autenticação, o que as
// regras de segurança (baseadas em dono do documento) não permitem — por isso o
// campo aceita CPF visualmente, mas a autenticação em si usa o e-mail cadastrado.
async function resolveEmail(entrada: string): Promise<string> {
  return entrada;
}

export default function Login() {
  const router = useRouter();
  const theme = useTheme();
  const [entrada, setEntrada] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setErro('');
    if (!entrada || !senha) {
      setErro('Preencha e-mail/CPF e senha.');
      return;
    }
    setLoading(true);
    try {
      const email = await resolveEmail(entrada.trim());
      await signInWithEmailAndPassword(auth, email, senha);
      router.replace('/(aluno)');
    } catch (error: any) {
      const credenciaisInvalidas = [
        'auth/invalid-credential',
        'auth/wrong-password',
        'auth/user-not-found',
        'auth/invalid-email',
      ];
      const msg = credenciaisInvalidas.includes(error.code)
        ? 'E-mail/CPF ou senha incorretos.'
        : 'Não foi possível entrar. Tente novamente.';
      setErro(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <SafeAreaView>
          <View style={styles.logoBox}>
            <ThemedText style={styles.logoIcon}>🚗</ThemedText>
            <ThemedText style={styles.logoTexto}>CONDUZ</ThemedText>
            <ThemedText style={styles.logoTextoBold}>APP</ThemedText>
          </View>
        </SafeAreaView>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <ThemedText style={styles.titulo}>Bem-vindo de volta!</ThemedText>
        <ThemedText style={[styles.subtitulo, { color: theme.textSecondary }]}>
          Faça login para continuar.
        </ThemedText>

        <View style={styles.form}>
          <Input
            icon="🔒"
            placeholder="E-mail ou CPF"
            value={entrada}
            onChangeText={setEntrada}
            autoCapitalize="none"
          />
          <Input icon="🔒" placeholder="Senha" value={senha} onChangeText={setSenha} isPassword error={erro} />

          <ThemedText
            style={[styles.esqueceu, { color: theme.primary }]}
            onPress={() => router.push('/recuperar-senha')}>
            Esqueceu sua senha?
          </ThemedText>

          <Button title="Entrar" onPress={handleLogin} loading={loading} />

          <ThemedText style={[styles.ou, { color: theme.textSecondary }]}>ou</ThemedText>

          <Button title="Criar conta" variant="secondary" onPress={() => router.push('/cadastro-aluno')} />

          <ThemedText
            style={[styles.instrutor, { color: theme.primary }]}
            onPress={() => router.push('/login-instrutor')}>
            Entrar como instrutor
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 24, paddingBottom: 48, alignItems: 'center' },
  logoBox: { alignItems: 'center', gap: 2 },
  logoIcon: { fontSize: 40, marginBottom: 4 },
  logoTexto: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  logoTextoBold: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  card: {
    flex: 1,
    marginTop: -28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingTop: 32,
  },
  titulo: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subtitulo: { fontSize: 14, marginBottom: 28 },
  form: { gap: 16 },
  esqueceu: { textAlign: 'right', fontSize: 13, fontWeight: '600', marginTop: -6 },
  ou: { textAlign: 'center', fontSize: 13 },
  instrutor: { textAlign: 'center', fontSize: 14, fontWeight: '700', marginTop: 8 },
});
