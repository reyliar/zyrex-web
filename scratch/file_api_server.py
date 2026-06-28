"""
Zyrex SFTPGo File Listing API Server
Reads SFTPGo user directories and returns JSON file listings.
Runs on http://localhost:8081
"""
import json
import os
import sys
import shutil
import sqlite3
import secrets
import time
import zipfile
import io
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

SFTPGO_DATA_DIR = r"C:\Users\reyli\Desktop\sftpgo\data"
BOT_DB_PATH = r"C:\Users\reyli\Desktop\zyrex-bot\data\zyrex.db"
PORT = 8081
SECRET_TOKEN = "zyrex-files-api-2026"
TOKEN_EXPIRY_SECONDS = 600  # 10 minutes

# In-memory token store: { token: { discord_id, product_id, file_path, created_at, used } }
download_tokens = {}

def generate_download_token(discord_id, product_id, file_path):
    """Generate a one-time download token."""
    token = secrets.token_hex(24)
    download_tokens[token] = {
        "discord_id": discord_id,
        "product_id": product_id,
        "file_path": file_path,
        "created_at": time.time(),
        "used": False,
    }
    # Clean expired tokens
    now = time.time()
    expired = [t for t, d in download_tokens.items() if now - d["created_at"] > TOKEN_EXPIRY_SECONDS]
    for t in expired:
        del download_tokens[t]
    return token

def validate_token(token):
    """Validate and consume a download token. Returns token data or None."""
    data = download_tokens.get(token)
    if not data:
        return None
    if data["used"]:
        return None  # Already used
    if time.time() - data["created_at"] > TOKEN_EXPIRY_SECONDS:
        del download_tokens[token]
        return None  # Expired
    data["used"] = True  # Mark as used (one-time)
    return data

def get_sftpgo_username(discord_id):
    """Look up SFTPGo username for a Discord ID from the bot database."""
    try:
        db = sqlite3.connect(BOT_DB_PATH)
        row = db.execute(
            "SELECT sftpgo_username FROM cloud_accounts WHERE discord_id = ?",
            (discord_id,)
        ).fetchone()
        db.close()
        return row[0] if row else None
    except Exception as e:
        print(f"DB lookup error: {e}")
        return None

def format_size(size_bytes):
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024*1024):.1f} MB"
    else:
        return f"{size_bytes / (1024*1024*1024):.1f} GB"

def list_directory(user_dir, relative_path=""):
    """List files and folders in a user's directory."""
    full_path = os.path.join(user_dir, relative_path.lstrip("/"))
    if not os.path.exists(full_path):
        return {"success": False, "error": "Path not found"}
    
    result = {"folders": [], "files": []}
    try:
        for entry in sorted(os.listdir(full_path)):
            entry_path = os.path.join(full_path, entry)
            is_dir = os.path.isdir(entry_path)
            if is_dir:
                result["folders"].append({"name": entry})
            else:
                size = os.path.getsize(entry_path)
                mtime = os.path.getmtime(entry_path)
                file_path = (relative_path.rstrip("/") + "/" + entry) if relative_path else "/" + entry
                result["files"].append({
                    "name": entry,
                    "path": file_path,
                    "size": size,
                    "size_formatted": format_size(size),
                    "last_modified": mtime,
                })
    except PermissionError:
        return {"success": False, "error": "Permission denied"}
    
    return {"success": True, "path": relative_path or "/", **result}

def detect_resources(username):
    """Scan user's directory for EDITOR/RESOURCE structure."""
    user_dir = os.path.join(SFTPGO_DATA_DIR, username)
    if not os.path.isdir(user_dir):
        return {"success": True, "resources": []}
    
    resources = []
    try:
        editors = sorted(os.listdir(user_dir))
    except PermissionError:
        return {"success": False, "error": "Permission denied"}
    
    for editor in editors:
        editor_path = os.path.join(user_dir, editor)
        if not os.path.isdir(editor_path):
            continue
        try:
            subs = sorted(os.listdir(editor_path))
        except PermissionError:
            continue
        
        has_files = False
        for sub in subs:
            sub_path = os.path.join(editor_path, sub)
            if os.path.isdir(sub_path):
                # Subfolder = resource
                try:
                    res_files = []
                    for f in sorted(os.listdir(sub_path)):
                        fp = os.path.join(sub_path, f)
                        if os.path.isfile(fp):
                            res_files.append({
                                "name": f,
                                "size": os.path.getsize(fp),
                                "path": f"{username}/{editor}/{sub}/{f}"
                            })
                    resources.append({
                        "editor": editor,
                        "resource": sub,
                        "files": res_files
                    })
                except PermissionError:
                    pass
            elif os.path.isfile(sub_path):
                has_files = True
        
        # If editor has files directly (no subfolders), treat editor as resource
        if has_files and not any(os.path.isdir(os.path.join(editor_path, s)) for s in subs):
            files = []
            for f in subs:
                fp = os.path.join(editor_path, f)
                if os.path.isfile(fp):
                    files.append({
                        "name": f,
                        "size": os.path.getsize(fp),
                        "path": f"{username}/{editor}/{f}"
                    })
            if files:
                resources.append({"editor": editor, "resource": editor, "files": files})
    
    return {"success": True, "resources": resources}

