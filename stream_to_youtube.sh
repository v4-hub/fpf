#!/bin/bash
# =========================================================
# YouTube Live Streaming for Footprint Map AutoPlay
# =========================================================
#
# ===== 如何获取 YouTube 推流密钥 =====
#
# 1. 打开 https://studio.youtube.com
# 2. 点击右上角的 "创建" → "开始直播"
# 3. 如果是第一次直播，需要等待24小时审核
# 4. 审核通过后，进入直播控制面板
# 5. 在左侧找到 "串流密钥"（Stream Key）
#    - 点击 "复制" 按钮复制密钥
#    - 密钥格式类似: xxxx-xxxx-xxxx-xxxx-xxxx
# 6. 将密钥粘贴到下面的 YOUTUBE_STREAM_KEY 变量中
#
# ===== 使用方法 =====
#
# 1. 确保应用已运行: docker start fpf-web
# 2. 在 Chrome 中打开: http://localhost:5001/explore-autoplay.html
# 3. 确保浏览器窗口全屏
# 4. 运行本脚本: bash stream_to_youtube.sh
#
# ===== 依赖 =====
# macOS: brew install ffmpeg
# Linux: sudo apt install ffmpeg
#
# =========================================================

YOUTUBE_RTMP_URL="rtmp://a.rtmp.youtube.com/live2"
YOUTUBE_STREAM_KEY="YOUR_STREAM_KEY_HERE"

# Video settings
FPS="30"
VIDEO_BITRATE="4500k"
AUDIO_BITRATE="128k"

echo "=========================================="
echo " 🎬 YouTube Live - Footprint Map"
echo "=========================================="

if ! command -v ffmpeg &> /dev/null; then
    echo "❌ ffmpeg not found!"
    echo "   macOS: brew install ffmpeg"
    echo "   Linux: sudo apt install ffmpeg"
    exit 1
fi

if [ "$YOUTUBE_STREAM_KEY" = "YOUR_STREAM_KEY_HERE" ]; then
    echo ""
    echo "❌ 请先设置推流密钥！"
    echo ""
    echo "步骤："
    echo "  1. 打开 https://studio.youtube.com"
    echo "  2. 点击右上角 '创建' → '开始直播'"
    echo "  3. 复制 '串流密钥'（Stream Key）"
    echo "  4. 编辑本文件，将密钥粘贴到 YOUTUBE_STREAM_KEY"
    echo ""
    echo "或者直接运行："
    echo "  YOUTUBE_STREAM_KEY=你的密钥 bash stream_to_youtube.sh"
    echo ""
    exit 1
fi

# Support passing key as env var
if [ -n "$STREAM_KEY" ]; then
    YOUTUBE_STREAM_KEY="$STREAM_KEY"
fi

echo ""
echo "✅ 准备就绪"
echo "   请确保 Chrome 已全屏打开 explore-autoplay.html"
echo "   3秒后开始推流..."
sleep 3

# Detect OS and capture accordingly
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - capture screen using avfoundation
    echo "📺 macOS模式：捕获屏幕..."
    ffmpeg \
        -f avfoundation \
        -framerate $FPS \
        -capture_cursor 0 \
        -i "1:0" \
        -c:v libx264 \
        -preset veryfast \
        -b:v $VIDEO_BITRATE \
        -maxrate $VIDEO_BITRATE \
        -bufsize 9000k \
        -pix_fmt yuv420p \
        -g $(($FPS * 2)) \
        -c:a aac \
        -b:a $AUDIO_BITRATE \
        -ar 44100 \
        -f flv \
        "${YOUTUBE_RTMP_URL}/${YOUTUBE_STREAM_KEY}"
else
    # Linux - capture using x11grab
    echo "📺 Linux模式：捕获屏幕..."
    ffmpeg \
        -f x11grab \
        -framerate $FPS \
        -video_size 1920x1080 \
        -i :0.0 \
        -f pulse \
        -i default \
        -c:v libx264 \
        -preset veryfast \
        -b:v $VIDEO_BITRATE \
        -maxrate $VIDEO_BITRATE \
        -bufsize 9000k \
        -pix_fmt yuv420p \
        -g $(($FPS * 2)) \
        -c:a aac \
        -b:a $AUDIO_BITRATE \
        -ar 44100 \
        -f flv \
        "${YOUTUBE_RTMP_URL}/${YOUTUBE_STREAM_KEY}"
fi

echo "🛑 推流结束。"
