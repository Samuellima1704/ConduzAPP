"use strict";
function runtimeConfig(env = process.env) {
  if (env.FUNCTIONS_EMULATOR === "true") {
    if (env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080")
      throw new Error("Firestore local precisa usar 127.0.0.1:8080.");
    return {
      emulator: true,
      projectId: "demo-conduzapp",
      storageBucket: "demo-conduzapp.appspot.com",
    };
  }
  const projectId = env.CONDUZ_PROJECT_ID;
  const storageBucket = env.CONDUZ_STORAGE_BUCKET;
  const scope = env.CONDUZ_DEMO_SCOPE;
  if (
    env.CONDUZ_MODE !== "cloud-demo" ||
    !projectId ||
    !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) ||
    projectId.startsWith("demo-") ||
    env.GCLOUD_PROJECT !== projectId ||
    ![`${projectId}.firebasestorage.app`, `${projectId}.appspot.com`].includes(
      storageBucket,
    ) ||
    !/^demo-[a-zA-Z0-9-]{1,80}$/.test(scope || "") ||
    [
      "FIRESTORE_EMULATOR_HOST",
      "FIREBASE_AUTH_EMULATOR_HOST",
      "FIREBASE_STORAGE_EMULATOR_HOST",
    ].some((k) => env[k])
  )
    throw new Error(
      "ConduzAPP: ambiente online não configurado explicitamente; execução bloqueada.",
    );
  return { emulator: false, projectId, storageBucket, scope };
}
function authorizeRuntime(config, auth) {
  if (!auth) throw new Error("Entre na sua conta.");
  if (
    !config.emulator &&
    (auth.token?.conduzDemo !== true || auth.token?.stateScope !== config.scope)
  )
    throw new Error(
      "Sua conta ainda não foi liberada neste ambiente. Fale com o suporte.",
    );
}
module.exports = { runtimeConfig, authorizeRuntime };
