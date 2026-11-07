# Contas da apresentação (banca)

Base local dos emuladores após `node scripts/clean-mock-data.ts --executar` (06/11/2026): 1 administração, 2 instrutores e 2 alunos, todos fictícios. As senhas só funcionam no emulador local; não as reutilize em nenhum serviço real.

## Para copiar no Bloco de Notas

```
CONDUZAPP - CONTAS DA APRESENTACAO
Endereço: http://localhost:8081  (celular: Expo Go, mesma rede Wi-Fi)

ADMIN
  Nome:   Administração ConduzAPP
  E-mail: admin@conduzapp.local
  Senha:  admin@123
  Estado: administrador; aprova identidades e credenciamentos

INSTRUTOR
  Nome:   Carlos Eduardo Pereira
  E-mail: carlos.pereira@conduzapp.local
  Senha:  teste@123
  Estado: aprovado; RENACH RJ202600141 válido até 28/10/2027;
          identidade verificada; agenda com 3 períodos; 1 aula concluída (Ana)

INSTRUTOR
  Nome:   Fernanda Ribeiro Martins
  E-mail: fernanda.martins@conduzapp.local
  Senha:  teste@123
  Estado: aprovada; RENACH RJ202600275 válido até 28/10/2027;
          identidade verificada; agenda com 6 períodos; 1 aula concluída (Lucas)

ALUNO
  Nome:   Ana Beatriz Souza
  E-mail: ana.souza@conduzapp.local
  Senha:  teste@123
  Estado: identidade verificada; 1 aula concluída com Carlos (27/10);
          sem aula confirmada - pode reservar na hora

ALUNO
  Nome:   Lucas Oliveira Santos
  E-mail: lucas.santos@conduzapp.local
  Senha:  teste@123
  Estado: identidade verificada; 1 aula concluída com Fernanda (27/10);
          sem aula confirmada - pode reservar na hora
```

## Roteiro sugerido

1. **Aluno** (Ana) reserva uma aula de 50 minutos com Carlos.
2. **Instrutor** (Carlos) aceita; Ana confirma o pagamento e recebe o código de início.
3. **Admin**, no relógio de ensaio da reserva, avança para o início; Carlos digita o código; avança para o término e Carlos conclui a aula.
4. Ana e Carlos se avaliam. As telas atualizam sozinhas (tempo real), sem recarregar.

## Restaurar ou refazer

- Backup da base antes da limpeza: `.tools/backups/` (fora do Git).
- A carga original de 5 alunos e 5 instrutores pode ser recriada com `node scripts/carga-teste.cjs` (usa as senhas antigas listadas no próprio script).
