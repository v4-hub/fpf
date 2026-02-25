#!/bin/bash

# Port to run the app on (default 5000)
PORT=${1:-5000}

# Stop and remove existing container if it exists
docker rm -f fpf-app-container 2>/dev/null || true

# Build the docker image
echo "Building Docker image 'fpf-app'..."
docker build -q -t fpf-app .

# Use a named volume for data persistence to avoid bind mount issues on external drives
VOLUME_NAME="fpf-data"
docker volume create $VOLUME_NAME > /dev/null

# Run the container in detached mode
echo "Starting application..."
docker run -d --name fpf-app-container -p $PORT:5000 -v "$VOLUME_NAME:/app/data" fpf-app

echo "================================================="
echo "✅ Deployment successful!"
echo "🚀 Application is running at: http://localhost:$PORT"
echo "💾 Database is persisted in Docker volume: $VOLUME_NAME"
echo "================================================="