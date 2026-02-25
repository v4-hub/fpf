#!/bin/bash
# =========================================================
# Footprint Map - One-Click Linux Deployment (No Docker)
# Usage: git clone https://github.com/v4-hub/fpf.git && cd fpf && bash deploy.sh
# =========================================================
set -e

echo "================================================"
echo "  🌍 Footprint Map — Automated Deployment"
echo "================================================"

# 1. Install Python3 and pip if missing
if ! command -v python3 &> /dev/null; then
    echo "📦 Installing Python3..."
    if command -v apt &> /dev/null; then
        sudo apt update && sudo apt install -y python3 python3-pip python3-venv
    elif command -v yum &> /dev/null; then
        sudo yum install -y python3 python3-pip
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y python3 python3-pip
    else
        echo "❌ Cannot detect package manager. Please install python3 manually."
        exit 1
    fi
fi
echo "✅ Python3: $(python3 --version)"

# 2. Create virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
echo "✅ Virtual environment activated"

# 3. Install dependencies
echo "📦 Installing Python dependencies..."
pip install --upgrade pip >/dev/null 2>&1
pip install -r requirements.txt >/dev/null 2>&1
echo "✅ Dependencies installed"

# 4. Initialize database if needed
if [ ! -f "data/footprint_map.db" ]; then
    echo "🗄️ Initializing database..."
    python3 createdata.py
fi

# 5. Generate celebrity data + TTS audio (if not already done)
POINT_COUNT=$(python3 -c "
import sqlite3, os
db = os.path.join('data', 'footprint_map.db')
conn = sqlite3.connect(db)
count = conn.execute('SELECT COUNT(*) FROM journey_points').fetchone()[0]
print(count)
conn.close()
" 2>/dev/null || echo "0")

if [ "$POINT_COUNT" -lt 100 ]; then
    echo "🎤 Generating 34 celebrity footprints with TTS audio..."
    echo "   (This takes ~3 minutes, generating 147 audio files)"
    python3 generate_celebrity_samples.py
    echo "✅ Celebrity data generated"
else
    echo "✅ Celebrity data already exists ($POINT_COUNT waypoints)"
fi

# 6. Start the web server
PORT=${PORT:-5001}
echo ""
echo "================================================"
echo "  🚀 Starting Footprint Map on port $PORT"
echo "================================================"
echo ""

# Check if already running
if lsof -i :$PORT >/dev/null 2>&1; then
    echo "⚠️  Port $PORT is already in use."
    echo "   Kill existing process: kill \$(lsof -t -i:$PORT)"
    echo "   Or use another port: PORT=8080 bash deploy.sh"
    exit 1
fi

SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost')

echo "  🌐 Homepage:     http://$SERVER_IP:$PORT"
echo "  🎬 AutoPlay:     http://$SERVER_IP:$PORT/explore-autoplay.html"
echo "  📊 Dashboard:    http://$SERVER_IP:$PORT/dashboard.html"
echo ""
echo "  To run in background:  nohup bash deploy.sh &"
echo "  To change port:        PORT=8080 bash deploy.sh"
echo "  To stop:               kill \$(lsof -t -i:$PORT)"
echo ""

# Run with gunicorn if available, otherwise Flask dev server
if pip show gunicorn >/dev/null 2>&1; then
    echo "🔧 Using gunicorn (production mode)..."
    gunicorn -w 2 -b 0.0.0.0:$PORT run_dev:app
else
    echo "🔧 Using Flask dev server..."
    echo "   (Install gunicorn for production: pip install gunicorn)"
    python3 -c "
import os, sys
sys.path.insert(0, '.')
os.environ['FLASK_ENV'] = 'production'
from run_dev import app
app.run(host='0.0.0.0', port=$PORT, debug=False)
"
fi
