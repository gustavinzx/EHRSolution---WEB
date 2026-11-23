@echo off
chcp 65001 >nul
title Servidor local EHR - parar
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\servidor_local.ps1" parar
