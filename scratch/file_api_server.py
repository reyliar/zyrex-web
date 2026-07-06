"""
Zyrex SFTPGo File Listing API Server
Reads SFTPGo user directories and returns JSON file listings.
Storage: Cloudflare R2 (S3-compatible)
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
import boto3
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# === STORAGE CONFIG ===
# R2 (Cloudflare S3-compatible)
R2_ENDPOINT = "https://24871d1733baa733b470db9978234d96.r2.cloudflarestorage.com"
R2_ACCESS_KEY = "77916e5274c99b5a80aeca3f36a60071"
R2_SECRET_KEY = "9a815661086b43314b336cbf096ab07006ba585a831bb04e3509ca9aeb9ea580"
R2_PROD_BUCKET = "zyrexediting-staging"   # Production: published content served to website
R2_STAGING_BUCKET = "zyrexediting"        # Staging: user SFTPGo uploads, cleared after publish

s3_prod = boto3.client(
    "s3",
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
    region_name="auto"
)

s3_staging = boto3.client(
    "s3",
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
    region_name="auto"
)

SFTPGO_DATA_DIR = r"C:\Users\reyli\Desktop\sftpgo\data"
BOT_DB_PATH = r"C:\Users\reyli\Desktop\zyrex-bot\data\zyrex.db"
PORT = 5001
SECRET_TOKEN = "zyrex-files-api-2026"
TOKEN_EXPIRY_SECONDS = 600  # 10 minutes
DOWNLOAD_COUNTS_FILE = r"C:\Users\reyli\Desktop\zyrexweb\scratch\download_counts.json"

# === R2 HELPER FUNCTIONS ===
def r2_list_objects(prefix, delimiter="", bucket=None):
    """List objects in R2 under a prefix. Uses prod bucket by default."""
    if bucket is None:
        bucket = R2_PROD_BUCKET
    s3_client = s3_prod if bucket == R2_PROD_BUCKET else s3_staging
    objects = []
    paginator = s3_client.get_paginator("list_objects_v2")
    kwargs = {"Bucket": bucket, "Prefix": prefix}
    if delimiter:
        kwargs["Delimiter"] = delimiter
    for page in paginator.paginate(**kwargs):
        for obj in page.get("Contents", []):
            objects.append({
                "key": obj["Key"],
                "size": obj["Size"],
                "last_modified": obj["LastModified"].timestamp()
            })
        for cp in page.get("CommonPrefixes", []):
            objects.append({
                "key": cp["Prefix"],
                "size": 0,
                "last_modified": 0,
                "is_folder": True
            })
    return objects

def r2_get_object(key, bucket=None):
    """Get object body from R2. Uses prod bucket by default."""
    if bucket is None:
        bucket = R2_PROD_BUCKET
    s3_client = s3_prod if bucket == R2_PROD_BUCKET else s3_staging
    resp = s3_client.get_object(Bucket=bucket, Key=key)
    return resp["Body"].read()

def r2_put_object(key, body_bytes, bucket=None):
    """Put object to R2. Uses prod bucket by default."""
    if bucket is None:
        bucket = R2_PROD_BUCKET
    s3_client = s3_prod if bucket == R2_PROD_BUCKET else s3_staging
    s3_client.put_object(Bucket=bucket, Key=key, Body=body_bytes)

def r2_copy_object(src_key, dst_key, src_bucket, dst_bucket):
    """Copy object between R2 buckets. Returns True on success."""
    try:
        copy_source = {"Bucket": src_bucket, "Key": src_key}
        s3_prod.copy_object(
            Bucket=dst_bucket,
            Key=dst_key,
            CopySource=copy_source
        )
        return True
    except Exception as e:
        print(f"R2 copy failed: {src_key} -> {dst_key}: {e}")
        return False

def r2_delete_object(key, bucket):
    """Delete object from R2 bucket."""
    s3_client = s3_prod if bucket == R2_PROD_BUCKET else s3_staging
    s3_client.delete_object(Bucket=bucket, Key=key)

def r2_delete_prefix(prefix, bucket):
    """Delete all objects under a prefix in R2 bucket."""
    s3_client = s3_prod if bucket == R2_PROD_BUCKET else s3_staging
    paginator = s3_client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        objects = page.get("Contents", [])
        if objects:
            s3_client.delete_objects(
                Bucket=bucket,
                Delete={"Objects": [{"Key": obj["Key"]} for obj in objects]}
            )

# Watermark files injected into every production folder (embedded, no external files)
WATERMARK_FILES_CONTENT = {
    "LEAKED BY ZYREX.txt": (
        "ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX \r\n"
        "ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX \r\n"
        "\r\n"
        "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588   \u2588\u2588\u2588     \u2588\u2588\u2588  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588     \u2588\u2588\u2588\r\n"
        "\u2580\u2580\u2580\u2580\u2580\u2580\u2588\u2588\u2588\u2580    \u2588\u2588\u2588     \u2588\u2588\u2588  \u2588\u2588\u2588    \u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580   \u2588\u2588\u2588   \u2588\u2588\u2588 \r\n"
        "     \u2588\u2588\u2588       \u2588\u2588\u2588   \u2588\u2588\u2588   \u2588\u2588\u2588    \u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588            \u2588\u2588\u2588 \u2588\u2588\u2588  \r\n"
        "    \u2588\u2588\u2588         \u2588\u2588\u2588 \u2588\u2588\u2588    \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588     \u2588\u2588\u2588\u2588\u2588   \r\n"
        "   \u2588\u2588\u2588           \u2588\u2588\u2588\u2588\u2588     \u2588\u2588\u2588    \u2588\u2588\u2588    \u2588\u2588\u2588\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580     \u2588\u2588\u2588\u2588\u2588   \r\n"
        "  \u2588\u2588\u2588             \u2588\u2588\u2588      \u2588\u2588\u2588     \u2588\u2588\u2588   \u2588\u2588\u2588            \u2588\u2588\u2588 \u2588\u2588\u2588  \r\n"
        " \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588      \u2588\u2588\u2588      \u2588\u2588\u2588      \u2588\u2588\u2588  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588   \u2588\u2588\u2588   \u2588\u2588\u2588 \r\n"
        "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588      \u2588\u2588\u2588      \u2588\u2588\u2588       \u2588\u2588\u2588 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588     \u2588\u2588\u2588\r\n"
        "\r\n"
        "This resource leaked by ZYREX.\r\n"
        "\r\n"
        "- https://discord.gg/wvgbyBwNuG\r\n"
        "- zyrexediting.xyz\r\n"
        "\r\n"
        "ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX\r\n"
        "ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX ZYREX\r\n"
    ),
    "Visit for more resources!.url": (
        "[{000214A0-0000-0000-C000-000000000046}]\r\n"
        "Prop3=19,11\r\n"
        "[InternetShortcut]\r\n"
        "IDList=\r\n"
        "URL=https://zyrexediting.xyz/resources\r\n"
    ),
}

# In-memory token store: { token: { discord_id, product_id, file_path, created_at, used } }
download_tokens = {}

def inject_watermarks(target_prefix, bucket=None):
    """Write watermark files to R2 under target_prefix and all sub-folders."""
    if bucket is None:
        bucket = R2_PROD_BUCKET
    injected = 0
    # Get all unique folder prefixes
    folders = set()
    folders.add(target_prefix)
    objects = r2_list_objects(target_prefix, bucket=bucket)
    for obj in objects:
        key = obj["key"]
        if "/" in key[len(target_prefix):]:
            folder = key.rsplit("/", 1)[0] + "/"
            folders.add(folder)
    
    for folder in sorted(folders):
        for filename, content in WATERMARK_FILES_CONTENT.items():
            wm_key = folder + filename
            # Check if already exists
            existing = r2_list_objects(wm_key, bucket=bucket)
            if not any(o["key"] == wm_key for o in existing):
                try:
                    r2_put_object(wm_key, content.encode("utf-8"), bucket=bucket)
                    injected += 1
                except Exception as e:
                    print(f"Watermark failed: {wm_key}: {e}")
    return injected

def get_download_counts():
    """Read download counts from JSON file."""
    try:
        if os.path.exists(DOWNLOAD_COUNTS_FILE):
            with open(DOWNLOAD_COUNTS_FILE, 'r') as f:
                return json.load(f)
    except:
        pass
    return {}

def increment_download_count(product_id):
    """Increment download count for a product, return new count."""
    counts = get_download_counts()
    counts[product_id] = counts.get(product_id, 0) + 1
    try:
        with open(DOWNLOAD_COUNTS_FILE, 'w') as f:
            json.dump(counts, f)
    except:
        pass
    return counts[product_id]

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

def validate_token(token, consume=True):
    """Validate a download token. If consume=True, marks as used (one-time). If False, just checks validity."""
    data = download_tokens.get(token)
    if not data:
        return None
    if data.get("used", False):
        return None
    if time.time() - data["created_at"] > TOKEN_EXPIRY_SECONDS:
        del download_tokens[token]
        return None
    if consume:
        data["used"] = True
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

def detect_resources_r2(username):
    """Scan R2 staging bucket for user's EDITOR/RESOURCE structure."""
    prefix = f"{username}/"
    objects = r2_list_objects(prefix, delimiter="/", bucket=R2_STAGING_BUCKET)
    
    # Find editor folders (second level)
    editor_folders = set()
    for obj in objects:
        key = obj["key"]
        if key == prefix:
            continue
        rel = key[len(prefix):]
        if "/" in rel:
            editor = rel.split("/")[0]
            editor_folders.add(editor)
    
    resources = []
    for editor in sorted(editor_folders):
        editor_prefix = f"{prefix}{editor}/"
        editor_objects = r2_list_objects(editor_prefix, bucket=R2_STAGING_BUCKET)
        
        # Find resource subfolders
        resource_folders = set()
        has_files = False
        for obj in editor_objects:
            key = obj["key"]
            if key == editor_prefix:
                continue
            rel = key[len(editor_prefix):]
            if "/" in rel:
                resource = rel.split("/")[0]
                resource_folders.add(resource)
            elif rel:  # direct file in editor folder
                has_files = True
        
        # Process each resource subfolder
        for resource in sorted(resource_folders):
            res_prefix = f"{editor_prefix}{resource}/"
            res_objects = r2_list_objects(res_prefix, bucket=R2_STAGING_BUCKET)
            res_files = []
            for obj in res_objects:
                key = obj["key"]
                if key == res_prefix or obj.get("is_folder"):
                    continue
                fname = key[len(res_prefix):]
                if fname:
                    res_files.append({
                        "name": fname,
                        "size": obj["size"],
                        "path": f"{username}/{editor}/{resource}/{fname}"
                    })
            if res_files:
                resources.append({
                    "editor": editor,
                    "resource": resource,
                    "files": res_files
                })
        
        # If editor has files directly (no subfolders), treat editor as resource
        if has_files and not resource_folders:
            direct_files = []
            for obj in editor_objects:
                key = obj["key"]
                if key == editor_prefix or obj.get("is_folder"):
                    continue
                fname = key[len(editor_prefix):]
                if fname and "/" not in fname:
                    direct_files.append({
                        "name": fname,
                        "size": obj["size"],
                        "path": f"{username}/{editor}/{fname}"
                    })
            if direct_files:
                resources.append({"editor": editor, "resource": editor, "files": direct_files})
    
    return {"success": True, "resources": resources}

