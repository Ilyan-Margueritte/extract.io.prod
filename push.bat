@echo off
cd /d "%~dp0"
clear
git add -A
git commit -m "fix: subscription plan fetch from DB, add cache busting"
git push