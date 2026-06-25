"""
Zyrex Discord Bot - Self-hosted, always online in DND mode.
Provides real-time data to the Zyrex website.
"""

import discord
import os
import json
import asyncio
import logging
from discord.ext import tasks

# === CONFIG ===
BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")
GUILD_ID = int(os.environ.get("GUILD_ID", "1518954946110685184"))
STATUS_TEXT = "zyrexediting.xyz"

# === SETUP ===
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("zyrex-bot")

intents = discord.Intents.default()
intents.guilds = True
intents.members = True
intents.presences = True

bot = discord.Bot if hasattr(discord, "Bot") else discord.Client

class ZyrexBot(discord.Client):
    def __init__(self):
        super().__init__(intents=intents)

    async def on_ready(self):
        log.info(f"✅ Bot online as {self.user} (ID: {self.user.id})")
        await self.change_presence(
            status=discord.Status.dnd,
            activity=discord.Activity(
                type=discord.ActivityType.watching,
                name=STATUS_TEXT
            )
        )
        log.info(f"🔴 Status set to DND — watching {STATUS_TEXT}")
        self.update_stats.start()

    async def on_guild_update(self, before, after):
        """Cache guild data when guild is updated."""
        pass

    @tasks.loop(minutes=5)
    async def update_stats(self):
        """Periodically update and cache guild stats for the website."""
        try:
            guild = self.get_guild(GUILD_ID)
            if not guild:
                guild = await self.fetch_guild(GUILD_ID)
            if guild:
                # Count non-category channels
                text_channels = len(guild.text_channels)
                voice_channels = len(guild.voice_channels)
                forum_channels = len(guild.forums) if hasattr(guild, 'forums') else 0
                total_channels = text_channels + voice_channels + forum_channels

                stats = {
                    "name": guild.name,
                    "icon": guild.icon.key if guild.icon else "",
                    "member_count": guild.member_count or 0,
                    "online_count": sum(1 for m in guild.members if m.status != discord.Status.offline) if guild.chunked else 0,
                    "channels_count": total_channels,
                    "roles_count": len(guild.roles),
                    "boost_level": guild.premium_tier,
                }

                # Write to a JSON file that the website can read
                os.makedirs("bot", exist_ok=True)
                with open("bot/guild_stats.json", "w") as f:
                    json.dump(stats, f, indent=2)
                log.info(f"📊 Stats cached: {stats['member_count']} members, {stats['channels_count']} channels")
        except Exception as e:
            log.error(f"❌ Stats update error: {e}")

    @update_stats.before_loop
    async def before_update_stats(self):
        await self.wait_until_ready()


if __name__ == "__main__":
    if not BOT_TOKEN:
        log.error("❌ DISCORD_BOT_TOKEN environment variable not set!")
        log.error("   Create a .env file or set the environment variable.")
        log.error("   Example: set DISCORD_BOT_TOKEN=your_token_here")
        exit(1)

    client = ZyrexBot()
    client.run(BOT_TOKEN)
