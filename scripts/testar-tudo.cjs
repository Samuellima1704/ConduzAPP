"use strict";
// Teste de ponta a ponta do ConduzAPP contra os emuladores em execução.
// Percorre os fluxos de aluno, instrutor e administração pelo mesmo caminho do app
// (Firebase Auth, Storage e a Function `conduz`), em um ambiente isolado test-e2e-*:
// a base real (private/state) não é lida nem alterada.
//
// Uso:  node scripts/testar-tudo.cjs            executa e mantém as contas para conferência na tela
//       node scripts/testar-tudo.cjs --limpar    apaga as contas e os dados do último teste
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID, randomBytes } = require("node:crypto");
const adminRequire = require("node:module").createRequire(
  path.resolve(__dirname, "../functions/package.json"),
);
const { initializeApp: adminApp } = adminRequire("firebase-admin/app");
const { getAuth: adminAuth } = adminRequire("firebase-admin/auth");
const { getFirestore } = adminRequire("firebase-admin/firestore");
const { getStorage: adminStorage } = adminRequire("firebase-admin/storage");
const { initializeApp } = require("firebase/app");
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword } = require("firebase/auth");
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require("firebase/functions");
const { getStorage, connectStorageEmulator, ref, uploadBytes, getBytes } = require("firebase/storage");
const { empty, HOUR } = require("../functions/domain");

const MANIFEST = path.resolve(__dirname, "../.tools/teste-e2e.json");
const BUCKET = "demo-conduzapp.appspot.com";
adminApp({ projectId: "demo-conduzapp", storageBucket: BUCKET });
const db = require("../functions/emulator-db").configureEmulatorFirestore(getFirestore());

