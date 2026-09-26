import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function RecuperarSenha() {
  const router = useRouter();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleEnviar() {
    setErro('');
    if (!email) {
      setErro('Informe seu e-mail.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setEnviado(true);
    } catch (error: any) {
      setErro('Não foi possível enviar o link. Verifique o e-mail informado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.titulo}>
          🔑 Recuperar senha
        </ThemedText>
        <ThemedText style={[styles.subtitulo, { color: theme.textSecondary }]}>
          Informe o e-mail da sua conta para receber o link de redefinição de senha.
        </ThemedText>

        {enviado ? (
          <View style={[styles.sucesso, { backgroundColor: theme.success + '22', borderColor: theme.success }]}>
            <ThemedText style={{ color: theme.success, fontWeight: '700' }}>
              ✅ E-mail enviado! Verifique sua caixa de entrada.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.form}>
            <Input
              icon="✉️"
              placeholder="Seu e-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              error={erro}
            />
            <Button title="Enviar link de recuperação" onPress={handleEnviar} loading={loading} />
          </View>
        )}

        <ThemedText style={[styles.voltar, { color: theme.primary }]} onPress={() => router.back()}>
          Voltar ao login
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 24, justifyContent: 'center' },
  titulo: { fontSize: 26, fontWeight: '800', marginBottom: 8 },
  subtitulo: { fontSize: 14, marginBottom: 28, lineHeight: 20 },
  form: { gap: 16 },
  sucesso: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 8 },
  voltar: { textAlign: 'center', fontWeight: '700', marginTop: 24 },
});
