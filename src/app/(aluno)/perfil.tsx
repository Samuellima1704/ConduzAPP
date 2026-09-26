import { useEffect, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';

const MENU = [
  { icon: '📅', label: 'Meus Agendamentos', rota: '/(aluno)/agendamentos' },
  { icon: '♡', label: 'Favoritos', rota: '/em-breve?titulo=Favoritos' },
  { icon: '💳', label: 'Métodos de Pagamento', rota: '/em-breve?titulo=Métodos de Pagamento' },
  { icon: '⭐', label: 'Avaliações Recebidas', rota: '/em-breve?titulo=Avaliações Recebidas' },
  { icon: '🔔', label: 'Notificações', rota: '/em-breve?titulo=Notificações' },
  { icon: '⚙️', label: 'Configurações', rota: '/em-breve?titulo=Configurações' },
  { icon: '❓', label: 'Ajuda e Suporte', rota: '/em-breve?titulo=Ajuda e Suporte' },
] as const;

export default function PerfilAluno() {
  const router = useRouter();
  const theme = useTheme();
  const [nome, setNome] = useState('');
  const [foto, setFoto] = useState<string | undefined>();

  useEffect(() => {
    carregarPerfil();
  }, []);

  async function carregarPerfil() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const snap = await getDoc(doc(db, 'alunos', uid));
    if (snap.exists()) {
      setNome(snap.data().nome ?? '');
      setFoto(snap.data().foto);
    }
  }

  async function handleEditarFoto() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert('Permissão necessária', 'Precisamos acessar suas fotos para atualizar o avatar.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (resultado.canceled) return;

    const uri = resultado.assets[0].uri;
    setFoto(uri);
    const uid = auth.currentUser?.uid;
    if (uid) {
      await updateDoc(doc(db, 'alunos', uid), { foto: uri });
    }
  }

  function handleSair() {
    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          router.replace('/');
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <SafeAreaView edges={['top']}>
          <View style={styles.avatarBox}>
            <TouchableOpacity onPress={handleEditarFoto}>
              <Avatar nome={nome || 'Aluno'} foto={foto} size={88} />
              <View style={[styles.editIcon, { backgroundColor: theme.surface }]}>
                <ThemedText style={{ fontSize: 14 }}>✏️</ThemedText>
              </View>
            </TouchableOpacity>
            <ThemedText style={styles.nome}>{nome || 'Aluno'}</ThemedText>
            <View style={styles.badge}>
              <ThemedText style={styles.badgeTexto}>Aluno</ThemedText>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <View style={styles.menuWrapper}>
        <Card style={styles.menuCard}>
          {MENU.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, index < MENU.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
              onPress={() => router.push(item.rota as any)}>
              <ThemedText style={styles.menuIcon}>{item.icon}</ThemedText>
              <ThemedText style={styles.menuLabel}>{item.label}</ThemedText>
              <ThemedText style={{ color: theme.textSecondary }}>›</ThemedText>
            </TouchableOpacity>
          ))}
        </Card>

        <TouchableOpacity style={styles.sairBotao} onPress={handleSair}>
          <ThemedText style={[styles.sairTexto, { color: theme.danger }]}>🚪 Sair da conta</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 44 },
  avatarBox: { alignItems: 'center', paddingTop: 16, gap: 8 },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nome: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 8 },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  badgeTexto: { color: '#fff', fontSize: 12, fontWeight: '700' },
  menuWrapper: { flex: 1, marginTop: -28, paddingHorizontal: 20 },
  menuCard: { padding: 0, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  menuIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  sairBotao: { alignItems: 'center', padding: 16, marginTop: 8, marginBottom: 24 },
  sairTexto: { fontSize: 15, fontWeight: '700' },
});
