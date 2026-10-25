"use strict";
const { empty, HOUR, DAY } = require("../functions/domain");
const accounts = [
  { uid: "demo-aluno", account: "aluno", name: "Ana Souza", role: "aluno" },
  {
    uid: "demo-instrutor",
    account: "instrutor",
    name: "Marcos Oliveira",
    role: "instrutor",
  },
  {
    uid: "demo-admin",
    account: "admin",
    name: "Administração TCC",
    role: "admin",
  },
];
function demoFixture(now, scope, identities = {}) {
  const student = identities.aluno || "demo-aluno";
  const instructor = identities.instrutor || "demo-instrutor";
  if (!Number.isFinite(now) || !/^demo-[a-zA-Z0-9-]{1,80}$/.test(scope))
    throw new Error("Preparação de demonstração inválida.");
  const state = empty();
  for (const a of accounts) {
    const uid = identities[a.role] || a.uid;
    state.users[uid] = {
      id: uid,
      name: a.name,
      role: a.role,
      favorites: [],
      photoPath:
        a.role === "admin" ? null : `profilePhotos/${scope}/${uid}/demo.png`,
      identity: {
        status: "aprovado",
        reason: "Análise manual fictícia do cenário acadêmico",
        reviewedAt: now,
        reviewedBy: identities.admin || "demo-admin",
      },
    };
  }
  Object.assign(state.users[instructor], {
    region: "Centro · Niterói, RJ",
    price: 8500,
    car: "Chevrolet Onix",
    transmission: "Manual",
    bio: "Instrutor fictício para demonstração acadêmica.",
    specialty: "Prática e confiança ao dirigir",
    approval: "aprovado",
    credential: "DEMO-AUTORIZACAO-001",
    credentialExpires: now + 90 * DAY,
    approvalReason: "Credencial fictícia analisada para demonstração local.",
    periods: Array.from({ length: 7 }, (_, day) => [
      { day, from: 8, to: 12 },
      { day, from: 14, to: 18 },
    ]).flat(),
    blocks: [],
    cancellations: 0,
    absences: 0,
  });
  state.users["demo-pendente"] = {
    id: "demo-pendente",
    name: "Instrutor Fictício Pendente",
    role: "instrutor",
    credential: "DEMO-PENDENTE-002",
    credentialExpires: now + 90 * DAY,
    approval: "pendente",
    price: 8000,
    periods: [],
    blocks: [],
  };
  const bookingId = `${scope}-historica`;
  const start = Math.floor((now - 2 * HOUR) / HOUR) * HOUR;
  state.bookings[bookingId] = {
    id: bookingId,
    student,
    instructor,
    start,
    duration: 50,
    price: 8500,
    commission: 255,
    status: "confirmado",
    paid: true,
    paymentMode: "simulado",
    location: "Cenário histórico fictício — concluir e avaliar",
    createdAt: start - DAY,
    ratings: {},
    payoutEligible: false,
  };
  state.tickets[`${scope}-suporte`] = {
    id: `${scope}-suporte`,
    owner: student,
    kind: "suporte",
    reason: "Atendimento fictício: orientação sobre o ponto de encontro.",
    status: "aberto",
    at: now,
  };
  state.demo = {
    scope,
    preparedAt: now,
    presentationDate: "2026-10-30",
    historicalBooking: bookingId,
  };
  return state;
}
module.exports = { demoFixture, accounts };
