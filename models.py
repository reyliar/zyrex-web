"""Database models for Zyrex Web"""
import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'zyrex.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            global_name TEXT,
            avatar TEXT,
            email TEXT,
            roles TEXT,
            access_token TEXT,
            refresh_token TEXT,
            token_expires_at INTEGER,
            sftpgo_username TEXT,
            sftpgo_password TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('preset', 'plugin')),
            category TEXT NOT NULL,
            platform TEXT DEFAULT 'both',
            password TEXT DEFAULT 'star',
            description TEXT,
            file_path TEXT,
            thumbnail TEXT,
            author_id TEXT,
            author_name TEXT,
            downloads INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sftpgo_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            home_dir TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS transfer_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id TEXT,
            sftp_path TEXT NOT NULL,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
            uploaded_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        );
    ''')
    conn.commit()
    conn.close()

# --- User Functions ---

def upsert_user(user_data):
    conn = get_db()
    conn.execute('''
        INSERT INTO users (id, username, global_name, avatar, email, roles, access_token, refresh_token, token_expires_at, last_login)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            username = excluded.username,
            global_name = excluded.global_name,
            avatar = excluded.avatar,
            email = excluded.email,
            roles = excluded.roles,
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            token_expires_at = excluded.token_expires_at,
            last_login = excluded.last_login
    ''', (
        user_data['id'],
        user_data.get('username', ''),
        user_data.get('global_name', ''),
        user_data.get('avatar', ''),
        user_data.get('email', ''),
        user_data.get('roles', ''),
        user_data.get('access_token', ''),
        user_data.get('refresh_token', ''),
        user_data.get('token_expires_at', 0),
        datetime.utcnow().isoformat()
    ))
    conn.commit()
    conn.close()

def get_user(user_id):
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    return dict(user) if user else None

# --- Product Functions ---

def add_product(product_data):
    conn = get_db()
    conn.execute('''
        INSERT INTO products (id, name, type, category, platform, password, description, file_path, thumbnail, author_id, author_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        product_data['id'],
        product_data['name'],
        product_data['type'],
        product_data['category'],
        product_data.get('platform', 'both'),
        product_data.get('password', 'star'),
        product_data.get('description', ''),
        product_data.get('file_path', ''),
        product_data.get('thumbnail', ''),
        product_data.get('author_id', ''),
        product_data.get('author_name', '')
    ))
    conn.commit()
    conn.close()

def get_all_products(product_type=None):
    conn = get_db()
    if product_type:
        rows = conn.execute('SELECT * FROM products WHERE type = ? ORDER BY created_at DESC', (product_type,)).fetchall()
    else:
        rows = conn.execute('SELECT * FROM products ORDER BY created_at DESC').fetchall()
    conn.close()
    return [dict(r) for r in rows]

# --- SFTPGo Functions ---

def save_sftpgo_account(user_id, username, password, home_dir):
    conn = get_db()
    conn.execute('''
        INSERT OR REPLACE INTO sftpgo_accounts (user_id, username, password, home_dir)
        VALUES (?, ?, ?, ?)
    ''', (user_id, username, password, home_dir))
    conn.execute('UPDATE users SET sftpgo_username = ? WHERE id = ?', (username, user_id))
    conn.commit()
    conn.close()

def get_sftpgo_account(user_id):
    conn = get_db()
    account = conn.execute('SELECT * FROM sftpgo_accounts WHERE user_id = ?', (user_id,)).fetchone()
    conn.close()
    return dict(account) if account else None

# --- Transfer Queue ---

def add_to_queue(sftp_path, uploaded_by):
    conn = get_db()
    conn.execute('INSERT INTO transfer_queue (sftp_path, uploaded_by) VALUES (?, ?)', (sftp_path, uploaded_by))
    conn.commit()
    conn.close()

def get_pending_transfers():
    conn = get_db()
    rows = conn.execute('SELECT * FROM transfer_queue WHERE status = "pending" ORDER BY created_at ASC').fetchall()
    conn.close()
    return [dict(r) for r in rows]

if __name__ == '__main__':
    init_db()
    print("✅ Database initialized!")
