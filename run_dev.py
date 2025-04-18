# run_dev.py
import os
import sys
import webbrowser
from flask import Flask, render_template, send_from_directory
from api.app import app as api_app

app = Flask(__name__, static_folder='.')

# 注册API蓝图
app.register_blueprint(api_app, url_prefix='/api')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    port = 5000
    url = f"http://localhost:{port}"
    
    print(f"开发服务器正在启动...")
    print(f"访问: {url}")
    
    # 在新的浏览器标签页中打开URL
    webbrowser.open_new_tab(url)
    
    # 启动Flask应用
    app.run(host='0.0.0.0', port=port, debug=True)