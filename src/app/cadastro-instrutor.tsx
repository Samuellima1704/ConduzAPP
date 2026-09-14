import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function CadastroInstrutor() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [credencial, setCredencial] = useState('');
  const [regiao, setRegiao] = useState('');
  const [valorHora, setValorHora] = useState('');
  const [especialidade, setEspecialidade] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCadastro() {
    if (!nome || !email || !senha || !credencial || !regiao || !valorHora) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios!');
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
        especialidade,
        bio,
        avaliacao: 0,
        totalAvaliacoes: 0,
        tipo: 'instrutor',
        criadoEm: new Date(),
      });
      Alert.alert('✅ Sucesso!', `Perfil criado! Bem-vindo, ${nome}!`, [
        { text: 'OK', onPress: () => router.push('/dashboard-instrutor') }
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

          <ThemedText type="title" style={styles.titulo}>📋 Cadastro do Instrutor</ThemedText>
          <ThemedText style={styles.subtitulo}>Crie seu perfil profissional</ThemedText>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Nome completo"
              placeholderTextColor="#888"
              value={nome}
              onChangeText={setNome}
            />
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
            <TextInput
              style={styles.input}
              placeholder="Credencial DETRAN (ex: 12345-SP)"
              placeholderTextColor="#888"
              value={credencial}
              onChangeText={setCredencial}
            />
            <TextInput
              style={styles.input}
              placeholder="Região de atendimento (ex: Vila Madalena, SP)"
              placeholderTextColor="#888"
              value={regiao}
              onChangeText={setRegiao}
            />
            <TextInput
              style={styles.input}
              placeholder="Valor por hora (ex: 80)"
              placeholderTextColor="#888"
              value={valorHora}
              onChangeText={setValorHora}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Especialidade (ex: Primeira habilitação)"
              placeholderTextColor="#888"
              value={especialidade}
              onChangeText={setEspecialidade}
            />
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Sobre você (bio)"
              placeholderTextColor="#888"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={[styles.botao, loading && styles.botaoDesabilitado]} onPress={handleCadastro} disabled={loading}>
              <ThemedText style={styles.textoBotao}>{loading ? 'Criando perfil...' : 'Criar perfil'}</ThemedText>
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
  input: {
    borderWidth: 1, borderColor: '#333', borderRadius: 12,
    padding: 16, fontSize: 16, color: '#fff', backgroundColor: '#1a1a1a'
  },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  botao: { backgroundColor: '#16a34a', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  botaoDesabilitado: { opacity: 0.6 },
  textoBotao: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  voltar: { textAlign: 'center', color: '#16a34a', marginTop: 4, marginBottom: 32 },
});