@echo off
echo ========================================================
echo  Vocabulary Marathon EX-2 - Local Server
echo ========================================================
echo.
echo Starting local server...
echo PLEASE DO NOT CLOSE THIS WINDOW.
echo.

start http://localhost:8086
npx serve -l 8086

pause
