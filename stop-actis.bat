@echo off
title ACTIS - Stop Web Application
color 0E

echo ===================================================
echo             MENGHENTIKAN SISTEM ACTIS
echo ===================================================
echo.

cd /d "%~dp0"

echo [1/2] Menghentikan container database PostgreSQL...
docker compose stop postgres

echo [OK] PostgreSQL berhasil dihentikan dengan aman.
echo Data Anda tetap tersimpan utuh di Docker Volume.
echo.
echo ===================================================
pause

