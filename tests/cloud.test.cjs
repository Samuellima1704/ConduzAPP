const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { runtimeConfig, authorizeRuntime } = require("../functions/runtime");
const { effectiveNow } = require("../functions/state-scope");
const { execute, HOUR } = require("../functions/domain");
const { demoFixture } = require("../scripts/demo-fixture.cjs");
const fs = require("node:fs"),
  Module = require("node:module"),
  ts = require("typescript");
const moduleConfig = new Module(__filename);
moduleConfig._compile(
  ts.transpileModule(fs.readFileSync("src/lib/firebase-config.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  __filename,
);
const { firebaseSettings } = moduleConfig.exports;
test("CORS das fotos permite leitura nas origens HTTPS do app e preserva configuração existente", () => {
  const { storageCors } = require("../scripts/cloud-session.cjs");
  const existing = [
    { origin: ["https://origem-existente.example"], method: ["GET"] },
  ];
  const cors = storageCors("conduzapp-cors-test", existing);
  assert.deepEqual(cors[0], existing[0]);
  assert.equal(existing.length, 1);
  assert.deepEqual(cors[1].origin, [
    "https://conduzapp-cors-test.web.app",
    "https://conduzapp-cors-test.firebaseapp.com",
  ]);
  assert.deepEqual(cors[1].method, ["GET", "HEAD"]);
  assert.deepEqual(storageCors("conduzapp-cors-test", cors), cors);
});
test("preparação online armazena referências e preserva tipos sem salvar imagem no Firestore", () => {
  const { firestoreValue } = require("../scripts/cloud-session.cjs");
  const result = firestoreValue({
    price: 8500,
    paid: true,
    photoPath: "profilePhotos/demo-tcc/u/photo.png",
    optional: null,
    values: ["a", 2],
    missing: undefined,
  }).mapValue.fields;
  assert.equal(result.price.integerValue, "8500");
  assert.equal(result.paid.booleanValue, true);
  assert.equal(
    result.photoPath.stringValue,
    "profilePhotos/demo-tcc/u/photo.png",
  );
  assert.deepEqual(result.optional, { nullValue: null });
  assert.equal(result.values.arrayValue.values[1].integerValue, "2");
  assert.equal(result.missing, undefined);
  assert.throws(() => firestoreValue(NaN), /inválido/);
});
const env = {
  CONDUZ_MODE: "cloud-demo",
  CONDUZ_PROJECT_ID: "conduzapp-test-config",
  GCLOUD_PROJECT: "conduzapp-test-config",
  CONDUZ_STORAGE_BUCKET: "conduzapp-test-config.firebasestorage.app",
  CONDUZ_DEMO_SCOPE: "demo-tcc-2026",
};
test("backend fica bloqueado fora do emulador sem configuração online explícita e consistente", () => {
  assert.throws(() => runtimeConfig({}), /bloqueada/);
  const runtime = runtimeConfig(env);
  assert.equal(runtime.emulator, false);
  for (const change of [
    { CONDUZ_MODE: "production" },
    { GCLOUD_PROJECT: "outro-projeto" },
    { CONDUZ_STORAGE_BUCKET: "bucket-de-outro-projeto" },
    { CONDUZ_DEMO_SCOPE: "state" },
    { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" },
    { FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" },
  ])
    assert.throws(() => runtimeConfig({ ...env, ...change }), /bloqueada/);
});
test("modo local preserva destino fixo mesmo com configuração de nuvem no processo", () => {
  const local = runtimeConfig({
    ...env,
    FUNCTIONS_EMULATOR: "true",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  });
  assert.equal(local.projectId, "demo-conduzapp");
  assert.equal(local.emulator, true);
  assert.throws(
    () =>
      runtimeConfig({
        FUNCTIONS_EMULATOR: "true",
        FIRESTORE_EMULATOR_HOST: "outra-maquina:8080",
      }),
    /127.0.0.1/,
  );
});
test("somente contas convidadas do cenário autorizado acessam o backend online", () => {
  const runtime = runtimeConfig(env);
  authorizeRuntime(runtime, {
    uid: "s",
    token: { conduzDemo: true, stateScope: env.CONDUZ_DEMO_SCOPE },
  });
  assert.throws(() => authorizeRuntime(runtime, null), /Entre/);
  for (const token of [
    {},
    { admin: true },
    { conduzDemo: true },
    { conduzDemo: true, stateScope: "demo-outro" },
    { conduzDemo: false, stateScope: env.CONDUZ_DEMO_SCOPE },
  ])
    assert.throws(
      () => authorizeRuntime(runtime, { uid: "s", token }),
      /liberada/,
    );
  authorizeRuntime({ emulator: true }, { uid: "local", token: {} });
});
test("frontend não faz fallback para localhost quando falta configuração online", () => {
  const local = firebaseSettings({});
  assert.equal(local.mode, "emulator");
  assert.equal(local.config.projectId, "demo-conduzapp");
  const valid = {
    mode: "cloud-demo",
    projectId: env.CONDUZ_PROJECT_ID,
    apiKey: "public-web-config",
    authDomain: `${env.CONDUZ_PROJECT_ID}.firebaseapp.com`,
    storageBucket: env.CONDUZ_STORAGE_BUCKET,
    appId: "1:111111:web:test-config",
  };
  assert.equal(firebaseSettings(valid).mode, "cloud-demo");
  for (const change of [
    { apiKey: "" },
    { projectId: "demo-conduzapp" },
    { authDomain: "localhost" },
    { storageBucket: "outro-bucket" },
    { appId: "" },
  ])
    assert.throws(
      () => firebaseSettings({ ...valid, ...change }),
      /incompleta/,
    );
  assert.throws(() => firebaseSettings({ mode: "qualquer" }), /inválido/);
});
test("relógio de ensaio online exige confiança do servidor, administrador e cenário isolado", () => {
  const now = Date.parse("2026-10-30T09:00:00-03:00"),
    scope = env.CONDUZ_DEMO_SCOPE;
  const s = demoFixture(now, scope),
    booking = s.demo.historicalBooking;
  const trusted = { cloudDemo: true, demoScope: scope, realNow: now };
  const changed = execute(
    s,
    { uid: "demo-admin", admin: true },
    "setDemoClock",
    { booking, stage: "end" },
    now,
    "clock",
    trusted,
  ).state;
  assert.ok(changed.demo.clockOffset < 0);
  assert.equal(
    effectiveNow(changed, { stateScope: scope }, now, true),
    changed.bookings[booking].start +
      changed.bookings[booking].duration * 60000,
  );
  assert.equal(effectiveNow(changed, { stateScope: scope }, now, false), now);
  assert.equal(
    effectiveNow(changed, { stateScope: "demo-outro" }, now, true),
    now,
  );
  assert.throws(
    () =>
      execute(
        s,
        { uid: "demo-aluno" },
        "setDemoClock",
        { booking, stage: "end" },
        now,
        "clock",
        trusted,
      ),
    /administrador/,
  );
  assert.throws(
    () =>
      execute(
        s,
        { uid: "demo-admin", admin: true },
        "setDemoClock",
        { booking, stage: "end", cloudDemo: true },
        now,
        "clock",
        {},
      ),
    /administrador/,
  );
});
