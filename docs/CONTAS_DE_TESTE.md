# Contas de teste da apresentação

Criadas por `node scripts/carga-teste.cjs` na base local dos emuladores. **Pessoas, CPFs e documentos são fictícios** (os CPFs têm dígitos verificadores válidos apenas para teste). Estas senhas só funcionam no emulador local; não as reutilize em nenhum serviço real.

Para remover tudo o que a carga criou: `node scripts/carga-teste.cjs --limpar`.

## Alunos

| Nome | E-mail | Senha | CPF (fictício) | Situação |
|---|---|---|---|---|
| Ana Beatriz Souza | ana.souza@conduzapp.local | AlunoTeste1! | 529.982.247-25 | Aprovada · aula concluída com Carlos, aguardando avaliação |
| Lucas Oliveira Santos | lucas.santos@conduzapp.local | AlunoTeste2! | 153.509.460-56 | Aprovado · aula concluída com Fernanda, aguardando avaliação |
| Mariana Costa Lima | mariana.lima@conduzapp.local | AlunoTeste3! | 714.602.380-01 | Aprovada · aula concluída com Roberto, aguardando avaliação |
| Pedro Henrique Almeida | pedro.almeida@conduzapp.local | AlunoTeste4! | 286.435.901-42 | Aprovado · aula concluída com Patrícia, aguardando avaliação |
| Juliana Ferreira Rocha | juliana.rocha@conduzapp.local | AlunoTeste5! | 901.837.425-32 | **Aguardando análise do admin** |

## Instrutores

| Nome | E-mail | Senha | CPF (fictício) | Veículo · câmbio | Valor/aula | Situação |
|---|---|---|---|---|---|---|
| Carlos Eduardo Pereira | carlos.pereira@conduzapp.local | InstrutorTeste1! | 438.217.096-69 | VW Gol 1.0 2021 · Manual | R$ 70,00 | Aprovado · seg–sex 08–12 e 14–18 |
| Fernanda Ribeiro Martins | fernanda.martins@conduzapp.local | InstrutorTeste2! | 672.049.318-31 | Hyundai HB20 2023 · Automático | R$ 95,00 | Aprovada · seg–sáb 07–11 |
| Roberto Silveira | roberto.silveira@conduzapp.local | InstrutorTeste3! | 345.781.902-50 | Fiat Argo 1.3 2022 · Manual | R$ 80,00 | Aprovado · seg, qua, sex 08–12 e 13–17 |
| Patrícia Gomes Barbosa | patricia.barbosa@conduzapp.local | InstrutorTeste4! | 860.294.157-94 | Toyota Yaris CVT 2022 · Automático | R$ 85,00 | Aprovada · ter, qui, sáb 09–12 e 18–21 |
| Marcos Vinícius Teixeira | marcos.teixeira@conduzapp.local | InstrutorTeste5! | 197.653.048-20 | Chevrolet Onix 1.0 2020 · Manual | R$ 75,00 | **Aguardando análise do admin** (identidade e credencial) |

## O que cada conta permite mostrar

- **Aprovação pelo admin:** Juliana e Marcos têm foto e documento de teste no Storage. O admin compara as imagens e aprova; o Marcos também precisa ter o credenciamento aprovado para aparecer na busca.
- **Avaliações:** os quatro alunos aprovados têm uma aula de 50 minutos concluída ontem. Em Agendamentos → Gerenciar aula, o aluno vê "Avalie seu instrutor" (1 a 5 estrelas e comentário). O instrutor da aula vê "Avalie seu aluno (opcional)".
- **Reserva nova:** qualquer aluno aprovado pode reservar com qualquer instrutor aprovado. A duração é sempre de 50 minutos, definida pelo servidor.

A conta de administração não faz parte desta carga: veja `.tools/acessos-locais.txt` ou crie com `node scripts/tornar-admin.cjs email --criar`.
