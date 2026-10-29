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
  if (
    ["failed-precondition", "permission-denied", "unauthenticated", "internal"].includes(kind) &&
    message.length > 12 &&
    !/firebase|error|exception|undefined|null|fetch/i.test(message)
  )
    return message;
  return "Não foi possível concluir agora. Confira sua conexão e tente novamente.";
}
