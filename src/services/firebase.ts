import { getApp, getApps, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectAuthEmulator } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { emulatorHost, firebaseSettings } from "@/lib/firebase-config";
import { createAuth } from "./firebase-auth";

const settings = firebaseSettings({
  mode: process.env.EXPO_PUBLIC_FIREBASE_MODE,
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
});
export const cloudDemo = settings.mode === "cloud-demo";
const app = getApps().length ? getApp() : initializeApp(settings.config);
export const db = getFirestore(app);
export const auth = createAuth(app);
export const functions = getFunctions(app, "us-central1");
export const storage = getStorage(app);
const host = emulatorHost({
  platform: Platform.OS,
  envHost: process.env.EXPO_PUBLIC_EMULATOR_HOST,
  hostUri: Constants.expoConfig?.hostUri,
});
const state = globalThis as typeof globalThis & { conduzemulators?: boolean };
if (!cloudDemo && !state.conduzemulators) {
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
  connectStorageEmulator(storage, host, 9199);
  state.conduzemulators = true;
}
