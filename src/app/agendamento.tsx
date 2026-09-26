import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { DURACAO_AULA_MIN, FOCOS_AULA } from '@/services/seed';

const HORARIOS_PADRAO = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

function gerarProximosDias() {
  const dias = [];
  const hoje = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    dias.push({
      label: labels[d.getDay()],
      dia: String(d.getDate()).padStart(2, '0'),
      data: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
    });
  }
  return dias;
}

const dias = gerarProximosDias();

type Instrutor = {
  nome: string;
  carro?: string;
  cambio?: string;
  categoria?: string;
  valorHora: number;
  avaliacao: number;
  foto?: string;
  disponibilidade?: string[];
};

export default function Agendamento() {
  const { instrutorId, instrutor: instrutorNomeParam } = useLocalSearchParams<{
    instrutorId: string;
    instrutor: string;
  }>();
  const router = useRouter();
  const theme = useTheme();

  const [instrutor, setInstrutor] = useState<Instrutor | null>(null);
  const [horariosOcupados, setHorariosOcupados] = useState<string[]>([]);
  const [diaSelecionado, setDiaSelecionado] = useState('');
  const [horarioSelecionado, setHorarioSelecionado] = useState('');
  const [foco, setFoco] = useState<string>(FOCOS_AULA[1]);
  const [local, setLocal] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [mostrarSucesso, setMostrarSucesso] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function carregar() {
      if (!instrutorId) return;
      const snap = await getDoc(doc(db, 'instrutores', instrutorId));
      if (snap.exists()) setInstrutor(snap.data() as Instrutor);
    }
    carregar();
  }, [instrutorId]);

  useEffect(() => {
    async function carregarOcupados() {
      if (!instrutorId || !diaSelecionado) {
        setHorariosOcupados([]);
        return;
      }
      const q = query(collection(db, 'agendamentos'), where('instrutorId', '==', instrutorId));
      const snapshot = await getDocs(q);
      const ocupados = snapshot.docs
        .map((d) => d.data())
        .filter((a) => a.dia === diaSelecionado && a.status !== 'cancelado')
        .map((a) => a.horario);
      setHorariosOcupados(ocupados);
    }
    carregarOcupados();
  }, [instrutorId, diaSelecionado]);

  const horarios = instrutor?.disponibilidade?.length ? instrutor.disponibilidade : HORARIOS_PADRAO;
  const instrutorNome = instrutor?.nome ?? instrutorNomeParam;

  function handleAbrirConfirmacao() {
    if (!diaSelecionado || !horarioSelecionado) return;
    setMostrarConfirmacao(true);
  }

  async function handleConfirmar() {
    const alunoId = auth.currentUser?.uid;
    if (!alunoId) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'agendamentos'), {
        alunoId,
        instrutorId,
        instrutorNome,
        dia: diaSelecionado,
        horario: horarioSelecionado,
        foco,
        local,
        observacoes,
        categoria: instrutor?.categoria ?? 'B',
        duracaoMin: DURACAO_AULA_MIN,
        formaPagamento: 'PIX',
        status: 'pendente',
        criadoEm: new Date(),
      });
      setMostrarConfirmacao(false);
      setMostrarSucesso(true);
    } catch (error) {
      console.warn('[agendamento] erro ao confirmar:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <ThemedText style={styles.voltar} onPress={() => router.back()}>
            ←
          </ThemedText>
          <ThemedText style={styles.headerTitulo}>Novo Agendamento</ThemedText>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Card style={styles.instrutorCard}>
            <Avatar nome={instrutorNome ?? '?'} foto={instrutor?.foto} size={56} />
            <View style={styles.instrutorInfo}>
              <ThemedText style={styles.instrutorNome}>{instrutorNome}</ThemedText>
              <ThemedText style={[styles.instrutorDetalhe, { color: theme.textSecondary }]}>
                Carro: {instrutor?.carro ?? '—'} | {instrutor?.cambio ?? '—'}
              </ThemedText>
              <ThemedText style={[styles.instrutorValor, { color: theme.success }]}>
                R$ {instrutor?.valorHora ?? '—'} / aula
              </ThemedText>
            </View>
            {instrutor?.avaliacao ? (
              <ThemedText style={[styles.instrutorNota, { color: theme.warning }]}>
                {instrutor.avaliacao.toFixed(1)} ★
              </ThemedText>
            ) : null}
          </Card>

          <ThemedText style={styles.secaoTitulo}>Selecionar Data</ThemedText>
          <View style={styles.diasContainer}>
            {dias.map((d) => {
              const ativo = diaSelecionado === d.data;
              return (
                <TouchableOpacity
                  key={d.data}
                  style={[
                    styles.diaCard,
                    { backgroundColor: ativo ? theme.primary : theme.surface, borderColor: ativo ? theme.primary : theme.border },
                  ]}
                  onPress={() => {
                    setDiaSelecionado(d.data);
                    setHorarioSelecionado('');
                  }}>
                  <ThemedText style={[styles.diaLabel, { color: ativo ? '#fff' : theme.textSecondary }]}>{d.label}</ThemedText>
                  <ThemedText style={[styles.diaNum, { color: ativo ? '#fff' : theme.text }]}>{d.dia}</ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          <ThemedText style={styles.secaoTitulo}>Selecionar Horário</ThemedText>
          <View style={styles.horariosContainer}>
            {horarios.map((h) => {
              const ocupado = horariosOcupados.includes(h);
              const ativo = horarioSelecionado === h;
              return (
                <TouchableOpacity
                  key={h}
                  disabled={ocupado}
                  style={[
                    styles.horarioCard,
                    {
                      backgroundColor: ativo ? theme.primary : theme.surface,
                      borderColor: ativo ? theme.primary : theme.border,
                      opacity: ocupado ? 0.4 : 1,
                    },
                  ]}
                  onPress={() => setHorarioSelecionado(h)}>
                  <ThemedText style={{ color: ativo ? '#fff' : theme.text, fontWeight: '600' }}>{h}</ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          <ThemedText style={styles.secaoTitulo}>Foco da Aula</ThemedText>
          <View style={styles.focoContainer}>
            {FOCOS_AULA.map((f) => {
              const ativo = foco === f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.focoChip,
                    { backgroundColor: ativo ? theme.primary + '15' : theme.surface, borderColor: ativo ? theme.primary : theme.border },
                  ]}
                  onPress={() => setFoco(f)}>
                  <ThemedText style={{ color: ativo ? theme.primary : theme.text, fontWeight: ativo ? '700' : '400', fontSize: 13 }}>
                    {f}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.campo}>
            <Input icon="📍" placeholder="Local da Aula (ex: Bairro Centro, São Paulo - SP)" value={local} onChangeText={setLocal} />
          </View>
          <View style={styles.campo}>
            <Input
              placeholder="Observações (opcional) — escreva algo para o instrutor..."
              value={observacoes}
              onChangeText={setObservacoes}
              multiline
              numberOfLines={3}
            />
          </View>

          <Button
            title="Confirmar Agendamento"
            onPress={handleAbrirConfirmacao}
            disabled={!diaSelecionado || !horarioSelecionado}
          />
        </ScrollView>

        <ConfirmSheet
          visible={mostrarConfirmacao}
          titulo="Revisar Agendamento"
          onCancelar={() => setMostrarConfirmacao(false)}
          onConfirmar={handleConfirmar}
          loading={loading}>
          <ResumoLinha label="Instrutor" valor={instrutorNome ?? ''} />
          <ResumoLinha label="Data" valor={diaSelecionado} />
          <ResumoLinha label="Horário" valor={horarioSelecionado} />
          <ResumoLinha label="Foco" valor={foco} />
          <ResumoLinha label="Local" valor={local || 'Não informado'} />
          <ResumoLinha label="Pagamento" valor="PIX" />
          <ResumoLinha label="Valor" valor={`R$ ${instrutor?.valorHora ?? '—'}`} />
        </ConfirmSheet>

        <Modal visible={mostrarSucesso} transparent animationType="fade">
          <View style={styles.sucessoOverlay}>
            <View style={[styles.sucessoCard, { backgroundColor: theme.surface }]}>
              <View style={[styles.checkCircle, { backgroundColor: theme.success }]}>
                <ThemedText style={styles.checkIcon}>✓</ThemedText>
              </View>
              <ThemedText style={styles.sucessoTitulo}>Reserva Solicitada!</ThemedText>
              <ThemedText style={[styles.sucessoSubtitulo, { color: theme.textSecondary }]}>
                O instrutor confirmará em instantes.
              </ThemedText>

              <View style={[styles.resumoBox, { borderColor: theme.border }]}>
                <ResumoLinha label="Data" valor={diaSelecionado} />
                <ResumoLinha label="Horário" valor={horarioSelecionado} />
                <ResumoLinha label="Instrutor" valor={instrutorNome ?? ''} />
                <ResumoLinha label="Foco" valor={foco} />
                <ResumoLinha label="Pagamento" valor="PIX" />
              </View>

              <Button
                title="VER MINHAS AULAS"
                onPress={() => {
                  setMostrarSucesso(false);
                  router.replace('/(aluno)/agendamentos');
                }}
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ThemedView>
  );
}

function ResumoLinha({ label, valor }: { label: string; valor: string }) {
  const theme = useTheme();
  return (
    <View style={styles.resumoLinha}>
      <ThemedText style={{ color: theme.textSecondary }}>{label}</ThemedText>
      <ThemedText style={{ fontWeight: '700' }}>{valor}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12 },
  voltar: { fontSize: 22 },
  headerTitulo: { fontSize: 18, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, gap: 4 },
  instrutorCard: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 8 },
  instrutorInfo: { flex: 1, gap: 2 },
  instrutorNome: { fontSize: 16, fontWeight: '700' },
  instrutorDetalhe: { fontSize: 12 },
  instrutorValor: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  instrutorNota: { fontWeight: '700' },
  secaoTitulo: { fontWeight: '700', fontSize: 15, marginBottom: 12, marginTop: 20 },
  diasContainer: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  diaCard: { flex: 1, minWidth: 48, alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1.5 },
  diaLabel: { fontSize: 11, fontWeight: '600' },
  diaNum: { fontSize: 15, fontWeight: '700' },
  horariosContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  horarioCard: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  focoContainer: { gap: 8 },
  focoChip: { borderWidth: 1.5, borderRadius: 12, padding: 12 },
  campo: { marginTop: 20 },
  resumoLinha: { flexDirection: 'row', justifyContent: 'space-between' },
  sucessoOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 24 },
  sucessoCard: { borderRadius: 24, padding: 24, alignItems: 'center', gap: 4 },
  checkCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  checkIcon: { color: '#fff', fontSize: 32, fontWeight: '800' },
  sucessoTitulo: { fontSize: 20, fontWeight: '800' },
  sucessoSubtitulo: { fontSize: 13, marginBottom: 16, textAlign: 'center' },
  resumoBox: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 14, padding: 16, gap: 8, marginBottom: 20 },
});
