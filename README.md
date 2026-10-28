# ConduzAPP — recuperação do TCC

Aplicativo Expo/React Native com três perfis, Firebase local com dados persistentes e pagamentos simulados no backend.

Preparação do ambiente compartilhado online: [instruções e status](docs/AMBIENTE_ONLINE.md). O modo local continua padrão. A publicação online depende de projeto Firebase, faturamento e validação real; tornar o GitHub público não publica o banco nem o aplicativo.

## Executar neste notebook

Na pasta do projeto, execute no PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\Iniciar-ConduzAPP.ps1
```

Aplicativo: http://localhost:8081. Painel Firebase local: http://127.0.0.1:4000.

As ferramentas portáteis ficam em `.tools`, sem alterar instalações do Windows. Em uma cópia nova, prepare primeiro:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Preparar-Ambiente.ps1
```

## Dados persistentes

Não há contas nem base pré-carregadas: alunos e instrutores se cadastram pelo próprio app ("Criar conta"). Tudo o que os usuários fazem (contas, perfis, fotos, documentos, aulas, avaliações e mensagens) fica gravado nos emuladores do Firebase e é salvo em `.emulator-data`:

- automaticamente, a cada 2 minutos, enquanto o app estiver rodando;
- ao encerrar com o script abaixo, que salva antes de parar.

```powershell
powershell -ExecutionPolicy Bypass -File .\Parar-ConduzAPP.ps1
```

No próximo `Iniciar-ConduzAPP.ps1` os dados são restaurados. A cópia anterior fica em `.emulator-data.prev`. Fechar a janela ou desligar o notebook sem o script perde no máximo os últimos 2 minutos. A pasta `.emulator-data` contém dados pessoais e fica fora do Git.

### Conta de administração

A permissão de administrador só pode ser concedida pelo Admin SDK, nunca pelo app. Crie a conta normalmente pelo app e, com o app rodando, promova-a:

```powershell
node scripts/tornar-admin.cjs email-da-conta@exemplo.com
```

Saia e entre novamente para aplicar. Use uma conta exclusiva para a administração. O admin aprova identidades e credenciais e tem um relógio de ensaio local, que permite demonstrar o início e o término de uma aula sem esperar o horário real.

## Verificar

Com o app rodando, o teste de ponta a ponta percorre cadastro, verificação, reserva, pagamento, código de início, conclusão, avaliações, disputa, remarcação, cancelamento, suspensão e suporte em um ambiente isolado, sem tocar na base real:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Testar-Tudo.ps1          # relatório em .tools\teste-e2e.txt
powershell -ExecutionPolicy Bypass -File .\scripts\Testar-Tudo.ps1 -Limpar  # apaga as contas de teste
```

Com os emuladores ativos:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Verificar.ps1
```

Os testes de integração usam contas temporárias e documentos isolados por execução; não substituem a base usada pelo aplicativo. A verificação atual inclui **68 testes unitários, 27 integrações/autorização, TypeScript e build web**. As regras online são verificadas em projeto fictício separado; o vínculo auxiliar de aula recebe UUID exclusivo no projeto do emulador e é removido ao final. Resultado das implementações urgentes e limites do ensaio: [relatório](docs/IMPLEMENTACOES_URGENTES_TCC.md). Correção e comprovação de fotos reais após recarga/login: [fotos de perfil](docs/CORRECAO_FOTOS_PERFIL.md).

Com Node 22 e npm no PATH também é possível executar `npm test`, `npm run typecheck`, `npm run test:emulators` e `npm run build:web`.

## Arquitetura de recuperação

- `src/app/painel.tsx`: fluxos de aluno, instrutor e administração.
- `src/components`: componentes reutilizados de formulários, cartões e avaliações.
- `src/services/session.tsx`: sessão e chamadas autenticadas.
- `src/services/firebase.ts`: emuladores por padrão ou configuração explícita de demonstração online.
- `functions/domain.js`: regras puras de negócio testadas.
- `functions/index.js`: endpoint autenticado, transação Firestore e autorização.
- `functions/state-scope.js`: cenários de teste/ensaio selecionados por claim do Admin SDK autorizado.
- `firestore.rules`: impede leitura e escrita direta pelo cliente.
- `storage.rules`: fotos de perfil por ambiente, documentos de identidade privados e evidências de contestação com acesso autorizado.

O backend usa um documento agregado privado e transações para serializar as mutações desta demonstração pequena. Há limites de quantidade/tamanho. Esta estrutura prioriza recuperação e verificabilidade local; exige migração para coleções particionadas antes de escalar para produção. Os campos de acesso às fotos são espelhados pelo servidor. Não há migração de dados reais ou leitura do Firebase antigo.

Preço em centavos, taxa de 12% arredondada no backend, horário de Brasília (UTC−03), novas aulas de 50 minutos em hora cheia. Reservas antigas mantêm valor e duração. Remarcação não altera a reserva até aceite e revalida conflitos.

## Restrições

Nenhuma transferência financeira, cobrança real ou integração automática com Detran. Credenciamento manual com validade e suspensão. Aprovação administrativa depende de custom claim provisionada pelo responsável. Functions usam emuladores ou um projeto de demonstração online configurado explicitamente e com acesso restrito às contas habilitadas. A preparação online está na branch `ultimaversao`; a branch `main` permanece preservada. Consulte o status antes de apresentar: ter código preparado não comprova um deploy online.

Chat antes da reserva, tags calculadas no backend e notificações internas usam o serviço agregado existente. Mensagens têm chave de reenvio para evitar duplicação. Atualizações entre participantes seguem o polling de 10 segundos, com botão Atualizar.

A identidade azul e branca aprovada foi preservada com componentes existentes, inclusive nas funcionalidades urgentes. Validação nativa em aparelhos Android/iOS continua prevista para etapa separada.

Veja [roteiro da apresentação](docs/DEMONSTRACAO.md) e [registro da recuperação](RECUPERACAO.md).

Resultado das correções e pendências: [auditoria atualizada](docs/AUDITORIA_FINAL_TCC.md).
