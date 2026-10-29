"use strict";
// Carga de dados de teste para a apresentação: 5 alunos e 5 instrutores fictícios,
// gravados na base local persistente (private/state) dos emuladores.
//
// - Cada conta recebe foto e documento de teste no Storage (imagens geradas aqui,
//   com a marca "DOCUMENTO DE TESTE — SEM VALOR LEGAL").
// - 4 alunos e 4 instrutores já entram aprovados; 1 de cada fica AGUARDANDO
//   ANÁLISE, para demonstrar a aprovação no painel do admin.
// - Cada aluno aprovado tem 1 aula de 50 minutos já concluída (ontem), pronta
//   para o aluno avaliar o instrutor e o instrutor, opcionalmente, avaliar o aluno.
// - Nomes e CPFs são fictícios; os CPFs têm dígitos verificadores válidos.
//
// Uso (com o app rodando):
//   node scripts/carga-teste.cjs            cria as contas (recusa se já existirem)
//   node scripts/carga-teste.cjs --limpar   remove as contas, aulas e arquivos da carga
// E-mails e senhas: docs/CONTAS_DE_TESTE.md
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
const path = require("node:path");
const adminRequire = require("node:module").createRequire(
  path.resolve(__dirname, "../functions/package.json"),
);
const { initializeApp } = adminRequire("firebase-admin/app");
const { getAuth } = adminRequire("firebase-admin/auth");
const { getFirestore } = adminRequire("firebase-admin/firestore");
const { getStorage } = adminRequire("firebase-admin/storage");
const sharp = adminRequire("sharp");
const { empty, HOUR, DAY, LESSON_MIN, COMMISSION_PERCENT } = require("../functions/domain");

const BUCKET = "demo-conduzapp.appspot.com";
initializeApp({ projectId: "demo-conduzapp", storageBucket: BUCKET });
const db = require("../functions/emulator-db").configureEmulatorFirestore(getFirestore());

