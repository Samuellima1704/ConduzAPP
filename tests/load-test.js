// Teste de carga (k6) da Cloud Function `conduz` nos emuladores locais.
//
// O ConduzAPP tem uma única Function callable; cada ação do app é uma operação
// ({ op, input }) enviada a ela com o token do usuário. A carga reproduz o uso
// real: a maior parte é a consulta de estado que o app faz a cada 10 s, com uma
// fração de escritas (favoritar instrutor e enviar mensagem).
//
// Pré-requisitos: app rodando (Iniciar-ConduzAPP.ps1) e cenário isolado criado
// com `node scripts/cenario-carga.cjs`. Execução: scripts/Teste-Carga.ps1.
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const cenario = JSON.parse(open("../.tools/k6-cenario.json"));
const FUNCTION_URL =
  __ENV.FUNCTION_URL || "http://127.0.0.1:5001/demo-conduzapp/us-central1/conduz";
const AUTH_URL =
  "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-conduzapp-key";

// Tempo por operação, para separar leitura e escrita no relatório.
const opDuration = {
  state: new Trend("op_state_ms", true),
  favorite: new Trend("op_favorite_ms", true),
  message: new Trend("op_message_ms", true),
};

export const options = {
  scenarios: {
    rampa: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 }, // aquecimento
        { duration: "1m", target: 25 }, // carga normal
        { duration: "1m", target: 50 }, // pico
        { duration: "30s", target: 0 }, // desaceleração
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<1000"], // 95% das respostas abaixo de 1 s
    http_req_failed: ["rate<0.01"], // menos de 1% de falhas
    checks: ["rate>0.99"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "max"],
};

// Uma vez por execução: autentica todos os alunos do cenário no Auth emulator.
export function setup() {
  const tokens = cenario.students.map((s) => {
    const r = http.post(
      AUTH_URL,
      JSON.stringify({ email: s.email, password: cenario.password, returnSecureToken: true }),
      { headers: { "Content-Type": "application/json" }, tags: { name: "login" } },
    );
    if (r.status !== 200) throw new Error(`Login falhou para ${s.email}: ${r.status}`);
    return { uid: s.uid, token: r.json("idToken") };
  });
  return { tokens, instructors: cenario.instructors.map((i) => i.uid) };
}

function call(token, op, input) {
  const r = http.post(FUNCTION_URL, JSON.stringify({ data: { op, input } }), {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    tags: { name: op },
  });
  opDuration[op].add(r.timings.duration);
  check(r, {
    [`${op}: status 200`]: (res) => res.status === 200,
    [`${op}: resposta válida`]: (res) => !!res.json("result.me"),
  });
  return r;
}

export default function (data) {
  const me = data.tokens[(__VU - 1) % data.tokens.length];
  const instructor = data.instructors[__ITER % data.instructors.length];
  const sorteio = Math.random();
  if (sorteio < 0.85) call(me.token, "state", {});
  else if (sorteio < 0.95) call(me.token, "favorite", { instructor });
  else
    call(me.token, "message", {
      to: instructor,
      text: "Olá! Gostaria de agendar uma aula.",
      requestId: `k6-${__VU}-${__ITER}-${Date.now()}`,
    });
  sleep(1 + Math.random()); // intervalo de um usuário real entre ações
}
