"use strict";
// Promove a administrador uma conta criada pelo próprio app ("Criar conta").
// A permissão vem da claim `admin` no token, que só o Admin SDK pode gravar:
// nenhum formulário do app consegue se autopromover. Uso exclusivo dos emuladores locais.
// Uso: node scripts/tornar-admin.cjs email@exemplo.com
//      node scripts/tornar-admin.cjs email@exemplo.com --criar
//      (--criar cria a conta se ela não existir, com senha aleatória gravada em
//       .tools/acessos-locais.txt, pasta ignorada pelo Git)
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
async function account(email, create) {
  try {
    return await getAuth().getUserByEmail(email);
  } catch {
    if (!create)
      throw new Error("Conta não encontrada. Crie a conta pelo app (Criar conta) ou use --criar.");
  }
  const fs = require("node:fs"),
    path = require("node:path");
  const password = "Adm-" + require("node:crypto").randomBytes(6).toString("hex");
  const user = await getAuth().createUser({ email, password, displayName: "Administração ConduzAPP" });
  const file = path.resolve(__dirname, "../.tools/acessos-locais.txt");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `Administração · ${email} · senha: ${password} · criada em ${new Date().toLocaleString("pt-BR")}\n`);
  console.log(`Conta criada. E-mail e senha gravados em .tools/acessos-locais.txt (fora do Git).`);
  return user;
}
async function promote(email, create) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Informe o e-mail da conta: node scripts/tornar-admin.cjs email@exemplo.com");
  const user = await account(email, create);
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
promote(process.argv[2], process.argv.includes("--criar"))
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
