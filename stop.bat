@echo off
chcp 65001 > nul
echo.
echo Parando o Nexus Agent...
echo.

powershell -NoProfile -Command "$found = $false; Get-CimInstance Win32_Process -Filter \"Name='pythonw.exe' OR Name='python.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*agent.main*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; $found = $true; Write-Host ('[OK] Processo ' + $_.ProcessId + ' encerrado.') }; if (-not $found) { Write-Host 'Nenhum agente Nexus em execucao foi encontrado.' }"

echo.
pause
