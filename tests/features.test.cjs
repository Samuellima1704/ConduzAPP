const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { execute, empty, HOUR, DAY } = require("../functions/domain");
const { validImage, validateMedia } = require("../functions/media");
test("servidor decodifica a imagem e recusa apenas assinatura PNG ou conteúdo truncado", async () => {
  const { validateMedia } = require("../functions/media");
  function bucket(bytes) {
    return {
      file: () => ({
        getMetadata: async () => [
          { size: bytes.length, contentType: "image/png" },
        ],
        download: async () => [bytes],
      }),
    };
  }
  await assert.rejects(
    () =>
      validateMedia(
        bucket(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
        "u",
        "test-media",
        "setPhoto",
        "profilePhotos/test-media/u/image.png",
      ),
    /incompleta/,
  );
  const png = require("node:fs").readFileSync(
    "assets/demo/perfil-ficticio.png",
  );
  assert.equal(
    (
      await validateMedia(
        bucket(png),
        "u",
        "test-media",
        "setPhoto",
        "profilePhotos/test-media/u/image.png",
      )
    ).path,
    "profilePhotos/test-media/u/image.png",
  );
});
const fs = require("node:fs"),
  Module = require("node:module"),
  ts = require("typescript");
const uxModule = new Module(__filename);
uxModule._compile(
  ts.transpileModule(fs.readFileSync("src/lib/presentation.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  __filename,
);
const ux = uxModule.exports;
const now = Date.parse("2026-10-20T09:00:00-03:00"),
  student = { uid: "s" },
  teacher = { uid: "t" },
  admin = { uid: "a", admin: true };
function fixture() {
  const s = empty();
  for (const [id, role] of [
    ["s", "aluno"],
    ["t", "instrutor"],
    ["o", "aluno"],
    ["a", "admin"],
  ])
    s.users[id] = {
      id,
      role,
      name: "Ficticio " + id,
      photoPath: "photo/" + id,
      identity: { status: "aprovado" },
      favorites: [],
    };
  Object.assign(s.users.t, {
    approval: "aprovado",
    credential: "DEMO",
    credentialExpires: now + 30 * DAY,
    price: 8500,
    periods: Array.from({ length: 7 }, (_, day) => ({ day, from: 8, to: 20 })),
    blocks: [],
  });
  return s;
}
const act = (
  s,
  a,
  op,
  input = {},
  time = now,
  id = "operation",
  trusted = {},
) =>
  execute(
    s,
    a,
    op,
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
    time,
    id,
    trusted,
  ).state;
function booked() {
  return act(fixture(), student, "book", { instructor: "t", start: now + DAY });
}
function paid() {
  return act(
    act(booked(), teacher, "accept", { booking: "operation" }),
    student,
    "pay",
    { booking: "operation" },
  );
}
test("foto exige recibo de imagem validado pelo servidor e persiste na projeção", () => {
  let s = fixture();
  assert.throws(
    () => act(s, student, "setPhoto", { path: "injetada" }),
    /validada/,
  );
  s = act(s, student, "setPhoto", { path: "nova" }, now, "p", {
    media: { path: "nova", kind: "profilePhotos" },
  });
  assert.equal(execute(s, student, "state").result.me.photoPath, "nova");
  assert.equal(execute(s, teacher, "state").result.users.s, undefined);
});
test("foto não pode ser removida com reserva ativa; substituição é atômica", () => {
  const s = booked();
  assert.throws(() => act(s, student, "removePhoto"), /aulas ativas/);
  const n = act(s, student, "setPhoto", { path: "nova" }, now, "p", {
    media: { path: "nova", kind: "profilePhotos" },
  });
  assert.equal(n.users.s.photoPath, "nova");
  assert.equal(s.users.s.photoPath, "photo/s");
});
test("pagamento só confirma com as duas fotos; ausência antiga não cancela a reserva", () => {
  let s = act(booked(), teacher, "accept", { booking: "operation" });
  s.users.s.photoPath = null;
  assert.throws(
    () => act(s, student, "pay", { booking: "operation" }),
    /foto de perfil/,
  );
  assert.equal(s.bookings.operation.status, "aguardando_pagamento");
});
test("documentação privada, decisão manual auditada e notificação; identidade não substitui credenciamento", () => {
  let s = fixture();
  s.users.s.identity = { status: "nao_enviada" };
  assert.throws(
    () => act(s, student, "book", { instructor: "t", start: now + DAY }),
    /aguardando análise/,
  );
  s = act(s, student, "submitIdentity", { path: "doc" }, now, "doc", {
    media: { path: "doc", kind: "identityDocuments" },
  });
  assert.equal(s.users.s.identity.status, "pendente");
  assert.throws(
    () => act(s, teacher, "reviewIdentity", { user: "s" }),
    /administração/,
  );
  assert.equal(execute(s, teacher, "state").result.users.s, undefined);
  s = act(s, admin, "reviewIdentity", {
    user: "s",
    decision: "rejeitado",
    reason: "Imagem fictícia ilegível",
    documentPath: "doc",
    photoPath: "photo/s",
  });
  assert.equal(s.identityAudit[0].reviewedBy, "a");
  assert.equal(
    Object.values(execute(s, student, "state").result.notifications).length,
    1,
  );
  s = act(s, student, "submitIdentity", { path: "doc2" }, now, "d2", {
    media: { path: "doc2", kind: "identityDocuments" },
  });
  s = act(s, admin, "reviewIdentity", {
    user: "s",
    decision: "aprovado",
    reason: "Análise manual fictícia",
    documentPath: "doc2",
    photoPath: "photo/s",
  });
  assert.equal(s.users.s.identity.status, "aprovado");
  s.users.t.approval = "pendente";
  assert.throws(
    () => act(s, student, "book", { instructor: "t", start: now + DAY }),
    /aprovação/,
  );
});
test("bytes de imagem e MIME são conferidos; SVG e arquivo disfarçado recusados", () => {
  assert.equal(validImage(Buffer.from("segredo"), "image/png"), false);
  assert.equal(validImage(Buffer.from("<svg/>"), "image/svg+xml"), false);
  assert.equal(
    validImage(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), "image/png"),
    true,
  );
});
test("erros de login não enumeram contas e não exibem detalhes Firebase", () => {
  assert.equal(
    ux.authMessage({ code: "auth/user-not-found" }),
    ux.authMessage({ code: "auth/wrong-password" }),
  );
  assert.match(
    ux.authMessage({ code: "auth/email-already-in-use" }, true),
    /Já existe/,
  );
  assert.match(
    ux.authMessage({ code: "auth/network-request-failed" }),
    /internet/,
  );
  assert.match(ux.authFields("", ""), /Preencha/);
  assert.match(ux.authFields("invalido", "abc"), /válido/);
  assert.match(
    ux.authFields("novo@exemplo.com", "123", true, "Nome"),
    /segurança/,
  );
  assert.ok(
    !ux
      .authMessage({ message: "Firebase: token secreto" })
      .includes("Firebase"),
  );
});
module.exports = {
  fixture,
  act,
  paid,
  booked,
  now,
  student,
  teacher,
  admin,
  ux,
};
test("código nasce no pagamento, só o aluno recebe o segredo e a validação abre no início", () => {
  let s = paid(),
    time = now + DAY;
  const early = execute(s, student, "state", {}, time - 1).result.bookings
    .operation.startConfirmation;
  assert.equal(early.status, "aguardando");
  assert.ok(/^\d{8}$/.test(early.code));
  assert.equal(
    execute(s, teacher, "state", {}, time - 1).result.bookings.operation
      .startConfirmation.code,
    undefined,
  );
  assert.equal(
    Object.values(s.notifications).filter((n) => n.event === "start").length,
    0,
  );
  let r = execute(s, student, "state", {}, time);
  const c = r.result.bookings.operation.startConfirmation;
  assert.equal(c.status, "disponivel");
  assert.equal(c.code, early.code);
  assert.equal(r.write, true);
  s = r.state;
  for (const a of [teacher, admin]) {
    const view = execute(s, a, "state", {}, time).result.bookings.operation
      .startConfirmation;
    assert.ok(!view.code && !view.hash && !view.salt && !view.secret);
  }
  assert.deepEqual(
    execute(s, { uid: "o" }, "state", {}, time).result.bookings,
    {},
  );
  assert.equal(execute(s, student, "state", {}, time + 1).write, false);
  assert.equal(
    Object.values(s.notifications).filter((n) => n.event === "start").length,
    2,
  );
});
test("início correto inclusive no décimo minuto; confirmação é idempotente e não conclui aula", () => {
  let s = paid(),
    time = now + DAY;
  const r = execute(s, student, "state", {}, time);
  s = r.state;
  const code = r.result.bookings.operation.startConfirmation.code;
  assert.throws(
    () => act(s, student, "confirmStart", { booking: "operation", code }, time),
    /instrutor/,
  );
  assert.throws(
    () =>
      act(
        s,
        { uid: "o" },
        "confirmStart",
        { booking: "operation", code },
        time,
      ),
    /participa/,
  );
  s = act(
    s,
    teacher,
    "confirmStart",
    { booking: "operation", code },
    time + 10 * 60000,
  );
  assert.equal(s.bookings.operation.startConfirmation.status, "confirmado");
  assert.equal(s.bookings.operation.status, "confirmado");
  const n = s.audit.length;
  assert.equal(
    execute(
      s,
      teacher,
      "confirmStart",
      { booking: "operation", code },
      time + 10 * 60000,
    ).write,
    false,
  );
  assert.equal(s.audit.length, n);
  assert.throws(
    () =>
      act(s, teacher, "complete", { booking: "operation" }, time + 10 * 60000),
    /término/,
  );
  s = act(s, teacher, "complete", { booking: "operation" }, time + HOUR);
  s = act(
    s,
    teacher,
    "eligibility",
    { booking: "operation" },
    time + 26 * HOUR,
  );
  assert.equal(s.bookings.operation.payoutEligible, true);
});
test("tentativas inválidas persistem até bloqueio sem alteração financeira", () => {
  let s = paid(),
    time = now + DAY;
  for (let i = 0; i < 5; i++) {
    const r = execute(
      s,
      teacher,
      "confirmStart",
      { booking: "operation", code: "00000000" },
      time,
    );
    assert.match(r.result.operationError, /incorreto|Limite/);
    s = r.state;
  }
  assert.equal(s.bookings.operation.startConfirmation.attempts, 5);
  assert.equal(s.bookings.operation.startConfirmation.status, "bloqueado");
  assert.throws(
    () =>
      act(
        s,
        teacher,
        "confirmStart",
        { booking: "operation", code: "00000000" },
        time,
      ),
    /Limite/,
  );
  assert.equal(s.bookings.operation.price, 8500);
  assert.equal(s.bookings.operation.paid, true);
  assert.equal(s.bookings.operation.refund, undefined);
});
test("expiração não marca falta nem cancela; conclusão mantém prazo e repasse fica bloqueado", () => {
  const time = now + DAY;
  let s = paid();
  s = execute(s, student, "state", {}, time + 10 * 60000 + 1).state;
  assert.equal(s.bookings.operation.startConfirmation.status, "expirado");
  assert.equal(s.bookings.operation.status, "confirmado");
  assert.equal(s.bookings.operation.refund, undefined);
  assert.throws(
    () =>
      act(
        s,
        teacher,
        "confirmStart",
        { booking: "operation", code: "00000000" },
        time + 11 * 60000,
      ),
    /dez minutos/,
  );
  s = act(s, teacher, "complete", { booking: "operation" }, time + HOUR);
  assert.throws(
    () =>
      act(
        s,
        teacher,
        "eligibility",
        { booking: "operation" },
        time + 26 * HOUR,
      ),
    /Início não confirmado/,
  );
});
test("códigos são específicos por aula e não se reutilizam entre as duas reservas", () => {
  let s = act(
    fixture(),
    student,
    "book",
    { instructor: "t", start: now + DAY, lessonCount: 2 },
    now,
    "g",
  );
  for (const b of ["g", "g_2"]) s = act(s, teacher, "accept", { booking: b });
  s = act(s, student, "pay", { booking: "g" });
  let r = execute(s, student, "state", {}, now + DAY);
  s = r.state;
  const first = r.result.bookings.g.startConfirmation.code;
  r = execute(s, student, "state", {}, now + DAY + HOUR);
  s = r.state;
  assert.ok(first !== r.result.bookings.g_2.startConfirmation.code);
  r = execute(
    s,
    teacher,
    "confirmStart",
    { booking: "g_2", code: first },
    now + DAY + HOUR,
  );
  assert.match(r.result.operationError, /incorreto/);
});
test("relógio controlado exige cenário demo, administrador e emulador; payload comum não controla tempo", () => {
  let s = fixture();
  s.demo = { scope: "demo-clock" };
  const trusted = { emulator: true, demoScope: "demo-clock", realNow: now };
  s = act(s, student, "book", { instructor: "t", start: now + DAY });
  assert.throws(
    () =>
      act(
        s,
        student,
        "setDemoClock",
        { booking: "operation", stage: "start" },
        now,
        "clock",
        trusted,
      ),
    /administrador/,
  );
  assert.throws(
    () =>
      act(
        s,
        admin,
        "setDemoClock",
        { booking: "operation", stage: "start" },
        now,
        "clock",
        { ...trusted, emulator: false },
      ),
    /exclusivo/,
  );
  assert.throws(
    () =>
      act(
        s,
        admin,
        "setDemoClock",
        { booking: "operation", stage: "start" },
        now,
        "clock",
        { emulator: false, cloudDemo: true, demoScope: "test-clock", realNow: now },
      ),
    /exclusivo/,
  );
  s = act(
    s,
    admin,
    "setDemoClock",
    { booking: "operation", stage: "start" },
    now,
    "clock",
    trusted,
  );
  const { effectiveNow } = require("../functions/state-scope");
  assert.equal(
    effectiveNow(s, { stateScope: "demo-clock" }, now, true),
    now + DAY,
  );
  assert.equal(effectiveNow(s, { stateScope: "demo-clock" }, now, false), now);
  assert.equal(effectiveNow(s, { stateScope: "test-clock" }, now, true), now);
  assert.equal(
    execute(fixture(), student, "state", { now: now + DAY }, now).result.now,
    now,
  );
});
test("duas aulas consecutivas são duas reservas de 50min com valor congelado e comissão individual", () => {
  const s = act(
    fixture(),
    student,
    "book",
    { instructor: "t", start: now + DAY, lessonCount: 2 },
    now,
    "group",
  );
  const lessons = Object.values(s.bookings);
  assert.equal(lessons.length, 2);
  assert.equal(lessons[1].start, lessons[0].start + HOUR);
  assert.ok(
    lessons.every(
      (b) => b.duration === 50 && b.price === 8500 && b.groupId === "group",
    ),
  );
  assert.equal(
    lessons.reduce((n, b) => n + b.price, 0),
    17000,
  );
  assert.equal(
    lessons.reduce((n, b) => n + b.commission, 0),
    2040,
  );
});
test("segunda aula indisponível não deixa metade da solicitação gravada; horários separados recusados", () => {
  const s = act(
    fixture(),
    { uid: "o" },
    "book",
    { instructor: "t", start: now + DAY + HOUR },
    now,
    "occupied",
  );
  assert.throws(
    () =>
      act(
        s,
        student,
        "book",
        { instructor: "t", start: now + DAY, lessonCount: 2 },
        now,
        "group",
      ),
    /reservado/,
  );
  assert.deepEqual(Object.keys(s.bookings), ["occupied"]);
  assert.throws(
    () =>
      act(fixture(), student, "book", {
        instructor: "t",
        start: now + DAY,
        lessonCount: 2,
        starts: [now + DAY, now + DAY + 2 * HOUR],
      }),
    /consecutivos/,
  );
  assert.throws(
    () =>
      act(fixture(), student, "book", {
        instructor: "t",
        start: now + DAY + 14 * HOUR,
        lessonCount: 2,
      }),
    /mesma data/,
  );
});
test("pagamento conjunto exige aceite das duas; cancelamento de cada aula usa política existente", () => {
  let s = act(
    fixture(),
    student,
    "book",
    { instructor: "t", start: now + DAY, lessonCount: 2 },
    now,
    "group",
  );
  s = act(s, teacher, "accept", { booking: "group" });
  assert.throws(
    () => act(s, student, "pay", { booking: "group" }),
    /duas aulas/,
  );
  assert.ok(Object.values(s.bookings).every((b) => !b.paid));
  s = act(s, teacher, "accept", { booking: "group_2" });
  s = act(s, student, "pay", { booking: "group" });
  assert.ok(Object.values(s.bookings).every((b) => b.paid));
  s = act(s, student, "cancel", { booking: "group" }, now + DAY - HOUR);
  assert.equal(s.bookings.group.refund, 4250);
  assert.equal(s.bookings.group_2.status, "confirmado");
  assert.equal(s.bookings.group_2.price, 8500);
});
test("não lidas contam somente recebidas, leitura autorizada persiste e reenvio não duplica", () => {
  let s = act(
    fixture(),
    student,
    "message",
    { to: "t", text: "Mensagem fictícia", requestId: "unread-001" },
    now,
    "m1",
  );
  assert.equal(execute(s, teacher, "state").result.unreadCount, 1);
  assert.equal(execute(s, student, "state").result.unreadCount, 0);
  s = act(
    s,
    student,
    "message",
    { to: "t", text: "Mensagem fictícia", requestId: "unread-001" },
    now,
    "m2",
  );
  assert.equal(s.messages.length, 1);
  assert.throws(
    () => act(s, { uid: "o" }, "readMessages", { to: "s", messages: ["m1"] }),
    /outro participante/,
  );
  s = act(s, teacher, "readMessages", { to: "s", messages: ["m1"] });
  const read = s.messages[0].readAt;
  s = act(
    s,
    teacher,
    "readMessages",
    { to: "s", messages: ["m1"] },
    now + 1000,
  );
  assert.equal(s.messages[0].readAt, read);
  assert.equal(execute(s, teacher, "state").result.unreadCount, 0);
});
test("filtros refletem estados reais e disputa sem inventar status", () => {
  assert.ok(ux.matchesBooking({ status: "solicitado" }, "Pendentes"));
  assert.ok(!ux.matchesBooking({ status: "confirmado" }, "Pendentes"));
  assert.ok(
    ux.matchesBooking({ status: "concluido", disputeOpen: true }, "Em disputa"),
  );
  assert.ok(ux.matchesBooking({ status: "falta_aluno" }, "Faltas"));
  assert.equal(ux.homeTab("aluno"), "Início");
  assert.equal(ux.homeTab("instrutor"), "Início");
  assert.equal(ux.homeTab("admin"), "Início");
  assert.equal(ux.homeTab("aluno", true), "Perfil");
});

test("códigos disponíveis usa janela do servidor e não exige expor segredo ao instrutor", () => {
  const b = {
    status: "confirmado",
    paid: true,
    start: now,
    startCodeRequired: true,
    startConfirmation: { status: "disponivel", expiresAt: now + 10 * 60000 },
  };
  const matches = (value, time) =>
    ux.matchesBooking(value, "Códigos disponíveis", time);
  assert.equal(matches(b, now - 1), false);
  assert.equal(matches(b, now), true);
  assert.equal(matches(b, now + 10 * 60000), true);
  assert.equal(matches(b, now + 10 * 60000 + 1), false);
  assert.equal(matches(b, undefined), false);
  for (const change of [
    { paid: false },
    { startCodeRequired: false },
    ...[
      "cancelado",
      "concluido",
      "falta_aluno",
      "solicitado",
      "aguardando_pagamento",
    ].map((status) => ({ status })),
    ...["confirmado", "expirado", "bloqueado"].map((status) => ({
      startConfirmation: { ...b.startConfirmation, status },
    })),
  ])
    assert.equal(matches({ ...b, ...change }, now), false);
  assert.equal(
    matches(
      {
        ...b,
        startConfirmation: { ...b.startConfirmation, expiresAt: now - 1 },
      },
      now,
    ),
    false,
  );
  assert.ok(ux.bookingFilters.includes("Códigos disponíveis"));
});

test("avaliação pelo perfil respeita par, conclusão, pagamento, término e autoria única", () => {
  const b = {
    student: "s",
    instructor: "t",
    status: "concluido",
    paid: true,
    start: now - HOUR,
    duration: 60,
  };
  assert.ok(ux.canReviewPeer(b, "s", "t", now));
  assert.ok(ux.canReviewPeer(b, "t", "s", now));
  for (const [viewer, peer] of [
    ["o", "t"],
    ["t", "o"],
    ["s", "s"],
  ])
    assert.equal(ux.canReviewPeer(b, viewer, peer, now), false);
  assert.equal(ux.canReviewPeer(b, "s", "t", now - 1), false);
  for (const change of [
    { paid: false },
    { status: "confirmado" },
    { ratings: { s: 5 } },
  ])
    assert.equal(ux.canReviewPeer({ ...b, ...change }, "s", "t", now), false);
  assert.ok(ux.canReviewPeer({ ...b, ratings: { s: 5 } }, "t", "s", now));
});
test("lista completa exclui inaptos; destaque não inventa profissionais", () => {
  const users = [
    { id: "a", role: "instrutor", eligible: true, name: "A", featured: true },
    { id: "b", role: "instrutor", eligible: true, name: "B" },
    { id: "c", role: "instrutor", eligible: false, name: "C" },
    { id: "d", role: "aluno", eligible: true, name: "D" },
  ];
  assert.deepEqual(
    ux.instructorList(users, "avulsas", "").map((u) => u.id),
    ["a"],
  );
  assert.deepEqual(
    ux.instructorList(users, "instrutores", "").map((u) => u.id),
    ["a", "b"],
  );
  assert.deepEqual(
    ux.instructorList(users, "favoritos", "", ["b"]).map((u) => u.id),
    ["b"],
  );
  assert.deepEqual(
    ux.instructorList(users, "instrutores", "B").map((u) => u.id),
    ["b"],
  );
});
test("endereço estruturado exige campos; CEP opcional e s/n válidos", () => {
  const { address, formatAddress } = require("../functions/address");
  const a = {
    street: "Rua Fictícia",
    number: "s/n",
    neighborhood: "Centro",
    city: "Niterói",
    uf: "rj",
  };
  assert.equal(address(a).cep, "");
  assert.match(formatAddress(address(a)), /s\/n/);
  assert.throws(() => address({ ...a, street: "" }), /rua/);
  assert.throws(() => address({ ...a, cep: "123" }), /oito/);
  assert.throws(
    () =>
      execute(
        fixture(),
        student,
        "book",
        { instructor: "t", start: now + DAY },
        now,
      ),
    /rua/,
  );
  const s = booked();
  assert.equal(s.bookings.operation.address.number, "s/n");
});
test("ViaCEP preenche dados disponíveis e falhas preservam a alternativa manual", async () => {
  const mod = new Module(__filename);
  mod._compile(
    ts.transpileModule(fs.readFileSync("src/lib/cep.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    __filename,
  );
  let url;
  const found = await mod.exports.lookupCep("24000-000", async (u) => {
    url = u;
    return {
      ok: true,
      json: async () => ({
        logradouro: "Rua Fictícia",
        bairro: "Centro",
        localidade: "Niterói",
        uf: "RJ",
      }),
    };
  });
  assert.match(url, /24000000\/json/);
  assert.equal(found.street, "Rua Fictícia");
  await assert.rejects(() => mod.exports.lookupCep("123"), /oito/);
  await assert.rejects(
    () =>
      mod.exports.lookupCep("99999999", async () => ({
        ok: true,
        json: async () => ({ erro: true }),
      })),
    /manualmente/,
  );
  await assert.rejects(
    () =>
      mod.exports.lookupCep("24000000", async () => {
        throw Error("offline");
      }),
    /manualmente/,
  );
});

// Correções da auditoria de 10/2026 e regras alinhadas para a apresentação.
test("aula de 50 min: término, slots em hora cheia e segunda aula após intervalo de 10 min", () => {
  const { LESSON_MIN, slots } = require("../functions/domain");
  assert.equal(LESSON_MIN, 50);
  let s = paid();
  const b = s.bookings.operation;
  assert.equal(b.duration, 50);
  assert.throws(
    () => act(s, teacher, "complete", { booking: "operation" }, b.start + 49 * 60000),
    /término/,
  );
  s = act(s, teacher, "complete", { booking: "operation" }, b.start + 50 * 60000);
  assert.equal(s.bookings.operation.status, "concluido");
  assert.ok(slots(fixture(), "t", now).every((t) => t % HOUR === 0));
  const group = act(
    fixture(),
    student,
    "book",
    { instructor: "t", start: now + DAY, lessonCount: 2 },
    now,
    "g",
  );
  assert.equal(group.bookings.g_2.start - (group.bookings.g.start + 50 * 60000), 10 * 60000);
});
test("instrutor suspenso ou com credencial em renovação ainda confirma início e conclui aula paga", () => {
  for (const change of [
    (s) => act(s, admin, "suspend", { instructor: "t", reason: "Ocorrência fictícia" }),
    (s) => act(s, teacher, "credential", { credential: "RENOVADA", expires: now + 60 * DAY }),
  ]) {
    let s = change(paid());
    const time = now + DAY;
    assert.throws(
      () => act(s, teacher, "accept", { booking: "operation" }, time),
      /autorização/,
    );
    const r = execute(s, student, "state", {}, time);
    s = act(
      r.state,
      teacher,
      "confirmStart",
      { booking: "operation", code: r.result.bookings.operation.startConfirmation.code },
      time,
    );
    assert.equal(s.bookings.operation.startConfirmation.status, "confirmado");
    s = act(s, teacher, "complete", { booking: "operation" }, time + 50 * 60000);
    assert.equal(s.bookings.operation.status, "concluido");
    assert.throws(
      () => act(s, { uid: "o" }, "complete", { booking: "operation" }, time + HOUR),
      /participa/,
    );
  }
});
test("nova disputa não apaga estorno concluído; só mantém ou amplia o valor", () => {
  const time = now + DAY + HOUR;
  let s = act(paid(), teacher, "complete", { booking: "operation" }, time);
  s = act(s, student, "dispute", { booking: "operation", reason: "Aula incompleta" }, time, "d1");
  s = act(s, admin, "resolve", { ticket: "d1", reason: "Estorno parcial", refund: 3000 }, time);
  s = act(s, admin, "refund", { booking: "operation" }, time);
  assert.equal(s.bookings.operation.refundStatus, "concluido_simulado");
  s = act(s, student, "dispute", { booking: "operation", reason: "Nova contestação" }, time + 1, "d2");
  assert.throws(
    () => act(s, admin, "resolve", { ticket: "d2", reason: "Sem estorno", refund: 0 }, time + 1),
    /estorno concluído/,
  );
  const kept = act(s, admin, "resolve", { ticket: "d2", reason: "Mantido", refund: 3000 }, time + 1);
  assert.equal(kept.bookings.operation.refund, 3000);
  assert.equal(kept.bookings.operation.refundStatus, "concluido_simulado");
  const more = act(s, admin, "resolve", { ticket: "d2", reason: "Ampliado", refund: 5000 }, time + 1);
  assert.equal(more.bookings.operation.refund, 5000);
  assert.equal(more.bookings.operation.refundStatus, "pendente_simulado");
});
test("código gerado no pagamento não valida antes do início e é renovado na remarcação", () => {
  let s = paid();
  const before = execute(s, student, "state", {}, now).result.bookings.operation
    .startConfirmation.code;
  assert.throws(
    () => act(s, teacher, "confirmStart", { booking: "operation", code: before }, now + DAY - 1),
    /dez minutos/,
  );
  s = act(s, teacher, "propose", { booking: "operation", start: now + DAY + 2 * HOUR });
  s = act(s, student, "reschedule", { booking: "operation", accept: true });
  const c = s.bookings.operation.startConfirmation;
  assert.equal(c.status, "aguardando");
  assert.equal(c.availableAt, now + DAY + 2 * HOUR);
  const after = execute(s, student, "state", {}, now).result.bookings.operation
    .startConfirmation.code;
  assert.ok(/^\d{8}$/.test(after));
  assert.notEqual(c.hash, undefined);
});
test("dashboard do instrutor resume agenda, histórico e valores líquidos simulados", () => {
  const base = { instructor: "t", paid: true, duration: 50, price: 10000, commission: 1200 };
  const list = [
    { ...base, id: "hoje", status: "confirmado", start: now + 2 * HOUR },
    { ...base, id: "semana", status: "confirmado", start: now + 3 * DAY },
    { ...base, id: "longe", status: "confirmado", start: now + 8 * DAY },
    { ...base, id: "pendente", status: "solicitado", paid: false, start: now + DAY },
    { ...base, id: "pagar", status: "aguardando_pagamento", paid: false, start: now + DAY },
    { ...base, id: "terminou", status: "confirmado", start: now - 2 * HOUR },
    { ...base, id: "ok", status: "concluido", start: now - DAY },
    { ...base, id: "estorno", status: "concluido", start: now - 2 * DAY, refund: 2000 },
    { ...base, id: "cancelada", status: "cancelado", start: now - 3 * DAY }, { ...base, id: "cancelada-futura", status: "cancelado", start: now + 2 * DAY },
    { ...base, id: "outro", instructor: "x", status: "concluido", start: now - DAY },
  ];
  const d = ux.instructorDashboard(list, "t", now);
  assert.equal(d.today, 1);
  assert.equal(d.week, 2);
  assert.equal(d.requests, 1);
  assert.equal(d.awaitingPayment, 1);
  assert.equal(d.toComplete, 1);
  assert.equal(d.completed, 2);
  assert.equal(d.hours, 100 / 60);
  assert.equal(d.earned, 8800 + 6800);
  assert.equal(d.forecast, 3 * 8800);
  assert.deepEqual(d.upcoming.map((b) => b.id), ["hoje", "semana", "longe"]);
  assert.deepEqual(d.history.map((b) => b.id), ["cancelada-futura", "ok", "estorno", "cancelada"]);
});
test("base real local: só o admin ajusta o relógio de ensaio, e o ajuste vale apenas no ambiente local", () => {
  const { effectiveNow } = require("../functions/state-scope");
  const trusted = { emulator: true, demoScope: "state", realNow: now };
  let s = act(fixture(), student, "book", { instructor: "t", start: now + DAY });
  assert.equal(s.demo, undefined);
  assert.throws(
    () => act(s, student, "setDemoClock", { booking: "operation", stage: "start" }, now, "clock", trusted),
    /administrador/,
  );
  s = act(s, admin, "setDemoClock", { booking: "operation", stage: "start" }, now, "clock", trusted);
  assert.equal(s.demo.scope, "state");
  assert.equal(effectiveNow(s, {}, now, true, true), now + DAY);
  assert.equal(effectiveNow(s, {}, now, true, false), now);
  assert.equal(effectiveNow(s, { stateScope: "test-outro" }, now, true, true), now);
  s = act(s, admin, "setDemoClock", { stage: "reset" }, now, "clock", trusted);
  assert.equal(effectiveNow(s, {}, now, true, true), now);
});
