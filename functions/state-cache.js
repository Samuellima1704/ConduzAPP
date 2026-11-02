"use strict";
// Desempenho sob carga (medido com k6, tests/load-test.js).
//
// Todo o estado de um ambiente vive em um único documento. Sem estes dois
// mecanismos, cada chamada abria uma transação nele, e as chamadas concorrentes
// se bloqueavam até "Transaction lock timeout".
//
// 1. Cache de leitura: a consulta de estado (feita pelo app a cada 10 s) lê o
//    documento fora de transação e reaproveita a leitura por até `ttlMs`.
//    Toda escrita confirmada nesta instância atualiza o cache (write-through),
//    então quem escreveu sempre vê o próprio resultado. Escritas de outra
//    instância ou de scripts administrativos aparecem em no máximo `ttlMs`.
// 2. Fila de escrita: as escritas no mesmo documento rodam uma de cada vez
//    nesta instância (a Function usa maxInstances: 1). A consistência entre
//    processos vem da gravação condicional (lastUpdateTime) em index.js; a fila
//    apenas reduz as novas tentativas dentro do mesmo processo.
function createStateCache(ttlMs = 2000, clock = Date.now) {
  const entries = new Map();
  return {
    get(key) {
      const hit = entries.get(key);
      return hit && clock() - hit.at < ttlMs ? hit.data : undefined;
    },
    set(key, data) {
      entries.set(key, { data, at: clock() });
    },
    delete(key) {
      entries.delete(key);
    },
  };
}
function createWriteQueue() {
  const tails = new Map();
  return function serialized(key, task) {
    const previous = tails.get(key) || Promise.resolve();
    const run = previous.then(task, task);
    const tail = run.catch(() => {});
    tails.set(key, tail);
    // Libera a memória quando a fila daquele documento esvazia.
    tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return run;
  };
}
module.exports = { createStateCache, createWriteQueue };
