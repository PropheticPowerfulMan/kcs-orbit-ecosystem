@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0end-session.ps1" %*
