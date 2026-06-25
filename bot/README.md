# Zyrex Discord Bot

Self-hosted Discord bot for Zyrex website. Always online in DND mode.

## Setup

1. **Activate virtual environment:**
   ```powershell
   cd ..
   .\.venv\Scripts\Activate.ps1
   ```

2. **Set your bot token as environment variable:**
   ```powershell
   $env:DISCORD_BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"
   ```

3. **Run the bot:**
   ```powershell
   python bot\zyrex_bot.py
   ```

## Install as Windows Service (auto-start at boot)

1. **Run the installer with your bot token:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File bot\install_service.ps1 -BotToken "YOUR_BOT_TOKEN_HERE"
   ```

2. **Start the task immediately:**
   ```powershell
   Start-ScheduledTask -TaskName "ZyrexDiscordBot"
   ```

## Verify

- Bot will appear online with **Do Not Disturb** status
- Custom status: `watching zyrexediting.xyz`
- Guild stats are cached every 5 minutes to `bot/guild_stats.json`
