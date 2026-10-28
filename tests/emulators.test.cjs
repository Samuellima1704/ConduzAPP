const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const adminRequire = require("node:module").createRequire(
  require("node:path").resolve(__dirname, "../functions/package.json"),
);
const { initializeApp } = adminRequire("firebase-admin/app");
const { getFirestore } = adminRequire("firebase-admin/firestore");
const { getAuth } = adminRequire("firebase-admin/auth");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc } = require("firebase/firestore");
const { ref, uploadBytes, getBytes, listAll } = require("firebase/storage");
const { deleteObject } = require("firebase/storage");
const { empty, HOUR, DAY } = require("../functions/domain");
initializeApp({ projectId: "demo-conduzapp" });
const db = require("../functions/emulator-db").configureEmulatorFirestore(
  getFirestore(),
);
const scope = `test-${require("node:crypto").randomUUID()}`;
const stateRef = db.doc(`private/${scope}`);
const generatedBookings = new Set();
let preservedState;
let env,
  users = {},
  baseline,
  now,
  start;
async function account(role) {
  const email = `${role}-${Date.now()}@conduzapp.test`,
    password = "TestTCC2026!";
  let r = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  let data = await r.json();
  assert.ok(data.localId, JSON.stringify(data));
  {
    await getAuth().setCustomUserClaims(data.localId, {
      stateScope: scope,
      ...(role === "admin" ? { admin: true } : {}),
    });
    r = await fetch(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    data = await r.json();
  }
  return { uid: data.localId, token: data.idToken };
}
async function call(role, op, input = {}) {
  const r = await fetch(
    "http://127.0.0.1:5001/demo-conduzapp/us-central1/conduz",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(role ? { Authorization: `Bearer ${users[role].token}` } : {}),
      },
      body: JSON.stringify({
        data: {
          op,
          input:
            op === "book"
              ? {
                  address: {
                    cep: "",
                    street: "Rua Fictícia",
                    number: "s/n",
                    neighborhood: "Centro",
                    city: "Niterói",
                    uf: "RJ",
                  },
                  ...input,
                }
              : input,
        },
      }),
    },
  );
  const body = await r.json();
  for (const b of Object.values(body.result?.bookings || {}))
    generatedBookings.add(b.id);
  return { status: r.status, ...body };
}
before(async () => {
  console.log("Preparando contas e estado temporário nos emuladores.");
  preservedState = (await db.doc("private/state").get()).data();
  for (const role of ["aluno", "outro", "instrutor", "admin"])
    users[role] = await account(role);
  now = Date.now();
  start = Math.ceil((now + DAY) / HOUR) * HOUR;
  baseline = empty();
  for (const [role, u] of Object.entries(users))
    baseline.users[u.uid] = {
      id: u.uid,
      name: `Teste ${role}`,
      role: role === "outro" ? "aluno" : role,
      favorites: [],
      photoPath: "fixture/photo",
      identity: { status: "aprovado" },
    };
  Object.assign(baseline.users[users.instrutor.uid], {
    approval: "aprovado",
    credential: "DEMO-TEST",
    credentialExpires: now + 30 * DAY,
    price: 8500,
    periods: Array.from({ length: 7 }, (_, day) => ({ day, from: 0, to: 24 })),
    blocks: [],
  });
  env = await initializeTestEnvironment({
    projectId: "demo-conduzapp",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: fs.readFileSync("storage.rules", "utf8"),
    },
  });
});
beforeEach(async () => {
  await stateRef.set(baseline);
});
after(async () => {
  await stateRef.delete();
  for (const id of generatedBookings)
    await db.doc(`bookingAccess/${id}`).delete();
  for (const u of Object.values(users)) await getAuth().deleteUser(u.uid);
  if (env) await env.cleanup();
  assert.deepEqual(
    (await db.doc("private/state").get()).data(),
    preservedState,
    "A suíte não pode modificar a base anterior da demonstração.",
  );
});
test("Function recusa acesso anônimo e elevação de privilégio", async () => {
  assert.equal((await call(null, "state")).status, 401);
  const r = await call("aluno", "approve", {
    instructor: users.instrutor.uid,
    decision: "aprovado",
    reason: "Fraude",
  });
  assert.ok(r.error);
  assert.match(r.error.message, /administração/);
});

