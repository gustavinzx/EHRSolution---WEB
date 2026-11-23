<#
  Servidor local EHR Solutions para teste da Trava EHR (Windows)
  -------------------------------------------------------------
  Liga no seu computador: banco PostgreSQL (portátil), backend (API) e painel web.
  Não precisa de Docker nem de administrador. Na primeira vez baixa o que faltar
  (Node.js portátil, PostgreSQL portátil, dependências) e demora alguns minutos.

  Uso:  servidor_local.ps1 iniciar | parar | status
#>
param(
  [Parameter(Position = 0)] [ValidateSet('iniciar', 'parar', 'status')] [string] $Acao = 'iniciar',
  [switch] $SemPausa,      # não espera Enter no fim (usado no teste automático)
  [switch] $SemFirewall    # não tenta liberar o firewall
)

# ============================== CONFIGURAÇÃO ===============================
$PortaApi      = 3001
$PortaPainel   = 5173
$PortaBanco    = 5433          # 5433 para não colidir com um PostgreSQL já instalado
$SenhaGestor   = 'EhrGestor2026'
$SenhaMotorista = 'EhrMotorista2026'
$VersaoNode    = 'latest-v22.x'
# ===========================================================================

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Pasta      = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)   # pasta no Google Drive
$Codigo     = Join-Path $Pasta 'EHRSolution-WEB'
$ZipCodigo  = Join-Path $Pasta 'EHRSolution-WEB.zip'
$Local      = Join-Path $env:LOCALAPPDATA 'EHR-Local'                               # cópia de trabalho (fora do Drive)
$App        = Join-Path $Local 'app'
$Logs       = Join-Path $Local 'logs'
$Estado     = Join-Path $Local 'estado'
$DadosBanco = Join-Path $Local 'pgdata'
$PastaBanco = Join-Path $Local 'banco'
$ArqEnderecos = Join-Path $Pasta 'ENDERECOS.txt'

function Titulo($t) { Write-Host ''; Write-Host "== $t ==" -ForegroundColor Cyan }
function Ok($t)     { Write-Host "  [OK] $t" -ForegroundColor Green }
function Aviso($t)  { Write-Host "  [!]  $t" -ForegroundColor Yellow }
function Info($t)   { Write-Host "       $t" }
function Falhar($t) { Write-Host ''; Write-Host "  [ERRO] $t" -ForegroundColor Red; throw $t }

function Garantir-Pasta($p) { if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null } }

function Porta-Aberta([int] $porta) {
  $c = New-Object System.Net.Sockets.TcpClient
  try {
    $r = $c.BeginConnect('127.0.0.1', $porta, $null, $null)
    $ok = $r.AsyncWaitHandle.WaitOne(500) -and $c.Connected
    return $ok
  } catch { return $false } finally { $c.Close() }
}

function Esperar-Porta([int] $porta, [int] $segundos, [string] $nome, [string] $log) {
  for ($i = 0; $i -lt $segundos; $i++) {
    if (Porta-Aberta $porta) { return }
    Start-Sleep -Seconds 1
  }
  if ($log -and (Test-Path $log)) { Write-Host ''; Get-Content $log -Tail 30 | ForEach-Object { Write-Host "    $_" } }
  Falhar "$nome não respondeu na porta $porta em $segundos s. Registro completo: $log"
}

function Esperar-Http([string] $url, [int] $segundos, [string] $nome, [string] $log) {
  for ($i = 0; $i -lt $segundos; $i++) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return }
    } catch {}
    Start-Sleep -Seconds 1
  }
  if ($log -and (Test-Path $log)) { Write-Host ''; Get-Content $log -Tail 40 | ForEach-Object { Write-Host "    $_" } }
  Falhar "$nome não respondeu em $url em $segundos s. Registro completo: $log"
}

function Obter-IP {
  try {
    $cfg = Get-NetIPConfiguration -ErrorAction Stop |
      Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } |
      Select-Object -First 1
    if ($cfg -and $cfg.IPv4Address) { return @($cfg.IPv4Address)[0].IPAddress }
  } catch {}
  try {
    $ip = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
      Where-Object { $_.AddressFamily -eq 'InterNetwork' -and $_.IPAddressToString -notlike '169.254.*' -and $_.IPAddressToString -ne '127.0.0.1' } |
      Select-Object -First 1
    if ($ip) { return $ip.IPAddressToString }
  } catch {}
  return $null
}

