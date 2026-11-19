@echo off
title Black Hole Relativistic Simulation Launcher
echo Starting Black Hole Simulation Web Application...
start "" "http://localhost:8000"
node server.js
if %errorlevel% neq 0 (
    echo Opening index.html directly...
    start "" "index.html"
)
pause
