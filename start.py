import os
import sys
import time
import subprocess

def setup_nginx(port):
    print(f"🔧 Configuring Nginx to listen on port {port}...")
    
    # Nginx configuration template for user-space execution
    nginx_conf = f"""worker_processes 1;
pid /home/container/nginx.pid;
error_log /home/container/nginx.error.log warn;

events {{
    worker_connections 1024;
}}

http {{
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    access_log /home/container/nginx.access.log;
    
    # Set user-writable directories for Nginx temp paths
    client_body_temp_path /home/container/nginx_client_body;
    proxy_temp_path /home/container/nginx_proxy;
    fastcgi_temp_path /home/container/nginx_fastcgi;
    uwsgi_temp_path /home/container/nginx_uwsgi;
    scgi_temp_path /home/container/nginx_scgi;

    server {{
        listen {port};
        server_name localhost;

        # Serve frontend files directly
        location / {{
            root /home/container;
            index index.html;
            try_files $uri $uri/ /index.html;
        }}

        # Proxy API calls to Flask backend
        location /api/ {{
            proxy_pass http://127.0.0.1:5000/api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }}
    }}
}}
"""
    # Create required temp folders if they do not exist
    for folder in ["nginx_client_body", "nginx_proxy", "nginx_fastcgi", "nginx_uwsgi", "nginx_scgi"]:
        os.makedirs(os.path.join("/home/container", folder), exist_ok=True)
        
    # Write configuration file
    with open("/home/container/nginx.conf", "w") as f:
        f.write(nginx_conf)
    print("✅ nginx.conf written successfully.")

def main():
    # Read public port assigned by Pterodactyl (default to 12988)
    server_port = os.environ.get("SERVER_PORT") or os.environ.get("PORT") or "12988"
    setup_nginx(server_port)
    
    # Launch Nginx in background
    print("🚀 Starting Nginx...")
    try:
        nginx_proc = subprocess.Popen(["nginx", "-c", "/home/container/nginx.conf"])
    except FileNotFoundError:
        print("❌ Error: 'nginx' command not found in the container. Make sure Nginx is installed.")
        sys.exit(1)
        
    # Launch Flask backend (binds internally to 127.0.0.1:5000)
    print("🚀 Starting Flask App...")
    flask_proc = subprocess.Popen([sys.executable, "/home/container/app.py"])
    
    try:
        # Keep main thread alive and monitor processes
        while True:
            time.sleep(2)
            if nginx_proc.poll() is not None:
                print("⚠️ Nginx process died! Exiting...")
                break
            if flask_proc.poll() is not None:
                print("⚠️ Flask backend died! Exiting...")
                break
    except KeyboardInterrupt:
        print("Stopping services...")
    finally:
        # Cleanup processes on exit
        nginx_proc.terminate()
        flask_proc.terminate()
        print("👋 Shutdown complete.")

if __name__ == "__main__":
    main()
