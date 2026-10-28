"use strict";
// A claim é emitida apenas pelo Admin SDK, nunca pelo formulário.
// Testes e ensaios usam documentos próprios e preservam private/state.
function statePath(token = {}) {
  if (token.stateScope === undefined) return "private/state";
  if (!/^(test|demo)-[a-zA-Z0-9-]{1,80}$/.test(token.stateScope))
    throw new Error("Ambiente isolado inválido.");
  return `private/${token.stateScope}`;
}
function effectiveNow(
  state,
  token,
  realNow,
  demoClockAllowed = process.env.FUNCTIONS_EMULATOR === "true",
  local = false,
) {
  const scope = token?.stateScope;
  // No ambiente local o relógio de ensaio vale também para a base real (private/state).
  const scopeAllowed = local
    ? state.demo?.scope === (scope ?? "state")
    : /^demo-[a-zA-Z0-9-]{1,80}$/.test(scope || "") &&
      state.demo?.scope === scope;
  return demoClockAllowed &&
    scopeAllowed &&
    Number.isFinite(state.demo.clockOffset) &&
    Math.abs(state.demo.clockOffset) <= 7 * 86400000
    ? realNow + state.demo.clockOffset
    : realNow;
}
module.exports = { statePath, effectiveNow };
