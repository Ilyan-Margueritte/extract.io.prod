@echo off
cd /d "%~dp0"
git add .
git commit -m "fix: subscription plan fetch from DB, add cache busting"
git push