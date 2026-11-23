<#
  Roda o diagnóstico de rede como administrador (corrige o firewall) e copia
  o relatório DIAGNOSTICO_REDE.txt para a pasta do servidor.
#>
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$Pasta = Split-Path -Parent $PSScriptRoot
$Local = Join-Path $env:LOCALAPPDATA 'EHR-Local'
New-Item -ItemType Directory -Path $Local -Force | Out-Null
# A janela de administrador pode não enxergar o Google Drive: roda a partir da pasta local
$script = Join-Path $Local 'diagnostico_rede.ps1'
$rel = Join-Path $Local 'DIAGNOSTICO_REDE.txt'
Copy-Item (Join-Path $PSScriptRoot 'diagnostico_rede.ps1') $script -Force
if (Test-Path $rel) { Remove-Item $rel -Force }

Write-Host 'O Windows vai pedir permissão de administrador para corrigir o firewall. Aceite.' -ForegroundColor Yellow
$elevado = $true
try {
  Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$script`"", '-Corrigir', '-Relatorio', "`"$rel`"")
} catch { $elevado = $false }
if (-not $elevado -or -not (Test-Path $rel)) {
  Write-Host 'Sem permissão de administrador: faço só o diagnóstico, sem corrigir.' -ForegroundColor Yellow
  & $script -Relatorio $rel
}
Write-Host ''
if (Test-Path $rel) {
  Get-Content $rel -Encoding UTF8 | ForEach-Object { Write-Host $_ }
  Copy-Item $rel (Join-Path $Pasta 'DIAGNOSTICO_REDE.txt') -Force
  Write-Host ''
  Write-Host "Relatório copiado para: $(Join-Path $Pasta 'DIAGNOSTICO_REDE.txt')" -ForegroundColor Green
}
Write-Host ''
Read-Host 'Pressione Enter para fechar' | Out-Null
