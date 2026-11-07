export function authMessage(error: unknown, signup = false): string {
  const code = (error as { code?: string })?.code || "";
  if (code === "auth/invalid-email")
    return "Digite um endereço de e-mail válido.";
  if (signup && code === "auth/email-already-in-use")
    return "Já existe uma conta com este e-mail.";
  if (
    signup &&
    ["auth/weak-password", "auth/password-does-not-meet-requirements"].includes(
      code,
    )
  )
    return "A senha não atende aos requisitos mínimos de segurança.";
  if (["auth/network-request-failed", "functions/unavailable"].includes(code))
    return "Não foi possível conectar. Verifique sua internet e tente novamente.";
  if (code === "auth/too-many-requests")
    return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  if (
    !signup &&
    [
      "auth/user-not-found",
      "auth/wrong-password",
      "auth/invalid-credential",
      "auth/user-disabled",
    ].includes(code)
  )
    return "E-mail ou senha incorretos. Confira seus dados e tente novamente.";
  return signup
    ? "Não foi possível concluir o cadastro. Confira os dados e tente novamente."
    : "Não foi possível entrar. Confira seus dados e tente novamente.";
}
export const identityStatusLabel = (status?: string) =>
  (
    ({
      aprovado: "Aprovada",
      pendente: "Aguardando verificação",
      rejeitado: "Rejeitada",
      nao_enviada: "Envio pendente",
    }) as Record<string, string>
  )[status || "nao_enviada"] || "Envio pendente";
export function authFields(
  email: string,
  password: string,
  signup = false,
  name = "",
): string {
  if (!email.trim() || !password) return "Preencha seu e-mail e sua senha.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return "Digite um endereço de e-mail válido.";
  if (signup && name.trim().length < 3) return "Informe seu nome completo.";
  // Política de senha do cadastro: 8+ caracteres, com letras e números.
  if (
    signup &&
    (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password))
  )
    return "A senha não atende aos requisitos mínimos de segurança: use 8 ou mais caracteres, com letras e números.";
  return "";
}
export const homeTab = (_role: string, pending = false) =>
  pending ? "Perfil" : "Início";
export const bookingFilters = [
  "Todas",
  "Códigos disponíveis",
  "Pendentes",
  "Aguardando pagamento",
  "Confirmadas",
  "Concluídas",
  "Canceladas",
  "Faltas",
  "Em disputa",
];
export function matchesBooking(
  b: {
    status: string;
    disputeOpen?: boolean;
    paid?: boolean;
    start?: number;
    startCodeRequired?: boolean;
    startConfirmation?: { status: string; expiresAt: number };
  },
  filter: string,
  now?: number,
): boolean {
  if (filter === "Todas") return true;
  if (filter === "Códigos disponíveis")
    return !!(
      now !== undefined &&
      b.start !== undefined &&
      b.paid &&
      b.status === "confirmado" &&
      b.startCodeRequired &&
      b.startConfirmation?.status === "disponivel" &&
      now >= b.start &&
      now <= Math.min(b.startConfirmation.expiresAt, b.start + 10 * 60000)
    );
  if (filter === "Em disputa") return !!b.disputeOpen;
  if (filter === "Faltas") return b.status.startsWith("falta_");
  return (
    b.status ===
    (
      {
        Pendentes: "solicitado",
        "Aguardando pagamento": "aguardando_pagamento",
        Confirmadas: "confirmado",
        Concluídas: "concluido",
        Canceladas: "cancelado",
      } as Record<string, string>
    )[filter]
  );
}
export function canReviewPeer(
  b: {
    student: string;
    instructor: string;
    status: string;
    paid: boolean;
    start: number;
    duration: number;
    ratings?: Record<string, number>;
  },
  viewer: string,
  peer: string,
  now: number,
): boolean {
  return (
    viewer !== peer &&
    ((b.student === viewer && b.instructor === peer) ||
      (b.instructor === viewer && b.student === peer)) &&
    b.status === "concluido" &&
    b.paid &&
    now >= b.start + b.duration * 60000 &&
    !b.ratings?.[viewer]
  );
}
export function instructorList<
  T extends {
    role: string;
    eligible?: boolean;
    featured?: boolean;
    id: string;
    name: string;
    region?: string;
  },
