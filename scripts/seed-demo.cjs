"use strict";
// Somente emuladores locais; jamais usa credenciais de produção.
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const adminRequire = require("node:module").createRequire(
  require("node:path").resolve(__dirname, "../functions/package.json"),
);
const { initializeApp } = adminRequire("firebase-admin/app");
const { getAuth } = adminRequire("firebase-admin/auth");
const { getFirestore } = adminRequire("firebase-admin/firestore");
const { empty, HOUR, DAY } = require("../functions/domain");
initializeApp({ projectId: "demo-conduzapp" });
async function seed() {
  const db = require("../functions/emulator-db").configureEmulatorFirestore(getFirestore());
  const existing = await db.doc("private/state").get();
  if (existing.exists && Object.keys(existing.data().users || {}).length > 0) {
    console.log("Base local existente preservada.");
    return;
  }
  const state = empty(),
    now = Date.now();
  const accounts = [
    ["aluno", "demo-aluno", "Ana Souza", "aluno"],
    ["instrutor", "demo-instrutor", "Marcos Oliveira", "instrutor"],
    ["admin", "demo-admin", "Administração TCC", "admin"],
  ];
  for (const [account, uid, name, role] of accounts) {
    try {
      await getAuth().createUser({
        uid,
        email: `${account}@conduzapp.test`,
        password: "DemoTCC2026!",
        displayName: name,
      });
    } catch (e) {
      if (
        e.code !== "auth/uid-already-exists" &&
        e.code !== "auth/email-already-exists"
      )
        throw e;
    }
    if (role === "admin")
      await getAuth().setCustomUserClaims(uid, { admin: true });
    state.users[uid] = { id: uid, name, role, favorites: [] };
  }
  Object.assign(state.users["demo-instrutor"], {
    region: "Centro · Niterói, RJ",
    price: 8500,
    car: "Chevrolet Onix",
    transmission: "Manual",
    bio: "Instrutor fictício para demonstração acadêmica. Aulas com foco em confiança, baliza e trânsito urbano.",
    specialty: "Prática e confiança ao dirigir",
    approval: "aprovado",
    credential: "DEMO-AUTORIZACAO-001",
    credentialExpires: now + 90 * DAY,
    approvalReason:
      "Credencial fictícia aprovada para o ambiente de demonstração.",
    periods: [],
    blocks: [],
    cancellations: 0,
    absences: 0,
  });
  // Aula histórica fictícia: permite mostrar conclusão/avaliação sem esperar uma hora.
  const start = Math.floor((now - 2 * HOUR) / HOUR) * HOUR;
  state.bookings["demo-aula-historica"] = {
    id: "demo-aula-historica",
    student: "demo-aluno",
    instructor: "demo-instrutor",
    start,
    duration: 50,
    price: 8500,
    commission: 1020,
    status: "confirmado",
    paid: true,
    paymentMode: "simulado",
    location: "Local fictício da apresentação",
    createdAt: start - DAY,
    ratings: {},
    payoutEligible: false,
  };
  await db.doc("private/state").set(state);
  await db
    .doc("bookingAccess/demo-aula-historica")
    .set({
      student: "demo-aluno",
      instructor: "demo-instrutor",
      disputeOpen: false,
    });
  console.log("Base fictícia preparada. Senha das três contas: DemoTCC2026!");
}
seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