# Processo independente da janela: continua rodando quando a janela é fechada
function Iniciar-Desacoplado([string] $linhaDeComando, [string] $pasta) {
  $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $linhaDeComando; CurrentDirectory = $pasta }
  if ($r.ReturnValue -ne 0) { Falhar "Não consegui iniciar: $linhaDeComando (código $($r.ReturnValue))" }
}

# ------------------------------------------------------------------ Node.js
function Garantir-Node {
  Titulo 'Node.js'
  $sistema = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($sistema) {
    $v = (& $sistema.Source --version) -replace '^v', ''
    if ([int]($v.Split('.')[0]) -ge 20) {
      Ok "Node.js $v já instalado no computador"
      return (Split-Path $sistema.Source)
    }
    Aviso "Node.js $v é antigo; vou usar um Node.js portátil"
  }
  $dirNode = Join-Path $Local 'node'
  $exe = Get-ChildItem -Path $dirNode -Filter node.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($exe) { Ok "Node.js portátil: $($exe.DirectoryName)"; return $exe.DirectoryName }

  Info 'Baixando o Node.js portátil (cerca de 30 MB)...'
  $base = "https://nodejs.org/dist/$VersaoNode"
  $somas = (Invoke-WebRequest -Uri "$base/SHASUMS256.txt" -UseBasicParsing).Content -split "`n"
  $linha = $somas | Where-Object { $_ -match 'node-v[\d.]+-win-x64\.zip$' } | Select-Object -First 1
  if (-not $linha) { Falhar 'Não encontrei o Node.js para Windows em nodejs.org' }
  $partes = $linha.Trim() -split '\s+'
  $hashEsperado = $partes[0]; $arquivo = $partes[1]
  Garantir-Pasta $dirNode
  $zip = Join-Path $Local $arquivo
  Invoke-WebRequest -Uri "$base/$arquivo" -OutFile $zip -UseBasicParsing
  $hash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
  if ($hash -ne $hashEsperado.ToLower()) { Remove-Item $zip -Force; Falhar 'O download do Node.js veio corrompido. Rode de novo.' }
  Expand-Archive -Path $zip -DestinationPath $dirNode -Force
  Remove-Item $zip -Force
  $exe = Get-ChildItem -Path $dirNode -Filter node.exe -Recurse | Select-Object -First 1
  Ok "Node.js portátil instalado: $($exe.DirectoryName)"
  return $exe.DirectoryName
}

function Npm([string] $pasta, [string[]] $args_) {
  Push-Location $pasta
  try {
    & npm.cmd @args_ --no-audit --no-fund --loglevel=error
    if ($LASTEXITCODE -ne 0) { Falhar "npm $($args_ -join ' ') falhou em $pasta" }
  } finally { Pop-Location }
}

function Instalar-Dependencias([string] $pasta, [string] $nome) {
  $lock = Join-Path $pasta 'package-lock.json'
  $marca = Join-Path $Estado "$nome.hash"
  # Sem package-lock no código (caso do banco), a referência é o package.json
  $usaLock = (Test-Path $lock) -and ($nome -ne 'banco')
  $hash = if ($usaLock) { (Get-FileHash $lock).Hash } else { (Get-FileHash (Join-Path $pasta 'package.json')).Hash }
  $instalado = (Test-Path (Join-Path $pasta 'node_modules')) -and (Test-Path $marca) -and ((Get-Content $marca -Raw).Trim() -eq $hash)
  if ($instalado) { Ok "Dependências de $nome já instaladas"; return }
  Info "Instalando as dependências de $nome (pode levar alguns minutos)..."
  if ($usaLock) { Npm $pasta @('ci') } else { Npm $pasta @('install') }
  Set-Content -Path $marca -Value $hash
  Ok "Dependências de $nome instaladas"
}

