"use strict";
const { runtimeConfig, authorizeRuntime } = require("./runtime");
const runtime = runtimeConfig();
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { randomUUID } = require("node:crypto");
const { execute, empty } = require("./domain");
const { statePath, effectiveNow } = require("./state-scope");
const { UserError } = require("./errors");
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
      const scope = statePath(request.auth.token).split("/")[1];
      const trusted = {};
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
      return await db.runTransaction(async (tx) => {
        const ref = db.doc(statePath(request.auth.token));
        const snap = await tx.get(ref);
        const state = snap.data() || empty(),
          realNow = Date.now();
        const result = execute(
          state,
          actor,
          op,
          input,
          effectiveNow(
            state,
            request.auth.token,
            realNow,
            true,
            runtime.emulator,
          ),
          id,
          {
            ...trusted,
            realNow,
            emulator: runtime.emulator,
            cloudDemo: !runtime.emulator,
            demoScope: scope,
          },
        );
        if (result.write) {
          tx.set(ref, result.state);
          for (const b of Object.values(result.state.bookings)) {
            tx.set(db.doc(`bookingAccess/${b.id}`), {
              student: b.student,
              instructor: b.instructor,
              disputeOpen: !!b.disputeOpen,
              scope,
            });
          }
        }
        return result.result;
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
