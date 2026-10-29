"use strict";
// Erro de regra de negócio: a mensagem foi escrita para o usuário final e pode ir
// para a tela. Qualquer outro erro é tratado como falha interna e nunca é exibido.
class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = "UserError";
  }
}
module.exports = { UserError };
