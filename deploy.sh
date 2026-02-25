#!/bin/bash
# =========================================================
# Footprint Map - One-Click Linux Deployment
# Usage: curl -sSL https://raw.githubusercontent.com/v4-hub/fpf/main/deploy.sh | bash
# Or:    git clone https://github.com/v4-hub/fpf.git && cd fpf && bash deploy.sh
# =========================================================
set -e

echo "================================================"
echo "  🌍 Footprint Map — Automated Deployment"
echo "================================================"

# 1. Check Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "⚠️  Docker installed. You may need to log out and back in for group changes."
    echo "   Then run this script again."
    exit 0
fi

echo "✅ Docker found: $(docker --version)"

# 2. Check if we're in the repo
if [ ! -f "Dockerfile" ]; then
    echo "📥 Cloning repository..."
    git clone https://github.com/v4-hub/fpf.git
    cd fpf
fi

# 3. Generate celebrity data + TTS audio
echo "🎤 Generating celebrity data and TTS audio..."
pip3 install edge-tts >/dev/null 2>&1 || pip install edge-tts >/dev/null 2>&1
python3 generate_celebrity_samples.py

# 4. Build Docker image
echo "🔨 Building Docker image..."
docker build -t fpf-app .

# 5. Stop old container if running
docker rm -f fpf-web 2>/dev/null || true

# 6. Run container
PORT=${PORT:-5001}
echo "🚀 Starting on port $PORT..."
docker run -d -p $PORT:5000 --name fpf-web --restart unless-stopped fpf-app

echo ""
echo "================================================"
echo "  ✅ Deployment Complete!"
echo "================================================"
echo ""
echo "  🌐 Homepage:     http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):$PORT"
echo "  🎬 AutoPlay:     http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):$PORT/explore-autoplay.html"
echo "  📊 Dashboard:    http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):$PORT/dashboard.html"
echo ""
echo "  To change port:  PORT=8080 bash deploy.sh"
echo "  To stop:         docker stop fpf-web"
echo "  To restart:      docker start fpf-web"
echo "  To view logs:    docker logs -f fpf-web"
echo ""
