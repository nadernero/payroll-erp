@echo off
chcp 65001 >nul
title ترحيل البيانات إلى Firebase Firestore
cd /d "%~dp0"

echo =======================================================
echo    جاري ترحيل كافة البيانات إلى Firebase Firestore...
echo =======================================================
node scripts/migrate-to-firestore.js

echo.
pause
