@echo off
title ACTIS - Start Web Application
color 0A

echo ===================================================
echo             MENJALANKAN SISTEM ACTIS
echo ===================================================
echo.

:: 1. Memastikan folder kerja berada di direktori project ini
cd /d "%~dp0"

:: 2. Mengecek dan menyalakan Database PostgreSQL Docker
echo [1/3] Menjalankan Database PostgreSQL di Docker...
docker compose up -d postgres
if %errorlevel% neq 0 (
    echo.
    color 0C
    echo [ERROR] Gagal menyalakan Docker!
    echo Pastikan aplikasi "Docker Desktop" sudah dibuka dan berstatus "Engine running".
    echo.
    echo Setelah Docker Desktop aktif, silakan jalankan kembali file ini.
    echo ===================================================
    pause
    exit /b %errorlevel%
)

echo [OK] Database PostgreSQL siap di port 15432!
echo.

:: 3. Menjalankan Server Web ACTIS (Next.js)
echo [2/3] Memulai Web Server ACTIS...
echo Aplikasi akan terbuka di browser Anda: http://localhost:3000
echo (Tekan Ctrl + C di jendela ini jika ingin menghentikan aplikasi)
echo ===================================================
echo.

:: Membuka browser otomatis setelah 3 detik
start "" timeout /t 3 /nobreak >nul & start http://localhost:3000

:: Menjalankan Next.js dev server (dengan auto clean cache jika ada kendala OneDrive)
npm run dev
if %errorlevel% neq 0 (
    echo.
    echo Terdeteksi cache lama terganggu OneDrive, membersihkan cache .next...
    npm run dev:clean
)
