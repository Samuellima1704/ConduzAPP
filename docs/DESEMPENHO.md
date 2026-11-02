# Teste de carga e desempenho — ConduzAPP

Medição de 02/11/2026 com o k6 v2.3.0 contra os emuladores locais. Depois das otimizações, a Function `conduz` atendeu 50 usuários simultâneos com **0% de falhas e p95 de 47 ms**. Antes, as escritas concorrentes travavam por cerca de 20 s e mais da metade falhava.

## O que é testado

O ConduzAPP tem uma única Cloud Function callable, `conduz`:

- **Endereço local:** `http://127.0.0.1:5001/demo-conduzapp/us-central1/conduz`, projeto `demo-conduzapp` (`.firebaserc`), porta 5001 (`firebase.json`).
- **Funcionamento:** cada ação do app é uma operação `{ op, input }` enviada com o token do usuário.
- **Carga simulada ([tests/load-test.js](../tests/load-test.js)):**
  - **85% de leitura** (`state`), a consulta que o app faz a cada 10 s;
  - **10% de favoritar** instrutor;
  - **5% de mensagens**;
  - intervalo de 1 a 2 s entre ações, como um usuário real.
- **Rampa de usuários:** 0 → 10 (30 s) → 25 (1 min) → 50 (1 min) → 0 (30 s).
- **Limites (thresholds):** p95 < 1000 ms, falhas < 1% e checks > 99%.
- **Isolamento:** o cenário roda em um espaço isolado `test-k6-*`, com 20 alunos e 3 instrutores. A base real não é lida nem alterada, e o cenário é apagado no final.

## Resultados

| Métrica | Antes | Depois |
|---|---|---|
| p95 geral | 17,98 s | **47 ms** |
| Falhas HTTP | 8,08% | **0%** |
| Checks aprovados | 91,78% | **100%** |
| Leitura `state` (mediana / p95) | 44 ms / 77 ms | **7 ms / 11 ms** |
| Escrita `favorite` (p95) | 20,65 s | **126 ms** |
| Escrita `message` (p95) | 20,50 s | **130 ms** |
| Requisições atendidas | 1.323 (7/s) | **2.756 (15/s)** |
| Limites do k6 | 3 de 3 reprovados | **3 de 3 aprovados** |

### Diagnóstico

O log do servidor mostrou 122 erros `Transaction lock timeout` (ABORTED). Todo o estado de um ambiente fica em um único documento, e cada chamada, inclusive a leitura, abria uma transação nele. O emulador do Firestore usa trava pessimista: duas transações que leem e depois gravam o mesmo documento esperam uma pela outra (deadlock) até estourar o tempo.

### Otimizações aplicadas

| Arquivo | Mudança |
|---|---|
| [functions/state-cache.js](../functions/state-cache.js) | **Cache de leitura em memória** (TTL de 2 s, write-through) e **fila de escrita** por documento |
| [functions/index.js](../functions/index.js) | A leitura `state` sai da transação e usa o cache; escritas viram **concorrência otimista**: ler sem trava, gravar só se o documento não mudou (`lastUpdateTime`), senão reler e recalcular (até 10 tentativas) |
| [functions/index.js](../functions/index.js) | O vínculo `bookingAccess` é regravado só para reservas novas ou alteradas, e não mais para todas a cada escrita |

A consistência foi mantida: o teste de duas reservas simultâneas no mesmo horário continua aceitando só uma. Passam 72 testes unitários, 27 integrados e 35 de 35 no ponta a ponta.

O cache não usa biblioteca externa (como `node-cache`): um `Map` com prazo resolve sem nova dependência. Custo aceito: gravações feitas por fora do app, como `tornar-admin` ou a carga de dados, aparecem em até 2 s. As escritas feitas pelo próprio app aparecem na hora, porque atualizam o cache.

## Índices do Firestore

**Hoje não há índice composto a criar.** O backend não faz consultas (`where`, `orderBy`): só lê documentos pelo caminho exato (`private/state`, `bookingAccess/{id}`), e esse acesso usa o índice padrão do Firestore. Por isso o projeto não tem `firestore.indexes.json`.

Quando o estado migrar para coleções (o passo de escalabilidade previsto), estas são as consultas do app e os índices compostos correspondentes:

| Coleção | Consulta | Índice composto |
|---|---|---|
| `bookings` | agenda do instrutor | `instructor` ASC, `start` ASC |
| `bookings` | aulas do aluno | `student` ASC, `start` DESC |
| `bookings` | conflito de horário | `instructor` ASC, `status` ASC, `start` ASC |
| `messages` | histórico da conversa | `conversation` ASC, `at` ASC |
| `messages` | não lidas | `to` ASC, `readAt` ASC |
| `notifications` | avisos do usuário | `recipient` ASC, `at` DESC |
| `reviews` | avaliações do instrutor | `to` ASC, `at` DESC |
| `users` | busca de instrutores | `role` ASC, `approval` ASC, `region` ASC |

## Como rodar

Com o app no ar (`Iniciar-ConduzAPP.ps1`), em outro PowerShell, na pasta do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Teste-Carga.ps1
```

O script cria o cenário isolado, executa o k6 (instalado de forma portátil em `.tools\k6`) e apaga o cenário no final. O resumo fica em `.tools\k6-resultado.txt`.

Para rodar o k6 direto, com o cenário já criado (`node scripts/cenario-carga.cjs`):

```powershell
& .\.tools\k6\k6-v2.3.0-windows-amd64\k6.exe run tests\load-test.js
```

## Limites desta medição

- O emulador roda no notebook, junto com o próprio k6. Em produção, os tempos absolutos dependem da região e da rede, mas o gargalo de trava e a solução por escrita otimista valem igualmente.
- A taxa de 15 req/s é limitada pelo intervalo simulado de 1 a 2 s entre ações de cada usuário. Para buscar o teto de vazão, reduza o `sleep` em `tests/load-test.js`.
- O documento único continua com o limite de cerca de 850 KB. A migração para coleções, com os índices acima, é o caminho para muitos milhares de usuários.
