@echo off
rem Starts a small local web server for the real-time viewer and opens it. Close this window to stop it.
rem The server tells the browser not to cache, so a normal refresh always shows the latest version.
cd /d "%~dp0"
start "" "http://127.0.0.1:8766/web/"
"E:\img3d\venv-hy3d\Scripts\python.exe" serve.py 8766
