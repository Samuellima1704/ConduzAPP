"use strict";
const { createHash } = require("node:crypto");
const {
  verified,
  identityOperation,
  assertOperational,
} = require("./identity");
const { address, formatAddress } = require("./address");
const {
  issueStartCode,
  updateStarts,
  projectBooking,
  confirmStart,
  setDemoClock,
} = require("./start-code");
const HOUR = 3600000;
const DAY = 24 * HOUR;
// Aula padrão de 50 minutos iniciando em hora cheia; os 10 minutos restantes são intervalo.
// Reservas antigas preservam a própria duração.
const LESSON_MIN = 50;
// Taxa de intermediação (take rate) do modelo de negócio, sobre cada aula; congelada na reserva.
const COMMISSION_PERCENT = 12;
const fail = (message) => {
  throw new Error(message);
};
const check = (condition, message) => {
  if (!condition) fail(message);
};
const text = (value, max = 2000) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const empty = () => ({
  users: {},
  bookings: {},
  reviews: {},
  messages: [],
  conversations: {},
  notifications: {},
  tickets: {},
  audit: [],
});
const localDate = (ms) => new Date(ms - 3 * HOUR).toISOString().slice(0, 10);
const localHour = (ms) => new Date(ms - 3 * HOUR).getUTCHours();
const end = (b) => b.start + b.duration * 60000;
const active = (b) =>
  !["cancelado", "falta_aluno", "falta_instrutor"].includes(b.status);
const approved = (u, now) =>
  u?.role === "instrutor" &&
  verified(u) &&
  !!u.photoPath &&
  u.approval === "aprovado" &&
  u.credentialExpires > now &&
  !(u.suspendedUntil > now);
