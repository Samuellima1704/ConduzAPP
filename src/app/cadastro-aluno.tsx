import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const STATUS_OPCOES = ['Iniciando processo', 'Reprovei no prático', 'Quero mais prática'];

export default function CadastroAluno() {
  const router = useRouter();
  const theme = useTheme();
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [statusCNH, setStatusCNH] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCadastro() {
    setErro('');
    if (!nome || !email || !senha || !confirmarSenha) {
      setErro('Preencha todos os campos obrigatórios!');
      return;
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem!');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      await setDoc(doc(db, 'alunos', userCredential.user.uid), {
        nome,
        cpf: cpf.replace(/\D/g, ''),
        email,
        statusCNH,
        tipo: 'aluno',
        criadoEm: new Date(),
      });
      router.replace('/(aluno)');
    } catch (error: any) {
      setErro(error.message ?? 'Não foi possível criar sua conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ThemedText type="title" style={styles.titulo}>
            📝 Cadastro do Aluno
          </ThemedText>
          <ThemedText style={[styles.subtitulo, { color: theme.textSecondary }]}>
            Crie sua conta para encontrar instrutores
          </ThemedText>

          <View style={styles.form}>
            <Input placeholder="Nome completo" value={nome} onChangeText={setNome} />
            <Input placeholder="CPF" value={cpf} onChangeText={setCpf} keyboardType="numeric" />
            <Input
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input placeholder="Senha" value={senha} onChangeText={setSenha} isPassword />
            <Input
              placeholder="Confirmar senha"
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
              isPassword
              error={erro}
            />

            <ThemedText style={styles.label}>Qual é o seu status na CNH?</ThemedText>
            {STATUS_OPCOES.map((opcao) => {
              const ativo = statusCNH === opcao;
              return (
                <TouchableOpacity
                  key={opcao}
                  style={[
                    styles.opcao,
                    {
                      backgroundColor: ativo ? theme.primary + '15' : theme.surface,
                      borderColor: ativo ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setStatusCNH(opcao)}>
                  <ThemedText style={{ color: ativo ? theme.primary : theme.textSecondary, fontWeight: ativo ? '700' : '400' }}>
                    {opcao}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}

            <Button title="Criar conta" onPress={handleCadastro} loading={loading} />

            <ThemedText style={[styles.voltar, { color: theme.primary }]} onPress={() => router.back()}>
              Já tenho conta. Fazer login
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 24 },
  titulo: { fontSize: 26, fontWeight: '800', marginBottom: 8, marginTop: 8 },
  subtitulo: { fontSize: 14, marginBottom: 28 },
  form: { gap: 16 },
  label: { fontWeight: '700', marginTop: 4 },
  opcao: { borderWidth: 1.5, borderRadius: 14, padding: 14, alignItems: 'center' },
  voltar: { textAlign: 'center', fontWeight: '700', marginTop: 4, marginBottom: 32 },
});
