"use strict";
const { runtimeConfig, authorizeRuntime } = require("./runtime");
const runtime = runtimeConfig();
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { randomUUID } = require("node:crypto");
const { execute, empty } = require("./domain");
const { statePath, effectiveNow } = require("./state-scope");
const { UserError } = require("./errors");
const { createStateCache, createWriteQueue } = require("./state-cache");
const stateCache = createStateCache(2000);
const serialized = createWriteQueue();
let database;
function getDatabase() {
  if (!database) {
    const { initializeApp, getApps } = require("firebase-admin/app");
    const { getFirestore } = require("firebase-admin/firestore");
    if (!getApps().length)
      initializeApp({
        projectId: runtime.projectId,
        storageBucket: runtime.storageBucket,
      });
    database = runtime.emulator
      ? require("./emulator-db").configureEmulatorFirestore(getFirestore())
      : getFirestore();
  }
  return database;
}
exports.conduz = onCall(
  {
    cors: true,
    timeoutSeconds: 60,
    region: "us-central1",
    minInstances: 0,
    maxInstances: 1,
    concurrency: 10,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Entre na sua conta.");
    try {
      authorizeRuntime(runtime, request.auth);
    } catch (error) {
      throw new HttpsError("permission-denied", error.message);
    }
    const actor = {
      uid: request.auth.uid,
      admin: request.auth.token.admin === true,
    };
    const { op, input } = request.data || {};
    const id = randomUUID();
    const db = getDatabase();
    try {
      const path = statePath(request.auth.token);
      const scope = path.split("/")[1];
      const trusted = {};
      const run = (state, realNow) =>
        execute(
          state,
          actor,
          op,
          input,
          effectiveNow(state, request.auth.token, realNow, true, runtime.emulator),
          id,
          {
            ...trusted,
            realNow,
            emulator: runtime.emulator,
            cloudDemo: !runtime.emulator,
            demoScope: scope,
          },
        );
      // Leitura pura (polling do app): sem transação, com cache curto.
      if (op === "state") {
        let state = stateCache.get(path);
        if (!state) {
          state = (await db.doc(path).get()).data() || empty();
          stateCache.set(path, state);
        }
        const result = run(state, Date.now());
        // Só segue para a transação se a leitura precisar gravar (ex.: código de início disponível).
        if (!result.write) return result.result;
      }
      if (["setPhoto", "submitIdentity"].includes(op)) {
        const { getStorage } = require("firebase-admin/storage");
        trusted.media = await require("./media").validateMedia(
          getStorage().bucket(runtime.storageBucket),
          actor.uid,
          scope,
          op,
          input?.path,
        );
      }
      // Escrita com concorrência otimista: lê sem trava e grava só se o documento
      // não mudou desde a leitura (lastUpdateTime). Se outra escrita chegou antes,
      // relê e recalcula a operação. Sem trava, não há deadlock sob carga.
      return await serialized(path, async () => {
        const ref = db.doc(path);
        for (let attempt = 1; ; attempt++) {
          const snap = await ref.get();
          const state = snap.data() || empty();
          const result = run(state, Date.now());
          if (!result.write) return result.result;
          const batch = db.batch();
          if (snap.exists)
            batch.update(ref, result.state, { lastUpdateTime: snap.updateTime });
          else batch.create(ref, result.state);
          // Sinal de tempo real: só um número de versão, sem dados. O app escuta este
          // documento (onSnapshot) e então busca o estado pela Function, que filtra o que
          // cada usuário pode ver. As regras liberam a leitura apenas deste documento.
          batch.set(db.doc(`signals/${scope}`), { version: Date.now() });
          // Vínculo usado pelas regras do Storage: grava só reservas novas ou alteradas.
          for (const b of Object.values(result.state.bookings)) {
            const before = state.bookings?.[b.id];
            if (
              before &&
              before.student === b.student &&
              before.instructor === b.instructor &&
              !!before.disputeOpen === !!b.disputeOpen
            )
              continue;
            batch.set(db.doc(`bookingAccess/${b.id}`), {
              student: b.student,
              instructor: b.instructor,
              disputeOpen: !!b.disputeOpen,
              scope,
            });
          }
          try {
            await batch.commit();
          } catch (error) {
            // 9 = alterado por outra escrita; 6 = criado em paralelo; 10 = abortado.
            // No modo REST o conflito de versão chega como texto ("stored version ... base version").
            const conflict =
              [6, 9, 10].includes(error?.code) ||
              /precondition|already exists|aborted|stored version|base version/i.test(
                String(error?.message),
              );
            if (conflict && attempt < 10) {
              await new Promise((r) => setTimeout(r, 5 + Math.random() * 20 * attempt));
              continue;
            }
            throw error;
          }
          // Write-through: o cache reflete a escrita assim que ela é confirmada.
          stateCache.set(path, result.state);
          return result.result;
        }
      });
    } catch (error) {
      // Regra de negócio: a mensagem foi escrita para o usuário.
      if (error instanceof UserError)
        throw new HttpsError("failed-precondition", error.message);
      // Falha interna: detalhes só no log do servidor, nunca na tela.
      console.error("conduz: falha interna", { op, id, error });
      throw new HttpsError(
        "internal",
        "Não foi possível concluir a operação agora. Tente novamente em instantes.",
      );
    }
  },
);
