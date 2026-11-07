/// <reference types="node" />
// Sanitização da base LOCAL (emuladores) para a apresentação: mantém só as contas
// listadas e remove os demais perfis com tudo o que depende deles (reservas,
// avaliações, mensagens, conversas, notificações, ocorrências, arquivos e logins).
//
// Segurança:
// - Só roda contra os emuladores (127.0.0.1); nunca toca um projeto online.
// - Sem --executar, apenas SIMULA e lista o que seria removido.
// - Com --executar, grava antes um backup JSON em .tools/backups (fora do Git).
// - Contas de testes isolados (claim stateScope test-/demo-) não são tocadas.
//
// Uso (com o app rodando):
//   node scripts/clean-mock-data.ts                      # simulação
//   node scripts/clean-mock-data.ts --executar           # aplica
//   node scripts/clean-mock-data.ts --manter a@x,b@y     # troca a lista de quem fica
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
const root = resolve(import.meta.dirname, "..");
const adminRequire = createRequire(join(root, "functions/package.json"));
const { initializeApp } = adminRequire("firebase-admin/app");
const { getAuth } = adminRequire("firebase-admin/auth");
const { getFirestore } = adminRequire("firebase-admin/firestore");
const { getStorage } = adminRequire("firebase-admin/storage");
const { configureEmulatorFirestore } = createRequire(import.meta.url)(
  "../functions/emulator-db",
);

// Elenco da banca: 1 administração, 2 instrutores e 2 alunos fictícios.
const DEFAULT_KEEP = [
  "admin@conduzapp.local",
  "carlos.pereira@conduzapp.local",
  "fernanda.martins@conduzapp.local",
  "ana.souza@conduzapp.local",
  "lucas.santos@conduzapp.local",
];
const args = process.argv.slice(2);
const execute = args.includes("--executar");
const keepArg = args[args.indexOf("--manter") + 1];
const keepEmails = new Set(
  (args.includes("--manter") && keepArg ? keepArg.split(",") : DEFAULT_KEEP).map(
    (e: string) => e.trim().toLowerCase(),
  ),
);

type AnyRecord = Record<string, any>;

