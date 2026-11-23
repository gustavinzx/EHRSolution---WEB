@echo off
chcp 65001 >nul
title Servidor local EHR - corrigir rede
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\corrigir_rede.ps1"