// Disponibilidade semanal: dia 0 = domingo. Horários em hora cheia (Brasília).
const week = (days, ...ranges) => days.flatMap((day) => ranges.map(([from, to]) => ({ day, from, to })));
const ALUNOS = [
  { key: "a1", name: "Ana Beatriz Souza", email: "ana.souza@conduzapp.local", password: "AlunoTeste1!", cpf: "529.982.247-25", region: "Aterrado · Volta Redonda", aprovado: true },
  { key: "a2", name: "Lucas Oliveira Santos", email: "lucas.santos@conduzapp.local", password: "AlunoTeste2!", cpf: "153.509.460-56", region: "Vila Santa Cecília · Volta Redonda", aprovado: true },
  { key: "a3", name: "Mariana Costa Lima", email: "mariana.lima@conduzapp.local", password: "AlunoTeste3!", cpf: "714.602.380-01", region: "Retiro · Volta Redonda", aprovado: true },
  { key: "a4", name: "Pedro Henrique Almeida", email: "pedro.almeida@conduzapp.local", password: "AlunoTeste4!", cpf: "286.435.901-42", region: "Jardim Amália · Volta Redonda", aprovado: true },
  { key: "a5", name: "Juliana Ferreira Rocha", email: "juliana.rocha@conduzapp.local", password: "AlunoTeste5!", cpf: "901.837.425-32", region: "Centro · Barra Mansa", aprovado: false },
];
const INSTRUTORES = [
  { key: "i1", name: "Carlos Eduardo Pereira", email: "carlos.pereira@conduzapp.local", password: "InstrutorTeste1!", cpf: "438.217.096-69", region: "Aterrado · Volta Redonda", car: "Volkswagen Gol 1.0 2021", transmission: "Manual", price: 7000, specialty: "Primeira habilitação", bio: "Instrutor há 12 anos, paciente com quem está começando.", credential: "AUT-RJ-2026-0141", periods: week([1, 2, 3, 4, 5], [8, 12], [14, 18]), aprovado: true },
  { key: "i2", name: "Fernanda Ribeiro Martins", email: "fernanda.martins@conduzapp.local", password: "InstrutorTeste2!", cpf: "672.049.318-31", region: "Vila Santa Cecília · Volta Redonda", car: "Hyundai HB20 1.0 Automático 2023", transmission: "Automático", price: 9500, specialty: "Câmbio automático e ansiedade ao volante", bio: "Especialista em alunos com medo de dirigir.", credential: "AUT-RJ-2026-0275", periods: week([1, 2, 3, 4, 5, 6], [7, 11]), aprovado: true },
  { key: "i3", name: "Roberto Silveira", email: "roberto.silveira@conduzapp.local", password: "InstrutorTeste3!", cpf: "345.781.902-50", region: "Retiro · Volta Redonda", car: "Fiat Argo 1.3 2022", transmission: "Manual", price: 8000, specialty: "Baliza e rampa", bio: "Credenciado há 15 anos; foco em exame prático.", credential: "AUT-RJ-2026-0388", periods: week([1, 3, 5], [8, 12], [13, 17]), aprovado: true },
  { key: "i4", name: "Patrícia Gomes Barbosa", email: "patricia.barbosa@conduzapp.local", password: "InstrutorTeste4!", cpf: "860.294.157-94", region: "Jardim Amália · Volta Redonda", car: "Toyota Yaris 1.5 CVT 2022", transmission: "Automático", price: 8500, specialty: "Trânsito urbano e rodovia", bio: "Aulas práticas em rodovia e horários noturnos.", credential: "AUT-RJ-2026-0452", periods: week([2, 4, 6], [9, 12], [18, 21]), aprovado: true },
  { key: "i5", name: "Marcos Vinícius Teixeira", email: "marcos.teixeira@conduzapp.local", password: "InstrutorTeste5!", cpf: "197.653.048-20", region: "Centro · Barra Mansa", car: "Chevrolet Onix 1.0 2020", transmission: "Manual", price: 7500, specialty: "Reforço para habilitados", bio: "Para quem já tem CNH e quer voltar a dirigir.", credential: "AUT-RJ-2026-0519", periods: week([1, 2, 3, 4, 5], [10, 16]), aprovado: false },
];
const COLORS = ["#2457D6", "#0E8A6A", "#B5476B", "#8A5A00", "#5B3FC4", "#1F7A99", "#B03A2E", "#4E7A27", "#7A4E99", "#2E5E8A"];
const initials = (name) => name.split(" ").filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join("");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Foto: avatar com iniciais. Documento: cartão com nome, CPF e a marca de teste.
async function photo(person, i) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480"><rect width="480" height="480" fill="${COLORS[i]}"/><text x="240" y="300" font-family="Arial" font-size="190" font-weight="bold" fill="#fff" text-anchor="middle">${initials(person.name)}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
async function documentImage(person, i) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560"><rect width="900" height="560" rx="24" fill="#EEF3EA"/><rect x="0" y="0" width="900" height="90" rx="24" fill="#2F6B3A"/><text x="40" y="58" font-family="Arial" font-size="32" font-weight="bold" fill="#fff">REPÚBLICA FICTÍCIA · IDENTIDADE DE TESTE</text><rect x="40" y="130" width="240" height="300" fill="${COLORS[i]}"/><text x="160" y="320" font-family="Arial" font-size="110" font-weight="bold" fill="#fff" text-anchor="middle">${initials(person.name)}</text><text x="320" y="170" font-family="Arial" font-size="22" fill="#555">NOME</text><text x="320" y="210" font-family="Arial" font-size="34" font-weight="bold" fill="#222">${esc(person.name)}</text><text x="320" y="270" font-family="Arial" font-size="22" fill="#555">CPF (FICTÍCIO)</text><text x="320" y="310" font-family="Arial" font-size="34" fill="#222">${person.cpf}</text><text x="320" y="370" font-family="Arial" font-size="22" fill="#555">NATURALIDADE</text><text x="320" y="410" font-family="Arial" font-size="30" fill="#222">Volta Redonda/RJ</text><text x="450" y="515" font-family="Arial" font-size="28" font-weight="bold" fill="#B03A2E" text-anchor="middle">DOCUMENTO DE TESTE — SEM VALOR LEGAL</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function load() {
  const everyone = [...ALUNOS, ...INSTRUTORES];
  for (const p of everyone) {
    const exists = await getAuth().getUserByEmail(p.email).then(() => true, () => false);
    if (exists) throw new Error(`${p.email} já existe. Para recriar: node scripts/carga-teste.cjs --limpar`);
  }
  const bucket = getStorage().bucket(BUCKET);
  const now = Date.now();
  for (const [i, p] of everyone.entries()) {
    const u = await getAuth().createUser({ email: p.email, password: p.password, displayName: p.name });
    p.uid = u.uid;
    p.photoPath = `profilePhotos/state/${u.uid}/foto-perfil.png`;
    p.documentPath = `identityDocuments/state/${u.uid}/documento.png`;
    await bucket.file(p.photoPath).save(await photo(p, i), { metadata: { contentType: "image/png" } });
    await bucket.file(p.documentPath).save(await documentImage(p, i), { metadata: { contentType: "image/png" } });
  }
  const ref = db.doc("private/state");
  const bookings = [];
  await db.runTransaction(async (tx) => {
    const s = (await tx.get(ref)).data() || empty();
    s.notifications ||= {};
    const admin = Object.values(s.users).find((u) => u.role === "admin");
    const reviewer = admin?.id || "carga-de-teste";
    const identity = (p) =>
      p.aprovado
        ? { status: "aprovado", documentPath: p.documentPath, photoPath: p.photoPath, submittedAt: now - 3 * DAY, reason: "Documento conferido na carga de teste.", reviewedBy: reviewer, reviewedAt: now - 2 * DAY }
        : { status: "pendente", documentPath: p.documentPath, photoPath: p.photoPath, submittedAt: now - HOUR };
    for (const p of ALUNOS)
      s.users[p.uid] = { id: p.uid, name: p.name, role: "aluno", cpf: p.cpf, region: p.region, favorites: [], photoPath: p.photoPath, identity: identity(p) };
    for (const p of INSTRUTORES)
      s.users[p.uid] = {
        id: p.uid, name: p.name, role: "instrutor", cpf: p.cpf, region: p.region, price: p.price, car: p.car,
        transmission: p.transmission, bio: p.bio, specialty: p.specialty, credential: p.credential,
        credentialExpires: now + 365 * DAY, approval: p.aprovado ? "aprovado" : "pendente",
        ...(p.aprovado ? { approvalReason: "Credencial de teste conferida.", reviewedBy: reviewer } : {}),
        periods: p.periods, blocks: [], cancellations: 0, absences: 0, favorites: [], photoPath: p.photoPath, identity: identity(p),
      };
    // Uma aula concluída ontem para cada par aprovado (aluno N com instrutor N), aguardando avaliações.
    const midnight = Math.floor((now - 3 * HOUR) / DAY) * DAY + 3 * HOUR;
    ALUNOS.filter((a) => a.aprovado).forEach((a, n) => {
      const ins = INSTRUTORES[n];
      const start = midnight - DAY + (9 + n) * HOUR;
      const id = `carga-aula-${n + 1}`;
      s.bookings[id] = {
        id, student: a.uid, instructor: ins.uid, start, duration: LESSON_MIN, price: ins.price,
        commission: Math.round((ins.price * COMMISSION_PERCENT) / 100), status: "concluido", paid: true,
        paidAt: start - 2 * DAY, paymentMode: "simulado", createdAt: start - 3 * DAY, completedAt: start + LESSON_MIN * 60000,
        address: { cep: "27255-000", street: "Rua de Teste", number: String(100 + n), neighborhood: a.region.split(" · ")[0], city: "Volta Redonda", uf: "RJ" },
        location: `Rua de Teste, ${100 + n} · ${a.region.split(" · ")[0]} · Volta Redonda/RJ · CEP 27255000`,
        startCodeRequired: true,
        startConfirmation: { status: "confirmado", attempts: 0, availableAt: start, expiresAt: start + 10 * 60000, confirmedAt: start + 3 * 60000, confirmedBy: ins.uid },
        ratings: {}, payoutEligible: false,
      };
      const nid = `${id}_complete_${a.uid}`;
      s.notifications[nid] = { id: nid, recipient: a.uid, booking: id, event: "complete", title: "Aula concluída: avaliação disponível", at: start + LESSON_MIN * 60000, readAt: null };
      bookings.push(s.bookings[id]);
    });
    tx.set(ref, s);
  });
  for (const b of bookings)
    await db.doc(`bookingAccess/${b.id}`).set({ student: b.student, instructor: b.instructor, disputeOpen: false, scope: "state" });
  console.log(`Carga concluída: ${ALUNOS.length} alunos, ${INSTRUTORES.length} instrutores e ${bookings.length} aulas concluídas aguardando avaliação.`);
  console.log("Aguardando análise do admin: Juliana Ferreira Rocha (aluna) e Marcos Vinícius Teixeira (instrutor).");
  console.log("E-mails e senhas: docs/CONTAS_DE_TESTE.md");
}