function pair(state, a, b) {
  const student = [a, b].find((id) => state.users[id]?.role === "aluno");
  const instructor = [a, b].find((id) => state.users[id]?.role === "instrutor");
  check(a !== b && student && instructor, "Conversa exige aluno e instrutor.");
  const id = createHash("sha256")
    .update(JSON.stringify([student, instructor]))
    .digest("hex");
  return { id, student, instructor };
}
function conversations(state) {
  const result = { ...(state.conversations || {}) };
  // Recupera os vínculos e o histórico existentes sem migrar ou apagar mensagens.
  for (const b of Object.values(state.bookings)) {
    const c = pair(state, b.student, b.instructor);
    result[c.id] ||= c;
  }
  for (const m of state.messages) {
    const c = pair(state, m.from, m.to);
    result[c.id] ||= c;
  }
  for (const c of Object.values(result))
    c.tag = Object.values(state.bookings).some(
      (b) =>
        b.student === c.student &&
        b.instructor === c.instructor &&
        ["solicitado", "aguardando_pagamento", "confirmado"].includes(b.status),
    )
      ? "AGENDADO"
      : "SEM AGENDAMENTO";
  return result;
}
function bookingNotifications(state, actor, op, input, id, now) {
  const events = {
    book: ["Nova solicitação recebida", "instructor"],
    accept: ["Solicitação aceita: aguardando pagamento", "student"],
    pay: ["Aula confirmada — pagamento simulado", "both"],
    cancel: ["Aula cancelada", "other"],
    propose: ["Pedido de remarcação recebido", "other"],
    reschedule: [
      input.accept ? "Remarcação aceita" : "Remarcação recusada",
      "other",
    ],
    complete: ["Aula concluída: avaliação disponível", "student"],
    absence: ["Ocorrência de falta registrada pela administração", "both"],
    dispute: ["Contestação aberta: repasse bloqueado", "other"],
    resolve: ["Análise administrativa concluída", "both"],
  };
  const event = events[op];
  const booking =
    state.bookings[
      op === "book" ? id : input.booking || state.tickets[input.ticket]?.booking
    ];
  if (!event || !booking) return;
  const recipients =
    event[1] === "both"
      ? [booking.student, booking.instructor]
      : event[1] === "other"
        ? [booking.student, booking.instructor].filter(
            (uid) => uid !== actor.uid,
          )
        : [booking[event[1]]];
  for (const recipient of recipients) {
    const notificationId = `${id}_${op}_${recipient}`;
    state.notifications[notificationId] = {
      id: notificationId,
      recipient,
      booking: booking.id,
      event: op,
      title: event[0],
      at: now,
      readAt: null,
    };
  }
}
function validateAvailability(periods, blocks) {
  check(
    Array.isArray(periods) && periods.length <= 28,
    "Disponibilidade inválida.",
  );
  periods.forEach((p, i) => {
    check(
      Number.isInteger(p.day) &&
        p.day >= 0 &&
        p.day <= 6 &&
        Number.isInteger(p.from) &&
        Number.isInteger(p.to) &&
        p.from >= 0 &&
        p.to <= 24 &&
        p.from < p.to,
      "Use dias válidos e períodos em horas cheias.",
    );
    check(
      !periods
        .slice(0, i)
        .some((q) => q.day === p.day && p.from < q.to && p.to > q.from),
      "Períodos sobrepostos.",
    );
  });
  check(
    Array.isArray(blocks) &&
      blocks.length <= 365 &&
      blocks.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
    "Datas de bloqueio inválidas.",
  );
}
function validSlot(state, instructor, start, duration, now, ignoreId) {
  const u = state.users[instructor];
  check(approved(u, now), "Instrutor sem aprovação válida ou suspenso.");
  check(
    Number.isFinite(start) && start > now && start < now + 7 * DAY,
    "Escolha um horário futuro nos próximos sete dias.",
  );
  check(
    start % HOUR === 0 && Number.isInteger(duration) && duration > 0,
    "A aula deve começar em hora cheia.",
  );
  check(
    u.credentialExpires >= start + duration * 60000,
    "Autorização profissional vence antes da aula.",
  );
  const date = localDate(start);
  const weekday = new Date(start - 3 * HOUR).getUTCDay();
  const hour = localHour(start);
  check(
    !(u.blocks || []).includes(date) &&
      (u.periods || []).some(
        (p) =>
          p.day === weekday && hour >= p.from && hour + duration / 60 <= p.to,
      ),
    "Horário fora da disponibilidade.",
  );
  check(
    !Object.values(state.bookings).some(
      (b) =>
        b.id !== ignoreId &&
        b.instructor === instructor &&
        active(b) &&
        start < end(b) &&
        start + duration * 60000 > b.start,
    ),
    "Horário já reservado.",
  );
}
function slots(state, instructor, now) {
  const result = [];
  for (
    let start = Math.ceil(now / HOUR) * HOUR;
    start < now + 7 * DAY;
    start += HOUR
  ) {
    try {
      validSlot(state, instructor, start, LESSON_MIN, now);
      result.push(start);
    } catch {}
  }
  return result;
}
function view(state, actor, now) {
  const me = state.users[actor.uid];
  if (!me)
    return {
      me: null,
      users: {},
      bookings: {},
      reviews: {},
      messages: [],
      conversations: {},
      notifications: {},
      tickets: {},
      audit: [],
      now,
    };
  const notifications = Object.fromEntries(
    Object.entries(state.notifications || {}).filter(
      ([, n]) => n.recipient === actor.uid,
    ),
  );
  if (actor.admin)
    return {
      ...state,
      bookings: Object.fromEntries(
        Object.entries(state.bookings).map(([id, b]) => [
          id,
          projectBooking(b, actor, now),
        ]),
      ),
      notifications,
      me,
      now,
      demoClockActive: !!state.demo?.clockOffset,
    };
  if (!verified(me))
    return {
      me,
      users: { [me.id]: me },
      bookings: {},
      reviews: {},
      messages: [],
      conversations: {},
      notifications,
      tickets: Object.fromEntries(
        Object.entries(state.tickets).filter(([, t]) => t.owner === actor.uid),
      ),
      audit: [],
      now,
    };
  const bookings = Object.fromEntries(
    Object.entries(state.bookings).filter(([, b]) =>
      [b.student, b.instructor].includes(actor.uid),
    ),
  );
  const myConversations = Object.fromEntries(
    Object.entries(conversations(state)).filter(([, c]) =>
      [c.student, c.instructor].includes(actor.uid),
    ),
  );
  const users = {};
  for (const [id, u] of Object.entries(state.users)) {
    if (id === actor.uid) users[id] = u;
    else if (
      approved(u, now) ||
      Object.values({ ...bookings, ...myConversations }).some((b) =>
        [b.student, b.instructor].includes(id),
      )
    ) {
      const {
        name,
        role,
        region,
        price,
        car,
        transmission,
        bio,
        specialty,
        approval,
        credentialExpires,
        photoPath,
        featured,
      } = u;
      users[id] = {
        id,
        name,
        role,
        region: region || "",
        price: price || 0,
        car: car || "",
        transmission: transmission || "",
        bio: bio || "",
        specialty: specialty || "",
        approval: approval || "",
        credentialExpires: credentialExpires || 0,
        photoPath,
        eligible: approved(u, now),
        featured: featured === true,
        slots: approved(u, now) ? slots(state, id, now) : [],
      };
    }
  }
  return {
    me,
    users,
    bookings: Object.fromEntries(
      Object.entries(bookings).map(([id, b]) => [
        id,
        projectBooking(b, actor, now),
      ]),
    ),
    demoClockActive: !!state.demo?.clockOffset,
    conversations: myConversations,
    notifications,
    reviews: Object.fromEntries(
      Object.values(state.reviews).flatMap((r) => {
        if ([r.from, r.to].includes(actor.uid)) return [[r.id, r]];
        if (state.users[r.to]?.role !== "instrutor") return [];
        // Avaliação do instrutor é pública; reserva e identidade do aluno não são.
        const id = createHash("sha256").update(r.id).digest("hex");
        return [
          [
            id,
            { id, to: r.to, rating: r.rating, comment: r.comment, at: r.at },
          ],
        ];
      }),
    ),
    messages: state.messages.filter((m) => [m.from, m.to].includes(actor.uid)),
    unreadCount: state.messages.filter((m) => m.to === actor.uid && !m.readAt)
      .length,
    tickets: Object.fromEntries(
      Object.entries(state.tickets).filter(([, t]) => t.owner === actor.uid),
    ),
    audit: [],
    now,
  };
}
function execute(
  original,
  actor,
  op,
  input = {},
  now = Date.now(),
  id = "operation",
  trusted = {},
) {
  check(actor?.uid, "Autenticação obrigatória.");
  const s = structuredClone(original || empty());
  s.conversations = conversations(s);
  s.notifications ||= {};
  const startsChanged = updateStarts(s, now);
  let operationError;
  const me = s.users[actor.uid];
  const extraNotificationBookings = [];
  const admin = () =>
    check(actor.admin === true, "Acesso exclusivo da administração.");
  const user = () => check(!!me, "Complete seu cadastro.");
  if (op === "state")
    return { state: s, result: view(s, actor, now), write: startsChanged };
  if (op === "register") {
    check(!me, "Perfil já cadastrado.");
    check(["aluno", "instrutor"].includes(input.role), "Perfil inválido.");
    check(text(input.name).length >= 3, "Informe seu nome completo.");
    s.users[actor.uid] = {
      id: actor.uid,
      name: text(input.name, 120),
      role: input.role,
      favorites: [],
      identity: { status: "nao_enviada" },
      ...(input.role === "instrutor"
        ? {
            approval: "pendente",
            credential: text(input.credential, 120),
            credentialExpires: 0,
            price: 8000,
            periods: [],
            blocks: [],
            cancellations: 0,
            absences: 0,
          }
        : {}),
    };
  } else {
    user();
    assertOperational(me, actor, op);
    const b = s.bookings[input.booking];
    const participant = () => {
      check(!!b, "Reserva não encontrada.");
      check(
        [b.student, b.instructor].includes(actor.uid),
        "Você não participa desta reserva.",
      );
    };
    const instructor = () => {
      participant();
      check(
        b.instructor === actor.uid && approved(me, now),
        "Instrutor sem autorização válida.",
      );
    };
    // Aula já paga: suspensão ou credencial em renovação não impedem registrar o que foi dado.
    const ownLesson = () => {
      participant();
      check(
        b.instructor === actor.uid,
        "Ação exclusiva do instrutor desta aula.",
      );
    };
    const student = () => {
      participant();
      check(b.student === actor.uid, "Ação exclusiva do aluno.");
    };
    if (op === "setDemoClock") setDemoClock(s, actor, input, now, trusted);
    else if (!identityOperation(s, actor, op, input, now, id, trusted))
      switch (op) {
        case "profile": {
          check(text(input.name).length >= 3, "Informe seu nome.");
          Object.assign(me, {
            name: text(input.name, 120),
            region: text(input.region, 120),
            car: text(input.car, 80),
            transmission: text(input.transmission, 40),
            bio: text(input.bio),
            specialty: text(input.specialty, 120),
          });
          if (me.role === "instrutor") {
            check(
              Number.isInteger(input.price) &&
                input.price >= 100 &&
                input.price <= 100000,
              "Preço deve ficar entre R$ 1 e R$ 1.000.",
            );
            me.price = input.price;
          }
          break;
        }
        case "confirmStart":
          ownLesson();
          if (b.startConfirmation?.status === "confirmado")
            return {
              state: s,
              result: view(s, actor, now),
              write: startsChanged,
            };
          operationError = confirmStart(b, actor, input, now);
          break;
        case "credential":
          check(
            me.role === "instrutor" &&
              text(input.credential).length >= 3 &&
              Number.isFinite(input.expires) &&
              input.expires > now,
            "Informe autorização profissional e validade futura.",
          );
          Object.assign(me, {
            credential: text(input.credential, 120),
            credentialExpires: input.expires,
            approval: "pendente",
          });
          break;
        case "approve": {
          admin();
          const u = s.users[input.instructor];
          check(u?.role === "instrutor", "Instrutor não encontrado.");
          check(
            ["aprovado", "rejeitado"].includes(input.decision),
            "Decisão inválida.",
          );
          check(text(input.reason).length >= 3, "Registre a análise manual.");
          if (input.decision === "aprovado")
            check(
              u.credential?.length >= 3 && u.credentialExpires > now,
              "Autorização profissional vencida ou ausente.",
            );
          Object.assign(u, {
            approval: input.decision,
            approvalReason: text(input.reason),
            reviewedBy: actor.uid,
          });
          break;
        }
        case "suspend":
          admin();
          check(
            s.users[input.instructor]?.role === "instrutor",
            "Instrutor não encontrado.",
          );
          check(text(input.reason).length >= 3, "Informe o motivo.");
          s.users[input.instructor].suspendedUntil = now + 7 * DAY;
          s.users[input.instructor].suspensionReason = text(input.reason);
          break;
        case "availability":
          check(me.role === "instrutor", "Ação exclusiva do instrutor.");
          validateAvailability(input.periods, input.blocks);
          Object.assign(me, { periods: input.periods, blocks: input.blocks });
          break;
        case "favorite":
          check(
            me.role === "aluno" &&
              s.users[input.instructor]?.role === "instrutor",
            "Instrutor inválido.",
          );
          me.favorites = (me.favorites || []).includes(input.instructor)
            ? me.favorites.filter((x) => x !== input.instructor)
            : [...(me.favorites || []), input.instructor];
          break;
        case "book": {
          const meetingAddress = address(input.address),
            count = input.lessonCount ?? 1;
          check(me.role === "aluno", "Ação exclusiva do aluno.");
          check(
            count === 1 || count === 2,
            "Escolha uma ou duas aulas consecutivas.",
          );
          check(Number.isFinite(input.start), "Escolha um horário válido.");
          if (input.starts !== undefined)
            check(
              Array.isArray(input.starts) &&
                input.starts.length === count &&
                input.starts.every(
                  (start, i) => start === input.start + i * HOUR,
                ),
              "Horários devem ser consecutivos na mesma data.",
            );
          check(
            localDate(input.start) ===
              localDate(input.start + (count - 1) * HOUR),
            "As duas aulas devem ocorrer na mesma data.",
          );
          const u = s.users[input.instructor];
          for (let i = 0; i < count; i++) {
            const start = input.start + i * HOUR,
              bookingId = i === 0 ? id : id + "_2";
            validSlot(s, input.instructor, start, LESSON_MIN, now);
            check(
              !Object.values(s.bookings).some(
                (x) =>
                  x.student === actor.uid &&
                  active(x) &&
                  start < end(x) &&
                  start + LESSON_MIN * 60000 > x.start,
              ),
              "Você já possui uma aula neste horário.",
            );
            check(Number.isInteger(u.price) && u.price > 0, "Preço inválido.");
            s.bookings[bookingId] = {
              id: bookingId,
              student: actor.uid,
              instructor: input.instructor,
              start,
              duration: LESSON_MIN,
              price: u.price,
              commission: Math.round((u.price * COMMISSION_PERCENT) / 100),
              status: "solicitado",
              paid: false,
              paymentMode: "simulado",
              address: meetingAddress,
              location: formatAddress(meetingAddress),
              createdAt: now,
              startCodeRequired: true,
              ratings: {},
              payoutEligible: false,
              ...(count === 2
                ? {
                    groupId: id,
                    lessonNumber: i + 1,
                    lessonCount: 2,
                    groupPrice: 2 * u.price,
                  }
                : {}),
            };
          }
          break;
        }
        case "accept":
          instructor();
          check(
            b.status === "solicitado" && b.start > now,
            "Solicitação já processada ou expirada.",
          );
          b.status = "aguardando_pagamento";
          break;
        case "pay": {
          student();
          check(
            s.users[b.student]?.photoPath && s.users[b.instructor]?.photoPath,
            "Ambos os participantes precisam de foto de perfil para confirmar a aula. Acesse Editar perfil.",
          );
          check(
            verified(s.users[b.student]) && verified(s.users[b.instructor]),
            "Os participantes precisam de identidade aprovada pela administração.",
          );
          check(
            b.status === "aguardando_pagamento" && b.start > now,
            "Pagamento indisponível.",
          );
          check(
            approved(s.users[b.instructor], now),
            "Instrutor sem autorização válida.",
          );
          const lessons = b.groupId
            ? Object.values(s.bookings).filter(
                (x) =>
                  x.groupId === b.groupId &&
                  ["solicitado", "aguardando_pagamento"].includes(x.status),
              )
            : [b];
          check(
            lessons.every(
              (x) => x.status === "aguardando_pagamento" && x.start > now,
            ),
            "Aguarde o aceite das duas aulas antes de simular o pagamento conjunto.",
          );
          for (const lesson of lessons) {
            Object.assign(lesson, {
              paid: true,
              status: "confirmado",
              paidAt: now,
            });
            // O código nasce com o pagamento; a validação continua restrita à janela de início.
            if (lesson.startCodeRequired) issueStartCode(lesson);
            if (lesson.id !== b.id) extraNotificationBookings.push(lesson.id);
          }
          break;
        }
        case "cancel": {
          participant();
          check(
            active(b) && !["concluido"].includes(b.status) && now < b.start,
            "Cancelamento indisponível.",
          );
          const byInstructor = b.instructor === actor.uid;
          const rate = byInstructor || b.start - now > 2 * HOUR ? 1 : 0.5;
          Object.assign(b, {
            status: "cancelado",
            refund: b.paid ? Math.round(b.price * rate) : 0,
            refundStatus: b.paid ? "pendente_simulado" : "nao_aplicavel",
            cancelledBy: actor.uid,
            payoutEligible: false,
            proposal: null,
          });
          if (byInstructor) {
            me.cancellations = (me.cancellations || 0) + 1;
            if (me.cancellations >= 5) me.adminAlert = true;
          }
          break;
        }
        case "propose":
          participant();
          check(
            b.status === "confirmado" && b.start - now >= 3 * HOUR,
            "Remarcação exige antecedência de três horas.",
          );
          validSlot(s, b.instructor, input.start, b.duration, now, b.id);
          check(
            input.start !== b.start && input.start - now >= 3 * HOUR,
            "Novo horário deve ter três horas de antecedência.",
          );
          b.proposal = { start: input.start, by: actor.uid, at: now };
          break;
        case "reschedule":
          participant();
          check(
            b.status === "confirmado" &&
              b.proposal &&
              b.proposal.by !== actor.uid &&
              b.start - now >= 3 * HOUR,
            "Não há proposta válida da outra parte.",
          );
          if (input.accept) {
            check(b.proposal.start - now >= 3 * HOUR, "Proposta expirada.");
            validSlot(s, b.instructor, b.proposal.start, b.duration, now, b.id);
            check(
              !Object.values(s.bookings).some(
                (x) =>
                  x.id !== b.id &&
                  x.student === b.student &&
                  active(x) &&
                  b.proposal.start < end(x) &&
                  b.proposal.start + b.duration * 60000 > x.start,
              ),
              "Aluno já possui aula no novo horário.",
            );
            b.previousStart = b.start;
            b.start = b.proposal.start;
            // Novo horário invalida o código anterior.
            delete b.startConfirmation;
            if (b.startCodeRequired) issueStartCode(b);
          }
          b.proposal = null;
          break;
        case "complete":
          ownLesson();
          check(
            b.status === "confirmado" && b.paid && now >= end(b),
            "Conclua somente após o término e o pagamento.",
          );
          Object.assign(b, {
            status: "concluido",
            completedAt: now,
            payoutEligible: false,
          });
          break;
        case "confirm":
          student();
          check(b.status === "concluido", "Aula ainda não concluída.");
          b.studentConfirmed = true;
          break;
        case "eligibility":
          participant();
          check(
            !b.startCodeRequired ||
              b.startConfirmation?.status === "confirmado",
            "Início não confirmado. Elegibilidade bloqueada; encaminhe ao suporte para análise.",
          );
          check(
            b.status === "concluido" &&
              b.paid &&
              now > end(b) + DAY &&
              !b.disputeOpen,
            "Aguarde a janela de contestação e a análise de disputas.",
          );
          check(
            !b.refund ||
              (b.refund < b.price && b.refundStatus === "concluido_simulado"),
            "Estorno integral ou pendente impede elegibilidade.",
          );
          b.payoutEligible = true;
          break;
        case "review": {
          participant();
          check(
            b.status === "concluido" && b.paid && now >= end(b),
            "Avalie somente aulas concluídas e pagas.",
          );
          check(
            Number.isInteger(input.rating) &&
              input.rating >= 1 &&
              input.rating <= 5,
            "Nota deve ser de 1 a 5.",
          );
          const reviewId = `${b.id}_${actor.uid}`;
          check(!s.reviews[reviewId], "Você já avaliou esta aula.");
          s.reviews[reviewId] = {
            id: reviewId,
            booking: b.id,
            from: actor.uid,
            to: actor.uid === b.student ? b.instructor : b.student,
            rating: input.rating,
            comment: text(input.comment),
            at: now,
          };
          b.ratings = { ...b.ratings, [actor.uid]: input.rating };
          break;
        }
        case "dispute":
          participant();
          check(
            b.paid &&
              [
                "confirmado",
                "concluido",
                "falta_aluno",
                "falta_instrutor",
              ].includes(b.status) &&
              now >= b.start &&
              now <= end(b) + DAY,
            "Contestação permitida durante a aula e até 24h após seu término.",
          );
          check(
            !b.disputeOpen && text(input.reason).length >= 5,
            "Informe o problema ou aguarde a disputa aberta.",
          );
          b.disputeOpen = true;
          b.payoutEligible = false;
          s.tickets[id] = {
            id,
            booking: b.id,
            owner: actor.uid,
            kind: "disputa",
            reason: text(input.reason),
            status: "aberto",
            at: now,
          };
          break;
        case "support":
          check(text(input.reason).length >= 5, "Descreva sua solicitação.");
          s.tickets[id] = {
            id,
            owner: actor.uid,
            kind: "suporte",
            reason: text(input.reason),
            status: "aberto",
            at: now,
          };
          break;
        case "resolve": {
          admin();
          const t = s.tickets[input.ticket];
          check(
            t && t.status === "aberto",
            "Ocorrência já resolvida ou inexistente.",
          );
          check(text(input.reason).length >= 5, "Registre a decisão.");
          if (t.booking) {
            const booking = s.bookings[t.booking];
            // Estorno já concluído é histórico financeiro: a nova decisão só pode mantê-lo ou ampliá-lo.
            const settled =
              booking.refundStatus === "concluido_simulado"
                ? booking.refund || 0
                : 0;
            check(
              Number.isInteger(input.refund) &&
                input.refund >= settled &&
                input.refund <= booking.price,
              settled
                ? "Já existe estorno concluído nesta aula; informe valor igual ou maior."
                : "Estorno inválido.",
            );
            Object.assign(booking, {
              disputeOpen: false,
              payoutEligible: false,
              refund: input.refund,
              refundStatus:
                input.refund > settled
                  ? "pendente_simulado"
                  : settled
                    ? "concluido_simulado"
                    : "nao_aplicavel",
            });
          }
          Object.assign(t, {
            status: "resolvido",
            decision: text(input.reason),
            reviewedBy: actor.uid,
          });
          break;
        }
        case "refund":
          admin();
          check(
            b && b.refundStatus === "pendente_simulado",
            "Sem estorno pendente.",
          );
          b.refundStatus = "concluido_simulado";
          break;
        case "absence": {
          admin();
          check(
            b && b.paid && ["confirmado", "concluido"].includes(b.status),
            "Reserva indisponível.",
          );
          check(
            ["aluno", "instrutor"].includes(input.who) &&
              text(input.reason).length >= 5,
            "Informe a parte e a evidência.",
          );
          check(
            now >= (input.who === "aluno" ? b.start + 20 * 60000 : end(b)),
            "Aguarde a tolerância ou o término da aula.",
          );
          b.status = input.who === "aluno" ? "falta_aluno" : "falta_instrutor";
          b.payoutEligible = false;
          b.absenceReason = text(input.reason);
          b.refund = input.who === "instrutor" ? b.price : 0;
          b.refundStatus = b.refund ? "pendente_simulado" : "nao_aplicavel";
          if (input.who === "instrutor") {
            const u = s.users[b.instructor];
            u.absences = (u.absences || 0) + 1;
            if (u.absences >= 3) {
              u.suspendedUntil = now + 7 * DAY;
              u.adminAlert = true;
            }
          }
          break;
        }
        case "openConversation": {
          const existing = Object.values(s.conversations).some(
            (c) =>
              (c.student === actor.uid && c.instructor === input.to) ||
              (c.instructor === actor.uid && c.student === input.to),
          );
          check(
            existing ||
              (me.role === "aluno" && approved(s.users[input.to], now)),
            "Escolha um instrutor aprovado e disponível para conversar.",
          );
          const c = pair(s, actor.uid, input.to);
          s.conversations[c.id] ||= { ...c, createdAt: now };
          break;
        }
        case "readNotification": {
          const n = s.notifications[input.notification];
          check(
            n && n.recipient === actor.uid,
            "Notificação não encontrada ou sem autorização.",
          );
          n.readAt ||= now;
          break;
        }
        case "readMessages": {
          check(
            Array.isArray(input.messages) && input.messages.length <= 1500,
            "Mensagens inválidas.",
          );
          for (const messageId of input.messages) {
            const m = s.messages.find((m) => m.id === messageId);
            check(
              m && m.to === actor.uid && m.from === input.to,
              "Mensagem de outro participante ou não recebida.",
            );
            m.readAt ||= now;
          }
          break;
        }
        case "message": {
          check(
            s.users[input.to] &&
              input.to !== actor.uid &&
              text(input.text).length > 0,
            "Destinatário ou mensagem inválidos.",
          );
          const c = pair(s, actor.uid, input.to);
          check(
            !input.conversation || input.conversation === c.id,
            "Você não participa desta conversa.",
          );
          check(
            s.conversations[c.id] ||
              (me.role === "aluno" && approved(s.users[input.to], now)),
            "Aguarde o aluno iniciar a conversa.",
          );
          check(
            typeof input.requestId === "string" &&
              /^[a-zA-Z0-9_-]{8,100}$/.test(input.requestId),
            "Identificador de envio inválido.",
          );
          const previous = s.messages.find(
            (m) => m.from === actor.uid && m.requestId === input.requestId,
          );
          if (previous) {
            check(
              previous.to === input.to && previous.text === text(input.text),
              "Identificador de envio já utilizado para outra mensagem.",
            );
            return { state: s, result: view(s, actor, now), write: false };
          }
          check(s.messages.length < 1500, "Limite da demonstração atingido.");
          s.conversations[c.id] ||= { ...c, createdAt: now };
          s.messages.push({
            id,
            requestId: input.requestId,
            conversation: c.id,
            from: actor.uid,
            to: input.to,
            text: text(input.text),
            at: now,
          });
          break;
        }
        default:
          fail("Operação desconhecida.");
      }
  }
  bookingNotifications(s, actor, op, input, id, now);
  if (op === "book" && s.bookings[id + "_2"])
    bookingNotifications(s, actor, op, input, id + "_2", now);
  for (const booking of extraNotificationBookings)
    bookingNotifications(s, actor, op, { booking }, id + "_" + booking, now);
  if (!["message", "readNotification", "readMessages"].includes(op))
    s.audit.push({ id, by: actor.uid, op, at: now });
  check(
    Buffer.byteLength(JSON.stringify(s), "utf8") < 850000,
    "Limite de armazenamento da demonstração atingido.",
  );
  check(
    s.audit.length < 2000 && Object.keys(s.bookings).length < 300,
    "Limite do ambiente de demonstração atingido.",
  );
  return {
    state: s,
    result: {
      ...view(s, actor, now),
      ...(operationError ? { operationError } : {}),
    },
    write: true,
  };
}
module.exports = {
  execute,
  empty,
  slots,
  validSlot,
  approved,
  end,
  HOUR,
  DAY,
  LESSON_MIN,
  COMMISSION_PERCENT,
};