test("perfil vinculado: instrutor inicia chat, ambos avaliam aula elegível e terceiro não acessa aluno", async () => {
  const student = users.aluno.uid,
    teacher = users.instrutor.uid;
  assert.ok(
    (await call("instrutor", "openConversation", { to: student })).error,
  );
  const booked = await call("aluno", "book", { instructor: teacher, start });
  assert.ok(booked.result, JSON.stringify(booked));
  const b = Object.values(booked.result.bookings)[0];
  let r = await call("instrutor", "openConversation", { to: student });
  assert.ok(r.result, JSON.stringify(r));
  assert.equal(r.result.users[student].identity, undefined);
  assert.ok(
    (
      await call("instrutor", "message", {
        to: student,
        text: "Mensagem pelo perfil vinculado",
        requestId: "linked-profile-message",
      })
    ).result,
  );
  r = await call("aluno", "state");
  assert.equal(r.result.messages[0].text, "Mensagem pelo perfil vinculado");
  const saved = (await stateRef.get()).data();
  Object.assign(saved.bookings[b.id], {
    start: now - 2 * HOUR,
    paid: true,
    status: "concluido",
    startCodeRequired: false,
  });
  await stateRef.set(saved);
  assert.ok(
    (
      await call("aluno", "review", {
        booking: b.id,
        rating: 5,
        comment: "Avaliação pública do instrutor",
      })
    ).result,
  );
  assert.ok(
    (
      await call("instrutor", "review", {
        booking: b.id,
        rating: 4,
        comment: "Avaliação privada do aluno",
      })
    ).result,
  );
  assert.ok(
    (await call("instrutor", "review", { booking: b.id, rating: 5 })).error,
  );
  r = await call("outro", "state");
  assert.equal(r.result.users[student], undefined);
  assert.equal(r.result.messages.length, 0);
  const reviews = Object.values(r.result.reviews);
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].to, teacher);
  assert.equal(reviews[0].from, undefined);
  assert.ok(
    (await call("instrutor", "openConversation", { to: users.outro.uid }))
      .error,
  );
  assert.ok(
    (await call("outro", "review", { booking: b.id, rating: 1 })).error,
  );
});

