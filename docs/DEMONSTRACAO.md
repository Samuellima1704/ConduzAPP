# Roteiro da apresentação — 30/10/2026

O ConduzAPP roda com dados persistentes. Não há contas nem cenário pré-carregados: tudo o que for cadastrado no ensaio continua salvo no dia da banca.

## Antes da banca (uma única vez)

1. Inicie o app e abra http://localhost:8081:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\Iniciar-ConduzAPP.ps1
   ```

2. **Administração:** em "Criar conta", crie a conta da administração. Com o app rodando, promova-a e depois saia e entre de novo:

   ```powershell
   node scripts/tornar-admin.cjs email-da-conta@exemplo.com
   ```

3. **Instrutor:** em "Entrar como instrutor" → "Criar conta", cadastre o instrutor com a autorização profissional. Em Perfil, envie a foto e o documento, informe a validade da credencial e configure a disponibilidade (por exemplo, 08–12 e 14–18).
4. **Aluno:** em "Criar conta", cadastre o aluno e envie foto e documento.
5. **Administração:** aprove as duas identidades (comparação manual de foto e documento) e o credenciamento do instrutor.
6. Encerre sem perder dados:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\Parar-ConduzAPP.ps1
   ```

No dia, basta iniciar: contas, aprovações e agenda estarão lá. Use um navegador separado para cada conta (por exemplo, Chrome, Chrome anônimo e Edge), porque o login fica salvo por navegador.

## Sequência para mostrar os fluxos

1. **Instrutor e agenda:** entre como instrutor. Mostre credenciamento aprovado, validade e os períodos de disponibilidade. O Início traz as métricas e o resumo financeiro.
2. **Aluno e contato:** entre como aluno, busque o instrutor e abra o perfil. Toque em "Conversar com o instrutor" e envie uma mensagem. A conversa exibe **SEM AGENDAMENTO** enquanto não houver reserva ativa.
3. **Solicitação:** escolha um horário futuro dos próximos sete dias. Selecione "1 aula · 50 min" ou "2 aulas · 2 × 50 min". Cada aula dura 50 minutos e começa em hora cheia; os 10 minutos restantes são intervalo (ex.: 14:00–14:50 e 15:00–15:50). Informe rua, número (aceita s/n), bairro, cidade e UF; CEP é opcional, com ViaCEP e alternativa manual. Solicite. Os horários ficam reservados e a tag muda para **AGENDADO**.
4. **Aceite:** entre como instrutor. Veja a notificação e o filtro Pendentes. Aceite cada aula; elas ficam **Aguardando pagamento**. Duas aulas relacionadas precisam dos dois aceites antes do pagamento conjunto.
5. **Pagamento:** entre como aluno e toque em "Confirmar pagamento (simulado)". O pagamento é processado no backend, sem cobrança externa. A taxa de 12% (R$10,20 por aula de R$85) é calculada e congelada por aula; o instrutor a vê no card e no resumo financeiro. Os dois participantes precisam de foto e identidade aprovada. **O código de início nasce aqui:** o aluno já vê os 8 dígitos com a situação "Código gerado · validação a partir do início"; o instrutor não vê o código.
6. **Bloqueio do horário:** abra de novo os horários do instrutor. O horário reservado não aparece. A integração também valida duas reservas simultâneas: somente uma é aceita.
7. **Mensagens e notificações:** confira o badge de não lidas na aba Mensagens; abrir a conversa marca as recebidas. Um terceiro não recebe o histórico. Atualizações usam consulta a cada 10s; Atualizar confere imediatamente.
8. **Início com código e conclusão:** siga a seção abaixo.
9. **Avaliações:** na aula concluída, aluno e instrutor avaliam uma vez cada. A avaliação do instrutor é pública, sem revelar quem é o aluno.
10. **Administração:** mostre verificações de identidade, credenciamento com número, validade e parecer, e Ocorrências (suporte e disputas). Não há consulta ao Detran.

