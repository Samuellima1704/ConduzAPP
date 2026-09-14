import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login-aluno" options={{ title: 'Login do Aluno' }} />
        <Stack.Screen name="cadastro-aluno" options={{ title: 'Cadastro' }} />
        <Stack.Screen name="login-instrutor" options={{ title: 'Login do Instrutor' }} />
        <Stack.Screen name="cadastro-instrutor" options={{ title: 'Cadastro Instrutor' }} />
        <Stack.Screen name="busca-instrutores" options={{ title: 'Instrutores' }} />
        <Stack.Screen name="perfil-instrutor" options={{ title: 'Perfil do Instrutor' }} />
        <Stack.Screen name="agendamento" options={{ title: 'Agendar Aula' }} />
        <Stack.Screen name="dashboard-instrutor" options={{ title: 'Meu Dashboard', headerShown: false }} />
        <Stack.Screen name="relatorios-instrutor" options={{ title: 'Relatórios' }} />
        <Stack.Screen name="historico-aluno" options={{ title: 'Minhas Aulas' }} />
        <Stack.Screen name="avaliacao" options={{ title: 'Avaliar Instrutor' }} />
      </Stack>
    </ThemeProvider>
  );
}
