# Publicação do ConduzAPP — web, celular e backend

O código já está pronto para três destinos: **web** (`https://conduzapp.web.app`), **celular** (Expo Go ou APK) e **backend** (Cloud Function `conduz` no Firebase). O único passo que depende de decisão financeira é ativar o **plano Blaze** do Firebase, exigido pelo Google para publicar Cloud Functions e o bucket do Storage. Sem ele, o app continua funcionando no notebook (modo local).

## Como o app escolhe o servidor

Não há URL de API para configurar à mão. O app usa o SDK do Firebase, que monta o endereço sozinho:

| `EXPO_PUBLIC_FIREBASE_MODE` | Backend usado | Quando |
|---|---|---|
| `emulator` (padrão) | `http://127.0.0.1:5001/demo-conduzapp/us-central1/conduz` e demais emuladores | Notebook (`Iniciar-ConduzAPP.ps1`) |
| `cloud-demo` | `https://us-central1-SEU-PROJETO.cloudfunctions.net/conduz`, Auth, Firestore e Storage reais | Web publicada e APK |

As variáveis estão descritas em [.env.example](../.env.example). No modo `cloud-demo`, o backend aceita apenas contas habilitadas pela administração (claims `conduzDemo` e `stateScope`). Para um TCC exposto na internet, isso evita cadastros abusivos e custo inesperado.

## 1. Backend e web no Firebase (recomendado)

Pré-requisitos (feitos por você, no Console Firebase, projeto `conduzapp-d9beb`):

1. Ativar o **plano Blaze** e criar um **alerta de orçamento** (ex.: R$ 10). O uso de um TCC fica dentro das cotas gratuitas, mas o alerta não é um teto rígido.
2. Authentication → habilitar **E-mail/Senha**; criar o **Firestore** e o **Storage**.
3. Registrar um **app Web** e anotar o App ID.

Depois, no PowerShell, na pasta do projeto:

```powershell
. .\scripts\ambiente.ps1
node node_modules/firebase-tools/lib/bin/firebase.js login
node node_modules/firebase-tools/lib/bin/firebase.js hosting:sites:create conduzapp --project conduzapp-d9beb
node scripts/configure-cloud.cjs conduzapp-d9beb SEU-APP-ID-WEB demo-tcc-2026
node scripts/prepare-cloud-demo.cjs
powershell -ExecutionPolicy Bypass -File .\scripts\Build-Online.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\Deploy-Online.ps1 -ProjectId conduzapp-d9beb
```

- `hosting:sites:create conduzapp` reserva o endereço **conduzapp.web.app**. Em 06/11/2026 ele aparecia livre. Se alguém tiver reservado antes, troque `site` em `firebase.cloud.json` e as origens em `scripts/cloud-session.cjs`.
- `configure-cloud.cjs` gera a configuração pública (`.tools/cloud-demo/config.json`) e `functions/.env.conduzapp-d9beb`, ambos fora do Git.
- `prepare-cloud-demo.cjs` cria as contas da demonstração com senhas aleatórias (`.tools/cloud-demo/acessos.json`, fora do Git) e o CORS do Storage para as origens do app.
- `Deploy-Online.ps1` confere se o faturamento está ativo e publica regras, Storage, a Function e o Hosting, nada além disso.

Resultado: **https://conduzapp.web.app**. O endereço `https://conduzapp-d9beb.web.app` também continua respondendo.

## 2. Web na Vercel (alternativa ao Firebase Hosting)

[vercel.json](../vercel.json) já define o build (`npx expo export --platform web`) e a pasta `dist`. Na Vercel:

1. Importar o repositório do GitHub e nomear o projeto como `conduzapp` → **https://conduzapp.vercel.app**.
2. Em Settings → Environment Variables, cadastrar as `EXPO_PUBLIC_*` do modo `cloud-demo`.
3. Acrescentar `https://conduzapp.vercel.app` às origens CORS em `scripts/cloud-session.cjs` e rodar `prepare-cloud-demo.cjs` de novo. Sem isso, as fotos não carregam.

O backend continua no Firebase (seção 1). A Vercel hospeda só a parte web.

## 3. Celular

### a) Expo Go, para testes (mesma rede Wi-Fi do notebook)

Com o modo local, o celular precisa alcançar o computador pela rede:

