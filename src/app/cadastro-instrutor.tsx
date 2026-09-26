import { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
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

export default function CadastroInstrutor() {
  const router = useRouter();
  const theme = useTheme();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [credencial, setCredencial] = useState('');
  const [regiao, setRegiao] = useState('');
  const [valorHora, setValorHora] = useState('');
  const [carro, setCarro] = useState('');
  const [cambio, setCambio] = useState('Manual');
  const [categoria, setCategoria] = useState('B');
  const [foto, setFoto] = useState('');
  const [especialidade, setEspecialidade] = useState('');
  const [bio, setBio] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCadastro() {
    setErro('');
    if (!nome || !email || !senha || !credencial || !regiao || !valorHora) {
      setErro('Preencha todos os campos obrigatórios!');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      await setDoc(doc(db, 'instrutores', userCredential.user.uid), {
        nome,
        email,
        credencial,
        regiao,
        valorHora: Number(valorHora),
        carro,
        cambio,
        categoria,
        ...(foto ? { foto } : {}),
        especialidade,
        bio,
        avaliacao: 0,
        totalAvaliacoes: 0,
        disponibilidade: ['08:00', '09:00', '10:00', '14:00', '15:00', '16:00'],
        tipo: 'instrutor',
        criadoEm: new Date(),
      });
      router.replace('/dashboard-instrutor');
    } catch (error: any) {
      setErro(error.message ?? 'Não foi possível criar seu perfil.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ThemedText type="title" style={styles.titulo}>
            📋 Cadastro do Instrutor
          </ThemedText>
          <ThemedText style={[styles.subtitulo, { color: theme.textSecondary }]}>Crie seu perfil profissional</ThemedText>

          <View style={styles.form}>
            <Input placeholder="Nome completo" value={nome} onChangeText={setNome} />
            <Input placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Input placeholder="Senha" value={senha} onChangeText={setSenha} isPassword />
            <Input placeholder="Credencial DETRAN (ex: 12345-SP)" value={credencial} onChangeText={setCredencial} />
            <Input placeholder="Região de atendimento (ex: Vila Madalena, SP)" value={regiao} onChangeText={setRegiao} />
            <Input placeholder="Valor por hora (ex: 80)" value={valorHora} onChangeText={setValorHora} keyboardType="numeric" />
            <Input placeholder="Carro (ex: Onix)" value={carro} onChangeText={setCarro} />
            <Input placeholder="Câmbio (Manual ou Automático)" value={cambio} onChangeText={setCambio} />
            <Input placeholder="Categoria CNH (ex: B ou A e B)" value={categoria} onChangeText={setCategoria} />
            <Input placeholder="Foto (URL, opcional)" value={foto} onChangeText={setFoto} autoCapitalize="none" />
            <Input placeholder="Especialidade (ex: Primeira habilitação)" value={especialidade} onChangeText={setEspecialidade} />
            <Input
              placeholder="Sobre você (bio)"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              error={erro}
            />

            <Button title="Criar perfil" onPress={handleCadastro} loading={loading} />

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
  voltar: { textAlign: 'center', fontWeight: '700', marginTop: 4, marginBottom: 32 },
});