class FileAPIHandler(BaseHTTPRequestHandler):
    def _auth_check(self, params):
        auth = self.headers.get("X-Auth-Token") or self.headers.get("X-API-Token") or params.get("token", [None])[0]
        return auth == SECRET_TOKEN
    
    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Token")
        self.end_headers()
    
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path.rstrip("/") or "/"
        
        if not self._auth_check(params):
            self._send_json({"success": False, "error": "Unauthorized"}, 401)
            return
        
        if path == "/api/files/ping":
            self._send_json({"success": True, "message": "pong"})
            return
        
        # === DOWNLOAD TOKEN VALIDATION & FILE SERVING ===
        if path == "/api/files/validate":
            token = params.get("token", [None])[0]
            if not token:
                self._send_json({"success": False, "error": "Missing token"}, 400)
                return
            data = validate_token(token)
            if not data:
                self._send_json({"success": False, "error": "Invalid or expired token"}, 404)
                return
            self._send_json({
                "success": True,
                "product_id": data["product_id"],
                "file_path": data["file_path"],
                "discord_id": data["discord_id"],
            })
            return
        
        if path == "/api/files/download":
            token = params.get("token", [None])[0]
            if not token:
                self.send_error(400, "Missing token")
                return
            data = validate_token(token)
            if not data:
                self.send_error(404, "Invalid or expired token")
                return
            
            file_path = data["file_path"]
            if not os.path.exists(file_path):
                self.send_error(404, "File not found on disk")
                return
            
            # If it's a directory, create a ZIP
            if os.path.isdir(file_path):
                zip_buffer = io.BytesIO()
                with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
                    for root, dirs, files in os.walk(file_path):
                        for f in files:
                            full = os.path.join(root, f)
                            rel = os.path.relpath(full, file_path)
                            zf.write(full, rel)
                zip_data = zip_buffer.getvalue()
                filename = os.path.basename(file_path) + ".zip"
                self.send_response(200)
                self.send_header("Content-Type", "application/zip")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Content-Length", str(len(zip_data)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(zip_data)
            else:
                # Single file
                filename = os.path.basename(file_path)
                with open(file_path, 'rb') as f:
                    file_data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Content-Length", str(len(file_data)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(file_data)
            return
        
        # Endpoints that DON'T require discord_id
        if path == "/api/files/editors":
            editors = []
            if os.path.isdir(SFTPGO_DATA_DIR):
                for entry in sorted(os.listdir(SFTPGO_DATA_DIR)):
                    entry_path = os.path.join(SFTPGO_DATA_DIR, entry)
                    if os.path.isdir(entry_path):
                        editors.append(entry)
            self._send_json({"success": True, "editors": editors})
            return
        
        # Endpoints that DO require discord_id
        discord_id = params.get("discord_id", [None])[0]
        if not discord_id:
            self._send_json({"success": False, "error": "Missing discord_id"}, 400)
            return
        
        username = get_sftpgo_username(discord_id)
        if not username:
            self._send_json({"success": False, "error": "No SFTPGo account linked to this Discord ID"}, 404)
            return
        
        user_dir = os.path.join(SFTPGO_DATA_DIR, username)
        
        if path == "/api/files/list":
            browse_path = params.get("path", ["/"])[0]
            result = list_directory(user_dir, browse_path)
            self._send_json(result)
        elif path == "/api/files/resources":
            result = detect_resources(username)
            self._send_json(result)
        elif path == "/api/files/account":
            total_size, file_count = 0, 0
            if os.path.isdir(user_dir):
                for dirpath, dirnames, filenames in os.walk(user_dir):
                    for fn in filenames:
                        try:
                            total_size += os.path.getsize(os.path.join(dirpath, fn))
                            file_count += 1
                        except: pass
            self._send_json({
                "success": True, "username": username, "data_dir": user_dir,
                "exists": os.path.isdir(user_dir), "total_size": total_size, "file_count": file_count,
            })

        else:
            self._send_json({"success": False, "error": "Unknown endpoint"}, 404)
    
    def do_POST(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path.rstrip("/") or "/"
        
        if not self._auth_check(params):
            self._send_json({"success": False, "error": "Unauthorized"}, 401)
            return
        
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}
        
        if path == "/api/files/transfer":
            discord_id = body.get("discord_id", "")
            source_editor = body.get("source_editor", "")
            source_resource = body.get("source_resource", "")
            dest_editor = body.get("destination_editor", "")
            
            if not all([discord_id, source_editor, source_resource, dest_editor]):
                self._send_json({"success": False, "error": "Missing required fields: discord_id, source_editor, source_resource, destination_editor"}, 400)
                return
            
            username = get_sftpgo_username(discord_id)
            if not username:
                self._send_json({"success": False, "error": "No SFTPGo account linked"}, 404)
                return
            
            # Source: SFTPGO_DATA_DIR/{username}/{source_editor}/{source_resource}/
            source_dir = os.path.join(SFTPGO_DATA_DIR, username, source_editor, source_resource)
            # Destination: SFTPGO_DATA_DIR/{dest_editor}/{source_resource}/
            dest_dir = os.path.join(SFTPGO_DATA_DIR, dest_editor, source_resource)
            
            if not os.path.isdir(source_dir):
                self._send_json({"success": False, "error": f"Source directory not found: {source_editor}/{source_resource}"}, 404)
                return
            
            try:
                # Create destination directory structure
                os.makedirs(dest_dir, exist_ok=True)
                # Copy all files
                copied = []
                for root, dirs, files in os.walk(source_dir):
                    rel_path = os.path.relpath(root, source_dir)
                    target_dir = os.path.join(dest_dir, rel_path) if rel_path != "." else dest_dir
                    os.makedirs(target_dir, exist_ok=True)
                    for f in files:
                        src_file = os.path.join(root, f)
                        dst_file = os.path.join(target_dir, f)
                        shutil.copy2(src_file, dst_file)
                        copied.append(f"{rel_path}/{f}" if rel_path != "." else f)
                
                # Build the production file path
                file_path = f"{dest_editor}/{source_resource}"
                self._send_json({
                    "success": True,
                    "message": f"Copied {len(copied)} files",
                    "file_path": file_path,
                    "files_copied": len(copied),
                })
            except Exception as e:
                self._send_json({"success": False, "error": f"Transfer failed: {str(e)}"}, 500)
        
        elif path == "/api/files/create-editor":
            editor_name = body.get("name", "").strip()
            if not editor_name:
                self._send_json({"success": False, "error": "Folder name required"}, 400)
                return
            
            # Sanitize folder name
            safe_name = "".join(c for c in editor_name if c.isalnum() or c in " _-.").strip()
            if not safe_name:
                self._send_json({"success": False, "error": "Invalid folder name"}, 400)
                return
            
            editor_path = os.path.join(SFTPGO_DATA_DIR, safe_name)
            if os.path.exists(editor_path):
                self._send_json({"success": False, "error": f"Folder '{safe_name}' already exists"}, 409)
                return
            
            try:
                os.makedirs(editor_path, exist_ok=True)
                self._send_json({"success": True, "message": f"Editor folder '{safe_name}' created"})
            except Exception as e:
                self._send_json({"success": False, "error": f"Create failed: {str(e)}"}, 500)
        
        elif path == "/api/files/request-token":
            # Generate a one-time download token
            discord_id = body.get("discord_id", "")
            product_id = body.get("product_id", "")
            file_path = body.get("file_path", "")
            if not discord_id or not product_id:
                self._send_json({"success": False, "error": "Missing discord_id or product_id"}, 400)
                return
            if not file_path:
                self._send_json({"success": False, "error": "Missing file_path"}, 400)
                return
            
            full_path = os.path.join(SFTPGO_DATA_DIR, file_path.replace("/", os.sep))
            if not os.path.exists(full_path):
                self._send_json({"success": False, "error": f"Resource not found on disk: {file_path}"}, 404)
                return
            
            token = generate_download_token(discord_id, product_id, full_path)
            self._send_json({
                "success": True,
                "token": token,
                "url": f"https://dl.zyrexediting.xyz/?token={token}",
                "expires_in": TOKEN_EXPIRY_SECONDS,
            })
        
        else:
            self._send_json({"success": False, "error": "Unknown endpoint"}, 404)
    
    def log_message(self, format, *args):
        print(f"[{self.client_address[0]}] {args[0]}")

if __name__ == "__main__":
    print(f"Zyrex File API Server starting on port {PORT}...")
    print(f"Serving SFTPGo data from: {SFTPGO_DATA_DIR}")
    server = HTTPServer(("127.0.0.1", PORT), FileAPIHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Server stopped.")
        server.server_close()
