import { getAuth } from "firebase/auth";
import type { FirebaseApp } from "firebase/app";

// Web: o SDK já persiste a sessão no IndexedDB do navegador.
// No celular o Metro usa firebase-auth.native.ts.
export function createAuth(app: FirebaseApp) {
  return getAuth(app);
}
