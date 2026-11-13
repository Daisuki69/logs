@echo off
echo Waiting for Antigravity IDE and agy.exe to close...
python "C:\AI Logs\2026-11-12\095836\cutover_8f2bd4b5.py" "C:\Users\CxAdmin\.gemini\antigravity" "C:\Users\CxAdmin\.gemini\antigravity\_import_stage" "C:\AI Logs\2026-11-12\095836\cutover_verify.txt"
if exist "C:\AI Logs\2026-11-12\095836\cutover_verify.txt" type "C:\AI Logs\2026-11-12\095836\cutover_verify.txt"
if exist "C:\AI Logs\2026-11-12\095836\cutover_verify.txt.err.txt" type "C:\AI Logs\2026-11-12\095836\cutover_verify.txt.err.txt"
pause
