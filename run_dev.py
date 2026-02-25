import os
import sys
import webbrowser
from flask import send_from_directory

# Initialize database if missing
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'footprint_map.db')
if not os.path.exists(db_path):
    print("Database not found, initializing...")
    import createdata
    print("Database initialized.")

from api.app import app

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Add static file routes to the existing API app
@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(BASE_DIR, path)

if __name__ == '__main__':
    port = 5000
    url = f"http://localhost:{port}"
    
    print(f"开发服务器正在启动...")
    print(f"访问: {url}")
    
    # 在新的浏览器标签页中打开URL
    # webbrowser.open_new_tab(url)
    
    # 启动Flask应用
    app.run(host='0.0.0.0', port=port, debug=True)