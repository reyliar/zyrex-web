"""Configuration for Zyrex Web Backend"""
import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'change-in-production')
    
    # Discord OAuth
    DISCORD_CLIENT_ID = os.environ.get('DISCORD_CLIENT_ID', '1519456130290417776')
    DISCORD_CLIENT_SECRET = os.environ.get('DISCORD_CLIENT_SECRET', '')
    DISCORD_BOT_TOKEN = os.environ.get('DISCORD_BOT_TOKEN', '')
    DISCORD_REDIRECT_URI = os.environ.get('DISCORD_REDIRECT_URI', 'http://127.0.0.1:5000/api/auth/callback')
    DISCORD_API_BASE = 'https://discord.com/api/v10'
    
    # Upload role
    UPLOAD_ROLE_ID = os.environ.get('UPLOAD_ROLE_ID', '1519624224476762122')
    
    # SFTPGo
    SFTPGO_API_URL = os.environ.get('SFTPGO_API_URL', 'http://127.0.0.1:8080/api/v2')
    SFTPGO_ADMIN_USER = os.environ.get('SFTPGO_ADMIN_USER', 'admin')
    SFTPGO_ADMIN_PASS = os.environ.get('SFTPGO_ADMIN_PASS', 'admin')
    
    # Guild
    GUILD_ID = os.environ.get('GUILD_ID', '1518954946110685184')
    
    # Database
    DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///zyrex.db')
