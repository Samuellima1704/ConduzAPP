const test = require("node:test");
const assert = require("node:assert/strict");
const { execute, empty, slots, HOUR, DAY } = require("../functions/domain");
const now = Date.parse("2026-10-19T12:00:00-03:00");
const start = now + DAY;
const actor = { uid: "student" };
const teacher = { uid: "teacher" };
const admin = { uid: "admin", admin: true };
function fixture() {
  const s = empty();
  s.users.student = {
    id: "student",
    name: "Aluno Teste",
    role: "aluno",
    favorites: [],
    photoPath: "fixture/photo",
    identity: { status: "aprovado" },
  };
  s.users.other = {
    id: "other",
    name: "Outro Aluno",
    role: "aluno",
    favorites: [],
    photoPath: "fixture/photo",
    identity: { status: "aprovado" },
  };
  s.users.teacher = {
    id: "teacher",
    name: "Instrutor Teste",
    role: "instrutor",
    photoPath: "fixture/teacher",
    identity: { status: "aprovado" },
    approval: "aprovado",
    credential: "FICTICIA",
    credentialExpires: now + 30 * DAY,
    price: 9999,
    periods: Array.from({ length: 7 }, (_, day) => ({ day, from: 8, to: 20 })),
    blocks: [],
  };
  s.users.admin = { id: "admin", name: "Admin", role: "admin" };
  return s;
}
const act = (s, a, op, input = {}, time = now, id = "b1") =>
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
  ).state;