test("foto e documento: upload, persistência, análise e isolamento real no Storage", async () => {
  const uid = users.aluno.uid;
  const owner = env
    .authenticatedContext(uid, { stateScope: scope })
    .storage("gs://demo-conduzapp.appspot.com");
  const outsider = env
    .authenticatedContext(users.outro.uid, { stateScope: scope })
    .storage("gs://demo-conduzapp.appspot.com");
  const administrator = env
    .authenticatedContext(users.admin.uid, { stateScope: scope, admin: true })
    .storage("gs://demo-conduzapp.appspot.com");
  const png = fs.readFileSync("assets/demo/perfil-ficticio.png");
  const photo = `profilePhotos/${scope}/${uid}/profile.png`,
    document = `identityDocuments/${scope}/${uid}/document.png`;
  await assertFails(
    uploadBytes(ref(outsider, photo), png, { contentType: "image/png" }),
  );
  await assertSucceeds(
    uploadBytes(ref(owner, photo), png, { contentType: "image/png" }),
  );
  assert.ok((await call("aluno", "setPhoto", { path: photo })).result);
  assert.equal((await call("aluno", "state")).result.me.photoPath, photo);
  await assertFails(deleteObject(ref(owner, photo)));
  await assertFails(
    uploadBytes(
      ref(owner, photo),
      Buffer.concat([png, Buffer.from("changed")]),
      { contentType: "image/png" },
    ),
  );
  await assertSucceeds(
    uploadBytes(ref(owner, document), png, { contentType: "image/png" }),
  );
  assert.ok((await call("aluno", "submitIdentity", { path: document })).result);
  assert.ok(
    (await call("aluno", "book", { instructor: users.instrutor.uid, start }))
      .error,
  );
  await assertFails(getBytes(ref(outsider, document)));
  await assertFails(
    getBytes(
      ref(
        env.unauthenticatedContext().storage("gs://demo-conduzapp.appspot.com"),
        document,
      ),
    ),
  );
  await assertFails(
    getBytes(
      ref(
        env
          .authenticatedContext(uid, { stateScope: "test-foreign" })
          .storage("gs://demo-conduzapp.appspot.com"),
        document,
      ),
    ),
  );
  await assertSucceeds(getBytes(ref(administrator, document)));
  assert.equal((await call("outro", "state")).result.users[uid], undefined);
  let r = await call("admin", "reviewIdentity", {
    user: uid,
    decision: "aprovado",
    reason: "Análise manual fictícia",
    documentPath: document,
    photoPath: photo,
  });
  assert.ok(r.result, JSON.stringify(r));
  r = await call("aluno", "state");
  assert.equal(r.result.me.identity.status, "aprovado");
  assert.ok(
    Object.values(r.result.notifications).some((n) => n.event === "identity"),
  );
  assert.ok(
    (
      await call("aluno", "setPhoto", {
        path: `profilePhotos/${scope}/${users.outro.uid}/other.png`,
      })
    ).error,
  );
});
test("backend recusa bytes falsos mesmo que MIME declare imagem", async () => {
  const path = `profilePhotos/${scope}/${users.aluno.uid}/invalid.png`;
  await uploadBytes(
    ref(
      env
        .authenticatedContext(users.aluno.uid, { stateScope: scope })
        .storage("gs://demo-conduzapp.appspot.com"),
      path,
    ),
    Buffer.from("não é PNG"),
    { contentType: "image/png" },
  );
  const r = await call("aluno", "setPhoto", { path });
  assert.ok(r.error);
  assert.match(r.error.message, /Arquivo inválido/);
});
test("instrutor também publica foto própria sem poder publicar arquivo de outra pessoa", async () => {
  const path = `profilePhotos/${scope}/${users.instrutor.uid}/teacher.png`,
    data = fs.readFileSync("assets/demo/perfil-ficticio.png");
  await uploadBytes(
    ref(
      env
        .authenticatedContext(users.instrutor.uid, { stateScope: scope })
        .storage("gs://demo-conduzapp.appspot.com"),
      path,
    ),
    data,
    { contentType: "image/png" },
  );
  const r = await call("instrutor", "setPhoto", { path });
  assert.ok(r.result, JSON.stringify(r));
  assert.equal(r.result.me.photoPath, path);
  assert.ok((await call("aluno", "setPhoto", { path })).error);
});
test("aluno e instrutor pendentes enviam JPEG e a referência persiste após nova autenticação", async () => {
  const jpeg = await adminRequire("sharp")({
    create: { width: 32, height: 32, channels: 3, background: "#2255aa" },
  })
    .jpeg()
    .toBuffer();
  for (const role of ["aluno", "instrutor"]) {
    const uid = users[role].uid;
    await stateRef.update({
      [`users.${uid}.identity`]: { status: "nao_enviada" },
      [`users.${uid}.photoPath`]: null,
    });
    const path = `profilePhotos/${scope}/${uid}/pending-${role}.jpg`;
    const owner = env
      .authenticatedContext(uid, { stateScope: scope })
      .storage("gs://demo-conduzapp.appspot.com");
    await assertSucceeds(
      uploadBytes(ref(owner, path), jpeg, { contentType: "image/jpeg" }),
    );
    const saved = await call(role, "setPhoto", { path });
    assert.ok(saved.result, JSON.stringify(saved));
    assert.equal(saved.result.me.identity.status, "nao_enviada");
    assert.equal(saved.result.me.photoPath, path);
    const profile = (await stateRef.get()).data().users[uid];
    assert.equal(profile.photoPath, path);
    assert.equal(typeof profile.photoPath, "string");
    assert.ok(
      !profile.photoPath.startsWith("data:") &&
        !profile.photoPath.startsWith("blob:"),
    );
    assert.deepEqual(Buffer.from(await getBytes(ref(owner, path))), jpeg);
    const account = await getAuth().getUser(uid);
    const login = await fetch(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: account.email,
          password: "TestTCC2026!",
          returnSecureToken: true,
        }),
      },
    );
    const authentication = await login.json();
    assert.equal(authentication.localId, uid);
    const response = await fetch(
      "http://127.0.0.1:5001/demo-conduzapp/us-central1/conduz",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authentication.idToken}`,
        },
        body: JSON.stringify({ data: { op: "state", input: {} } }),
      },
    );
    const reloaded = await response.json();
    assert.equal(reloaded.result.me.photoPath, path);
    assert.equal(reloaded.result.me.identity.status, "nao_enviada");
    assert.ok((await call("outro", "setPhoto", { path })).error);
  }
});

test("mensagens não lidas e endereço estruturado persistem com autorização", async () => {
  await call("aluno", "message", {
    to: users.instrutor.uid,
    text: "Conversa fictícia",
    requestId: "new-unread-01",
  });
  let r = await call("instrutor", "state");
  assert.equal(r.result.unreadCount, 1);
  const message = r.result.messages[0];
  assert.ok(
    (
      await call("outro", "readMessages", {
        to: users.aluno.uid,
        messages: [message.id],
      })
    ).error,
  );
  r = await call("instrutor", "readMessages", {
    to: users.aluno.uid,
    messages: [message.id],
  });
  assert.equal(r.result.unreadCount, 0);
  assert.equal((await call("instrutor", "state")).result.unreadCount, 0);
  r = await call("aluno", "book", { instructor: users.instrutor.uid, start });
  const b = Object.values(r.result.bookings)[0];
  assert.equal(b.address.number, "s/n");
  assert.match(b.location, /Rua Fictícia/);
  assert.ok(
    (
      await call("aluno", "book", {
        instructor: users.instrutor.uid,
        start: start + HOUR,
        address: { street: "" },
      })
    ).error,
  );
});
test("grupo de duas aulas é transacional contra solicitação concorrente no segundo horário", async () => {
  const groupStart = Date.parse(
    new Date(now + DAY - 3 * HOUR).toISOString().slice(0, 10) +
      "T09:00:00-03:00",
  );
  const result = await Promise.all([
    call("aluno", "book", {
      instructor: users.instrutor.uid,
      start: groupStart,
      lessonCount: 2,
    }),
    call("outro", "book", {
      instructor: users.instrutor.uid,
      start: groupStart + HOUR,
    }),
  ]);
  assert.equal(result.filter((r) => r.result).length, 1);
  const state = (await stateRef.get()).data(),
    bookings = Object.values(state.bookings);
  const group = bookings.filter((b) => b.student === users.aluno.uid);
  assert.ok(group.length === 0 || group.length === 2);
  if (group.length) {
    assert.equal(group[1].start - group[0].start, HOUR);
    assert.equal(
      group.reduce((n, b) => n + b.price, 0),
      17000,
    );
  }
});
test("duas aulas: aceite e pagamento simulado conjunto preservam acompanhamento individual", async () => {
  const groupStart = Date.parse(
    new Date(now + DAY - 3 * HOUR).toISOString().slice(0, 10) +
      "T09:00:00-03:00",
  );
  let r = await call("aluno", "book", {
    instructor: users.instrutor.uid,
    start: groupStart,
    lessonCount: 2,
  });
  assert.ok(r.result, JSON.stringify(r));
  const lessons = Object.values(r.result.bookings);
  for (const b of lessons)
    assert.ok((await call("instrutor", "accept", { booking: b.id })).result);
  r = await call("aluno", "pay", { booking: lessons[0].id });
  assert.ok(
    Object.values(r.result.bookings).every((b) => b.paid && b.duration === 50),
  );
  r = await call("aluno", "cancel", { booking: lessons[0].id });
  assert.equal(r.result.bookings[lessons[0].id].refund, 8500);
  assert.equal(r.result.bookings[lessons[1].id].status, "confirmado");
});
test("código de início é privado e tentativas inválidas persistem na transação", async () => {
  let r = await call("aluno", "book", {
    instructor: users.instrutor.uid,
    start,
  });
  const id = Object.keys(r.result.bookings)[0];
  await call("instrutor", "accept", { booking: id });
  await call("aluno", "pay", { booking: id });
  const s = (await stateRef.get()).data();
  s.bookings[id].start = Date.now() - 60000;
  await stateRef.set(s);
  r = await call("aluno", "state");
  const code = r.result.bookings[id].startConfirmation.code;
  assert.ok(/^\d{8}$/.test(code));
  for (const role of ["instrutor", "admin"]) {
    const c = (await call(role, "state")).result.bookings[id].startConfirmation;
    assert.ok(!c.code && !c.hash && !c.secret && !c.salt);
  }
  assert.ok((await call("outro", "confirmStart", { booking: id, code })).error);
  r = await call("instrutor", "confirmStart", {
    booking: id,
    code: "00000000",
  });
  assert.ok(r.result.operationError);
  assert.equal(
    (await stateRef.get()).data().bookings[id].startConfirmation.attempts,
    1,
  );
  r = await call("instrutor", "confirmStart", { booking: id, code });
  assert.equal(r.result.bookings[id].startConfirmation.status, "confirmado");
  r = await call("instrutor", "confirmStart", { booking: id, code });
  assert.equal(r.result.bookings[id].startConfirmation.status, "confirmado");
  assert.ok(
    (await call("aluno", "setDemoClock", { booking: id, stage: "start" }))
      .error,
  );
  // No ambiente local o administrador pode ensaiar o horário; o aluno nunca.
  assert.ok(
    (await call("admin", "setDemoClock", { booking: id, stage: "start" }))
      .result,
  );
  assert.ok((await call("admin", "setDemoClock", { stage: "reset" })).result);
});
test("código expirado não muda pagamento, falta ou cancelamento e bloqueia elegibilidade", async () => {
  let r = await call("aluno", "book", {
    instructor: users.instrutor.uid,
    start,
  });
  const id = Object.keys(r.result.bookings)[0];
  await call("instrutor", "accept", { booking: id });
  await call("aluno", "pay", { booking: id });
  const s = (await stateRef.get()).data();
  s.bookings[id].start = Date.now() - 11 * 60000;
  await stateRef.set(s);
  r = await call("aluno", "state");
  const b = r.result.bookings[id];
  assert.equal(b.startConfirmation.status, "expirado");
  assert.equal(b.status, "confirmado");
  assert.equal(b.paid, true);
  assert.equal(b.refund, undefined);
  assert.ok(!b.payoutEligible);
  assert.ok(
    (await call("instrutor", "confirmStart", { booking: id, code: "00000000" }))
      .error,
  );
});
test("duas reservas concorrentes: exatamente uma é aceita na transação", async () => {
  const results = await Promise.all(
    ["aluno", "outro"].map((role) =>
      call(role, "book", { instructor: users.instrutor.uid, start }),
    ),
  );
  assert.equal(
    results.filter((r) => r.result).length,
    1,
    JSON.stringify(results),
  );
  assert.equal(results.filter((r) => r.error).length, 1);
  const state = (await stateRef.get()).data();
  assert.equal(Object.keys(state.bookings).length, 1);
  const b = Object.values(state.bookings)[0];
  assert.equal(b.duration, 50);
  assert.equal(b.price, 8500);
  assert.equal(b.commission, 1020);
});
test("fluxo integrado: solicitar → aceitar → simular pagamento, com privacidade", async () => {
  let r = await call("aluno", "book", {
    instructor: users.instrutor.uid,
    start,
  });
  assert.ok(r.result, JSON.stringify(r));
  const b = Object.values(r.result.bookings)[0];
  assert.ok((await call("aluno", "pay", { booking: b.id })).error);
  r = await call("instrutor", "accept", { booking: b.id });
  assert.equal(r.result.bookings[b.id].status, "aguardando_pagamento");
  r = await call("aluno", "pay", { booking: b.id });
  assert.equal(r.result.bookings[b.id].status, "confirmado");
  const outside = await call("outro", "state");
  assert.deepEqual(outside.result.bookings, {});
  assert.equal(outside.result.users[users.instrutor.uid].credential, undefined);
  await call("aluno", "message", {
    to: users.instrutor.uid,
    text: "Mensagem privada",
    requestId: "mensagem-001",
  });
  assert.equal((await call("instrutor", "state")).result.messages.length, 1);
  assert.equal((await call("outro", "state")).result.messages.length, 0);
  assert.ok((await call("outro", "cancel", { booking: b.id })).error);
});
test("credenciamento, indisponibilidade e suspensão são impostos no backend real", async () => {
  const u = baseline.users[users.instrutor.uid];
  for (const change of [
    { approval: "pendente" },
    { periods: [] },
    { credentialExpires: now - 1 },
    { suspendedUntil: now + DAY },
  ]) {
    const s = structuredClone(baseline);
    Object.assign(s.users[users.instrutor.uid], change);
    await stateRef.set(s);
    assert.ok(
      (await call("aluno", "book", { instructor: users.instrutor.uid, start }))
        .error,
    );
  }
  assert.equal(u.approval, "aprovado");
});
test("conclusão e avaliações bilaterais pelo endpoint com tempo do servidor", async () => {
  const state = structuredClone(baseline),
    id = `${scope}-aula-passada`;
  state.bookings[id] = {
    id,
    student: users.aluno.uid,
    instructor: users.instrutor.uid,
    start: now - 2 * HOUR,
    duration: 60,
    price: 8500,
    commission: 255,
    status: "confirmado",
    paid: true,
    paymentMode: "simulado",
    ratings: {},
    payoutEligible: false,
  };
  await stateRef.set(state);
  let r = await call("instrutor", "complete", { booking: id });
  assert.equal(r.result.bookings[id].status, "concluido");
  assert.ok((await call("aluno", "review", { booking: id, rating: 5 })).result);
  assert.ok(
    (await call("instrutor", "review", { booking: id, rating: 4 })).result,
  );
  assert.ok((await call("aluno", "review", { booking: id, rating: 1 })).error);
  r = await call("aluno", "dispute", {
    booking: id,
    reason: "Contestação de teste",
  });
  assert.ok(r.result.bookings[id].disputeOpen);
  assert.equal(r.result.bookings[id].payoutEligible, false);
});
test("Firestore nega acesso direto a estado, reservas e escrita de privilégios", async () => {
  for (const ctx of [
    env.unauthenticatedContext(),
    env.authenticatedContext(users.aluno.uid),
    env.authenticatedContext(users.admin.uid, { admin: true }),
  ]) {
    const client = ctx.firestore();
    await assertFails(getDoc(doc(client, "private/state")));
    await assertFails(setDoc(doc(client, "private/state"), { admin: true }));
    await assertFails(
      setDoc(doc(client, "agendamentos/fraude"), { status: "confirmado" }),
    );
  }
});
test("fotos privadas: participante pode anexar, terceiro e anônimo não; admin lê", async () => {
  const booking = `${scope}-evidencia`;
  await db.doc(`bookingAccess/${booking}`).set({
    student: users.aluno.uid,
    instructor: users.instrutor.uid,
    disputeOpen: true,
  });
  const path = `disputes/${booking}/${users.aluno.uid}/foto.png`;
  const bytes = new Uint8Array([137, 80, 78, 71]);
  const mine = env.authenticatedContext(users.aluno.uid).storage();
  await assertSucceeds(
    uploadBytes(ref(mine, path), bytes, { contentType: "image/png" }),
  );
  await assertSucceeds(
    getBytes(
      ref(
        env.authenticatedContext(users.admin.uid, { admin: true }).storage(),
        path,
      ),
    ),
  );
  await assertSucceeds(
    getBytes(
      ref(env.authenticatedContext(users.instrutor.uid).storage(), path),
    ),
  );
  const folder = `disputes/${booking}/${users.aluno.uid}`;
  const listing = await assertSucceeds(listAll(ref(mine, folder)));
  assert.equal(listing.items.length, 1);
  await assertFails(
    listAll(ref(env.authenticatedContext(users.outro.uid).storage(), folder)),
  );
  await assertFails(
    getBytes(ref(env.authenticatedContext(users.outro.uid).storage(), path)),
  );
  await assertFails(
    getBytes(ref(env.unauthenticatedContext().storage(), path)),
  );
  await assertFails(
    uploadBytes(
      ref(mine, `disputes/${booking}/${users.aluno.uid}/arquivo.txt`),
      bytes,
      { contentType: "text/plain" },
    ),
  );
  await assertFails(
    uploadBytes(
      ref(mine, `disputes/${booking}/${users.instrutor.uid}/forjada.png`),
      bytes,
      { contentType: "image/png" },
    ),
  );
  await db.doc(`bookingAccess/${booking}`).delete();
});

test("avaliações privadas de alunos não vazam pelo endpoint; instrutores continuam públicos", async () => {
  const s = structuredClone(baseline);
  const privateId = "reserva-privada_instrutor";
  const publicId = "reserva-privada_aluno";
  s.reviews[privateId] = {
    id: privateId,
    booking: "reserva-privada",
    from: users.instrutor.uid,
    to: users.aluno.uid,
    rating: 4,
    comment: "Informação privada do aluno",
  };
  s.reviews[publicId] = {
    id: publicId,
    booking: "reserva-privada",
    from: users.aluno.uid,
    to: users.instrutor.uid,
    rating: 5,
    comment: "Avaliação pública do instrutor",
  };
  await stateRef.set(s);
  for (const role of ["aluno", "instrutor", "admin"]) {
    const r = await call(role, "state");
    assert.equal(
      r.result.reviews[privateId].comment,
      s.reviews[privateId].comment,
    );
  }
  const outsider = (await call("outro", "state")).result;
  assert.equal(outsider.reviews[privateId], undefined);
  const reviews = Object.values(outsider.reviews);
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].to, users.instrutor.uid);
  assert.equal(reviews[0].rating, 5);
  assert.equal(reviews[0].from, undefined);
  assert.equal(reviews[0].booking, undefined);
  assert.ok(!JSON.stringify(outsider).includes("reserva-privada"));
  for (const path of [
    "avaliacoes/" + privateId,
    "private/state",
    "private/" + scope,
  ]) {
    await assertFails(
      getDoc(doc(env.authenticatedContext(users.outro.uid).firestore(), path)),
    );
  }
});

test("falta administrativa seguida de contestação válida preserva pagamento e estorno", async () => {
  for (const who of ["aluno", "instrutor"]) {
    const s = structuredClone(baseline),
      id = `${scope}-falta-${who}`;
    s.bookings[id] = {
      id,
      student: users.aluno.uid,
      instructor: users.instrutor.uid,
      start: now - 2 * HOUR,
      duration: 60,
      price: 8500,
      commission: 255,
      paid: true,
      paymentMode: "simulado",
      status: "confirmado",
      ratings: {},
      payoutEligible: false,
    };
    await stateRef.set(s);
    let r = await call("admin", "absence", {
      booking: id,
      who,
      reason: "Ausência registrada na integração",
    });
    assert.equal(r.result.bookings[id].status, `falta_${who}`);
    const before = r.result.bookings[id];
    r = await call("aluno", "dispute", {
      booking: id,
      reason: "Contesto a falta registrada",
    });
    assert.equal(r.result.bookings[id].disputeOpen, true);
    assert.equal(r.result.bookings[id].payoutEligible, false);
    for (const field of [
      "paid",
      "paymentMode",
      "price",
      "commission",
      "refund",
      "refundStatus",
    ])
      assert.equal(r.result.bookings[id][field], before[field], field);
    assert.ok((await call("instrutor", "eligibility", { booking: id })).error);
    const ticket = Object.values(r.result.tickets)[0];
    assert.equal(
      (await db.doc(`bookingAccess/${id}`).get()).data().disputeOpen,
      true,
    );
    const adminState = (await call("admin", "state")).result;
    assert.equal(adminState.tickets[ticket.id].status, "aberto");
    r = await call("admin", "resolve", {
      ticket: ticket.id,
      reason: "Análise da ocorrência concluída",
      refund: before.refund,
    });
    assert.equal(r.result.tickets[ticket.id].status, "resolvido");
  }
});

test("chat sem reserva preserva participantes e impede duplicação em reenvios concorrentes", async () => {
  let r = await call("aluno", "openConversation", { to: users.instrutor.uid });
  assert.deepEqual(r.result.bookings, {});
  const c = Object.values(r.result.conversations)[0];
  const input = {
    to: users.instrutor.uid,
    text: "Conversa antes da reserva",
    requestId: "envio-concorrente-001",
    conversation: c.id,
  };
  const responses = await Promise.all([
    call("aluno", "message", input),
    call("aluno", "message", input),
  ]);
  for (const response of responses)
    assert.ok(response.result, JSON.stringify(response));
  r = await call("instrutor", "state");
  assert.equal(r.result.messages.length, 1);
  assert.ok(r.result.conversations[c.id]);
  assert.equal(r.result.users[users.aluno.uid].credential, undefined);
  assert.ok(
    (
      await call("instrutor", "message", {
        to: users.aluno.uid,
        text: "Resposta",
        requestId: "resposta-001",
      })
    ).result,
  );
  const outsider = (await call("outro", "state", { conversation: c.id }))
    .result;
  assert.deepEqual(outsider.messages, []);
  assert.deepEqual(outsider.conversations, {});
  assert.ok(
    (await call("outro", "message", { ...input, requestId: "intrusao-001" }))
      .error,
  );
  assert.ok(
    (await call("aluno", "message", { ...input, text: "Fraude" })).error,
  );
  assert.equal((await call("aluno", "state")).result.messages.length, 2);
});
test("chat não inicia com instrutor pendente e instrutor não inicia conversa não solicitada", async () => {
  assert.ok(
    (
      await call("instrutor", "message", {
        to: users.aluno.uid,
        text: "Indevida",
        requestId: "indevida-001",
      })
    ).error,
  );
  const s = structuredClone(baseline);
  s.users[users.instrutor.uid].approval = "pendente";
  await stateRef.set(s);
  assert.ok(
    (await call("aluno", "openConversation", { to: users.instrutor.uid }))
      .error,
  );
  assert.ok(
    (
      await call("aluno", "message", {
        to: users.instrutor.uid,
        text: "Não permitido",
        requestId: "bloqueada-001",
      })
    ).error,
  );
});

test("tags acompanham reserva, aceite, pagamento, cancelamento e conclusão no servidor", async () => {
  const tag = (result) => Object.values(result.conversations)[0].tag;
  assert.equal(
    tag(
      (await call("aluno", "openConversation", { to: users.instrutor.uid }))
        .result,
    ),
    "SEM AGENDAMENTO",
  );
  let r = await call("aluno", "book", {
    instructor: users.instrutor.uid,
    start,
  });
  const b = Object.values(r.result.bookings)[0];
  assert.equal(tag(r.result), "AGENDADO");
  assert.equal(b.paid, false);
  r = await call("instrutor", "accept", { booking: b.id });
  assert.equal(tag(r.result), "AGENDADO");
  r = await call("aluno", "pay", { booking: b.id });
  assert.equal(tag(r.result), "AGENDADO");
  r = await call("aluno", "cancel", { booking: b.id });
  assert.equal(tag(r.result), "SEM AGENDAMENTO");
  assert.equal(
    tag((await call("instrutor", "state")).result),
    "SEM AGENDAMENTO",
  );
  const s = (await stateRef.get()).data();
  Object.assign(s.bookings[b.id], {
    status: "confirmado",
    start: now - 2 * HOUR,
  });
  await stateRef.set(s);
  r = await call("instrutor", "complete", { booking: b.id });
  assert.equal(tag(r.result), "SEM AGENDAMENTO");
});

test("notificações internas persistem por destinatário e acompanham os eventos essenciais", async () => {
  let r = await call("aluno", "book", {
    instructor: users.instrutor.uid,
    start,
  });
  const b = Object.values(r.result.bookings)[0];
  r = await call("instrutor", "state");
  const received = Object.values(r.result.notifications)[0];
  assert.equal(received.event, "book");
  assert.deepEqual((await call("outro", "state")).result.notifications, {});
  assert.ok(
    (await call("outro", "readNotification", { notification: received.id }))
      .error,
  );
  await call("instrutor", "readNotification", { notification: received.id });
  assert.ok(
    (await call("instrutor", "state")).result.notifications[received.id].readAt,
  );
  await call("instrutor", "accept", { booking: b.id });
  r = await call("aluno", "state");
  assert.ok(
    Object.values(r.result.notifications).some((n) => n.event === "accept"),
  );
  await call("aluno", "pay", { booking: b.id });
  await call("aluno", "propose", { booking: b.id, start: start + HOUR });
  r = await call("instrutor", "state");
  assert.ok(
    Object.values(r.result.notifications).some((n) => n.event === "pay"),
  );
  assert.ok(
    Object.values(r.result.notifications).some((n) => n.event === "propose"),
  );
  await call("instrutor", "reschedule", { booking: b.id, accept: true });
  r = await call("aluno", "state");
  assert.ok(
    Object.values(r.result.notifications).some((n) => n.event === "reschedule"),
  );
  await call("aluno", "cancel", { booking: b.id });
  r = await call("instrutor", "state");
  assert.ok(
    Object.values(r.result.notifications).some((n) => n.event === "cancel"),
  );
  const count = Object.keys(r.result.notifications).length;
  assert.ok((await call("aluno", "pay", { booking: b.id })).error);
  assert.equal(
    Object.keys((await call("instrutor", "state")).result.notifications).length,
    count,
  );
});

test("ensaio completo com a mesma fábrica de dados da apresentação e relógio do servidor", async () => {
  const { demoFixture } = require("../scripts/demo-fixture.cjs");
  const fixture = demoFixture(Date.now(), `demo-${scope.slice(5)}`, {
    aluno: users.aluno.uid,
    instrutor: users.instrutor.uid,
    admin: users.admin.uid,
  });
  // Acrescenta apenas a conta de terceiro criada por esta suíte.
  fixture.users[users.outro.uid] = baseline.users[users.outro.uid];
  await stateRef.set(fixture);
  const historical = fixture.demo.historicalBooking;
  let r = await call("instrutor", "complete", { booking: historical });
  assert.equal(r.result.bookings[historical].status, "concluido");
  r = await call("aluno", "state");
  const start = r.result.users[users.instrutor.uid].slots[0];
  assert.ok(start > Date.now());
  r = await call("aluno", "openConversation", { to: users.instrutor.uid });
  assert.equal(Object.values(r.result.conversations)[0].tag, "SEM AGENDAMENTO");
  await call("aluno", "message", {
    to: users.instrutor.uid,
    text: "Ensaio da apresentação",
    requestId: "ensaio-mensagem-001",
  });
  r = await call("aluno", "book", {
    instructor: users.instrutor.uid,
    start,
    location: "Endereço fictício sem CEP",
  });
  const future = Object.values(r.result.bookings).find(
    (b) => b.id !== historical,
  );
  assert.equal(future.status, "solicitado");
  assert.equal(Object.values(r.result.conversations)[0].tag, "AGENDADO");
  await call("instrutor", "accept", { booking: future.id });
  r = await call("aluno", "pay", { booking: future.id });
  assert.equal(r.result.bookings[future.id].status, "confirmado");
  assert.ok(!r.result.users[users.instrutor.uid].slots.includes(start));
  assert.ok(
    (await call("outro", "book", { instructor: users.instrutor.uid, start }))
      .error,
  );
  assert.ok(
    (
      await call("instrutor", "complete", {
        booking: future.id,
        demo: true,
        now: Date.now() + DAY,
      })
    ).error,
  );
  assert.ok(
    (
      await call("aluno", "review", {
        booking: historical,
        rating: 5,
        comment: "Ensaio fictício",
      })
    ).result,
  );
  assert.ok(
    (
      await call("instrutor", "review", {
        booking: historical,
        rating: 5,
        comment: "Avaliação privada fictícia",
      })
    ).result,
  );
  r = await call("admin", "state");
  assert.equal(r.result.me.role, "admin");
  const ticket = Object.values(r.result.tickets).find(
    (t) => t.kind === "suporte",
  );
  assert.ok(
    (
      await call("admin", "resolve", {
        ticket: ticket.id,
        reason: "Orientação fictícia concluída",
      })
    ).result,
  );
});

test("payload não troca o ambiente selecionado pela claim autenticada", async () => {
  const target = `test-${require("node:crypto").randomUUID()}`;
  const foreignRef = db.doc(`private/${target}`);
  const foreign = structuredClone(baseline);
  foreign.tickets.segredo = {
    id: "segredo",
    owner: users.aluno.uid,
    kind: "suporte",
    reason: "Estado de outro ensaio",
    status: "aberto",
  };
  await foreignRef.create(foreign);
  try {
    const r = await call("aluno", "state", {
      stateScope: target,
      scope: target,
      path: `private/${target}`,
    });
    assert.ok(r.result);
    assert.deepEqual(r.result.tickets, {});
    assert.deepEqual((await foreignRef.get()).data(), foreign);
  } finally {
    await foreignRef.delete();
  }
});
