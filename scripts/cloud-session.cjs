"use strict";
const fs = require("node:fs");
const { runtimeConfig } = require("../functions/runtime");
function loadConfig(file = ".tools/cloud-demo/config.json") {
  if (!fs.existsSync(file))
    throw Error(
      "Projeto online não configurado. Execute scripts/configure-cloud.cjs após o login Firebase.",
    );
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  runtimeConfig({
    CONDUZ_MODE: "cloud-demo",
    CONDUZ_PROJECT_ID: config.projectId,
    GCLOUD_PROJECT: config.projectId,
    CONDUZ_STORAGE_BUCKET: config.storageBucket,
    CONDUZ_DEMO_SCOPE: config.scope,
  });
  for (const key of [
    "FIRESTORE_EMULATOR_HOST",
    "FIREBASE_AUTH_EMULATOR_HOST",
    "FIREBASE_STORAGE_EMULATOR_HOST",
    "STORAGE_EMULATOR_HOST",
  ])
    if (process.env[key])
      throw Error(
        "Variáveis de emulador presentes; operação online bloqueada.",
      );
  return config;
}
async function cloudSession(config) {
  const auth = require("firebase-tools/lib/auth");
  const account = auth.getProjectDefaultAccount(process.cwd());
  if (!account)
    throw Error("Entre no Firebase com sua conta Google antes de continuar.");
  auth.setActiveAccount({}, account);
  const credential = {
    getAccessToken: async () => {
      const token = await auth.getAccessToken(
        account.tokens.refresh_token,
        account.scopes || [],
      );
      return {
        access_token: token.access_token,
        expires_in: Math.max(
          60,
          Math.floor(
            ((token.expires_at || Date.now() + 300000) - Date.now()) / 1000,
          ),
        ),
      };
    },
  };
  async function request(url, options = {}) {
    const token = await credential.getAccessToken();
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(30000),
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        ...options.headers,
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = Error(
        `Firebase online HTTP ${response.status}: ${body.error?.message || "verifique projeto e permissões"}`,
      );
      error.status = response.status;
      throw error;
    }
    return body;
  }
  const billing = await request(
    `https://cloudbilling.googleapis.com/v1/projects/${config.projectId}/billingInfo`,
  );
  if (!billing.billingEnabled)
    throw Error(
      `O projeto ainda não tem Blaze ativo. O responsável precisa revisar o faturamento em https://console.firebase.google.com/project/${config.projectId}/usage/details . Nenhuma ativação automática foi feita.`,
    );
  return { request, credential };
}
function firestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isFinite(value))
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  if (Array.isArray(value))
    return { arrayValue: { values: value.map(firestoreValue) } };
  if (value && typeof value === "object")
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, firestoreValue(v)]),
        ),
      },
    };
  throw Error("Valor inválido para preparação do Firestore.");
}
function storageCors(projectId, existing = []) {
  const origins = [
    `https://${projectId}.web.app`,
    `https://${projectId}.firebaseapp.com`,
    // Site do Hosting com o nome do app (firebase.cloud.json, "site": "conduzapp").
    "https://conduzapp.web.app",
    "https://conduzapp.firebaseapp.com",
  ];
  if (
    existing.some(
      (rule) =>
        origins.every((origin) => rule.origin?.includes(origin)) &&
        ["GET", "HEAD"].every((method) => rule.method?.includes(method)),
    )
  )
    return existing;
  return [
    ...existing,
    {
      origin: origins,
      method: ["GET", "HEAD"],
      responseHeader: ["Content-Type", "Content-Length", "ETag"],
      maxAgeSeconds: 3600,
    },
  ];
}
module.exports = { loadConfig, cloudSession, firestoreValue, storageCors };