const results = [];
async function step(area, name, fn) {
  try {
    const detail = await fn();
    results.push({ ok: true, area, name, detail: detail || "" });
  } catch (e) {
    results.push({ ok: false, area, name, detail: e.message });
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

async function client(email, password) {
  const app = initializeApp(
    { apiKey: "demo-conduzapp-key", authDomain: "demo-conduzapp.firebaseapp.com", projectId: "demo-conduzapp", storageBucket: BUCKET, appId: "demo-conduzapp" },
    email,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const functions = getFunctions(app, "us-central1");
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  const storage = getStorage(app);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  await signInWithEmailAndPassword(auth, email, password);
  await auth.currentUser.getIdToken(true);
  const conduz = httpsCallable(functions, "conduz");
  return {
    uid: auth.currentUser.uid,
    storage,
    call: async (op, input = {}) => (await conduz({ op, input })).data,
    fail: async (op, input, pattern) => {
      try {
        await conduz({ op, input });
      } catch (e) {
        assert(!pattern || pattern.test(e.message), `recusado com mensagem inesperada: ${e.message}`);
        return e.message;
      }
      throw new Error(`deveria ter sido recusado: ${op}`);
    },
  };
}

async function run() {
  const scope = `test-e2e-${randomUUID().slice(0, 8)}`;
  const password = "E2e-" + randomBytes(6).toString("hex");
  const people = {
    admin: { email: `admin.${scope}@conduzapp.local`, name: "Admin Teste E2E" },
    instrutor: { email: `instrutor.${scope}@conduzapp.local`, name: "Instrutor Teste E2E" },
    aluno: { email: `aluno.${scope}@conduzapp.local`, name: "Aluno Teste E2E" },
    outro: { email: `outro.${scope}@conduzapp.local`, name: "Outra Aluna Teste E2E" },
  };
  for (const [key, p] of Object.entries(people)) {
    const u = await adminAuth().createUser({ email: p.email, password, displayName: p.name });
    p.uid = u.uid;
    await adminAuth().setCustomUserClaims(u.uid, { stateScope: scope, ...(key === "admin" ? { admin: true } : {}) });
  }
  // O administrador só existe por provisionamento (Admin SDK), como em tornar-admin.cjs.
  const base = empty();
  base.users[people.admin.uid] = { id: people.admin.uid, name: people.admin.name, role: "admin", favorites: [], identity: { status: "aprovado" } };
  await db.doc(`private/${scope}`).set(base);
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify({ scope, password, people }, null, 2));

  const adm = await client(people.admin.email, password);
  const ins = await client(people.instrutor.email, password);
  const alu = await client(people.aluno.email, password);
  const out = await client(people.outro.email, password);
  const png = fs.readFileSync(path.resolve(__dirname, "../assets/demo/perfil-ficticio.png"));
  const doc = fs.readFileSync(path.resolve(__dirname, "../assets/demo/documento-ficticio.png"));
  const upload = async (c, kind, bytes) => {
    const p = `${kind}/${scope}/${c.uid}/${Date.now()}.png`;
    await uploadBytes(ref(c.storage, p), bytes, { contentType: "image/png" });
    return p;
  };

  // 1. Cadastro e verificação
  await step("Cadastro", "Aluno, aluna e instrutor se cadastram", async () => {
    await alu.call("register", { name: people.aluno.name, role: "aluno" });
    await out.call("register", { name: people.outro.name, role: "aluno" });
    await ins.call("register", { name: people.instrutor.name, role: "instrutor", credential: "AUT-TESTE-001" });
    return "3 perfis criados";
  });
  await step("Cadastro", "Conta não verificada não consegue reservar", () =>
    alu.fail("book", { instructor: people.instrutor.uid, start: Date.now() + 5 * HOUR }, /análise/));
  await step("Identidade", "Envio de foto e documento (Storage + validação no servidor)", async () => {
    for (const c of [alu, out, ins]) {
      await c.call("setPhoto", { path: await upload(c, "profilePhotos", png) });
      await c.call("submitIdentity", { path: await upload(c, "identityDocuments", doc) });
    }
    return "3 fotos e 3 documentos aceitos";
  });
  await step("Identidade", "Arquivo que não é imagem é recusado", async () => {
    const p = `profilePhotos/${scope}/${alu.uid}/falso.png`;
    await uploadBytes(ref(alu.storage, p), Buffer.from("isto não é uma imagem"), { contentType: "image/png" });
    return alu.fail("setPhoto", { path: p }, /inválid/i);
  });
  await step("Segurança", "Aluno não lê o documento de outra pessoa", async () => {
    const st = await adm.call("state");
    const docPath = st.users[people.instrutor.uid].identity.documentPath;
    try {
      await getBytes(ref(alu.storage, docPath));
    } catch (e) {
      return "Storage negou: " + (e.code || e.message);
    }
    throw new Error("o aluno conseguiu ler o documento do instrutor");
  });
  await step("Identidade", "Admin aprova as três identidades", async () => {
    const st = await adm.call("state");
    for (const p of [people.aluno, people.outro, people.instrutor]) {
      const i = st.users[p.uid].identity;
      await adm.call("reviewIdentity", { user: p.uid, decision: "aprovado", reason: "Conferido no teste", documentPath: i.documentPath, photoPath: i.photoPath });
    }
    return "3 aprovadas";
  });
  await step("Segurança", "Aluno não consegue agir como admin", () =>
    alu.fail("approve", { instructor: people.instrutor.uid, decision: "aprovado", reason: "tentativa" }, /administração/));

  // 2. Instrutor
  await step("Instrutor", "Credencial, preço e disponibilidade", async () => {
    await ins.call("credential", { credential: "AUT-TESTE-001", expires: Date.now() + 90 * 24 * HOUR });
    await ins.call("profile", { name: people.instrutor.name, region: "Centro · Volta Redonda", price: 8500, car: "Carro de teste", transmission: "Manual", bio: "Instrutor de teste", specialty: "Baliza" });
    await ins.call("availability", { periods: Array.from({ length: 7 }, (_, day) => ({ day, from: 6, to: 22 })), blocks: [] });
    return "R$ 85,00 · 06h–22h todos os dias";
  });
  await step("Instrutor", "Admin aprova o credenciamento", async () => {
    await adm.call("approve", { instructor: people.instrutor.uid, decision: "aprovado", reason: "Credencial conferida no teste" });
  });
  let slots = [];
  await step("Busca", "Aluno vê o instrutor aprovado com horários livres", async () => {
    const st = await alu.call("state");
    const u = st.users[people.instrutor.uid];
    assert(u?.eligible, "instrutor não aparece como disponível");
    slots = u.slots;
    assert(slots.length > 10, "poucos horários");
    assert(slots.every((s) => s % HOUR === 0), "horário fora da hora cheia");
    return `${slots.length} horários, todos em hora cheia`;
  });
  const pick = (minHours) => slots.find((s) => s >= Date.now() + minHours * HOUR);

  // 3. Conversa
  await step("Mensagens", "Aluno abre conversa e envia mensagem; instrutor lê", async () => {
    await alu.call("openConversation", { to: people.instrutor.uid });
    await alu.call("message", { to: people.instrutor.uid, text: "Olá! Teste de mensagem.", requestId: "e2e-msg-0001" });
    const st = await ins.call("state");
    const ids = st.messages.filter((m) => m.to === people.instrutor.uid && !m.readAt).map((m) => m.id);
    assert(st.unreadCount === 1 && ids.length === 1, "instrutor não recebeu a mensagem");
    const after = await ins.call("readMessages", { to: people.aluno.uid, messages: ids });
    assert(after.unreadCount === 0, "mensagem não marcada como lida");
    const third = await out.call("state");
    assert(third.messages.length === 0, "outra aluna viu a conversa");
    return "entregue, lida e privada";
  });
  await step("Busca", "Favoritar instrutor", async () => {
    const st = await alu.call("favorite", { instructor: people.instrutor.uid });
    assert(st.me.favorites.includes(people.instrutor.uid), "não favoritou");
  });

  // 4. Reserva, pagamento e código
  const addr = { cep: "", street: "Rua de Teste", number: "100", neighborhood: "Centro", city: "Volta Redonda", uf: "RJ" };
  let b1;
  await step("Reserva", "Aluno reserva 1 aula de 50 min com taxa de 12%", async () => {
    const start = pick(6);
    const st = await alu.call("book", { instructor: people.instrutor.uid, start, address: addr });
    b1 = Object.values(st.bookings).find((b) => b.start === start);
    assert(b1 && b1.duration === 50 && b1.commission === 1020 && b1.status === "solicitado", "reserva com dados errados");
    return "50 min · R$ 85,00 · taxa R$ 10,20";
  });
  await step("Reserva", "Mesmo horário para outra aluna é recusado", () =>
    out.fail("book", { instructor: people.instrutor.uid, start: b1.start, address: addr }, /reservado/));
  await step("Reserva", "Instrutor aceita e aluno paga (simulado)", async () => {
    await ins.call("accept", { booking: b1.id });
    const st = await alu.call("pay", { booking: b1.id });
    const b = st.bookings[b1.id];
    assert(b.status === "confirmado" && b.paid, "pagamento não confirmou");
    assert(/^\d{8}$/.test(b.startConfirmation?.code || ""), "aluno não recebeu o código");
    assert(b.startConfirmation.status === "aguardando", "código deveria aguardar o início");
    return "código de 8 dígitos gerado no pagamento";
  });
  await step("Código de início", "Instrutor não recebe o código", async () => {
    const st = await ins.call("state");
    const c = st.bookings[b1.id].startConfirmation;
    assert(!c.code && !c.hash && !c.secret, "o código vazou para o instrutor");
  });
  await step("Código de início", "Validação antes do horário é recusada", async () => {
    const code = (await alu.call("state")).bookings[b1.id].startConfirmation.code;
    return ins.fail("confirmStart", { booking: b1.id, code }, /dez minutos/);
  });
  await step("Relógio de ensaio", "Aluno não controla o relógio", () =>
    alu.fail("setDemoClock", { booking: b1.id, stage: "start" }, /administrador/));
  await step("Relógio de ensaio", "Admin avança para o início da aula", async () => {
    const st = await adm.call("setDemoClock", { booking: b1.id, stage: "start" });
    assert(st.demoClockActive, "relógio não ativou");
  });
  await step("Código de início", "Código errado mostra tentativas; correto confirma", async () => {
    const wrong = await ins.call("confirmStart", { booking: b1.id, code: "00000000" });
    assert(/Restam 4/.test(wrong.operationError || ""), "não informou tentativas restantes");
    const code = (await alu.call("state")).bookings[b1.id].startConfirmation.code;
    const st = await ins.call("confirmStart", { booking: b1.id, code });
    assert(st.bookings[b1.id].startConfirmation.status === "confirmado", "não confirmou");
    return "1 erro, depois confirmado";
  });
  await step("Conclusão", "Concluir antes do término é recusado", () =>
    ins.fail("complete", { booking: b1.id }, /término/));
  await step("Conclusão", "Admin avança ao término e instrutor conclui", async () => {
    await adm.call("setDemoClock", { booking: b1.id, stage: "end" });
    const st = await ins.call("complete", { booking: b1.id });
    assert(st.bookings[b1.id].status === "concluido", "não concluiu");
  });
  await step("Avaliações", "Aluno e instrutor avaliam uma vez cada", async () => {
    await alu.call("review", { booking: b1.id, rating: 5, comment: "Ótima aula de teste" });
    await ins.call("review", { booking: b1.id, rating: 4, comment: "Aluno pontual" });
    await alu.fail("review", { booking: b1.id, rating: 3 }, /já avaliou/);
    const st = await out.call("state");
    const pub = Object.values(st.reviews).find((r) => r.to === people.instrutor.uid);
    assert(pub && !pub.from && !pub.booking, "avaliação pública expõe o aluno");
    return "avaliação do instrutor pública e anônima";
  });
  await step("Repasse", "Repasse bloqueado antes de 24 h", () =>
    ins.fail("eligibility", { booking: b1.id }, /janela/));

  // 5. Disputa e estorno (B2)
  await step("Disputa", "Aluno contesta; admin decide estorno parcial e conclui", async () => {
    const st = await alu.call("dispute", { booking: b1.id, reason: "Aula terminou antes" });
    const t = Object.values(st.tickets).find((x) => x.booking === b1.id && x.status === "aberto");
    await adm.call("resolve", { ticket: t.id, reason: "Estorno parcial de teste", refund: 3000 });
    const done = await adm.call("refund", { booking: b1.id });
    assert(done.bookings[b1.id].refundStatus === "concluido_simulado", "estorno não concluiu");
    return "R$ 30,00 estornado";
  });
  await step("Disputa", "Nova disputa não apaga o estorno concluído (B2)", async () => {
    const st = await alu.call("dispute", { booking: b1.id, reason: "Nova contestação" });
    const t = Object.values(st.tickets).find((x) => x.booking === b1.id && x.status === "aberto");
    await adm.fail("resolve", { ticket: t.id, reason: "Sem estorno", refund: 0 }, /estorno concluído/);
    const ok = await adm.call("resolve", { ticket: t.id, reason: "Mantido", refund: 3000 });
    assert(ok.bookings[b1.id].refund === 3000, "estorno alterado");
  });
  await step("Relógio de ensaio", "Admin restaura o relógio", async () => {
    const st = await adm.call("setDemoClock", { stage: "reset" });
    assert(!st.demoClockActive, "relógio continua ativo");
  });

  // 6. Duas aulas, remarcação e cancelamento
  let group;
  await step("Reserva", "Pacote de 2 aulas seguidas com intervalo de 10 min", async () => {
    const start = slots.find((s) => s >= Date.now() + 24 * HOUR && slots.includes(s + HOUR) && new Date(s - 3 * HOUR).getUTCHours() < 20);
    const st = await out.call("book", { instructor: people.instrutor.uid, start, lessonCount: 2, address: addr });
    group = Object.values(st.bookings).filter((b) => b.groupId).sort((a, b) => a.start - b.start);
    assert(group.length === 2 && group[1].start - (group[0].start + 50 * 60000) === 10 * 60000, "pacote errado");
    for (const b of group) await ins.call("accept", { booking: b.id });
    const paid = await out.call("pay", { booking: group[0].id });
    assert(group.every((b) => paid.bookings[b.id].paid), "pagamento conjunto falhou");
    return "2 × 50 min, pagamento conjunto R$ 170,00";
  });
  await step("Remarcação", "Instrutor propõe, aluna aceita e o código é renovado", async () => {
    const b = group[1];
    const before = (await out.call("state")).bookings[b.id].startConfirmation.code;
    const newStart = slots.find((s) => s >= b.start + 2 * HOUR && slots.includes(s));
    await ins.call("propose", { booking: b.id, start: newStart });
    const st = await out.call("reschedule", { booking: b.id, accept: true });
    const after = st.bookings[b.id];
    assert(after.start === newStart && after.startConfirmation.code !== before, "remarcação não renovou o código");
    return "novo horário e novo código";
  });
  await step("Cancelamento", "Aluno cancela com mais de 2 h: estorno integral", async () => {
    const busy = Object.values((await ins.call("state")).bookings)
      .filter((x) => x.status !== "cancelado")
      .map((x) => x.start);
    const start = slots.find((s) => s >= Date.now() + 30 * HOUR && busy.every((t) => Math.abs(t - s) >= HOUR));
    const st = await alu.call("book", { instructor: people.instrutor.uid, start, address: addr });
    const b = Object.values(st.bookings).find((x) => x.start === start);
    await ins.call("accept", { booking: b.id });
    await alu.call("pay", { booking: b.id });
    const done = await alu.call("cancel", { booking: b.id });
    assert(done.bookings[b.id].status === "cancelado" && done.bookings[b.id].refund === 8500, "estorno incorreto");
    return "R$ 85,00 estornado";
  });

  // 7. Suspensão (B1)
  await step("Suspensão", "Instrutor suspenso conclui aula já paga (B1)", async () => {
    await adm.call("suspend", { instructor: people.instrutor.uid, reason: "Teste de suspensão" });
    await adm.call("setDemoClock", { booking: group[0].id, stage: "end" });
    const st = await ins.call("complete", { booking: group[0].id });
    assert(st.bookings[group[0].id].status === "concluido", "aula paga ficou travada");
    await adm.call("setDemoClock", { stage: "reset" });
    return "concluída mesmo suspenso";
  });
  await step("Suspensão", "Instrutor suspenso some da busca", async () => {
    const st = await alu.call("state");
    assert(!st.users[people.instrutor.uid]?.eligible, "instrutor suspenso continua disponível");
  });

  // 8. Suporte e notificações
  await step("Suporte", "Chamado de suporte aberto e resolvido pela administração", async () => {
    const st = await alu.call("support", { reason: "Dúvida de teste sobre a plataforma" });
    const t = Object.values(st.tickets).find((x) => x.kind === "suporte");
    const done = await adm.call("resolve", { ticket: t.id, reason: "Respondido no teste" });
    assert(done.tickets[t.id].status === "resolvido", "chamado não resolvido");
  });
  await step("Notificações", "Aluno recebeu notificações e marca como lida", async () => {
    const st = await alu.call("state");
    const list = Object.values(st.notifications);
    assert(list.length > 3, "poucas notificações");
    const after = await alu.call("readNotification", { notification: list[0].id });
    assert(after.notifications[list[0].id].readAt, "não marcou como lida");
    return `${list.length} notificações`;
  });
  await step("Isolamento", "Base real (private/state) não foi tocada", async () => {
    const real = await db.doc("private/state").get();
    const users = Object.values(real.data()?.users || {});
    assert(!users.some((u) => /Teste E2E/.test(u.name)), "dados de teste na base real");
    return `${users.length} perfis reais intactos`;
  });
}

async function cleanup() {
  if (!fs.existsSync(MANIFEST)) return console.log("Nenhum teste anterior para limpar.");
  const { scope, people } = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const state = (await db.doc(`private/${scope}`).get()).data();
  for (const id of Object.keys(state?.bookings || {})) await db.doc(`bookingAccess/${id}`).delete();
  await db.doc(`private/${scope}`).delete();
  for (const p of Object.values(people)) await adminAuth().deleteUser(p.uid).catch(() => {});
  const bucket = adminStorage().bucket(BUCKET);
  for (const prefix of [`profilePhotos/${scope}/`, `identityDocuments/${scope}/`])
    await bucket.deleteFiles({ prefix }).catch(() => {});
  for (const id of Object.keys(state?.bookings || {}))
    await bucket.deleteFiles({ prefix: `disputes/${id}/` }).catch(() => {});
  fs.unlinkSync(MANIFEST);
  console.log(`Teste ${scope} removido: contas, dados e arquivos apagados.`);
}

const limpar = process.argv.includes("--limpar");
(limpar ? cleanup() : run())
  .then(() => {
    if (!limpar) {
      let area = "";
      for (const r of results) {
        if (r.area !== area) console.log(`\n${(area = r.area)}`);
        console.log(`  ${r.ok ? "OK   " : "FALHA"} ${r.name}${r.detail ? " — " + r.detail : ""}`);
      }
      const failed = results.filter((r) => !r.ok).length;
      console.log(`\n${results.length - failed} de ${results.length} verificações aprovadas.`);
      console.log("Contas de teste mantidas para conferência. Para apagar: node scripts/testar-tudo.cjs --limpar");
      process.exit(failed ? 1 : 0);
    }
    process.exit(0);
  })
  .catch((e) => {
    console.error(e.stack || e.message);
    process.exit(2);
  });