## Código de início e relógio de ensaio

O relógio de ensaio é exclusivo da administração e só funciona no servidor local. Ele desloca o horário do servidor em até sete dias, para mostrar início e término sem esperar o horário real. Não altera o relógio do computador.

1. Solicite, aceite e pague uma aula pelo fluxo acima. O aluno já vê o código; o instrutor só consegue validá-lo do horário de início até +10min.
2. No admin, abra a aula em Agendamentos e use **Ensaio: horário de início**. Aparece o aviso de relógio de ensaio ativo.
3. No aluno, o código passa a "Disponível" e os dois participantes recebem a notificação de início. No instrutor, aparece o campo para digitar o código. Não inclua código ativo em gravações ou documentos públicos.
4. Digite um código errado e veja as tentativas restantes. Digite o correto e confira o horário registrado. Após cinco erros o fluxo bloqueia e encaminha ao suporte.
5. Tentar concluir antes do término (50 minutos após o início) é recusado. No admin, use **Ensaio: término da aula**; o instrutor conclui, e o painel do Início mostra a aula concluída, as horas e o valor líquido.
6. Para mostrar expiração, use outra aula confirmada e escolha **Ensaio: após dez minutos**. Os participantes veem prazo expirado e a opção de suporte, sem falta, cancelamento ou estorno automático.
7. **Ao terminar, use "Restaurar relógio do ensaio".** Como os dados agora são reais e persistentes, o relógio deslocado vale para todas as contas até ser restaurado. Registros já feitos não retrocedem.

## Cenários opcionais

- **Remarcação:** na aula confirmada, um participante propõe nova data com pelo menos três horas de antecedência; o outro aceita ou recusa. O backend revalida conflitos, preserva preço e duração e gera um novo código de início.
- **Cancelamento:** cancele uma reserva futura e confira o aviso ao outro participante. Aluno com mais de 2 h de antecedência recebe estorno integral; com 2 h ou menos, 50%.
- **Falta seguida de contestação:** o admin registra a falta; aluno ou instrutor podem contestar até 24h após o término. A administração decide expressamente.

## Explicações para a banca

- O app roda nos emuladores oficiais do Firebase, no notebook, com dados persistentes. Contas, perfis, documentos, aulas e mensagens são salvos automaticamente a cada 2 minutos e ao encerrar.
- Pagamentos, estornos e repasses são processados no backend sem gateway real: nenhuma cobrança é feita. Elegível para repasse não significa dinheiro transferido.
- Aluno cancela acima de duas horas: integral; até duas horas antes do início: 50%; falta: zero. Instrutor cancela: integral.
- Aula de 50 minutos em hora cheia, com 10 minutos de intervalo. Taxa da plataforma de 12% por aula, congelada na reserva.
- Instrutor suspenso ou com credencial em renovação não recebe novas solicitações, mas ainda confirma o início e conclui aulas já pagas.
- Credenciamento mostra número, validade e parecer; identidade tem envio privado e comparação manual, sem biometria. Endereço estruturado, com CEP opcional.
- Regras financeiras e decisões pendentes: [AUDITORIA_CANCELAMENTOS_TCC.md](AUDITORIA_CANCELAMENTOS_TCC.md).

## Persistência e base limpa

- **Salvar agora:** `powershell -ExecutionPolicy Bypass -File .\scripts\salvar-dados.ps1` (o app precisa estar rodando).
- **Encerrar:** sempre com `Parar-ConduzAPP.ps1`. Fechar a janela ou desligar o notebook perde no máximo os últimos 2 minutos.
- **Cópias:** a atual fica em `.emulator-data` e a anterior em `.emulator-data.prev`. Ambas contêm dados pessoais e ficam fora do Git.
- **Começar do zero:** encerre o app e apague as duas pastas. O próximo início sobe sem nenhuma conta.
