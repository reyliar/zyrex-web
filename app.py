"""Zyrex Web Backend - Flask Server with Discord OAuth & SFTPGo Integration"""
import os
import sys
import json
import uuid
import requests
from datetime import datetime
from flask import Flask, redirect, request, jsonify, session, render_template, send_from_directory, Response
from functools import wraps

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import Config
from models import init_db, upsert_user, get_user, add_product, get_all_products, save_sftpgo_account, get_sftpgo_account, add_to_queue, get_pending_transfers

app = Flask(__name__, static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = Config.SECRET_KEY
app.config['SESSION_TYPE'] = 'filesystem'

# Initialize database
init_db()

# ============ DISCORD OAUTH ============

DISCORD_API = Config.DISCORD_API_BASE
DISCORD_OAUTH_URL = f"{DISCORD_API}/oauth2/authorize"
DISCORD_TOKEN_URL = f"{DISCORD_API}/oauth2/token"
DISCORD_USER_URL = f"{DISCORD_API}/users/@me"
DISCORD_GUILD_MEMBER_URL = f"{DISCORD_API}/guilds/{Config.GUILD_ID}/members"

def get_discord_oauth_url():
    return (
        f"{DISCORD_OAUTH_URL}?"
        f"client_id={Config.DISCORD_CLIENT_ID}&"
        f"redirect_uri={Config.DISCORD_REDIRECT_URI}&"
        f"response_type=code&"
        f"scope=identify+email+guilds.members.read&"
        f"prompt=none"
    )

def exchange_code(code):
    data = {
        'client_id': Config.DISCORD_CLIENT_ID,
        'client_secret': Config.DISCORD_CLIENT_SECRET,
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': Config.DISCORD_REDIRECT_URI
    }
    headers = {'Content-Type': 'application/x-www-form-urlencoded'}
    resp = requests.post(DISCORD_TOKEN_URL, data=data, headers=headers)
    if resp.status_code != 200:
        return None
    return resp.json()

def refresh_token(refresh_token):
    data = {
        'client_id': Config.DISCORD_CLIENT_ID,
        'client_secret': Config.DISCORD_CLIENT_SECRET,
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token
    }
    headers = {'Content-Type': 'application/x-www-form-urlencoded'}
    resp = requests.post(DISCORD_TOKEN_URL, data=data, headers=headers)
    if resp.status_code != 200:
        return None
    return resp.json()

def get_discord_user(access_token):
    headers = {'Authorization': f'Bearer {access_token}'}
    resp = requests.get(DISCORD_USER_URL, headers=headers)
    if resp.status_code != 200:
        return None
    return resp.json()

def get_guild_member(user_id):
    """Check if user is in the guild and get their roles"""
    headers = {'Authorization': f'Bot {Config.DISCORD_BOT_TOKEN}'}
    resp = requests.get(f"{DISCORD_GUILD_MEMBER_URL}/{user_id}", headers=headers)
    if resp.status_code != 200:
        return None
    return resp.json()

# ============ DECORATORS ============

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Not logged in'}), 401
        return f(*args, **kwargs)
    return decorated

def upload_role_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Not logged in'}), 401
        user = get_user(session['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        roles = json.loads(user.get('roles', '[]'))
        if Config.UPLOAD_ROLE_ID not in roles:
            return jsonify({'error': 'You do not have permission to upload'}), 403
        return f(*args, **kwargs)
    decorated.__name__ = f.__name__
    return decorated

# ============ ROUTES - AUTH ============

@app.route('/api/login')
def login():
    return redirect(get_discord_oauth_url())

@app.route('/api/auth/callback')
def auth_callback():
    code = request.args.get('code')
    if not code:
        return redirect('/?error=no_code')
    
    token_data = exchange_code(code)
    if not token_data:
        return redirect('/?error=auth_failed')
    
    access_token = token_data.get('access_token')
    refresh_token_val = token_data.get('refresh_token')
    expires_in = token_data.get('expires_in', 0)
    
    discord_user = get_discord_user(access_token)
    if not discord_user:
        return redirect('/?error=user_fetch_failed')
    
    # Check guild membership
    guild_member = get_guild_member(discord_user['id'])
    roles = []
    if guild_member:
        roles = guild_member.get('roles', [])
    
    user_data = {
        'id': discord_user['id'],
        'username': discord_user.get('username', ''),
        'global_name': discord_user.get('global_name', '') or discord_user.get('username', ''),
        'avatar': discord_user.get('avatar', ''),
        'email': discord_user.get('email', ''),
        'roles': json.dumps(roles),
        'access_token': access_token,
        'refresh_token': refresh_token_val,
        'token_expires_at': int(datetime.utcnow().timestamp()) + expires_in
    }
    
    upsert_user(user_data)
    session['user_id'] = discord_user['id']
    session['username'] = discord_user.get('global_name', '') or discord_user.get('username', '')
    session['avatar'] = discord_user.get('avatar', '')
    session['can_upload'] = Config.UPLOAD_ROLE_ID in roles
    
    return redirect('/')

@app.route('/api/logout')
def logout():
    session.clear()
    return redirect('/')

@app.route('/api/me')
@login_required
def me():
    user = get_user(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({
        'id': user['id'],
        'username': user['username'],
        'global_name': user['global_name'],
        'avatar': user['avatar'],
        'can_upload': json.loads(user.get('roles', '[]')).count(Config.UPLOAD_ROLE_ID) > 0 if Config.UPLOAD_ROLE_ID in json.loads(user.get('roles', '[]')) else False,
        'sftpgo_username': user.get('sftpgo_username')
    })

# ============ ROUTES - SFTPGo ============

@app.route('/api/sftpgo/create-account', methods=['POST'])
@upload_role_required
def create_sftpgo_account():
    user = get_user(session['user_id'])
    
    # Generate unique credentials
    username = f"zyrex_{user['username']}_{uuid.uuid4().hex[:6]}"
    password = uuid.uuid4().hex[:12]
    home_dir = f"/{user['username']}"
    
    # Save to database
    save_sftpgo_account(user['id'], username, password, home_dir)
    
    # Try to create in SFTPGo
    try:
        sftpgo_data = {
            "username": username,
            "password": password,
            "home_dir": home_dir,
            "permissions": {
                "/": ["*"]
            },
            "max_sessions": 3,
            "quota_size": 1073741824,  # 1GB
            "quota_files": 100
        }
        resp = requests.post(
            f"{Config.SFTPGO_API_URL}/users",
            json=sftpgo_data,
            auth=(Config.SFTPGO_ADMIN_USER, Config.SFTPGO_ADMIN_PASS)
        )
        if resp.status_code not in (200, 201):
            print(f"SFTPGo creation failed: {resp.status_code} {resp.text}")
            # Still return success since we saved locally
    except Exception as e:
        print(f"SFTPGo connection failed: {e}")
    
    return jsonify({
        'username': username,
        'password': password,
        'server': '127.0.0.1:2222',
        'home_dir': home_dir
    })

@app.route('/api/sftpgo/my-account')
@login_required
def get_my_sftpgo_account():
    account = get_sftpgo_account(session['user_id'])
    if not account:
        return jsonify({'error': 'No SFTPGo account yet'}), 404
    return jsonify({
        'username': account['username'],
        'server': '127.0.0.1:2222',
        'home_dir': account['home_dir'],
        'created_at': account['created_at']
    })

# ============ ROUTES - GUILD STATS ============

# ============ ROUTES - GUILD STATS & USER PROXY ============

@app.route('/api/guild/stats')
def guild_stats():
    """Fetch Discord server stats via bot proxy or fallback"""
    # 1. Try bot proxy
    try:
        resp = requests.get("http://93.115.101.154:12988/api/guild/stats", timeout=3)
        if resp.status_code == 200:
            return jsonify(resp.json())
    except Exception as e:
        print(f"Failed to fetch guild stats from bot: {e}")
        
    # 2. Try direct Discord API
    if Config.DISCORD_BOT_TOKEN:
        headers = {'Authorization': f'Bot {Config.DISCORD_BOT_TOKEN}'}
        try:
            guild_resp = requests.get(f"{DISCORD_API}/guilds/{Config.GUILD_ID}?with_counts=true", headers=headers, timeout=3)
            if guild_resp.status_code == 200:
                guild = guild_resp.json()
                return jsonify({
                    'name': guild.get('name', 'Zyrex Community'),
                    'icon': guild.get('icon', ''),
                    'member_count': guild.get('approximate_member_count') or guild.get('member_count', 0),
                    'online_count': guild.get('approximate_presence_count', 0),
                    'channels_count': 0,
                    'boost_level': guild.get('premium_tier', 0),
                })
        except Exception as ex:
            print(f"Failed to fetch guild stats from Discord directly: {ex}")
            
    return jsonify(fallback_guild_stats()), 200

def fallback_guild_stats():
    return {
        'name': 'Zyrex Community',
        'icon': '',
        'member_count': 0,
        'online_count': 0,
        'channels_count': 0,
        'boost_level': 0,
    }

@app.route('/api/discord-user')
def api_discord_user():
    """Fetch Discord user details via bot proxy or fallback"""
    user_id = request.args.get('userId')
    if not user_id:
        return jsonify({'success': False, 'error': 'userId required'}), 400
        
    # 1. Try bot proxy
    try:
        resp = requests.get(f"http://93.115.101.154:12988/api/discord-user?userId={user_id}", timeout=3)
        if resp.status_code == 200:
            return jsonify(resp.json())
    except Exception as e:
        print(f"Failed to fetch user from bot: {e}")
        
    # 2. Try direct Discord API
    if Config.DISCORD_BOT_TOKEN:
        headers = {'Authorization': f'Bot {Config.DISCORD_BOT_TOKEN}'}
        try:
            resp = requests.get(f"{DISCORD_API}/users/{user_id}", headers=headers, timeout=3)
            if resp.status_code == 200:
                return jsonify({'success': True, 'source': 'discord-rest', 'user': resp.json()})
        except Exception as ex:
            print(f"Failed to fetch user from Discord: {ex}")
            
    return jsonify({'success': False, 'error': 'User not found'}), 404

# ============ ROUTES - GENERIC BOT PROXY ============

@app.route('/api/sftpgo/<path:subpath>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def sftpgo_proxy(subpath):
    """Proxy unhandled SFTPGo requests to self-hosted bot API"""
    target_url = f"http://93.115.101.154:12988/api/sftpgo/{subpath}"
    if request.query_string:
        target_url += f"?{request.query_string.decode('utf-8')}"
        
    headers = {key: value for key, value in request.headers if key.lower() != 'host'}
    try:
        resp = requests.request(
            method=request.method,
            url=target_url,
            headers=headers,
            data=request.get_data(),
            cookies=request.cookies,
            allow_redirects=False,
            timeout=10
        )
        response = Response(resp.content, status=resp.status_code)
        for key, value in resp.headers.items():
            if key.lower() not in ['content-length', 'connection', 'transfer-encoding']:
                response.headers[key] = value
        return response
    except Exception as e:
        print(f"SFTPGo proxy error for {subpath}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/products/<path:subpath>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def products_proxy(subpath):
    """Proxy unhandled products requests (like submit) to self-hosted bot API"""
    target_url = f"http://93.115.101.154:12988/api/products/{subpath}"
    if request.query_string:
        target_url += f"?{request.query_string.decode('utf-8')}"
        
    headers = {key: value for key, value in request.headers if key.lower() != 'host'}
    try:
        resp = requests.request(
            method=request.method,
            url=target_url,
            headers=headers,
            data=request.get_data(),
            cookies=request.cookies,
            allow_redirects=False,
            timeout=10
        )
        response = Response(resp.content, status=resp.status_code)
        for key, value in resp.headers.items():
            if key.lower() not in ['content-length', 'connection', 'transfer-encoding']:
                response.headers[key] = value
        return response
    except Exception as e:
        print(f"Products proxy error for {subpath}: {e}")
        return jsonify({'error': str(e)}), 500


# ============ ROUTES - UPLOAD / TRANSFER ============

@app.route('/api/transfer/scan', methods=['POST'])
@upload_role_required
def scan_sftp_files():
    """Scan SFTPGo directories for new products to transfer"""
    # This would list files from SFTPGo and add to transfer queue
    # For now, accept a path from the user
    data = request.get_json()
    sftp_path = data.get('path', '')
    if not sftp_path:
        return jsonify({'error': 'Path required'}), 400
    
    # Parse path: creator/product_name or product_type/creator/product_name
    parts = sftp_path.strip('/').split('/')
    if len(parts) < 2:
        return jsonify({'error': 'Path must be: creator/product_name'}), 400
    
    add_to_queue(sftp_path, session['user_id'])
    return jsonify({'message': 'Added to transfer queue', 'path': sftp_path})

@app.route('/api/transfer/pending')
@login_required
def get_pending_transfers_route():
    transfers = get_pending_transfers()
    return jsonify(transfers)

@app.route('/api/transfer/process', methods=['POST'])
@upload_role_required
def process_transfer():
    """Process a transfer: copy file from SFTPGo to web directory and add to DB"""
    data = request.get_json()
    sftp_path = data.get('path', '')
    product_type = data.get('type', 'preset')  # 'preset' or 'plugin'
    category = data.get('category', 'others')
    name = data.get('name', '')
    description = data.get('description', '')
    
    if not sftp_path or not name:
        return jsonify({'error': 'Path and name required'}), 400
    
    product_id = f"{product_type}-{uuid.uuid4().hex[:8]}"
    
    # In production: copy file from SFTP to web directory
    # For now, register in database
    product_data = {
        'id': product_id,
        'name': name,
        'type': product_type,
        'category': category,
        'description': description,
        'author_id': session['user_id'],
        'author_name': session.get('username', 'Unknown'),
        'file_path': sftp_path
    }
    
    add_product(product_data)
    
    # Update transfer queue
    conn = __import__('sqlite3').connect('zyrex.db')
    conn.execute('UPDATE transfer_queue SET status = "completed", completed_at = ? WHERE sftp_path = ?',
                 (datetime.utcnow().isoformat(), sftp_path))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Product added successfully', 'product_id': product_id})

# ============ ROUTES - PRODUCTS API ============

@app.route('/api/products')
def api_products():
    product_type = request.args.get('type')
    products = get_all_products(product_type)
    return jsonify(products)

@app.route('/api/products/add', methods=['POST'])
@upload_role_required
def api_add_product():
    data = request.get_json()
    product_id = f"{data.get('type', 'preset')}-{uuid.uuid4().hex[:8]}"
    data['id'] = product_id
    data['author_id'] = session['user_id']
    data['author_name'] = session.get('username', 'Unknown')
    add_product(data)
    return jsonify({'message': 'Product added', 'id': product_id})

# ============ ROUTES - ADMIN PANEL ============

@app.route('/admin')
@login_required
def admin_panel():
    user = get_user(session['user_id'])
    roles = json.loads(user.get('roles', '[]')) if user else []
    can_upload = Config.UPLOAD_ROLE_ID in roles
    return render_template('admin.html', 
                         username=session.get('username', 'User'),
                         can_upload=can_upload,
                         avatar=session.get('avatar', ''))

# ============ ROUTES - STATIC FILES ============

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(path) and not path.startswith('api/'):
        return send_from_directory('.', path)
    return send_from_directory('.', 'index.html')

# ============ STARTUP ============

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 Zyrex Backend starting on http://127.0.0.1:{port}")
    print(f"🔑 Discord OAuth: {get_discord_oauth_url()}")
    app.run(host='127.0.0.1', port=port, debug=True)
