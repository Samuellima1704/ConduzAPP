"use strict";
// Prepara o cenário do teste de carga (k6) em um ambiente isolado test-k6-*:
// 20 alunos e 3 instrutores aprovados, com agenda. A base real (private/state)
// não é lida nem alterada. Grava .tools/k6-cenario.json, lido por tests/load-test.js.
//
// Uso (com o app rodando):
//   node scripts/cenario-carga.cjs            cria o cenário
//   node scripts/cenario-carga.cjs --limpar   apaga contas e dados do cenário
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID, randomBytes } = require("node:crypto");
const adminRequire = require("node:module").createRequire(
  path.resolve(__dirname, "../functions/package.json"),
);
const { initializeApp } = adminRequire("firebase-admin/app");
const { getAuth } = adminRequire("firebase-admin/auth");
const { getFirestore } = adminRequire("firebase-admin/firestore");
const { empty, DAY } = require("../functions/domain");

const FILE = path.resolve(__dirname, "../.tools/k6-cenario.json");
const STUDENTS = 20,
  INSTRUCTORS = 3;
initializeApp({ projectId: "demo-conduzapp" });
const db = require("../functions/emulator-db").configureEmulatorFirestore(getFirestore());

async function create() {
  if (fs.existsSync(FILE)) throw new Error("Já existe um cenário. Rode com --limpar antes de criar outro.");
  const scope = `test-k6-${randomUUID().slice(0, 8)}`;
  const password = "K6-" + randomBytes(6).toString("hex");
  const now = Date.now();
  const state = empty();
  const make = async (role, i) => {
    const email = `${role}${i}.${scope}@conduzapp.local`;
    const u = await getAuth().createUser({ email, password, displayName: `${role} ${i}` });
    await getAuth().setCustomUserClaims(u.uid, { stateScope: scope });
    return { uid: u.uid, email };
  };
  const instructors = [];
  for (let i = 1; i <= INSTRUCTORS; i++) {
    const p = await make("instrutor", i);
    instructors.push(p);
    state.users[p.uid] = {
      id: p.uid, name: `Instrutor ${i}`, role: "instrutor", region: "Volta Redonda", price: 8000,
      car: "Carro", transmission: i % 2 ? "Manual" : "Automático", bio: "", specialty: "",
      credential: `AUT-${i}`, credentialExpires: now + 365 * DAY, approval: "aprovado",
      periods: Array.from({ length: 7 }, (_, day) => ({ day, from: 7, to: 21 })), blocks: [],
      cancellations: 0, absences: 0, favorites: [], photoPath: `profilePhotos/${scope}/${p.uid}/foto.png`,
      identity: { status: "aprovado" },
    };
  }
  const students = [];
  for (let i = 1; i <= STUDENTS; i++) {
    const p = await make("aluno", i);
    students.push(p);
    state.users[p.uid] = {
      id: p.uid, name: `Aluno ${i}`, role: "aluno", favorites: [],
      photoPath: `profilePhotos/${scope}/${p.uid}/foto.png`, identity: { status: "aprovado" },
    };
  }
  await db.doc(`private/${scope}`).set(state);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ scope, password, students, instructors }, null, 2));
  console.log(`Cenário ${scope} criado: ${STUDENTS} alunos e ${INSTRUCTORS} instrutores.`);
}

async function remove() {
  if (!fs.existsSync(FILE)) return console.log("Nenhum cenário de carga para remover.");
  const { scope, students, instructors } = JSON.parse(fs.readFileSync(FILE, "utf8"));
  for (const p of [...students, ...instructors]) await getAuth().deleteUser(p.uid).catch(() => {});
  await db.doc(`private/${scope}`).delete();
  fs.unlinkSync(FILE);
  console.log(`Cenário ${scope} removido.`);
}

(process.argv.includes("--limpar") ? remove() : create())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