test("instrutor abre conversa pelo perfil apenas com aluno já vinculado, sem vazar dados privados", () => {
  assert.throws(
    () => act(fixture(), teacher, "openConversation", { to: "student" }),
    /aprovado/,
  );
  let s = act(fixture(), actor, "book", { instructor: "teacher", start });
  s.users.student.identity.documentPath = "private/document";
  s = act(s, teacher, "openConversation", { to: "student" });
  const id = Object.keys(s.conversations)[0];
  s = act(s, teacher, "openConversation", { to: "student" });
  assert.deepEqual(Object.keys(s.conversations), [id]);
  s = act(s, teacher, "message", {
    to: "student",
    text: "Olá, aluno vinculado",
    requestId: "profile-first-message",
  });
  const received = execute(s, actor, "state", {}, now).result;
  assert.equal(received.messages[0].text, "Olá, aluno vinculado");
  assert.equal(
    execute(s, teacher, "state", {}, now).result.users.student.identity,
    undefined,
  );
  const outsider = execute(s, { uid: "other" }, "state", {}, now).result;
  assert.equal(outsider.users.student, undefined);
  assert.deepEqual(outsider.messages, []);
  assert.throws(
    () => act(s, teacher, "openConversation", { to: "other" }),
    /aprovado/,
  );
  assert.throws(
    () => act(s, { uid: "other" }, "openConversation", { to: "student" }),
    /aprovado/,
  );
});
function booked() {
  return act(fixture(), actor, "book", { instructor: "teacher", start });
}
function paid() {
  const result = act(
    act(booked(), teacher, "accept", { booking: "b1" }),
    actor,
    "pay",
    { booking: "b1" },
  );
  // Cenário legado das regras financeiras; novos códigos têm suíte própria.
  result.bookings.b1.startCodeRequired = false;
  return result;
}
test("autenticação obrigatória e cadastro sem elevação de privilégio", () => {
  assert.throws(() => execute(empty(), {}, "state"), /Autenticação/);
  assert.throws(
    () =>
      execute(empty(), actor, "register", { role: "admin", name: "Fraude" }),
    /Perfil inválido/,
  );
  assert.throws(
    () =>
      act(fixture(), actor, "approve", {
        instructor: "teacher",
        decision: "aprovado",
        reason: "teste",
      }),
    /administração/,
  );
});
test("cadastro instrutor inicia pendente e sem horários", () => {
  const s = act(empty(), teacher, "register", {
    role: "instrutor",
    name: "Instrutor",
  });
  assert.equal(s.users.teacher.approval, "pendente");
  assert.deepEqual(slots(s, "teacher", now), []);
});
test("credenciamento manual exige autorização válida; suspensão e vencimento impedem reserva", () => {
  for (const change of [
    { approval: "pendente" },
    { credentialExpires: now - 1 },
    { suspendedUntil: now + DAY },
  ]) {
    const s = fixture();
    Object.assign(s.users.teacher, change);
    assert.throws(
      () => act(s, actor, "book", { instructor: "teacher", start }),
      /aprovação/,
    );
  }
  const s = fixture();
  s.users.teacher.credentialExpires = 0;
  assert.throws(
    () =>
      act(s, admin, "approve", {
        instructor: "teacher",
        decision: "aprovado",
        reason: "Análise",
      }),
    /vencida/,
  );
});
test("sem disponibilidade não gera horários e bloqueios são respeitados", () => {
  const s = fixture();
  s.users.teacher.periods = [];
  assert.deepEqual(slots(s, "teacher", now), []);
  assert.throws(
    () => act(s, actor, "book", { instructor: "teacher", start }),
    /disponibilidade/,
  );
  const t = fixture();
  t.users.teacher.blocks = ["2026-10-20"];
  assert.throws(
    () => act(t, actor, "book", { instructor: "teacher", start }),
    /disponibilidade/,
  );
});
test("múltiplos períodos e validação de sobreposição", () => {
  const s = act(fixture(), teacher, "availability", {
    periods: [
      { day: 2, from: 8, to: 10 },
      { day: 2, from: 14, to: 18 },
    ],
    blocks: [],
  });
  assert.equal(slots(s, "teacher", now).length, 6);
  assert.throws(
    () =>
      act(s, teacher, "availability", {
        periods: [
          { day: 2, from: 8, to: 12 },
          { day: 2, from: 11, to: 14 },
        ],
        blocks: [],
      }),
    /sobrepostos/,
  );
});
test("novas reservas têm 50 minutos, hora cheia, sete dias e valores imutáveis", () => {
  const s = booked();
  assert.equal(s.bookings.b1.duration, 50);
  assert.equal(s.bookings.b1.price, 9999);
  assert.equal(s.bookings.b1.commission, 1200);
  s.users.teacher.price = 12000;
  assert.equal(s.bookings.b1.price, 9999);
  assert.throws(
    () =>
      act(fixture(), actor, "book", {
        instructor: "teacher",
        start: start + 60000,
      }),
    /hora cheia/,
  );
  assert.throws(
    () =>
      act(fixture(), actor, "book", {
        instructor: "teacher",
        start: now + 8 * DAY,
      }),
    /sete dias/,
  );
});
test("reserva conflitante é recusada; duração legada de 50 min é preservada", () => {
  const s = booked();
  s.bookings.b1.duration = 50;
  assert.throws(
    () => act(s, { uid: "other" }, "book", { instructor: "teacher", start }),
    /reservado/,
  );
  assert.equal(s.bookings.b1.duration, 50);
});
test("pagamento simulado só após aceite e só pelo aluno participante", () => {
  assert.throws(
    () => act(booked(), actor, "pay", { booking: "b1" }),
    /indisponível/,
  );
  assert.throws(
    () => act(booked(), { uid: "other" }, "accept", { booking: "b1" }),
    /participa/,
  );
  const s = paid();
  assert.equal(s.bookings.b1.status, "confirmado");
  assert.equal(s.bookings.b1.paymentMode, "simulado");
  assert.equal(s.bookings.b1.payoutEligible, false);
  assert.throws(() => act(s, actor, "pay", { booking: "b1" }), /indisponível/);
});
test("cancelamento aluno >2h integral e limite exato de 2h recebe 50%", () => {
  assert.equal(
    act(paid(), actor, "cancel", { booking: "b1" }, start - 2 * HOUR - 1)
      .bookings.b1.refund,
    9999,
  );
  assert.equal(
    act(paid(), actor, "cancel", { booking: "b1" }, start - 2 * HOUR).bookings
      .b1.refund,
    5000,
  );
  assert.throws(
    () => act(paid(), actor, "cancel", { booking: "b1" }, start),
    /indisponível/,
  );
});
test("cancelamento instrutor integral e quinto gera alerta", () => {
  const s = paid();
  s.users.teacher.cancellations = 4;
  const t = act(s, teacher, "cancel", { booking: "b1" });
  assert.equal(t.bookings.b1.refund, 9999);
  assert.equal(t.users.teacher.adminAlert, true);
});
test("remarcação mantém original até aceite, preço e duração legados", () => {
  let s = paid();
  s.bookings.b1.duration = 50;
  s = act(s, teacher, "propose", { booking: "b1", start: start + HOUR });
  assert.equal(s.bookings.b1.start, start);
  assert.throws(
    () => act(s, teacher, "reschedule", { booking: "b1", accept: true }),
    /outra parte/,
  );
  s = act(s, actor, "reschedule", { booking: "b1", accept: true });
  assert.equal(s.bookings.b1.start, start + HOUR);
  assert.equal(s.bookings.b1.duration, 50);
  assert.equal(s.bookings.b1.price, 9999);
  assert.throws(
    () =>
      act(
        paid(),
        actor,
        "propose",
        { booking: "b1", start: start + HOUR },
        start - 2 * HOUR,
      ),
    /três horas/,
  );
});
test("aceite da remarcação revalida horário ocupado", () => {
  let s = act(paid(), teacher, "propose", {
    booking: "b1",
    start: start + HOUR,
  });
  s = act(
    s,
    { uid: "other" },
    "book",
    { instructor: "teacher", start: start + HOUR },
    now,
    "b2",
  );
  assert.throws(
    () => act(s, actor, "reschedule", { booking: "b1", accept: true }),
    /reservado/,
  );
  assert.equal(s.bookings.b1.start, start);
});
test("conclusão após término e avaliações bilaterais uma vez por aula", () => {
  assert.throws(
    () => act(paid(), teacher, "complete", { booking: "b1" }, start),
    /término/,
  );
  assert.throws(
    () => act(paid(), actor, "review", { booking: "b1", rating: 5 }),
    /concluídas/,
  );
  let s = act(paid(), teacher, "complete", { booking: "b1" }, start + HOUR);
  s = act(s, actor, "review", { booking: "b1", rating: 5 }, start + HOUR);
  s = act(s, teacher, "review", { booking: "b1", rating: 4 }, start + HOUR);
  assert.equal(Object.keys(s.reviews).length, 2);
  assert.throws(
    () => act(s, actor, "review", { booking: "b1", rating: 2 }, start + HOUR),
    /já avaliou/,
  );
});
test("disputa durante aula e até 24h após fim bloqueia elegibilidade", () => {
  let s = act(
    paid(),
    actor,
    "dispute",
    { booking: "b1", reason: "Problema relatado" },
    start,
    "ticket",
  );
  assert.equal(s.bookings.b1.disputeOpen, true);
  assert.equal(s.bookings.b1.payoutEligible, false);
  assert.throws(
    () => act(s, actor, "eligibility", { booking: "b1" }, start + 26 * HOUR),
    /janela/,
  );
  assert.throws(
    () =>
      act(
        paid(),
        actor,
        "dispute",
        { booking: "b1", reason: "Problema relatado" },
        start + 25 * HOUR + 1,
      ),
    /24h/,
  );
  assert.throws(
    () =>
      act(
        paid(),
        actor,
        "dispute",
        { booking: "b1", reason: "Problema relatado" },
        start - 1,
      ),
    /durante/,
  );
  s = act(
    s,
    admin,
    "resolve",
    { ticket: "ticket", reason: "Análise concluída", refund: 9999 },
    start + 26 * HOUR,
  );
  assert.equal(s.bookings.b1.refundStatus, "pendente_simulado");
});
test("elegibilidade após janela independe da confirmação do aluno e não transfere dinheiro", () => {
  let s = act(paid(), teacher, "complete", { booking: "b1" }, start + HOUR);
  s = act(s, teacher, "eligibility", { booking: "b1" }, start + 25 * HOUR + 1);
  assert.equal(s.bookings.b1.payoutEligible, true);
  assert.equal(s.bookings.b1.transferred, undefined);
});
test("no-show aluno respeita 20min; terceira falta confirmada do instrutor suspende sem mudar notas", () => {
  assert.throws(
    () =>
      act(
        paid(),
        admin,
        "absence",
        { booking: "b1", who: "aluno", reason: "Ausência comprovada" },
        start + 19 * 60000,
      ),
    /tolerância/,
  );
  assert.equal(
    act(
      paid(),
      admin,
      "absence",
      { booking: "b1", who: "aluno", reason: "Ausência comprovada" },
      start + 20 * 60000,
    ).bookings.b1.refund,
    0,
  );
  const s = paid();
  s.users.teacher.absences = 2;
  const t = act(
    s,
    admin,
    "absence",
    { booking: "b1", who: "instrutor", reason: "Ausência comprovada" },
    start + HOUR,
  );
  assert.ok(t.users.teacher.suspendedUntil > start);
  assert.deepEqual(t.reviews, {});
});
test("mensagens e reservas são privadas para terceiros", () => {
  let s = paid();
  s = act(
    s,
    actor,
    "message",
    { to: "teacher", text: "Olá", requestId: "mensagem-001" },
    now,
    "msg",
  );
  assert.throws(
    () =>
      act(s, { uid: "other" }, "message", {
        to: "teacher",
        text: "Intruso",
        requestId: "intruso-001",
        conversation: s.messages[0].conversation,
      }),
    /participa/,
  );
  const v = execute(s, { uid: "other" }, "state", {}, now).result;
  assert.deepEqual(v.bookings, {});
  assert.deepEqual(v.messages, []);
  assert.equal(v.users.teacher.credential, undefined);
});

