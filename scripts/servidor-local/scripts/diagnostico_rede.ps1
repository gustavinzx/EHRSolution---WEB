<#
  Diagnóstico e correção da rede do servidor local EHR
  Gera DIAGNOSTICO_REDE.txt na pasta do servidor. Com -Corrigir (precisa de
  administrador) remove bloqueios do Node.js no firewall e libera as portas
  3001 e 5173 para aparelhos da rede local.
#>
param([switch] $Corrigir, [string] $Relatorio)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$Pasta = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $Relatorio) { $Relatorio = Join-Path $Pasta 'DIAGNOSTICO_REDE.txt' }
$Portas = @(3001, 5173)
$RedesPrivadas = @('LocalSubnet', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16')
$NomeRegraPortas = 'EHR Servidor Local (teste)'
$NomeRegraNode = 'EHR Servidor Local - Node.js (teste)'
$linhas = New-Object System.Collections.Generic.List[string]
function L([string] $t) { $linhas.Add($t); Write-Host $t }

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
L "DIAGNÓSTICO DE REDE - SERVIDOR LOCAL EHR - $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')"
L "Computador: $env:COMPUTERNAME   Administrador: $admin   Correção pedida: $Corrigir"
L ''

# ------------------------------------------------------------ Correção
if ($Corrigir) {
  L '== CORREÇÃO =='
  if (-not $admin) {
    L '  [!] Sem permissão de administrador: correção não aplicada.'
  } else {
    # 1) Regras de BLOQUEIO de entrada para node.exe (criadas quando o aviso do Windows é cancelado)
    $bloqueios = Get-NetFirewallApplicationFilter -ErrorAction SilentlyContinue |
      Where-Object { $_.Program -like '*node.exe' } |
      Get-NetFirewallRule -ErrorAction SilentlyContinue |
      Where-Object { $_.Direction -eq 'Inbound' -and $_.Action -eq 'Block' }
    foreach ($r in $bloqueios) {
      Remove-NetFirewallRule -Name $r.Name -ErrorAction SilentlyContinue
      L "  [OK] Removido bloqueio do firewall: $($r.DisplayName)"
    }
    if (-not $bloqueios) { L '  [OK] Nenhum bloqueio do Node.js no firewall' }

    # 2) Liberação das portas para redes privadas (inclui sub-redes diferentes do mesmo roteador)
    Get-NetFirewallRule -DisplayName $NomeRegraPortas -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -DisplayName $NomeRegraPortas -Direction Inbound -Protocol TCP -LocalPort $Portas `
      -Action Allow -Profile Any -RemoteAddress $RedesPrivadas | Out-Null
    L '  [OK] Portas 3001 e 5173 liberadas para redes privadas (192.168.x.x, 10.x.x.x, 172.16-31.x.x)'

    # 3) Liberação do programa node.exe que está servindo a porta 3001
    $con = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    $exe = $null
    if ($con) { $exe = (Get-Process -Id $con.OwningProcess -ErrorAction SilentlyContinue).Path }
    if (-not $exe) {
      $cand = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'EHR-Local\node') -Filter node.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($cand) { $exe = $cand.FullName } else { $c = Get-Command node.exe -ErrorAction SilentlyContinue; if ($c) { $exe = $c.Source } }
    }
    if ($exe) {
      Get-NetFirewallRule -DisplayName $NomeRegraNode -ErrorAction SilentlyContinue | Remove-NetFirewallRule
      New-NetFirewallRule -DisplayName $NomeRegraNode -Direction Inbound -Program $exe -Action Allow -Profile Any `
        -RemoteAddress $RedesPrivadas | Out-Null
      L "  [OK] Node.js liberado no firewall: $exe"
    }
  }
  L ''
}

# ---------------------------------------------------------------- Rede
L '== REDE DO COMPUTADOR =='
try {
  Get-NetIPConfiguration -ErrorAction Stop | Where-Object { $_.IPv4Address } | ForEach-Object {
    $perfil = (Get-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue)
    $gw = if ($_.IPv4DefaultGateway) { $_.IPv4DefaultGateway.NextHop } else { '-' }
    L ("  {0,-28} IP {1,-16} gateway {2,-15} rede '{3}' ({4}) status {5}" -f $_.InterfaceAlias, @($_.IPv4Address)[0].IPAddress, $gw,
       $(if ($perfil) { $perfil.Name } else { '-' }), $(if ($perfil) { $perfil.NetworkCategory } else { '-' }), $_.NetAdapter.Status)
  }
} catch { L "  [!] Não consegui ler a configuração de rede: $($_.Exception.Message)" }
L ''

