@echo off
rem Abre a Clinica Sagrada Esperanca em http://localhost:5180
cd /d "%~dp0"
if not exist node_modules (
  echo A instalar as dependencias. Na primeira vez demora alguns minutos...
  call npm install
)
start "" http://localhost:5180
call npm run dev
