#!/usr/bin/env bash
set -e

echo "🚀 Starting FOS Platform..."

# Check for .env
if [ ! -f .env ]; then
  echo "⚠️  No .env file found. Copying .env.example → .env"
  cp .env.example .env
  echo "📝 Please edit .env and add your API keys, then re-run this script."
  exit 1
fi

# Dev mode (no Docker)
if [ "$1" = "dev" ]; then
  echo "Starting in dev mode (no Docker)..."

  # Backend
  cd backend
  python -m venv .venv 2>/dev/null || true
  source .venv/bin/activate
  pip install -q -r requirements.txt
  uvicorn main:app --reload --port 8000 &
  BACKEND_PID=$!
  cd ..

  # Frontend
  cd frontend
  npm install -q
  npm run dev &
  FRONTEND_PID=$!
  cd ..

  echo "✅ FOS running:"
  echo "   Frontend → http://localhost:3000"
  echo "   Backend  → http://localhost:8000"
  echo "   API docs → http://localhost:8000/docs"
  echo ""
  echo "Press Ctrl+C to stop"

  trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
  wait

else
  # Docker mode (default)
  if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Install Docker or run: ./start.sh dev"
    exit 1
  fi

  echo "Building and starting with Docker Compose..."
  docker compose up --build -d

  echo ""
  echo "✅ FOS Platform is running:"
  echo "   Web App  → http://localhost"
  echo "   Frontend → http://localhost:3000"
  echo "   Backend  → http://localhost:8000"
  echo "   API docs → http://localhost:8000/docs"
  echo ""
  echo "Logs: docker compose logs -f"
  echo "Stop: docker compose down"
fi
