@echo off
cd /d "%~dp0.."
call .venv\Scripts\activate.bat
set DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
set GUILD_ID=1518954946110685184
python bot\zyrex_bot.py
pause
