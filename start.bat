@echo off
chcp 65001 >nul
title Склад
echo Запускаем Склад... Когда появится строка "Started WarehouseApplication", откройте http://localhost:8080
start "" cmd /c "timeout /t 25 >nul & start http://localhost:8080"
call mvn -q spring-boot:run
pause
