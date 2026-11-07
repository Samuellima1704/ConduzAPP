type Settings = {
  mode?: string;
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  appId?: string;
};
export function firebaseSettings(input: Settings) {
  const mode = input.mode || "emulator";
  if (mode === "emulator")
    return {
      mode,
      config: {
        apiKey: "demo-conduzapp-key",
        authDomain: "demo-conduzapp.firebaseapp.com",
        projectId: "demo-conduzapp",
        storageBucket: "demo-conduzapp.appspot.com",
        appId: "demo-conduzapp",
      },
    };
  if (mode !== "cloud-demo") throw new Error("Ambiente Firebase inválido.");
  const { apiKey, authDomain, projectId, storageBucket, appId } = input;
  if (
    !apiKey ||
    !appId ||
    !projectId ||
    !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) ||
    projectId.startsWith("demo-") ||
    authDomain !== `${projectId}.firebaseapp.com` ||
    ![`${projectId}.firebasestorage.app`, `${projectId}.appspot.com`].includes(
      storageBucket || "",
    )
  )
    throw new Error(
      "Configuração online incompleta ou inconsistente. Nenhuma conexão local será usada.",
    );
  return {
    mode,
    config: { apiKey, authDomain, projectId, storageBucket, appId },
  };
}

// Endereço dos emuladores. No navegador do próprio PC, 127.0.0.1 basta. No
// celular (Expo Go), 127.0.0.1 é o próprio aparelho: usa-se o IP do PC que
// serviu o app (hostUri do Expo, ex.: "192.168.0.15:8081"). A variável
// EXPO_PUBLIC_EMULATOR_HOST, quando definida, tem prioridade nos dois casos.
export function emulatorHost(input: {
  platform: string;
  envHost?: string;
  hostUri?: string | null;
}) {
  const env = input.envHost?.trim();
  if (env) return env;
  if (input.platform !== "web" && input.hostUri) {
    const host = input.hostUri.replace(/^[a-z]+:\/\//i, "").split(/[:/]/)[0];
    if (host) return host;
  }
  return "127.0.0.1";
}
