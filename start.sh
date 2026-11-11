#!/bin/sh
cd "$(dirname "$0")"
echo "Запускаем Склад... затем откройте http://localhost:8080"
(sleep 25; (xdg-open http://localhost:8080 || open http://localhost:8080) >/dev/null 2>&1) &
exec mvn -q spring-boot:run