test("aceite expirado e credencial vencendo antes da aula são recusados", () => {
  assert.throws(
    () => act(booked(), teacher, "accept", { booking: "b1" }, start),
    /expirada/,
  );
  const s = fixture();
  s.users.teacher.credentialExpires = start - 1;
  assert.throws(
    () => act(s, actor, "book", { instructor: "teacher", start }),
    /vence/,
  );
});
test("estorno integral ou pendente impede elegibilidade", () => {
  let s = act(paid(), teacher, "complete", { booking: "b1" }, start + HOUR);
  s.bookings.b1.refund = 9999;
  s.bookings.b1.refundStatus = "concluido_simulado";
  assert.throws(
    () => act(s, teacher, "eligibility", { booking: "b1" }, start + 26 * HOUR),
    /Estorno/,
  );
  s.bookings.b1.refund = 100;
  s.bookings.b1.refundStatus = "pendente_simulado";
  assert.throws(
    () => act(s, teacher, "eligibility", { booking: "b1" }, start + 26 * HOUR),
    /Estorno/,
  );
});

test("avaliações do aluno: apenas autor, destinatário e administração; instrutor público sem vínculo privado", () => {
  const s = fixture();
  s.reviews.private = {
    id: "private",
    booking: "segredo",
    from: "teacher",
    to: "student",
    rating: 4,
    comment: "Privado",
  };
  s.reviews.public = {
    id: "public",
    booking: "segredo",
    from: "student",
    to: "teacher",
    rating: 5,
    comment: "Público",
  };
  for (const a of [actor, teacher, admin])
    assert.equal(
      execute(s, a, "state", {}, now).result.reviews.private.comment,
      "Privado",
    );
  const outside = execute(s, { uid: "other" }, "state", {}, now).result;
  assert.equal(outside.reviews.private, undefined);
  const r = Object.values(outside.reviews);
  assert.equal(r.length, 1);
  assert.deepEqual(
    Object.keys(r[0]).sort(),
    ["id", "to", "rating", "comment", "at"].sort(),
  );
  assert.equal(r[0].rating, 5);
  assert.ok(!JSON.stringify(outside).includes("segredo"));
});
test("estados isolados são selecionados pela claim, nunca por entrada do cliente", () => {
  const { statePath } = require("../functions/state-scope");
  assert.equal(statePath({}), "private/state");
  assert.equal(statePath({ stateScope: "test-abc" }), "private/test-abc");
  assert.equal(
    statePath({ stateScope: "demo-2026-10-30" }),
    "private/demo-2026-10-30",
  );
  assert.throws(() => statePath({ stateScope: "../state" }), /inválido/);
});

