"use strict";
const { UserError } = require("./errors");
function address(input) {
  if (!input || typeof input !== "object")
    throw new UserError("Informe rua, número, bairro, cidade e UF. CEP é opcional.");
  const out = {};
  for (const [key, max] of [
    ["street", 120],
    ["number", 20],
    ["neighborhood", 100],
    ["city", 100],
    ["uf", 2],
  ]) {
    out[key] = String(input[key] || "").trim();
    if (!out[key] || out[key].length > max)
      throw new UserError("Informe rua, número, bairro, cidade e UF válidos.");
  }
  out.uf = out.uf.toUpperCase();
  if (
    !"AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO"
      .split(" ")
      .includes(out.uf)
  )
    throw new UserError("UF inválida.");
  const raw = String(input.cep || "").trim();
  if (raw && !/^\d{5}-?\d{3}$/.test(raw))
    throw new UserError("CEP deve ter oito dígitos ou ficar vazio.");
  out.cep = raw.replace(/\D/g, "");
  return out;
}
const formatAddress = (a) =>
  `${a.street}, ${a.number} · ${a.neighborhood} · ${a.city}/${a.uf}${a.cep ? " · CEP " + a.cep : ""}`;
module.exports = { address, formatAddress };
