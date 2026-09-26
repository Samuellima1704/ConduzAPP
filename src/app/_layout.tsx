import { DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="recuperar-senha" options={{ headerShown: true, title: 'Recuperar senha' }} />
        <Stack.Screen name="cadastro-aluno" options={{ headerShown: true, title: 'Cadastro' }} />
        <Stack.Screen name="login-instrutor" options={{ headerShown: true, title: 'Login do Instrutor' }} />
        <Stack.Screen name="cadastro-instrutor" options={{ headerShown: true, title: 'Cadastro Instrutor' }} />
        <Stack.Screen name="(aluno)" />
        <Stack.Screen name="busca-instrutores" options={{ headerShown: true, title: 'Instrutores' }} />
        <Stack.Screen name="perfil-instrutor" options={{ headerShown: true, title: 'Perfil do Instrutor' }} />
        <Stack.Screen name="agendamento" />
        <Stack.Screen name="avaliacao" />
        <Stack.Screen name="chat/[conversaId]" />
        <Stack.Screen name="dashboard-instrutor" />
        <Stack.Screen name="relatorios-instrutor" options={{ headerShown: true, title: 'Relatórios' }} />
        <Stack.Screen name="em-breve" options={{ headerShown: true, title: '' }} />
      </Stack>
    </ThemeProvider>
  );
}
