import { Image, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';

const PALETTE = ['#1E56F0', '#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#0D9488'];

function corPorNome(nome: string) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '?';
  const segunda = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + segunda).toUpperCase();
}

type AvatarProps = {
  nome: string;
  foto?: string;
  size?: number;
};

export function Avatar({ nome, foto, size = 56 }: AvatarProps) {
  const dimensao = { width: size, height: size, borderRadius: size / 2 };

  if (foto) {
    return <Image source={{ uri: foto }} style={[styles.imagem, dimensao]} />;
  }

  return (
    <View style={[styles.fallback, dimensao, { backgroundColor: corPorNome(nome) }]}>
      <ThemedText style={[styles.texto, { fontSize: size * 0.38 }]}>{iniciais(nome)}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  imagem: { backgroundColor: '#E2E8F0' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  texto: { color: '#FFFFFF', fontWeight: '700' },
});
