@echo off
chcp 65001 > nul
echo.
echo Desativando inicio automatico do Nexus Agent...
echo.

set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Nexus Agent.lnk"

if exist "%LNK%" (
    del "%LNK%"
    echo [OK] Inicio automatico desativado.
    echo O Nexus nao vai mais iniciar sozinho com o Windows.
    echo.
    echo Para parar o agente que ja esta rodando agora: stop.bat
) else (
    echo Inicio automatico ja estava desativado.
)
echo.
pause