>(users: T[], mode: string, query: string, favorites: string[] = []): T[] {
  const all = users.filter(
    (u) => u.role === "instrutor" && u.eligible === true,
  );
  const featured = all.filter((u) => u.featured);
  return (mode === "avulsas" && featured.length ? featured : all).filter(
    (u) =>
      (mode !== "favoritos" || favorites.includes(u.id)) &&
      (u.name + " " + (u.region || ""))
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
}
type DashboardBooking = {
  id: string;
  instructor: string;
  status: string;
  paid: boolean;
  start: number;
  duration: number;
  price: number;
  commission: number;
  refund?: number;
};
const brasiliaDay = (ms: number) =>
  new Date(ms - 3 * 3600000).toISOString().slice(0, 10);
// Métricas do painel do instrutor; valores em centavos.
export function instructorDashboard<T extends DashboardBooking>(
  bookings: T[],
  uid: string,
  now: number,
) {
  const mine = bookings.filter((b) => b.instructor === uid);
  const end = (b: T) => b.start + b.duration * 60000;
  const net = (b: T) => b.price - b.commission;
  const upcoming = mine
    .filter((b) => b.status === "confirmado" && end(b) > now)
    .sort((a, b) => a.start - b.start);
  const completed = mine.filter((b) => b.status === "concluido" && b.paid);
  const finished = [
    "concluido",
    "cancelado",
    "falta_aluno",
    "falta_instrutor",
  ];
  return {
    today: upcoming.filter((b) => brasiliaDay(b.start) === brasiliaDay(now))
      .length,
    week: upcoming.filter((b) => b.start < now + 7 * 86400000).length,
    requests: mine.filter((b) => b.status === "solicitado").length,
    awaitingPayment: mine.filter((b) => b.status === "aguardando_pagamento")
      .length,
    toComplete: mine.filter(
      (b) => b.status === "confirmado" && b.paid && end(b) <= now,
    ).length,
    completed: completed.length,
    hours: completed.reduce((n, b) => n + b.duration, 0) / 60,
    earned: completed.reduce(
      (n, b) => n + Math.max(0, net(b) - (b.refund || 0)),
      0,
    ),
    forecast: upcoming.filter((b) => b.paid).reduce((n, b) => n + net(b), 0),
    upcoming,
    // Pelo status, não pela data: aula cancelada com antecedência também é histórico.
    history: mine
      .filter((b) => finished.includes(b.status))
      .sort((a, b) => b.start - a.start)
      .slice(0, 5),
  };
}
// Mensagem de erro para o usuário final. O servidor só envia texto de negócio
// (failed-precondition, permission-denied, unauthenticated) ou uma mensagem
// genérica (internal); qualquer outro erro, como falha de rede, vira um aviso
// neutro, sem códigos ou rastros técnicos.
export function friendlyError(error: unknown): string {
  const { code = "", message = "" } = (error || {}) as {
    code?: string;
    message?: string;
  };
  const kind = code.replace(/^functions\//, "");
  // O SDK/emulador pode anexar o status HTTP ("... [400]"): o usuário não vê códigos técnicos.
  const text = message.replace(/\s*\[\d{3}\]\s*$/, "").trim();
  if (
    ["failed-precondition", "permission-denied", "unauthenticated", "internal"].includes(kind) &&
    text.length > 12 &&
    !/firebase|error|exception|undefined|null|fetch/i.test(text)
  )
    return text;
  return "Não foi possível concluir agora. Confira sua conexão e tente novamente.";
}
const clock = (ms: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ms);
const STATUS_LABELS: Record<string, string> = {
  solicitado: "Solicitação enviada",
  aguardando_pagamento: "Aguardando pagamento",
  confirmado: "Aula confirmada",
  cancelado: "Cancelada",
  concluido: "Concluída",
  falta_aluno: "Falta do aluno",
  falta_instrutor: "Falta do instrutor",
};
// Motivos gravados pelo servidor (functions/domain.js, CANCEL_REASONS).
const CANCEL_LABELS: Record<string, string> = {
  instructor_timeout: "Cancelada: prazo de resposta do instrutor expirado",
  payment_timeout: "Cancelada: pagamento não efetuado no prazo",
  instructor: "Cancelada pelo instrutor",
  student: "Cancelada pelo aluno",
};
export type StatusTone = "primary" | "success" | "warning" | "danger" | "neutral";
// Selo de situação da aula, com o motivo do cancelamento e o estado "Em andamento".
export function bookingStatus(
  b: {
    status: string;
    start: number;
    duration: number;
    instructor?: string;
    cancelledBy?: string;
    cancelReason?: string;
    inProgress?: boolean;
  },
  now: number,
): { title: string; tone: StatusTone } {
  if (b.status === "cancelado") {
    // Reservas antigas não têm cancelReason: o motivo vem de quem cancelou.
    const reason =
      b.cancelReason ||
      (b.cancelledBy ? (b.cancelledBy === b.instructor ? "instructor" : "student") : "");
    return {
      title: CANCEL_LABELS[reason] || "Cancelada",
      tone: reason.endsWith("_timeout") ? "neutral" : "danger",
    };
  }
  if (b.status === "confirmado" && b.inProgress)
    return {
      title: `Em andamento · até ${clock(b.start + b.duration * 60000)}`,
      tone: "primary",
    };
  // O servidor encerra no próximo acesso; até lá a tela já não oferece ações vencidas.
  if (["solicitado", "aguardando_pagamento"].includes(b.status) && now >= b.start)
    return { title: "Prazo encerrado", tone: "neutral" };
  return {
    title: STATUS_LABELS[b.status] || b.status,
    tone: ["confirmado", "concluido"].includes(b.status)
      ? "success"
      : b.status.startsWith("falta")
        ? "danger"
        : "warning",
  };
}
// Horário que ainda aceita ação de aceite/pagamento (antes do início da aula).
export const actionable = (b: { start: number }, now: number) => now < b.start;
const dayKey = (ms: number) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10);
// Gaveta de notificações: a partir da meia-noite (Brasília), as lidas de dias
// anteriores saem da lista principal; as não lidas continuam até serem vistas.
export function visibleNotifications<T extends { at: number; readAt: number | null }>(
  list: T[],
  now: number,
): { current: T[]; archived: T[] } {
  const today = dayKey(now);
  const sorted = [...list].sort((a, b) => b.at - a.at);
  return {
    current: sorted.filter((n) => !n.readAt || dayKey(n.at) === today),
    archived: sorted.filter((n) => n.readAt && dayKey(n.at) !== today),
  };
}
// ---------------------------------------------------------------------------
// Calendário de disponibilidade do instrutor.
// Mantém o formato salvo no servidor: grade semanal (periods) + datas de folga
// (blocks, "AAAA-MM-DD"). Datas sempre no calendário de Brasília.
// ---------------------------------------------------------------------------
export type CalendarDay = {
  date: string; // AAAA-MM-DD
  day: number;
  weekday: number; // 0 = domingo
  inMonth: boolean;
  past: boolean;
  workday: boolean; // a grade semanal tem horário neste dia da semana
  blocked: boolean; // folga marcada
  lessons: number; // aulas ativas marcadas no dia
};
// Grade de 6 semanas (domingo a sábado) do mês, com o estado de cada dia.
export function availabilityMonth(
  year: number,
  month0: number,
  ctx: {
    periods: { day: number }[];
    blocks: string[];
    bookings: { start: number; status: string }[];
    now: number;
  },
): CalendarDay[] {
  const today = dayKey(ctx.now);
  const blocked = new Set(ctx.blocks);
  const workdays = new Set(ctx.periods.map((p) => p.day));
  const lessons: Record<string, number> = {};
  for (const b of ctx.bookings)
    if (["solicitado", "aguardando_pagamento", "confirmado"].includes(b.status))
      lessons[dayKey(b.start)] = (lessons[dayKey(b.start)] || 0) + 1;
  const firstWeekday = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(Date.UTC(year, month0, 1 - firstWeekday + i));
    const date = d.toISOString().slice(0, 10);
    return {
      date,
      day: d.getUTCDate(),
      weekday: d.getUTCDay(),
      inMonth: d.getUTCMonth() === month0,
      past: date < today,
      workday: workdays.has(d.getUTCDay()),
      blocked: blocked.has(date),
      lessons: lessons[date] || 0,
    };
  });
}
// Alterna a folga de um dia, mantendo a lista ordenada e sem datas passadas.
export function toggleBlock(blocks: string[], date: string, now: number): string[] {
  const today = dayKey(now);
  const set = new Set(blocks.filter((d) => d >= today));
  if (set.has(date)) set.delete(date);
  else set.add(date);
  return [...set].sort();
}
// Mês corrente em Brasília, para abrir o calendário no mês certo.
export function currentMonth(now: number) {
  const [y, m] = dayKey(now).split("-").map(Number);
  return { year: y, month0: m - 1 };
}
// Folgas de hoje em diante (as passadas não afetam reservas e não precisam ser salvas).
export const futureBlocks = (blocks: string[], now: number) =>
  blocks.filter((d) => d >= dayKey(now)).sort();

