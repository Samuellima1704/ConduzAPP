param([Parameter(Mandatory=$true)][string]$ProjectId)
. "$PSScriptRoot\ambiente.ps1"
$ErrorActionPreference = 'Stop'
$taskConfig = Get-Content -Raw '.tools/cloud-demo/config.json' | ConvertFrom-Json
$taskBuild = Get-Content -Raw '.tools/cloud-demo/build.json' | ConvertFrom-Json
if ($ProjectId -ne $taskConfig.projectId -or $ProjectId -ne $taskBuild.projectId -or $taskBuild.scope -ne $taskConfig.scope) { throw 'Projeto do build não corresponde ao destino. Publicação bloqueada.' }
& node -e 'const c=require("./scripts/cloud-session.cjs"); c.cloudSession(c.loadConfig()).then(()=>console.log("Projeto com faturamento já habilitado; nenhuma contratação foi feita pelo script.")).catch(e=>{console.error(e.message);process.exit(1)})'
if ($LASTEXITCODE -ne 0) { throw 'Pré-verificação online não aprovada.' }
& node node_modules/firebase-tools/lib/bin/firebase.js deploy --config firebase.cloud.json --project $ProjectId --only 'firestore:rules,storage,functions:conduz,hosting'
if ($LASTEXITCODE -ne 0) { throw 'Deploy não confirmado. Verifique o resultado antes de apresentar.' }
Write-Output "Deploy finalizado. Validar contas e upload em https://conduzapp.web.app antes de considerar o ambiente pronto."
