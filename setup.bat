@echo off
chcp 65001 > nul
echo.
echo ========================================
echo   Nexus Agent — Instalação
echo ========================================
echo.

REM Remove flag read-only herdada da extração de ZIP no Windows
attrib -R /S /D > nul 2>&1

REM Verifica se Python está instalado
python --version > nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python não encontrado.
    echo.
    echo Instale o Python em: https://www.python.org/downloads/
    echo IMPORTANTE: marque "Add Python to PATH" durante a instalação.
    echo.
    pause
    exit /b 1
)

if exist .venv (
    echo Encontrei instalacao anterior. Removendo para instalar do zero...
    rmdir /s /q .venv
)

echo [1/4] Python encontrado. Criando ambiente virtual...
python -m venv .venv
if errorlevel 1 (
    echo [ERRO] Falha ao criar ambiente virtual.
    pause
    exit /b 1
)

echo [2/4] Instalando dependências (pode demorar alguns minutos)...
.venv\Scripts\pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependências.
    pause
    exit /b 1
)

echo [3/4] Baixando modelo de reconhecimento de voz...
.venv\Scripts\python agent\setup_models.py
if errorlevel 1 (
    echo [AVISO] Falha ao baixar modelo de voz. Tente rodar manualmente:
    echo   .venv\Scripts\python agent\setup_models.py
)

echo [4/4] Instalação concluída!
echo.
echo ========================================
echo   Próximo passo: parear o agente
echo ========================================
echo.
echo 1. Abra https://usenexus.online e faça login
echo 2. Vá em "Parear agente" e clique em "Gerar código"
echo 3. Execute o agente rodando este comando:
echo.
echo    .venv\Scripts\python -m agent.main
echo.
echo 4. Cole o código de 8 caracteres quando solicitado
echo.
pause
