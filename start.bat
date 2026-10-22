@echo off
echo ===================================================
echo   AVVIO HERBARIUM - DATABASE BOTANICO ONLINE
echo ===================================================
echo.

echo 1. Avvio Server Node.js (Porta 3000)...
start "Herbarium Server" /b node server.js

timeout /t 2 /nobreak > nul

echo 2. Avvio Cloudflare Tunnel Pubblico...
start "Herbarium Tunnel" .\cloudflared.exe tunnel --url http://localhost:3000

echo.
echo ===================================================
echo   L'applicazione e attiva su http://localhost:3000
echo   Controlla la finestra del Tunnel per l'URL pubblico!
echo ===================================================
pause