# ------------------------------------------------------------------- Código
function Preparar-Codigo {
  Titulo 'Código do EHR Solutions'
  if (-not (Test-Path (Join-Path $Codigo 'backend\package.json'))) {
    if (-not (Test-Path $ZipCodigo)) { Falhar "Não encontrei $Codigo nem $ZipCodigo" }
    Info 'Extraindo o código para a pasta (primeira vez)...'
    Expand-Archive -Path $ZipCodigo -DestinationPath $Pasta -Force
  }
  Ok "Código em $Codigo"
  # Cópia de trabalho fora do Google Drive (node_modules tem dezenas de milhares de arquivos)
  Garantir-Pasta $App
  & robocopy.exe $Codigo $App /MIR /XD node_modules .git dist build /XF .env .env.local /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { Falhar "Falha ao copiar o código para $App" }
  $global:LASTEXITCODE = 0
  Ok "Cópia de trabalho atualizada em $App"
}

# -------------------------------------------------------------------- Banco
function Achar-BinarioPg([string] $nome) {
  $f = Get-ChildItem -Path (Join-Path $PastaBanco 'node_modules') -Filter $nome -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($f) { return $f.FullName }
  return $null
}

function Iniciar-Banco {
  Titulo 'Banco de dados (PostgreSQL portátil)'
  Garantir-Pasta $PastaBanco
  Copy-Item -Path (Join-Path $PSScriptRoot 'banco\package.json') -Destination $PastaBanco -Force
  Instalar-Dependencias $PastaBanco 'banco'
  $initdb = Achar-BinarioPg 'initdb.exe'
  $pgctl  = Achar-BinarioPg 'pg_ctl.exe'
  if (-not $initdb -or -not $pgctl) { Falhar 'Não encontrei initdb.exe/pg_ctl.exe do PostgreSQL portátil' }
  $logBanco = Join-Path $Logs 'banco.log'

  if (-not (Test-Path (Join-Path $DadosBanco 'PG_VERSION'))) {
    Info 'Criando o banco (primeira vez)...'
    & $initdb -D $DadosBanco -U postgres -A trust -E UTF8 --no-locale | Out-File (Join-Path $Logs 'initdb.log') -Encoding UTF8
    if ($LASTEXITCODE -ne 0) { Get-Content (Join-Path $Logs 'initdb.log') -Tail 20; Falhar 'initdb falhou' }
  }
  if (Porta-Aberta $PortaBanco) { Ok "Banco já está ligado (porta $PortaBanco)"; return }
  if (Test-Path (Join-Path $DadosBanco 'postmaster.pid')) { Remove-Item (Join-Path $DadosBanco 'postmaster.pid') -Force }   # sobra de desligamento abrupto
  Iniciar-Desacoplado ('"' + $pgctl + '" -D "' + $DadosBanco + '" -l "' + $logBanco + '" -o "-p ' + $PortaBanco + ' -c listen_addresses=127.0.0.1" start') $PastaBanco
  Esperar-Porta $PortaBanco 60 'PostgreSQL' $logBanco
  Ok "Banco ligado em 127.0.0.1:$PortaBanco (só acessível deste computador)"
}

