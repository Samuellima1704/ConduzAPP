# Roteiro da apresentação — 30/10/2026

Fotos: a correção de 21/10 foi comprovada com fotografia JPEG real em aluno/instrutor, após recarga e novo login. Use Perfil → Alterar foto, ou Editar perfil. Inicie também o Firebase, não somente o Expo. [Diagnóstico, evidências e passo a passo](CORRECAO_FOTOS_PERFIL.md).

## Preparar um ensaio novo

Com as ferramentas portáteis já instaladas, execute na pasta do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File .\Iniciar-ConduzAPP.ps1
powershell -ExecutionPolicy Bypass -File .\Preparar-Demonstracao.ps1
```

Depois **saia e entre novamente** nas três contas. Tokens antigos podem continuar apontando para o cenário anterior. Abra http://localhost:8081.

| Perfil | E-mail | Senha fictícia |
| --- | --- | --- |
| Aluno | aluno@conduzapp.test | DemoTCC2026! |
| Instrutor | instrutor@conduzapp.test | DemoTCC2026! |
| Administração | admin@conduzapp.test | DemoTCC2026! |

Cada preparação cria um cenário próprio, com identificador `demo-<UUID>`, sem sobrescrever `private/state` ou ensaios anteriores. O manifesto fica em `.tools/demo-current.json`. **Execute novamente em 30/10, antes da banca**, para renovar as datas e recuperar uma aula histórica ainda sem conclusão/avaliações. Reiniciar o aplicativo sozinho preserva o cenário já usado.

A agenda vem configurada em dois períodos por dia, 08–12 e 14–18. Aluno e instrutor principais começam com fotos ilustrativas e identidade aprovada explicitamente como dados fictícios do ensaio. O instrutor também tem credenciamento profissional aprovado e validade de 90 dias. Há suporte e um segundo perfil fictício pendente de credenciamento para análise. Não use documentos, endereços ou fotos reais.

## Sequência para mostrar os fluxos

1. **Instrutor e agenda:** entre como instrutor. Mostre aprovação manual, validade e os dois períodos diários. A agenda pode ser editada pelo formulário normal.
2. **Conclusão sem esperar o fim da aula:** em Agendamentos, abra a aula com local “Cenário histórico fictício — concluir e avaliar”. Ela foi preparada com pagamento simulado, 50 minutos de duração e término há aproximadamente uma ou duas horas. Toque em “Concluir aula após o término”. O servidor usa o relógio normal e aplica as mesmas regras das outras aulas. A confirmação do aluno não é obrigatória.
3. **Aluno autenticado e contato:** entre como aluno, busque Marcos Oliveira e abra o perfil. Toque em “Conversar com o instrutor” e envie uma mensagem fictícia. A conversa exibirá **SEM AGENDAMENTO**, pois a histórica já está concluída e ainda não existe reserva futura.
4. **Disponibilidade e solicitação:** volte ao perfil do instrutor e escolha um horário futuro dos próximos sete dias. Selecione “1 aula · 50 min” ou “2 aulas · 2 × 50 min”. Cada aula dura 50 minutos e começa em hora cheia; os 10 minutos restantes são intervalo (ex.: 14:00–14:50 e 15:00–15:50). Duas aulas usam o mesmo dia e somam R$170. Informe rua, número (aceita s/n), bairro, cidade e UF fictícios; CEP é opcional, com ViaCEP e alternativa manual. Solicite. Os horários ficam reservados e a tag muda para **AGENDADO**, mesmo sem pagamento.
5. **Aceite:** entre como instrutor. Veja a notificação, o histórico e o filtro Pendentes. Aceite cada aula solicitada. Elas ficam **Aguardando pagamento**. Duas aulas relacionadas precisam dos dois aceites antes do pagamento conjunto.
6. **Pagamento simulado e confirmação:** entre como aluno. Abra a reserva e toque em “Confirmar pagamento SIMULADO”. Confira confirmação e total de R$85 ou R$170. A taxa de 12% da plataforma (R$10,20 por aula de R$85) é calculada e congelada no backend por aula, sem exposição no card do aluno; o instrutor a vê no card e no resumo financeiro do Início. Os dois participantes precisam ter foto e identidade aprovada. **O código de início é gerado neste momento:** o aluno já vê os 8 dígitos com a situação “Código gerado · validação a partir do início”; o instrutor não vê o código. Nenhuma cobrança externa ocorre.
7. **Bloqueio do horário:** abra novamente os horários do instrutor. O horário solicitado não aparece. A integração também valida duas reservas simultâneas: somente uma é aceita.
8. **Mensagens e notificações:** envie mensagem entre as contas fictícias e confira o badge de recebidas não lidas na aba Mensagens. A lista sozinha não marca leitura; abrir a conversa marca as recebidas. Um terceiro não recebe o histórico. Abra Notificações, confira aceite/confirmada e marque um aviso como lido. Atualizações usam consulta a cada 10s; Atualizar confere imediatamente.
9. **Avaliações:** na aula histórica concluída, aluno e instrutor avaliam uma vez cada. A avaliação do instrutor é pública para os usuários do aplicativo, sem divulgar o vínculo privado para terceiros. A avaliação do aluno só pode ser acessada pelo destinatário, autor e administração.
10. **Administração:** mostre o “Instrutor Fictício Pendente”, número/validade e parecer de credenciamento manual. Essa aprovação profissional é distinta da identidade; cumprir uma não substitui a outra. Em Ocorrências, abra o suporte fictício e registre uma decisão. Não há consulta ao Detran.
11. **Fotos e identidade:** em Perfil → Foto e verificação de identidade, selecione `assets/demo/perfil-ficticio.png`, confira prévia e salve. Com aula ativa, remover a foto é recusado, mas substituir é permitido. Envie `assets/demo/documento-ficticio.png`; conta passa a aguardar análise e conserva perfil/suporte. Admin compara as duas ilustrações, informa parecer e aprova/rejeita. Após aprovação, aluno recebe notificação e volta a operar. Trocar foto depois do envio exige nova comparação; faça essa parte antes do fluxo de início se desejar usar a mesma conta.
12. **Início com código:** siga a seção abaixo para mostrar código sem esperar o horário real. O código é privado do aluno e não deve ser incluído em prints/documentos da apresentação.

**Observação sobre a tag inicial:** antes de concluir a histórica, ela está confirmada e portanto também conta como AGENDADO, mesmo com horário passado. A classificação segue os estados aprovados do produto. Por isso a conclusão histórica vem antes da demonstração de SEM AGENDAMENTO.

## Cenários opcionais já existentes

- **Remarcação:** na aula futura confirmada, um participante propõe nova data com pelo menos três horas de antecedência. O outro aceita ou recusa. A original permanece até o aceite; o backend revalida conflitos e preserva preço/duração. O destinatário recebe notificação.
- **Cancelamento:** cancele a reserva futura e confira o aviso ao outro participante. Sem outra reserva solicitada/aceita/confirmada, a conversa volta para SEM AGENDAMENTO. Conclusões e cancelamentos não contam para a tag.
- **Falta seguida de contestação:** depois das avaliações, o admin pode registrar uma ocorrência fictícia de falta na histórica, com motivo explícito de ensaio. O aluno/instrutor ainda pode contestar até 24h após o término. A abertura bloqueia a elegibilidade e não modifica o pagamento/estorno que já estavam registrados. O admin analisa e decide expressamente. Para repetir, prepare outro cenário.
- **Evidências:** as permissões de upload/leitura/listagem foram testadas nos emuladores. O seletor/renderização não foram conferidos manualmente nesta tarefa; ensaie antes se quiser demonstrar anexos.

## Código de início e relógio controlado

1. Solicite, aceite e pague uma aula nova pelo fluxo acima. O código nasce no pagamento: o aluno já o vê, mas o instrutor só consegue validá-lo do horário de início até +10min. A histórica legada não exige código retroativamente.
2. No admin, abra essa aula em Agendamentos e use o controle **Ensaio: horário de início**. O aviso do relógio controlado deve aparecer. Isso desloca somente o cenário fictício `demo-*` nos emuladores, com claim administrativa e limite de sete dias; não altera o relógio do computador.
3. No aluno, abra a aula: o mesmo código gerado no pagamento passa a “Disponível”, até +10min, e os dois participantes recebem a notificação de início. No instrutor, aparece o campo para inserir, nunca o segredo por outra tela/API. Se a aula for remarcada, um código novo é gerado e o anterior deixa de valer. Copie verbalmente entre participantes do ensaio; não inclua código ativo em gravações ou documentos públicos.
4. Digite um código errado e veja tentativas restantes. Digite o correto, confirme e confira o horário registrado. Após cinco erros o fluxo bloqueia e encaminha ao suporte. Repetir a mesma confirmação não duplica o início.
5. Tentar concluir antes do término (50 minutos após o início) é recusado. No admin, avance para término da aula; então o instrutor consegue concluir e os participantes podem avaliar. No Início do instrutor, o painel passa a mostrar a aula concluída, as horas e o valor líquido.
6. Para mostrar expiração, use outra aula confirmada e não iniciada: no admin escolha **Ensaio: após dez minutos** (+11min). Os participantes veem prazo expirado e opção de suporte. Não ocorre falta, cancelamento, reembolso ou liberação financeira automática.
7. Use **Restaurar relógio do ensaio** no admin. Não retrocede registros já confirmados/concluídos; para repetir o roteiro inteiro, prepare um cenário novo e entre novamente nas contas.

Avisos de início e expiração surgem no próximo acesso ao servidor/polling. Não existe scheduler/push. Para aulas novas, sem início confirmado a elegibilidade continua bloqueada mesmo após conclusão. A decisão administrativa para liberar casos excepcionais depende de regra comercial ainda não definida; não há atalho financeiro de demonstração.

## Explicações para a banca

- Tudo ocorre em Firebase Emulators, com dados fictícios e em loopback.
- Pagamentos, estornos e elegibilidade são simulações. Elegível não significa dinheiro transferido.
- A histórica é preparação explícita, concluída pelo horário real. O relógio adicional de ensaio é exclusivo de admin no próprio cenário fictício dos emuladores; payload comum não escolhe o horário. Não existe integração automática com Detran.
- No-show não remove o direito de contestar dentro da janela. A administração analisa a ocorrência.
- Aluno cancela acima de duas horas: integral; até duas horas antes do início: 50%; falta: zero. Instrutor cancela: integral. Estes critérios existentes foram preservados.
- Aula de 50 minutos em hora cheia, com 10 minutos de intervalo; reservas antigas mantêm a duração original. Taxa da plataforma de 12% por aula, congelada na reserva.
- Instrutor suspenso ou com credencial em renovação não recebe novas solicitações, mas ainda confirma o início e conclui aulas já pagas.
- Penalidades não alteram estrelas. O contador de cancelamentos ainda inclui todos os cancelamentos do instrutor; a definição de “relevante” continua pendente na auditoria.
- Credenciamento profissional mostra número/validade/parecer; identidade possui envio privado e comparação manual de documento fictício, sem biometria. Endereço de novas reservas é estruturado, com CEP opcional.
- Regras financeiras e decisões pendentes: [AUDITORIA_CANCELAMENTOS_TCC.md](AUDITORIA_CANCELAMENTOS_TCC.md). Duas aulas são relacionadas e administradas individualmente, sem desconto ou multa de pacote.

Resultado e limites do ensaio web, capturas e verificações: [IMPLEMENTACOES_URGENTES_TCC.md](IMPLEMENTACOES_URGENTES_TCC.md). Android/iOS físico será validado em etapa separada.

## Preservação

O início normal preserva a base. A preparação cria outro cenário, sem apagar o anterior. O script de emuladores exporta os dados ao encerrar normalmente. Para salvar manualmente o snapshot local com o ambiente ativo:

```powershell
. .\scripts\ambiente.ps1
node node_modules/firebase-tools/lib/bin/firebase.js emulators:export .emulator-data --project demo-conduzapp --force
```

O comando atualiza apenas a pasta de snapshot local. Não faz deploy nem migração. Não encerre abruptamente os emuladores antes de salvar um ensaio que deseje preservar.
