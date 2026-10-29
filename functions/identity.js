"use strict";
const { UserError } = require("./errors");
const check = (v, message) => {
  if (!v) throw new UserError(message);
};
const verified = (u) =>
  u?.role === "admin" || u?.identity?.status === "aprovado";
function notify(s, uid, id, title, now) {
  s.notifications[id] = {
    id,
    recipient: uid,
    event: "identity",
    title,
    at: now,
    readAt: null,
  };
}
function identityOperation(s, actor, op, input, now, id, trusted) {
  const me = s.users[actor.uid];
  if (op === "setPhoto" || op === "submitIdentity") {
    const kind = op === "setPhoto" ? "profilePhotos" : "identityDocuments";
    check(
      trusted.media?.path === input.path && trusted.media?.kind === kind,
      "Imagem não validada pelo servidor. Selecione e envie novamente.",
    );
    if (op === "setPhoto") {
      me.photoPath = trusted.media.path;
      // Uma imagem substituída exige nova comparação, sem remover a anterior antes do envio.
      if (me.identity?.documentPath)
        me.identity = {
          status: "pendente",
          documentPath: me.identity.documentPath,
          photoPath: me.photoPath,
          submittedAt: now,
        };
    } else {
      check(
        me.photoPath,
        "Adicione sua foto de perfil antes de enviar o documento.",
      );
      me.identity = {
        status: "pendente",
        documentPath: trusted.media.path,
        photoPath: me.photoPath,
        submittedAt: now,
      };
    }
    return true;
  }
  if (op === "removePhoto") {
    check(
      !Object.values(s.bookings).some(
        (b) =>
          [b.student, b.instructor].includes(actor.uid) &&
          ["solicitado", "aguardando_pagamento", "confirmado"].includes(
            b.status,
          ) &&
          b.start + b.duration * 60000 > now,
      ),
      "Você possui aulas ativas. Substitua sua foto por outra imagem válida.",
    );
    me.photoPath = null;
    me.identity = { status: "nao_enviada" };
    return true;
  }
  if (op === "reviewIdentity") {
    check(actor.admin === true, "Acesso exclusivo da administração.");
    const u = s.users[input.user];
    check(u?.identity?.status === "pendente", "Verificação não está pendente.");
    check(
      input.documentPath === u.identity.documentPath &&
        input.photoPath === u.identity.photoPath,
      "Solicitação alterada; atualize e confira as imagens novamente.",
    );
    check(
      ["aprovado", "rejeitado"].includes(input.decision) &&
        String(input.reason || "").trim().length >= 5,
      "Informe decisão e parecer da análise manual.",
    );
    check(
      u.photoPath && u.photoPath === u.identity.photoPath,
      "Foto alterada; atualize a análise.",
    );
    u.identity = {
      ...u.identity,
      status: input.decision,
      reason: String(input.reason).trim().slice(0, 2000),
      reviewedBy: actor.uid,
      reviewedAt: now,
    };
    s.identityAudit ||= [];
    s.identityAudit.push({ id, user: u.id, ...u.identity });
    notify(
      s,
      u.id,
      id + "_identity",
      input.decision === "aprovado"
        ? "Verificação de identidade aprovada"
        : "Verificação de identidade não aprovada: confira o parecer no Perfil",
      now,
    );
    return true;
  }
  return false;
}
function assertOperational(me, actor, op) {
  if (actor.admin || verified(me)) return;
  check(
    [
      "profile",
      "setPhoto",
      "removePhoto",
      "submitIdentity",
      "credential",
      "support",
      "readNotification",
      "cancel",
      "dispute",
    ].includes(op),
    "Seu cadastro está aguardando análise. Acesse a verificação de identidade no Perfil.",
  );
}
module.exports = { verified, identityOperation, assertOperational };
