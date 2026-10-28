"use strict";
// Promove a administrador uma conta criada pelo próprio app ("Criar conta").
// A permissão vem da claim `admin` no token, que só o Admin SDK pode gravar:
// nenhum formulário do app consegue se autopromover. Uso exclusivo dos emuladores locais.
// Uso: node scripts/tornar-admin.cjs email@exemplo.com
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const adminRequire = require("node:module").createRequire(
  require("node:path").resolve(__dirname, "../functions/package.json"),
);
const { initializeApp } = adminRequire("firebase-admin/app");
const { getAuth } = adminRequire("firebase-admin/auth");
const { getFirestore } = adminRequire("firebase-admin/firestore");
const { empty } = require("../functions/domain");
initializeApp({ projectId: "demo-conduzapp" });
async function promote(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Informe o e-mail da conta: node scripts/tornar-admin.cjs email@exemplo.com");
  const user = await getAuth()
    .getUserByEmail(email)
    .catch(() => {
      throw new Error("Conta não encontrada. Crie a conta pelo app (Criar conta) e tente de novo.");
    });
  const db = require("../functions/emulator-db").configureEmulatorFirestore(getFirestore());
  const ref = db.doc("private/state");
  await db.runTransaction(async (tx) => {
    const state = (await tx.get(ref)).data() || empty();
    const current = state.users[user.uid];
    const hasLessons = Object.values(state.bookings || {}).some((b) =>
      [b.student, b.instructor].includes(user.uid),
    );
    // Uma conta com aulas preserva o papel de aluno/instrutor; o admin deve ser uma conta própria.
    if (current && current.role !== "admin" && hasLessons)
      throw new Error("Esta conta já participa de aulas. Use uma conta exclusiva para a administração.");
    state.users[user.uid] = {
      id: user.uid,
      name: current?.name || user.displayName || "Administração",
      role: "admin",
      favorites: [],
      identity: { status: "aprovado" },
    };
    tx.set(ref, state);
  });
  const claims = user.customClaims || {};
  delete claims.stateScope;
  await getAuth().setCustomUserClaims(user.uid, { ...claims, admin: true });
  console.log(`${email} agora é administrador. Saia e entre novamente no app para aplicar.`);
}
promote(process.argv[2])
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