def list_production_editors():
    """List top-level editor folders in R2 production bucket."""
    objects = r2_list_objects("", delimiter="/", bucket=R2_PROD_BUCKET)
    editors = set()
    for obj in objects:
        if obj.get("is_folder"):
            name = obj["key"].rstrip("/")
            if name and name != "production":  # skip legacy production prefix
                editors.add(name)
    return sorted(editors)

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
        
        # === DOWNLOAD COUNTER: GET counts ===
        if path == "/api/files/download-count":
            counts = get_download_counts()
            self._send_json({"success": True, "counts": counts})
            return
        
        # === DOWNLOAD TOKEN VALIDATION & FILE SERVING ===
        if path == "/api/files/validate":
            token = params.get("token", [None])[0]
            if not token:
                self._send_json({"success": False, "error": "Missing token"}, 400)
                return
            peek_only = params.get("peek", ["0"])[0] == "1"
            data = validate_token(token, consume=not peek_only)
            if not data:
                self._send_json({"success": False, "error": "Invalid or expired token"}, 404)
                return
            remaining = max(0, int(TOKEN_EXPIRY_SECONDS - (time.time() - data["created_at"])))
            self._send_json({
                "success": True,
                "product_id": data["product_id"],
                "file_path": data["file_path"],
                "discord_id": data["discord_id"],
                "expires_in": remaining,
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
            
            # file_path is now an R2 prefix (like "After Effects/my-preset/")
            r2_prefix = data["file_path"].replace("\\", "/")
            if not r2_prefix.endswith("/"):
                r2_prefix += "/"
            
            # Check in production R2 bucket first, fallback to staging
            check = r2_list_objects(r2_prefix, delimiter="/", bucket=R2_PROD_BUCKET)
            use_bucket = R2_PROD_BUCKET
            if not check:
                check = r2_list_objects(r2_prefix, delimiter="/", bucket=R2_STAGING_BUCKET)
                use_bucket = R2_STAGING_BUCKET
            if not check:
                self.send_error(404, "Resource not found in storage")
                return
            
            # Everything becomes a ZIP with watermark files included
            folder_name = params.get("title", [r2_prefix.rstrip("/").split("/")[-1]])[0]
            if not folder_name:
                folder_name = r2_prefix.rstrip("/").split("/")[-1]
            
            # Determine which files to include
            selected_files = params.get("files", [None])[0]
            selected_set = None
            if selected_files:
                selected_set = set(selected_files.split(","))
            
            # Get all objects under prefix
            all_objects = r2_list_objects(r2_prefix, bucket=use_bucket)
            
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
                for obj in all_objects:
                    if obj.get("is_folder"):
                        continue
                    fname = obj["key"][len(r2_prefix):]  # relative name
                    if not fname:
                        continue
                    if selected_set and fname not in selected_set:
                        continue
                    try:
                        data = r2_get_object(obj["key"], bucket=use_bucket)
                        zf.writestr(f"{folder_name}/{fname}", data)
                    except Exception as e:
                        print(f"ZIP skip: {obj['key']}: {e}")
                
                # Always inject watermark files into the folder
                for wm_name, wm_content in WATERMARK_FILES_CONTENT.items():
                    zf.writestr(f"{folder_name}/{wm_name}", wm_content)
            
            zip_data = zip_buffer.getvalue()
            zip_filename = f"{folder_name}.zip"
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Disposition", f'attachment; filename="{zip_filename}"')
            self.send_header("Content-Length", str(len(zip_data)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(zip_data)
            return
        
        # Endpoints that DON'T require discord_id
        if path == "/api/files/editors":
            # List top-level editor folders from R2 production bucket
            editors = list_production_editors()
            self._send_json({"success": True, "editors": editors})
            return
        
        # === SFTPGo detected resources (R2 staging bucket) ===
        if path == "/api/files/sftpgo-resources":
            discord_id = params.get("discord_id", [None])[0]
            if not discord_id:
                self._send_json({"success": False, "error": "Missing discord_id"}, 400)
                return
            username = get_sftpgo_username(discord_id)
            if not username:
                self._send_json({"success": False, "error": "No SFTPGo account linked"}, 404)
                return
            result = detect_resources_r2(username)
            self._send_json(result)
            return
        
        if path == "/api/files/list-path":
            # List files in a given path (no discord_id needed)
            list_path = params.get("path", [""])[0]
            if not list_path:
                self._send_json({"success": False, "error": "Missing path parameter"}, 400)
                return
            full_path = os.path.join(SFTPGO_DATA_DIR, list_path.replace("/", os.sep))
            if not os.path.isdir(full_path):
                # Try production folder fallback
                fallback = os.path.join(SFTPGO_DATA_DIR, "production", list_path)
                if os.path.isdir(fallback):
                    full_path = fallback
                else:
                    self._send_json({"success": False, "error": f"Path not found: {list_path}"}, 404)
                    return
            result = {"success": True, "files": []}
            try:
                for entry in sorted(os.listdir(full_path)):
                    entry_path = os.path.join(full_path, entry)
                    if os.path.isfile(entry_path):
                        size = os.path.getsize(entry_path)
                        result["files"].append({
                            "name": entry,
                            "size": size,
                            "size_formatted": format_size(size),
                        })
                self._send_json(result)
            except PermissionError:
                self._send_json({"success": False, "error": "Permission denied"}, 403)
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
            result = detect_resources_r2(username)
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
        
        # === DOWNLOAD COUNTER: POST track ===
        if path == "/api/files/download-count":
            product_id = body.get("productId", "")
            if not product_id:
                self._send_json({"success": False, "error": "Missing productId"}, 400)
                return
            count = increment_download_count(product_id)
            self._send_json({"success": True, "productId": product_id, "count": count})
            return
        
        # === PUBLISH: Move from staging R2 → production R2 + delete from staging ===
        if path == "/api/files/publish":
            source_prefix = body.get("source_prefix", "").strip()
            dest_prefix = body.get("dest_prefix", "").strip()
            
            if not source_prefix:
                self._send_json({"success": False, "error": "Missing source_prefix"}, 400)
                return
            if not dest_prefix:
                self._send_json({"success": False, "error": "Missing dest_prefix"}, 400)
                return
            
            # Ensure trailing slash
            if not source_prefix.endswith("/"):
                source_prefix += "/"
            if not dest_prefix.endswith("/"):
                dest_prefix += "/"
            
            # List objects in staging
            staging_objects = r2_list_objects(source_prefix, bucket=R2_STAGING_BUCKET)
            file_objects = [o for o in staging_objects]
            if not file_objects:
                self._send_json({"success": False, "error": f"No files found in staging: {source_prefix}"}, 404)
                return
            
            # Copy each file from staging → production
            copied = 0
            failed = []
            for obj in file_objects:
                src_key = obj["key"]
                # Map source prefix to dest prefix
                rel_path = src_key[len(source_prefix):]
                dst_key = dest_prefix + rel_path
                if r2_copy_object(src_key, dst_key, R2_STAGING_BUCKET, R2_PROD_BUCKET):
                    copied += 1
                else:
                    failed.append(src_key)
            
            if failed:
                self._send_json({
                    "success": False,
                    "error": f"Copied {copied}/{len(file_objects)} files, {len(failed)} failed",
                    "failed": failed,
                }, 500)
                return
            
            # Inject watermarks into production
            wm_count = inject_watermarks(dest_prefix, bucket=R2_PROD_BUCKET)
            
            # Delete all objects from staging
            r2_delete_prefix(source_prefix, R2_STAGING_BUCKET)
            
            self._send_json({
                "success": True,
                "message": f"Published {copied} files, {wm_count} watermarks injected. Staging cleared.",
                "files_published": copied,
                "watermarks_injected": wm_count,
                "dest_prefix": dest_prefix,
            })
            return
        
        if path == "/api/files/transfer":
            # R2-based transfer: copy from user's staging folder to production
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
            
            # R2 staging prefix: username/source_editor/source_resource/
            source_prefix = f"{username}/{source_editor}/{source_resource}/"
            # R2 production prefix: dest_editor/source_resource/
            dest_prefix = f"{dest_editor}/{source_resource}/"
            
            # Check source exists in staging R2
            staging_objects = r2_list_objects(source_prefix, bucket=R2_STAGING_BUCKET)
            file_objects = [o for o in staging_objects]
            if not file_objects:
                self._send_json({"success": False, "error": f"Source not found in cloud: {source_editor}/{source_resource}"}, 404)
                return
            
            # Copy each file from staging → production R2
            copied = 0
            failed = []
            for obj in file_objects:
                src_key = obj["key"]
                rel_path = src_key[len(source_prefix):]
                dst_key = dest_prefix + rel_path
                if r2_copy_object(src_key, dst_key, R2_STAGING_BUCKET, R2_PROD_BUCKET):
                    copied += 1
                else:
                    failed.append(src_key)
            
            if failed:
                self._send_json({
                    "success": False,
                    "error": f"Copied {copied}/{len(file_objects)} files, {len(failed)} failed",
                    "failed": failed,
                }, 500)
                return
            
            # Inject watermarks into production
            wm_count = inject_watermarks(dest_prefix, bucket=R2_PROD_BUCKET)
            
            # Delete source files from staging (user cloud freed)
            r2_delete_prefix(source_prefix, R2_STAGING_BUCKET)
            
            file_path = f"{dest_editor}/{source_resource}"
            self._send_json({
                "success": True,
                "message": f"Transferred {copied} files to production, {wm_count} watermarks injected. Cloud space freed.",
                "file_path": file_path,
                "files_copied": copied,
                "watermarks_injected": wm_count,
            })
            return
        
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
            
            # Check if editor folder already exists in R2 production bucket
            existing = r2_list_objects(f"{safe_name}/", delimiter="/", bucket=R2_PROD_BUCKET)
            if existing:
                self._send_json({"success": False, "error": f"Folder '{safe_name}' already exists"}, 409)
                return
            
            # Create a placeholder to ensure the folder prefix exists in R2
            try:
                r2_put_object(f"{safe_name}/.placeholder", b"", bucket=R2_PROD_BUCKET)
                self._send_json({"success": True, "message": f"Editor folder '{safe_name}' created"})
            except Exception as e:
                self._send_json({"success": False, "error": f"Create failed: {str(e)}"}, 500)
        
        elif path == "/api/files/request-token":
            # Generate a one-time download token (R2-based)
            discord_id = body.get("discord_id", "")
            product_id = body.get("product_id", "")
            file_path = body.get("file_path", "")
            if not discord_id or not product_id:
                self._send_json({"success": False, "error": "Missing discord_id or product_id"}, 400)
                return
            if not file_path:
                self._send_json({"success": False, "error": "Missing file_path"}, 400)
                return
            
            # file_path is an R2 prefix like "After Effects/my-preset/"
            r2_prefix = file_path.replace("\\", "/")
            if not r2_prefix.endswith("/"):
                r2_prefix += "/"
            
            # Search in production R2 bucket
            found = len(r2_list_objects(r2_prefix, bucket=R2_PROD_BUCKET)) > 0
            
            # Fallback: try production/{product_id}/
            if not found:
                fallback = f"production/{product_id}/"
                if len(r2_list_objects(fallback, bucket=R2_PROD_BUCKET)) > 0:
                    r2_prefix = fallback
                    found = True
            
            # Fallback: try any production/{product_id}* folder
            if not found:
                prod_objects = r2_list_objects("production/", delimiter="/", bucket=R2_PROD_BUCKET)
                for obj in prod_objects:
                    if obj.get("is_folder"):
                        sub_prefix = obj["key"]
                        if len(r2_list_objects(sub_prefix, bucket=R2_PROD_BUCKET)) > 0:
                            r2_prefix = sub_prefix
                            found = True
                            break
            
            # Last fallback: try in staging bucket
            if not found:
                if len(r2_list_objects(r2_prefix, bucket=R2_STAGING_BUCKET)) > 0:
                    r2_prefix = r2_prefix  # same prefix, different bucket context
                    found = True
                    print(f"Found in staging: {r2_prefix}")
            
            if not found:
                self._send_json({"success": False, "error": f"Resource not found: {file_path}"}, 404)
                return
            
            # Store R2 prefix directly in token (not local filesystem path)
            token = generate_download_token(discord_id, product_id, r2_prefix)
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
    print(f"Zyrex File API Server starting on port {PORT} (0.0.0.0)...")
    print(f"Serving SFTPGo data from: {SFTPGO_DATA_DIR}")
    server = HTTPServer(("0.0.0.0", PORT), FileAPIHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Server stopped.")
        server.server_close()
