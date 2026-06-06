@echo off
chcp 65001 > nul
echo.
echo ========================================
echo   Nexus Agent - Iniciar com o Windows
echo ========================================
echo.

set "AGENT_DIR=%~dp0"
set "AGENT_DIR=%AGENT_DIR:~0,-1%"
set "PYW=%AGENT_DIR%\.venv\Scripts\pythonw.exe"

if not exist "%PYW%" (
    echo [ERRO] Ambiente Python nao encontrado.
    echo Rode setup.bat primeiro para instalar o agente.
    echo.
    pause
    exit /b 1
)

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP%\Nexus Agent.lnk"

powershell -NoProfile -Command "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%LNK%'); $s.TargetPath = '%PYW%'; $s.Arguments = '-m agent.main'; $s.WorkingDirectory = '%AGENT_DIR%'; $s.WindowStyle = 7; $s.Description = 'Nexus Agent (em segundo plano)'; $s.Save()"

if exist "%LNK%" (
    echo [OK] Nexus Agent agora vai iniciar junto com o Windows.
    echo.
    echo Como verificar se esta rodando:
    echo   1. Aperte Ctrl + Shift + Esc para abrir o Gerenciador de Tarefas
    echo   2. Aba "Processos" - procure por "pythonw.exe"
    echo.
    echo Para PARAR o agente agora: rode stop.bat
    echo Para DESATIVAR o inicio automatico: rode disable_autostart.bat
    echo.
    echo OBS: O agente roda sem janela visivel. Isso e normal.
    echo      Diga "ola nexus" perto do microfone para acorda-lo.
) else (
    echo [ERRO] Nao foi possivel criar o atalho de inicio automatico.
)
echo.
pause