async function remove() {
  const ids = [];
  for (const p of [...ALUNOS, ...INSTRUTORES]) {
    const u = await getAuth().getUserByEmail(p.email).catch(() => null);
    if (!u) continue;
    ids.push(u.uid);
    await getAuth().deleteUser(u.uid);
  }
  const ref = db.doc("private/state");
  const removed = [];
  await db.runTransaction(async (tx) => {
    const s = (await tx.get(ref)).data();
    if (!s) return;
    for (const id of ids) delete s.users[id];
    for (const b of Object.values(s.bookings))
      if (ids.includes(b.student) || ids.includes(b.instructor)) {
        removed.push(b.id);
        delete s.bookings[b.id];
      }
    for (const [k, r] of Object.entries(s.reviews)) if (ids.includes(r.from) || ids.includes(r.to)) delete s.reviews[k];
    for (const [k, n] of Object.entries(s.notifications || {})) if (ids.includes(n.recipient)) delete s.notifications[k];
    for (const [k, t] of Object.entries(s.tickets)) if (ids.includes(t.owner)) delete s.tickets[k];
    for (const [k, c] of Object.entries(s.conversations || {})) if (ids.includes(c.student) || ids.includes(c.instructor)) delete s.conversations[k];
    s.messages = s.messages.filter((m) => !ids.includes(m.from) && !ids.includes(m.to));
    s.audit = s.audit.filter((a) => !ids.includes(a.by));
    tx.set(ref, s);
  });
  for (const id of removed) await db.doc(`bookingAccess/${id}`).delete();
  const bucket = getStorage().bucket(BUCKET);
  for (const id of ids)
    for (const prefix of [`profilePhotos/state/${id}/`, `identityDocuments/state/${id}/`])
      await bucket.deleteFiles({ prefix }).catch(() => {});
  console.log(`Carga removida: ${ids.length} contas e ${removed.length} aulas.`);
}

(process.argv.includes("--limpar") ? remove() : load())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