# -------------------------------------------------------------- Portas
L '== SERVIDOR ESCUTANDO =='
foreach ($p in $Portas) {
  $cs = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
  if (-not $cs) { L "  [!] Porta ${p}: NINGUÉM escutando (servidor desligado?)"; continue }
  foreach ($c in $cs) {
    $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    L "  [OK] Porta $p em $($c.LocalAddress) - $($proc.ProcessName) $($proc.Path)"
  }
}
$ips = @()
try { $ips = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | ForEach-Object { @($_.IPv4Address)[0].IPAddress } } catch {}
foreach ($alvo in (@('127.0.0.1') + $ips)) {
  try {
    $r = Invoke-WebRequest -Uri "http://$($alvo):3001/api/health" -UseBasicParsing -TimeoutSec 5
    $c = $r.Content; if ($c -is [byte[]]) { $c = [System.Text.Encoding]::UTF8.GetString($c) }
    L "  [OK] http://$($alvo):3001/api/health responde: $c"
  } catch { L "  [!] http://$($alvo):3001/api/health NÃO responde: $($_.Exception.Message)" }
}
L ''

# ------------------------------------------------------------ Firewall
L '== FIREWALL DO WINDOWS =='
try {
  Get-NetFirewallProfile -ErrorAction Stop | ForEach-Object {
    L "  Perfil $($_.Name): firewall $(if ($_.Enabled) { 'LIGADO' } else { 'desligado' }), entrada padrão $($_.DefaultInboundAction)"
  }
} catch { L "  [!] Não consegui ler os perfis do firewall" }
foreach ($n in @($NomeRegraPortas, $NomeRegraNode)) {
  $r = Get-NetFirewallRule -DisplayName $n -ErrorAction SilentlyContinue
  if ($r) {
    $end = ($r | Get-NetFirewallAddressFilter).RemoteAddress -join ','
    L "  [OK] Regra '$n': ativa=$($r.Enabled) ação=$($r.Action) perfil=$($r.Profile) origem=$end"
  } else { L "  [!] Regra '$n' NÃO existe" }
}
$regrasNode = Get-NetFirewallApplicationFilter -ErrorAction SilentlyContinue | Where-Object { $_.Program -like '*node.exe' } |
  ForEach-Object { $prog = $_.Program; $_ | Get-NetFirewallRule -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ R = $_; P = $prog } } }
foreach ($x in $regrasNode) {
  if ($x.R.Direction -eq 'Inbound') {
    $marca = if ($x.R.Action -eq 'Block' -and $x.R.Enabled -eq 'True') { '[!] BLOQUEIO' } else { '     ' }
    L "  $marca '$($x.R.DisplayName)' ação=$($x.R.Action) ativa=$($x.R.Enabled) perfil=$($x.R.Profile) programa=$($x.P)"
  }
}
L ''

# ------------------------------------------------------ Antivírus/firewall de terceiros
L '== ANTIVÍRUS E FIREWALLS INSTALADOS =='
foreach ($cls in @('FirewallProduct', 'AntiVirusProduct')) {
  try {
    Get-CimInstance -Namespace root/SecurityCenter2 -ClassName $cls -ErrorAction Stop | ForEach-Object { L "  ${cls}: $($_.displayName)" }
  } catch { L "  ${cls}: não disponível" }
}
L ''
L '== TESTE NO CELULAR =='
foreach ($ip in $ips) { L "  No navegador do celular (mesmo Wi-Fi), abra: http://$($ip):3001/api/health  -> deve mostrar {""status"":""ok""}" }

[System.IO.File]::WriteAllText($Relatorio, ($linhas -join "`r`n"), (New-Object System.Text.UTF8Encoding($true)))
Write-Host ''
Write-Host "Relatório salvo em: $Relatorio" -ForegroundColor Green