function Criar-BaseDeDados {
  $script = @"
const { Client } = require('pg');
(async () => {
  const c = new Client({ host: '127.0.0.1', port: $PortaBanco, user: 'postgres', password: 'postgres', database: 'postgres' });
  await c.connect();
  const r = await c.query("SELECT 1 FROM pg_database WHERE datname = 'ehr_fleet'");
  if (r.rowCount === 0) { await c.query('CREATE DATABASE ehr_fleet'); console.log('criada'); } else { console.log('existe'); }
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
"@
  Push-Location (Join-Path $App 'backend')
  try {
    $saida = $script | & node.exe -
    if ($LASTEXITCODE -ne 0) { Falhar "Não consegui criar a base ehr_fleet: $saida" }
  } finally { Pop-Location }
  if ($saida -match 'criada') { Ok 'Base ehr_fleet criada' } else { Ok 'Base ehr_fleet pronta' }
}

# ------------------------------------------------------------------ Backend
function Segredo-Jwt {
  $arq = Join-Path $Estado 'jwt_secret.txt'
  if (-not (Test-Path $arq)) {
    $s = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
    Set-Content -Path $arq -Value $s -NoNewline
  }
  return (Get-Content $arq -Raw).Trim()
}

function Escrever-EnvBackend {
  $env_ = @"
# Gerado por servidor_local.ps1 a cada início. Para mudar, edite o script.
PORT=$PortaApi
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=$PortaBanco
DB_NAME=ehr_fleet
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=$(Segredo-Jwt)
FACE_PROVIDER=mock
FACE_MOCK_MODE=always_match
VIRTUAL_HARDWARE_ENABLED=false
AUTO_SEED_IF_EMPTY=true
SEED_ADMIN_PASSWORD=$SenhaGestor
SEED_DRIVER_PASSWORD=$SenhaMotorista
"@
  [System.IO.File]::WriteAllText((Join-Path $App 'backend\.env'), $env_, (New-Object System.Text.UTF8Encoding($false)))
}

function Iniciar-Processo([string] $nome, [string] $pasta, [string] $argumentos) {
  $out = Join-Path $Logs "$nome.log"
  $linha = 'cmd.exe /c ""' + $global:NodeExe + '" ' + $argumentos + ' > "' + $out + '" 2>&1"'
  Iniciar-Desacoplado $linha $pasta
  return $out
}

function Iniciar-Backend {
  Titulo 'Servidor (API)'
  $pasta = Join-Path $App 'backend'
  Instalar-Dependencias $pasta 'backend'
  Criar-BaseDeDados
  Escrever-EnvBackend
  if (Porta-Aberta $PortaApi) { Aviso "A porta $PortaApi já estava em uso: parando o servidor anterior"; Parar-Porta $PortaApi }
  $log = Iniciar-Processo 'servidor' $pasta 'src/index.js'
  Esperar-Http "http://127.0.0.1:$PortaApi/api/health" 120 'Servidor' $log
  Ok "Servidor ligado na porta $PortaApi"
}

function Iniciar-Painel([string] $ip) {
  Titulo 'Painel web'
  $pasta = Join-Path $App 'frontend'
  Instalar-Dependencias $pasta 'painel'
  # Atualização ao vivo (Socket.IO) também para quem abre o painel por outro aparelho
  $alvo = if ($ip) { "http://$($ip):$PortaApi" } else { "http://localhost:$PortaApi" }
  [System.IO.File]::WriteAllText((Join-Path $pasta '.env.local'), "VITE_SOCKET_URL=$alvo`n", (New-Object System.Text.UTF8Encoding($false)))
  if (Porta-Aberta $PortaPainel) { Parar-Porta $PortaPainel }
  $log = Iniciar-Processo 'painel' $pasta "node_modules/vite/bin/vite.js --host 0.0.0.0 --port $PortaPainel --strictPort"
  Esperar-Http "http://127.0.0.1:$PortaPainel/" 90 'Painel' $log
  Ok "Painel ligado na porta $PortaPainel"
}

# ----------------------------------------------------------------- Firewall
function Liberar-Firewall {
  Titulo 'Firewall do Windows'
  $nome = 'EHR Servidor Local (teste)'
  $regra = Get-NetFirewallRule -DisplayName $nome -ErrorAction SilentlyContinue
  if ($regra) { Ok 'Portas já liberadas para a rede local'; return }
  Aviso 'O Windows vai pedir permissão de administrador para liberar as portas 3001 e 5173 para a rede local.'
  $cmd = "New-NetFirewallRule -DisplayName '$nome' -Direction Inbound -Protocol TCP -LocalPort $PortaApi,$PortaPainel -Action Allow -Profile Any -RemoteAddress LocalSubnet | Out-Null"
  try {
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile', '-Command', $cmd
  } catch {}
  if (Get-NetFirewallRule -DisplayName $nome -ErrorAction SilentlyContinue) {
    Ok 'Portas 3001 e 5173 liberadas (só para a rede local)'
  } else {
    Aviso 'Não liberei o firewall. Se o celular não conectar, rode de novo e aceite o pedido do Windows.'
  }
}

# -------------------------------------------------------------------- Parar
function Parar-Porta([int] $porta) {
  try {
    Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction Stop |
      ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
  } catch {}
}

function Parar-Tudo {
  Titulo 'Parando o servidor local'
  Parar-Porta $PortaPainel; Ok 'Painel parado'
  Parar-Porta $PortaApi; Ok 'Servidor parado'
  $pgctl = Achar-BinarioPg 'pg_ctl.exe'
  if ($pgctl -and (Test-Path (Join-Path $DadosBanco 'postmaster.pid'))) {
    & $pgctl -D $DadosBanco -m fast -w stop | Out-Null
    Ok 'Banco parado (os dados ficam guardados)'
  }
}

# ------------------------------------------------------------------- Status
function Mostrar-Enderecos([string] $ip) {
  $ipTxt = if ($ip) { $ip } else { 'IP-DO-COMPUTADOR' }
  $texto = @"
SERVIDOR LOCAL EHR SOLUTIONS - ligado em $(Get-Date -Format 'dd/MM/yyyy HH:mm')

PAINEL WEB
  Neste computador:     http://localhost:$PortaPainel
  Outro aparelho/rede:  http://$($ipTxt):$PortaPainel
  Gestor:               gestor@ehr.com   senha: $SenhaGestor

APP EHR MOTORISTA (versão Local)
  Servidor:             http://$($ipTxt):$PortaApi/api
  Motorista:            motorista@ehr.com   senha: $SenhaMotorista

PLACA ESP32 (config.h) - só pelo Wi-Fi da mesma rede
  SERVIDOR_HOST  "$ipTxt"
  SERVIDOR_PORTA $PortaApi
  SERVIDOR_TLS   false
  WIFI_SSID / WIFI_SENHA = a rede deste computador
  API_KEY        gere no painel (Frota > caminhão > Chave do hardware)

O celular e a placa precisam estar no MESMO Wi-Fi deste computador.
Verificação facial em modo de teste (always_match): qualquer foto é aceita.
"@
  [System.IO.File]::WriteAllText($ArqEnderecos, $texto, (New-Object System.Text.UTF8Encoding($true)))
  Write-Host ''
  Write-Host '=================================================================' -ForegroundColor Green
  Write-Host $texto
  Write-Host '=================================================================' -ForegroundColor Green
  Write-Host "Estes endereços também foram salvos em: $ArqEnderecos"
}

function Status {
  Titulo 'Status'
  $itens = @(@('Banco', $PortaBanco), @('Servidor', $PortaApi), @('Painel', $PortaPainel))
  foreach ($i in $itens) {
    if (Porta-Aberta $i[1]) { Ok "$($i[0]) ligado (porta $($i[1]))" } else { Aviso "$($i[0]) desligado (porta $($i[1]))" }
  }
  Info "Registros: $Logs"
}

# ===================================================================== Main
Garantir-Pasta $Local; Garantir-Pasta $Logs; Garantir-Pasta $Estado
try {
  switch ($Acao) {
    'parar'  { Parar-Tudo }
    'status' { Status }
    'iniciar' {
      Write-Host 'SERVIDOR LOCAL EHR SOLUTIONS' -ForegroundColor Cyan
      Write-Host "Cópia de trabalho: $Local"
      $dirNode = Garantir-Node
      $env:PATH = "$dirNode;$env:PATH"
      $global:NodeExe = Join-Path $dirNode 'node.exe'
      Preparar-Codigo
      Iniciar-Banco
      Iniciar-Backend
      $ip = Obter-IP
      Iniciar-Painel $ip
      if (-not $SemFirewall) { Liberar-Firewall }
      Mostrar-Enderecos $ip
      Write-Host ''
      Write-Host 'Tudo ligado. Pode fechar esta janela: o servidor continua rodando.' -ForegroundColor Green
      Write-Host 'Para desligar, use PARAR_SERVIDOR.bat.'
      if (-not $SemPausa) { Start-Process "http://localhost:$PortaPainel" }
    }
  }
  $codigo = 0
} catch {
  Write-Host ''
  Write-Host "Falhou: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Registros em: $Logs"
  $codigo = 1
}
if (-not $SemPausa) { Write-Host ''; Read-Host 'Pressione Enter para fechar' | Out-Null }
exit $codigo
