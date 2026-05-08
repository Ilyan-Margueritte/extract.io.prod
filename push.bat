@echo off
cd /d "%~dp0"
git add -A
git commit -m "fix: subscription plan fetch from DB, add cache busting"
git push