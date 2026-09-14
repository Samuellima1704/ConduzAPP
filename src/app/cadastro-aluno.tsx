import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function CadastroAluno() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [statusCNH, setStatusCNH] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCadastro() {
    if (!nome || !email || !senha || !confirmarSenha) {
      Alert.alert('Atenção', 'Preencha todos os campos!');
      return;
    }
    if (senha !== confirmarSenha) {
      Alert.alert('Erro', 'As senhas não coincidem!');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      await setDoc(doc(db, 'alunos', userCredential.user.uid), {
        nome,
        email,
        statusCNH,
        tipo: 'aluno',
        criadoEm: new Date(),
      });
      Alert.alert('✅ Sucesso!', `Bem-vindo, ${nome}!`, [
        { text: 'OK', onPress: () => router.push('/busca-instrutores') }
      ]);
    } catch (error: any) {
      Alert.alert('Erro', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ThemedText type="title" style={styles.titulo}>📝 Cadastro do Aluno</ThemedText>
          <ThemedText style={styles.subtitulo}>Crie sua conta para encontrar instrutores</ThemedText>
          <View style={styles.form}>
            <TextInput style={styles.input} placeholder="Nome completo" placeholderTextColor="#888" value={nome} onChangeText={setNome} />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#888" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Senha" placeholderTextColor="#888" value={senha} onChangeText={setSenha} secureTextEntry />
            <TextInput style={styles.input} placeholder="Confirmar senha" placeholderTextColor="#888" value={confirmarSenha} onChangeText={setConfirmarSenha} secureTextEntry />
            <ThemedText style={styles.label}>Qual é o seu status na CNH?</ThemedText>
            {['Iniciando processo', 'Reprovei no prático', 'Quero mais prática'].map((opcao) => (
              <TouchableOpacity key={opcao} style={[styles.opcao, statusCNH === opcao && styles.opcaoSelecionada]} onPress={() => setStatusCNH(opcao)}>
                <ThemedText style={statusCNH === opcao ? styles.opcaoTextoAtivo : styles.opcaoTexto}>{opcao}</ThemedText>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.botao, loading && styles.botaoDesabilitado]} onPress={handleCadastro} disabled={loading}>
              <ThemedText style={styles.textoBotao}>{loading ? 'Criando conta...' : 'Criar conta'}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()}>
              <ThemedText style={styles.voltar}>Já tenho conta. Fazer login</ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 24 },
  titulo: { fontSize: 28, fontWeight: 'bold', marginBottom: 8, marginTop: 16 },
  subtitulo: { opacity: 0.7, marginBottom: 32 },
  form: { gap: 16 },
  input: { borderWidth: 1, borderColor: '#333', borderRadius: 12, padding: 16, fontSize: 16, color: '#fff', backgroundColor: '#1a1a1a' },
  label: { fontWeight: 'bold', marginTop: 8 },
  opcao: { borderWidth: 1, borderColor: '#333', borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: '#1a1a1a' },
  opcaoSelecionada: { borderColor: '#2563eb', backgroundColor: '#1e3a8a' },
  opcaoTexto: { color: '#888' },
  opcaoTextoAtivo: { color: '#fff', fontWeight: 'bold' },
  botao: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  botaoDesabilitado: { opacity: 0.6 },
  textoBotao: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  voltar: { textAlign: 'center', color: '#2563eb', marginTop: 4, marginBottom: 32 },
});