1. Instalar o **Expo Go** (Play Store/App Store) atualizado. O projeto usa o **SDK 58** (React Native 0.88, React 19.3, Expo Router 58); um Expo Go de outro SDK recusa abrir o app com "Project is incompatible with this version of Expo Go".
2. Com o app parado (`.\Parar-ConduzAPP.ps1`), iniciar em modo celular:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\Iniciar-ConduzAPP.ps1 -Celular
   ```

   O QR Code aparece na mesma janela; leia-o com o Expo Go (Android) ou a câmera (iPhone). Encerrar: Ctrl+C e `.\Parar-ConduzAPP.ps1`.
3. O que o modo celular faz:
   - os emuladores Auth, Firestore, Functions e Storage escutam também na rede local, por uma cópia gerada `firebase.rede.json` (fora do Git). O `firebase.json` continua só em 127.0.0.1, e o painel (4000) fica só no PC;
   - o Expo anuncia o IP do notebook (`--lan`), e o app no celular usa esse mesmo IP para os emuladores (`emulatorHost` em `src/lib/firebase-config.ts`). `EXPO_PUBLIC_EMULATOR_HOST` continua tendo prioridade.
   - Se o Expo anunciar o IP errado (ex.: o `26.x` de uma VPN), force o do Wi-Fi: `.\Iniciar-ConduzAPP.ps1 -Celular -IP 192.168.0.15` (veja em `ipconfig`, "Endereço IPv4").
   - Na primeira vez, o Windows pergunta se libera o Node e o Java do projeto na rede: permita em **Redes privadas**. Se o aviso foi fechado, o celular mostra "Não foi possível conectar".
   - Use **só em rede doméstica confiável**: o emulador aceita tokens sem assinatura.

Com o backend publicado (seção 1), o Expo Go funciona de qualquer rede: `EXPO_PUBLIC_FIREBASE_MODE=cloud-demo` e `npx expo start --tunnel`.

### b) APK Android pelo EAS Build (sem cabo e sem o notebook ligado)

[eas.json](../eas.json) tem o perfil `preview`, que gera um `.apk` apontando para o Firebase real. Ele exige o backend publicado (seção 1).

```powershell
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_FIREBASE_API_KEY --value SUA-CHAVE --visibility plaintext
# repita para AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET e APP_ID
npx eas-cli@latest build -p android --profile preview
```

- `eas login` usa a sua conta Expo (gratuita); `eas init` grava o `projectId` no `app.json`.
- O build roda na nuvem da Expo (plano gratuito com fila) e devolve um link e um QR Code para baixar o APK.
- Identificador do app: `br.com.conduzapp`. Esquema de link: `conduzapp://`.
- No celular, o login fica salvo no AsyncStorage (`src/services/firebase-auth.native.ts`) e sobrevive ao fechar o app. Na web o Firebase continua usando o IndexedDB do navegador.

## 4. Endereço local `conduzapp.local` (opcional)

O Metro já responde por esse nome (testado em 06/11/2026). Falta o Windows resolvê-lo:

1. Abrir o **Bloco de Notas como administrador** e o arquivo `C:\Windows\System32\drivers\etc\hosts`.
2. Acrescentar a linha `127.0.0.1    conduzapp.local` e salvar.
3. Abrir **http://conduzapp.local:8081**.

Não há problema de CORS: a Function aceita qualquer origem (`cors: true`) e os emuladores são acessados pelo SDK em 127.0.0.1. A porta `:8081` continua no endereço; removê-la exigiria um proxy reverso na porta 80, o que não compensa para o uso local.

## 5. Git

```powershell
git status
git add -A
git commit -m "chore(deploy): preparar publicacao web, mobile e identidade ConduzAPP"
git push samuel main
```

O `.gitignore` bloqueia `node_modules/`, `.expo/`, `dist/`, logs, APK/AAB, `.tools/` (k6, Node portátil, senhas locais), `.emulator-data*` (dados pessoais), `.env*` (exceto os modelos `*.example`) e qualquer chave de conta de serviço.

## Recomendações de custo e manutenção

- **Firebase:** a Function já usa `minInstances: 0` e `maxInstances: 1`, ou seja, zero custo parado e um teto de escala. Mantenha o alerta de orçamento e o modo de contas habilitadas.
- **CI/CD:** um GitHub Action que rode `npm test` e `npm run typecheck` a cada push é gratuito e evita publicar código quebrado. O deploy automático exige guardar uma credencial de serviço como segredo do GitHub. Para o TCC, publicar manualmente com `Deploy-Online.ps1` é mais seguro.
- **Expo:** use o perfil `preview` (APK) para a banca. O `production` gera AAB, que só serve para a Play Store.
- **Antes da apresentação:** rode `Testar-Tudo.ps1` localmente e confira login e upload de foto no endereço publicado.