async function main() {
  initializeApp({ projectId: "demo-conduzapp", storageBucket: "demo-conduzapp.appspot.com" });
  const db = configureEmulatorFirestore(getFirestore());
  const ref = db.doc("private/state");
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Base local vazia: nada a limpar.");
  const state: AnyRecord = snap.data();

  const accounts = (await getAuth().listUsers(1000)).users as AnyRecord[];
  // Logins da base local (sem stateScope). Contas de testes isolados ficam de fora.
  const local = accounts.filter((a) => !a.customClaims?.stateScope);
  const keep = new Set(
    local
      .filter((a) => keepEmails.has(String(a.email).toLowerCase()) || a.customClaims?.admin === true)
      .map((a) => a.uid),
  );
  const missing = [...keepEmails].filter(
    (e) => !local.some((a) => String(a.email).toLowerCase() === e),
  );
  if (missing.length) throw new Error(`Conta(s) a manter não encontrada(s): ${missing.join(", ")}`);

  const users: AnyRecord = state.users || {};
  const removeUids = new Set([
    ...Object.keys(users).filter((uid) => !keep.has(uid)),
    ...local.filter((a) => !keep.has(a.uid)).map((a) => a.uid),
  ]);
  const gone = (uid?: string) => !!uid && removeUids.has(uid);
  const bookings: AnyRecord = state.bookings || {};
  const removedBookings = new Set(
    Object.values(bookings)
      .filter((b: AnyRecord) => gone(b.student) || gone(b.instructor))
      .map((b: AnyRecord) => b.id),
  );
  const dropBooking = (id?: string) => !!id && removedBookings.has(id);

  const next: AnyRecord = structuredClone(state);
  const filterObject = (obj: AnyRecord = {}, drop: (v: AnyRecord) => boolean) =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => !drop(v)));
  next.users = filterObject(users, (u) => gone(u.id));
  for (const u of Object.values(next.users) as AnyRecord[])
    if (Array.isArray(u.favorites)) u.favorites = u.favorites.filter((f: string) => !gone(f));
  next.bookings = filterObject(bookings, (b) => removedBookings.has(b.id));
  next.reviews = filterObject(state.reviews, (r) => dropBooking(r.booking) || gone(r.from) || gone(r.to));
  next.conversations = filterObject(state.conversations, (c) => gone(c.student) || gone(c.instructor));
  next.notifications = filterObject(state.notifications, (n) => gone(n.recipient));
  next.tickets = filterObject(state.tickets, (t) => gone(t.owner) || dropBooking(t.booking));
  next.messages = (state.messages || []).filter((m: AnyRecord) => !gone(m.from) && !gone(m.to));
  next.audit = (state.audit || []).filter((a: AnyRecord) => !gone(a.by));
  if (state.identityAudit)
    next.identityAudit = state.identityAudit.filter((a: AnyRecord) => !gone(a.user));

  const count = (key: string) => {
    const before = state[key], after = next[key];
    const n = (v: unknown) => (Array.isArray(v) ? v.length : Object.keys((v as AnyRecord) || {}).length);
    return `${key}: ${n(before)} → ${n(after)}`;
  };
  const label = (uid: string) => {
    const u = users[uid], a = local.find((x) => x.uid === uid);
    return `${u?.name || "(sem perfil)"} · ${u?.role || "-"} · ${a?.email || "(sem login)"}`;
  };
  console.log(execute ? "MODO EXECUÇÃO" : "SIMULAÇÃO (nada foi alterado; use --executar para aplicar)");
  console.log("\nMantidos:");
  for (const uid of keep) console.log("  ✓ " + label(uid));
  console.log(`\nRemovidos (${removeUids.size}):`);
  for (const uid of removeUids) console.log("  ✗ " + label(uid));
  console.log("\nTotais:");
  for (const key of ["users", "bookings", "reviews", "conversations", "messages", "notifications", "tickets", "audit", "identityAudit"])
    if (state[key] !== undefined) console.log("  " + count(key));
  const testAccounts = accounts.length - local.length;
  if (testAccounts) console.log(`\nContas de testes isolados preservadas: ${testAccounts} (limpe com scripts/Testar-Tudo.ps1 -Limpar).`);
  if (!execute) return;

  const backups = join(root, ".tools", "backups");
  mkdirSync(backups, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = join(backups, `state-${stamp}.json`);
  writeFileSync(
    backupFile,
    JSON.stringify({ state, accounts: local.map((a) => ({ uid: a.uid, email: a.email, claims: a.customClaims || {} })) }, null, 2),
  );
  console.log(`\nBackup: ${backupFile}`);

  // Grava só se ninguém alterou o estado desde a leitura (mesma regra da Function).
  const batch = db.batch();
  batch.update(ref, next, { lastUpdateTime: snap.updateTime });
  for (const id of removedBookings) batch.delete(db.doc(`bookingAccess/${id}`));
  batch.set(db.doc("signals/state"), { version: Date.now() });
  await batch.commit();

  const bucket = getStorage().bucket();
  for (const uid of removeUids)
    for (const prefix of [`profilePhotos/state/${uid}/`, `identityDocuments/state/${uid}/`])
      await bucket.deleteFiles({ prefix }).catch(() => {});
  for (const id of removedBookings) await bucket.deleteFiles({ prefix: `disputes/${id}/` }).catch(() => {});
  const logins = [...removeUids].filter((uid) => local.some((a) => a.uid === uid));
  if (logins.length) await getAuth().deleteUsers(logins);
  console.log(`Concluído: ${removeUids.size} perfis, ${removedBookings.size} reservas e ${logins.length} logins removidos.`);
  console.log("O autosalvamento grava a base limpa em até 2 minutos (ou rode Parar-ConduzAPP.ps1).");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error("Falha:", error?.message || error);
    process.exit(1);
  },
);
