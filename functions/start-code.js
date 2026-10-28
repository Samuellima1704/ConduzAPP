"use strict";
const {
  randomInt,
  randomBytes,
  createHash,
  timingSafeEqual,
} = require("node:crypto");
const hash = (salt, value) =>
  createHash("sha256")
    .update(salt + ":" + value)
    .digest("hex");
// Gerado no pagamento com status "aguardando"; só vira "disponivel" no horário de início.
function issueStartCode(b) {
  const salt = randomBytes(16).toString("hex"),
    secret = String(randomInt(10000000, 100000000));
  b.startConfirmation = {
    status: "aguardando",
    salt,
    hash: hash(salt, secret),
    secret,
    attempts: 0,
    availableAt: b.start,
    expiresAt: b.start + 10 * 60000,
  };
}
function updateStarts(state, now) {
  let changed = false;
  for (const b of Object.values(state.bookings)) {
    if (
      !b.startCodeRequired ||
      !b.paid ||
      b.status !== "confirmado" ||
      now < b.start
    )
      continue;
    const deadline = b.start + 10 * 60000;
    // Reservas pagas antes da geração no pagamento recebem o código no início.
    if (!b.startConfirmation) issueStartCode(b);
    if (b.startConfirmation.status === "aguardando") {
      Object.assign(b.startConfirmation, {
        status: now <= deadline ? "disponivel" : "expirado",
        availableAt: b.start,
        expiresAt: deadline,
      });
      changed = true;
      for (const recipient of [b.student, b.instructor]) {
        const id = b.id + "_start_" + recipient;
        state.notifications[id] = {
          id,
          recipient,
          booking: b.id,
          event: "start",
          title:
            now > deadline
              ? "Prazo de confirmação de início expirado. Procure o suporte."
              : recipient === b.student
                ? "Código de início disponível na aula. Compartilhe com seu instrutor."
                : "Confirmação de início disponível. Solicite o código ao aluno.",
          at: now,
          readAt: null,
        };
      }
    }
    if (
      ["disponivel", "bloqueado"].includes(b.startConfirmation.status) &&
      now > deadline
    ) {
      b.startConfirmation.status = "expirado";
      b.payoutEligible = false;
      changed = true;
    }
  }
  return changed;
}
function projectBooking(b, actor, now) {
  const out = { ...b };
  if (b.startConfirmation) {
    const { secret, salt, hash, ...publicFields } = b.startConfirmation;
    out.startConfirmation = { ...publicFields };
    if (
      actor.uid === b.student &&
      ["aguardando", "disponivel"].includes(publicFields.status) &&
      now <= publicFields.expiresAt
    )
      out.startConfirmation.code = secret;
  }
  return out;
}
function confirmStart(b, actor, input, now) {
  const c = b.startConfirmation;
  if (!b.paid || b.status !== "confirmado" || actor.uid !== b.instructor)
    throw Error("Confirmação exclusiva do instrutor desta aula paga.");
  if (c?.status === "confirmado") return null;
  if (!c || now < b.start || now > c.expiresAt)
    throw Error(
      "Confirmação de início disponível do início até dez minutos após. Procure o suporte se o prazo expirou.",
    );
  if (c.status === "bloqueado" || c.attempts >= 5)
    throw Error("Limite de tentativas atingido. Encaminhe ao suporte.");
  const value = String(input.code || "").slice(0, 100),
    candidate = hash(c.salt, value);
  if (
    !/^\d{8}$/.test(value) ||
    !timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(c.hash, "hex"))
  ) {
    c.attempts++;
    if (c.attempts >= 5) c.status = "bloqueado";
    return c.status === "bloqueado"
      ? "Limite de tentativas atingido. Encaminhe ao suporte."
      : `Código incorreto. Restam ${5 - c.attempts} tentativas.`;
  }
  Object.assign(c, {
    status: "confirmado",
    confirmedAt: now,
    confirmedBy: actor.uid,
  });
  delete c.secret;
  return null;
}
function setDemoClock(s, actor, input, now, trusted) {
  // Local (emuladores): o administrador ensaia em qualquer base, inclusive a real persistida.
  // Online: somente em cenário isolado demo-*, preparado pelo responsável.
  const local = trusted.emulator === true && !!trusted.demoScope;
  const cloudScenario =
    trusted.cloudDemo === true &&
    !!trusted.demoScope?.startsWith("demo-") &&
    s.demo?.scope === trusted.demoScope;
  if (!actor.admin || !(local || cloudScenario))
    throw Error(
      "Relógio de ensaio exclusivo do administrador no ambiente local ou em cenário de demonstração.",
    );
  if (local) s.demo = { ...s.demo, scope: trusted.demoScope };
  let target = trusted.realNow;
  if (input.stage !== "reset") {
    const b = s.bookings[input.booking];
    if (!b) throw Error("Aula do ensaio não encontrada.");
    if (input.stage === "start") target = b.start;
    else if (input.stage === "expired") target = b.start + 11 * 60000;
    else if (input.stage === "end") target = b.start + b.duration * 60000;
    else throw Error("Etapa de ensaio inválida.");
  }
  if (
    !Number.isFinite(target) ||
    Math.abs(target - trusted.realNow) > 7 * 86400000
  )
    throw Error("Relógio do ensaio fora do limite de sete dias.");
  s.demo.clockOffset = input.stage === "reset" ? 0 : target - trusted.realNow;
  s.demo.clockBy = actor.uid;
  s.demo.clockUpdatedAt = trusted.realNow;
}
module.exports = {
  issueStartCode,
  updateStarts,
  projectBooking,
  confirmStart,
  setDemoClock,
};
