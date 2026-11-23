@echo off
chcp 65001 >nul
title Servidor local EHR - status
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\servidor_local.ps1" status