// ---- RENACH e validade (cadastro e credencial do instrutor) ----
// RENACH: sigla da UF + 9 dígitos (ex.: RJ123456789). Mesmo formato validado
// no servidor (functions/domain.js, RENACH_PATTERN).
const UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");
export function formatRenach(input: string) {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const uf = raw.replace(/[^A-Z]/g, "").slice(0, 2);
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  return uf + digits;
}
export function renachError(value: string) {
  if (!/^[A-Z]{2}\d{9}$/.test(value))
    return "Informe o RENACH: sigla da UF e 9 dígitos (ex.: RJ123456789).";
  if (!UFS.includes(value.slice(0, 2))) return "Sigla de UF inválida no RENACH.";
  return "";
}
// Validade digitada como DD/MM/AAAA, com barras inseridas durante a digitação.
export function formatDateBR(input: string) {
  const d = input.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/");
}
// Fim do dia em Brasília (UTC−03), igual ao formato salvo antes (credentialExpires em ms).
export function parseDateBR(value: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!m) return NaN;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day)
    return NaN;
  return Date.UTC(year, month - 1, day, 23, 59, 59) + 3 * 3600000;
}
export function toDateBR(ms?: number) {
  if (!ms) return "";
  const [y, m, d] = dayKey(ms).split("-");
  return `${d}/${m}/${y}`;
}