test("falta registrada mantém contestação até o limite de 24h, sem movimentar valores", () => {
  for (const who of ["aluno", "instrutor"]) {
    const absent = act(
      paid(),
      admin,
      "absence",
      { booking: "b1", who, reason: "Ausência documentada" },
      start + HOUR,
    );
    const before = structuredClone(absent.bookings.b1);
    for (const participant of [actor, teacher]) {
      const s = act(
        absent,
        participant,
        "dispute",
        { booking: "b1", reason: "Discordo da ocorrência" },
        start + 24 * HOUR + 50 * 60000,
        "contestacao",
      );
      assert.equal(s.bookings.b1.disputeOpen, true);
      assert.equal(s.bookings.b1.payoutEligible, false);
      for (const field of [
        "paid",
        "paidAt",
        "paymentMode",
        "price",
        "commission",
        "refund",
        "refundStatus",
        "status",
      ])
        assert.equal(s.bookings.b1[field], before[field], field);
      assert.throws(
        () =>
          act(
            s,
            participant,
            "eligibility",
            { booking: "b1" },
            start + 26 * HOUR,
          ),
        /janela/,
      );
      assert.throws(
        () =>
          act(s, { uid: "other" }, "resolve", {
            ticket: "contestacao",
            reason: "Análise indevida",
            refund: 0,
          }),
        /administração/,
      );
      const resolved = act(
        s,
        admin,
        "resolve",
        {
          ticket: "contestacao",
          reason: "Análise administrativa registrada",
          refund: before.refund,
        },
        start + 26 * HOUR,
      );
      assert.equal(resolved.tickets.contestacao.status, "resolvido");
      assert.equal(resolved.bookings.b1.disputeOpen, false);
    }
    assert.throws(
      () =>
        act(
          absent,
          actor,
          "dispute",
          { booking: "b1", reason: "Fora do prazo" },
          start + 24 * HOUR + 50 * 60000 + 1,
        ),
      /24h/,
    );
    assert.throws(
      () =>
        act(
          absent,
          { uid: "other" },
          "dispute",
          { booking: "b1", reason: "Sem autorização" },
          start + HOUR,
        ),
      /participa/,
    );
  }
});

