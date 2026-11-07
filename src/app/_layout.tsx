import { DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import Head from 'expo-router/head';
import { Session } from '@/services/session';

// Head: título padrão da aba na web (cada tela pode trocar); sem efeito no celular.
//
// Troca de conta sem tela branca ("Bundling... app/cadastro-instrutor.tsx"):
// a causa NÃO era o Firebase nem o estado de autenticação. No SDK 58 o Expo Router
// passou a carregar as rotas da web sob demanda (asyncRoutes.web = true por padrão).
// Em desenvolvimento, a primeira visita a uma rota obriga o Metro a empacotar aquele
// arquivo naquele momento: a tela fica em branco enquanto isso. Com
// "asyncRoutes": { "web": false } no app.json, todas as rotas vão no mesmo pacote
// inicial e a navegação entre login, cadastro e painel é imediata. Enquanto a sessão
// troca de usuário, o painel mostra o indicador "Conectando ao ConduzAPP…"
// (src/services/session.tsx zera o estado e busca o do novo usuário).
export default function RootLayout() {
  return (
    <Session>
      <Head>
        <title>ConduzAPP</title>
      </Head>
      <ThemeProvider value={DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </Session>
  );
}