// ---- Pendências da administração (gaveta de notificações do admin) ----
// Derivadas do estado: aparecem assim que o servidor registra o envio e somem
// quando a análise é decidida. Não dependem de o usuário ter "lido" algo.
export type AdminPending = { id: string; title: string; at: number; tab: "Início" | "Ocorrências" };
export function adminPending(state: {
  users: Record<string, { id: string; name: string; role: string; approval?: string; credential?: string; identity?: { status: string; submittedAt?: number } }>;
  tickets: Record<string, { id: string; kind: string; status: string; at?: number; owner: string }>;
}): AdminPending[] {
  const items: AdminPending[] = [];
  for (const u of Object.values(state.users)) {
    if (u.identity?.status === "pendente")
      items.push({ id: `identity:${u.id}`, title: `Identidade · ${u.name}: aguardando verificação`, at: u.identity.submittedAt || 0, tab: "Início" });
    if (u.role === "instrutor" && u.approval === "pendente" && u.credential)
      items.push({ id: `credential:${u.id}`, title: `Credenciamento · ${u.name}: aguardando análise`, at: 0, tab: "Início" });
  }
  for (const t of Object.values(state.tickets))
    if (t.status === "aberto")
      items.push({
        id: `ticket:${t.id}`,
        title: `${t.kind === "disputa" ? "Contestação" : "Suporte"} · ${state.users[t.owner]?.name || "usuário"}: aberto`,
        at: t.at || 0,
        tab: "Ocorrências",
      });
  return items.sort((a, b) => b.at - a.at);
}

// Conclusão de aula pelo instrutor: espelha a regra do servidor ("complete").
export function completionBlock(
  b: { start: number; duration: number; paid?: boolean },
  now: number,
) {
  if (!b.paid) return "Esta aula só pode ser finalizada após a confirmação do pagamento.";
  const end = b.start + b.duration * 60000;
  if (now < end)
    return `Esta aula só pode ser finalizada após o término do horário estipulado (${clock(end)}).`;
  return "";
}