test("conversa antes da reserva exige aluno e instrutor aprovado; participantes mantêm acesso", () => {
  let s = act(fixture(), actor, "openConversation", { to: "teacher" });
  assert.deepEqual(s.bookings, {});
  assert.equal(Object.keys(s.conversations).length, 1);
  s = act(s, actor, "openConversation", { to: "teacher" });
  assert.equal(Object.keys(s.conversations).length, 1);
  assert.equal(
    Object.keys(execute(s, teacher, "state", {}, now).result.conversations)
      .length,
    1,
  );
  assert.equal(
    Object.keys(
      execute(s, { uid: "other" }, "state", {}, now).result.conversations,
    ).length,
    0,
  );
  assert.equal(
    execute(s, teacher, "state", {}, now).result.users.student.name,
    "Aluno Teste",
  );
  assert.throws(
    () =>
      act(fixture(), teacher, "message", {
        to: "student",
        text: "Não solicitado",
        requestId: "novo-envio",
      }),
    /Aguarde/,
  );
  assert.throws(
    () => act(fixture(), actor, "openConversation", { to: "other" }),
    /aprovado/,
  );
  for (const change of [
    { approval: "pendente" },
    { suspendedUntil: now + DAY },
    { credentialExpires: now - 1 },
  ]) {
    const blocked = fixture();
    Object.assign(blocked.users.teacher, change);
    assert.throws(
      () => act(blocked, actor, "openConversation", { to: "teacher" }),
      /aprovado/,
    );
  }
});
test("reenvio de mensagem é idempotente por remetente; conteúdo diferente não reutiliza chave", () => {
  const input = {
    to: "teacher",
    text: "Olá antes da reserva",
    requestId: "envio-unico-001",
  };
  let s = act(fixture(), actor, "message", input, now, "m1");
  const retry = execute(s, actor, "message", input, now + 1, "m2");
  assert.equal(retry.write, false);
  assert.equal(retry.state.messages.length, 1);
  assert.equal(retry.state.messages[0].id, "m1");
  assert.throws(
    () => act(s, actor, "message", { ...input, text: "Alterada" }),
    /já utilizado/,
  );
  assert.throws(
    () => act(s, actor, "message", { to: "teacher", text: "Sem chave" }),
    /Identificador/,
  );
  s.users.teacher.suspendedUntil = now + DAY;
  s = act(
    s,
    teacher,
    "message",
    {
      to: "student",
      text: "Histórico preservado",
      requestId: "envio-unico-001",
    },
    now,
    "m3",
  );
  assert.equal(s.messages.length, 2);
  assert.deepEqual(
    execute(s, { uid: "other" }, "state", {}, now).result.messages,
    [],
  );
});
test("conversas antigas são recuperadas a partir de reservas e mensagens existentes", () => {
  const s = paid();
  delete s.conversations;
  s.messages.push({
    id: "legada",
    from: "student",
    to: "teacher",
    text: "Histórico",
    at: now,
  });
  const v = execute(s, actor, "state", {}, now).result;
  assert.equal(Object.keys(v.conversations).length, 1);
  assert.equal(v.messages[0].id, "legada");
});

