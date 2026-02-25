# Footprint Map (足迹地图)

A web application for creating and sharing your life journeys on an interactive map.

## Features
- Interactive 2D and 3D maps
- Create, edit, and share journeys
- User authentication
- Responsive design

## Quick Start (Docker)

1. Ensure you have Docker installed.
2. Run the startup script:

```bash
./run.sh [PORT]
```

Example:
```bash
./run.sh 8080
```
This will build the Docker image and start the application on port 8080 (default is 5000).
Access the application at `http://localhost:8080`.

## Development

To run locally without Docker:

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Initialize database:
   ```bash
   python createdata.py
   ```

3. Run the development server:
   ```bash
   python run_dev.py
   ```

## License
MIT
