import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FirebaseAuth from "firebase/auth";
import type { FirebaseApp } from "firebase/app";

// Celular: guarda a sessão no AsyncStorage para o login sobreviver ao fechar
// o app. getReactNativePersistence só existe na build React Native do SDK, que
// o Metro escolhe sozinho; as tipagens padrão são as da web, daí o cast.
const { getReactNativePersistence } = FirebaseAuth as typeof FirebaseAuth & {
  getReactNativePersistence: (
    storage: typeof AsyncStorage,
  ) => FirebaseAuth.Persistence;
};

export function createAuth(app: FirebaseApp) {
  try {
    return FirebaseAuth.initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Recarga rápida do Metro: o Auth já foi inicializado neste processo.
    return FirebaseAuth.getAuth(app);
  }
}