test("tags refletem reservas pendentes, aceitas ou confirmadas sem exigir pagamento", () => {
  const initial = act(fixture(), actor, "openConversation", { to: "teacher" });
  const tag = (s) =>
    Object.values(execute(s, actor, "state", {}, now).result.conversations)[0]
      .tag;
  assert.equal(tag(initial), "SEM AGENDAMENTO");
  for (const status of [
    "solicitado",
    "aguardando_pagamento",
    "confirmado",
    "cancelado",
    "concluido",
    "falta_aluno",
    "falta_instrutor",
  ]) {
    const s = booked();
    s.bookings.b1.status = status;
    assert.equal(
      tag(s),
      ["solicitado", "aguardando_pagamento", "confirmado"].includes(status)
        ? "AGENDADO"
        : "SEM AGENDAMENTO",
      status,
    );
  }
  const s = booked();
  s.bookings.b1.status = "cancelado";
  s.bookings.b2 = { ...s.bookings.b1, id: "b2", status: "solicitado" };
  assert.equal(tag(s), "AGENDADO");
  s.bookings.b2.student = "other";
  assert.equal(tag(s), "SEM AGENDAMENTO");
});

test("notificações essenciais são geradas na mesma alteração e restritas ao destinatário", () => {
  let s = booked();
  const visible = (a) =>
    Object.values(execute(s, a, "state", {}, now).result.notifications);
  assert.deepEqual(
    visible(teacher).map((n) => n.event),
    ["book"],
  );
  assert.deepEqual(visible({ uid: "other" }), []);
  const notification = visible(teacher)[0].id;
  assert.throws(
    () => act(s, actor, "readNotification", { notification }),
    /autorização/,
  );
  assert.throws(
    () => act(s, admin, "readNotification", { notification }),
    /autorização/,
  );
  s = act(s, teacher, "readNotification", { notification });
  const readAt = s.notifications[notification].readAt;
  s = act(s, teacher, "readNotification", { notification }, now + HOUR);
  assert.equal(s.notifications[notification].readAt, readAt);
  s = act(s, teacher, "accept", { booking: "b1" });
  s = act(s, actor, "pay", { booking: "b1" });
  assert.ok(visible(actor).some((n) => n.event === "accept"));
  assert.ok(visible(actor).some((n) => n.event === "pay"));
  assert.ok(visible(teacher).some((n) => n.event === "pay"));
  s = act(s, actor, "propose", { booking: "b1", start: start + HOUR });
  assert.ok(visible(teacher).some((n) => n.event === "propose"));
  s = act(s, teacher, "reschedule", { booking: "b1", accept: true });
  assert.ok(visible(actor).some((n) => n.event === "reschedule"));
  s = act(s, actor, "cancel", { booking: "b1" });
  assert.ok(visible(teacher).some((n) => n.event === "cancel"));
  const before = Object.keys(s.notifications).length;
  assert.throws(
    () => act(s, teacher, "accept", { booking: "b1" }),
    /processada/,
  );
  assert.equal(Object.keys(s.notifications).length, before);
});

test("disputa em aula concluída bloqueia elegibilidade após a janela; controle sem disputa permite", () => {
  const completed = act(
    paid(),
    teacher,
    "complete",
    { booking: "b1" },
    start + HOUR,
  );
  const disputed = act(
    completed,
    actor,
    "dispute",
    { booking: "b1", reason: "Solicito análise administrativa" },
    start + 2 * HOUR,
  );
  assert.throws(
    () =>
      act(
        disputed,
        teacher,
        "eligibility",
        { booking: "b1" },
        start + 26 * HOUR,
      ),
    /janela/,
  );
  assert.equal(
    act(completed, teacher, "eligibility", { booking: "b1" }, start + 26 * HOUR)
      .bookings.b1.payoutEligible,
    true,
  );
});
