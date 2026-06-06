@echo off
chcp 65001 > nul
echo Iniciando Nexus Agent...
echo.
.venv\Scripts\python -m agent.main
echo.
if errorlevel 1 (
    echo [ERRO] O agente encerrou com um erro.
    echo Se for a primeira vez, rode o setup.bat antes.
)
pause
