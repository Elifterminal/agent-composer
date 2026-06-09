@echo off
title AgentScore
rem Double-click to run AgentScore locally (no Python needed; uses PowerShell).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
