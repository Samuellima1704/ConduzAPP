import { DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import Head from 'expo-router/head';
import { Session } from '@/services/session';
// Head: título da aba na web (o Expo Router gerencia a tag <title>); sem efeito no celular.
export default function RootLayout(){return <Session><Head><title>ConduzAPP</title></Head><ThemeProvider value={DefaultTheme}><Stack screenOptions={{headerShown:false}}/></ThemeProvider></Session>;}
