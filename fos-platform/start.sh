#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Founder Operating System — Universal Start Script
# Works on macOS, Linux, Windows (Git Bash / WSL), and any phone
# via Termux (Android) or iSH (iOS).
#
# Usage:
#   ./start.sh            → Start with Docker (recommended)
#   ./start.sh dev        → Start without Docker (requires Python 3.11+ & Node 18+)
#   ./start.sh stop       → Stop all services
#   ./start.sh test       → Run DevOps test suite
#   ./start.sh logs       → Tail live logs
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}ℹ️  $*${NC}"; }
success() { echo -e "${GREEN}✅ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠️  $*${NC}"; }
error()   { echo -e "${RED}❌ $*${NC}"; exit 1; }

# ── Environment setup ────────────────────────────────────────────
setup_env() {
  if [ ! -f ".env" ]; then
    warn "No .env file found."
    if [ -f ".env.example" ]; then
      cp .env.example .env
      echo ""
      echo "  A .env file has been created from .env.example."
      echo "  Please open it and add your ANTHROPIC_API_KEY (or another AI provider key):"
      echo ""
      echo "  📁 $(pwd)/.env"
      echo ""
      echo "  Get a free Anthropic key at: https://console.anthropic.com/"
      echo ""
      read -p "Press Enter after adding your key to continue, or Ctrl+C to abort..." || true
    else
      error ".env.example missing. Please re-clone the repository."
    fi
  fi

  # Validate at least one AI key exists
  source .env 2>/dev/null || true
  if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -z "${OPENAI_API_KEY:-}" ] && [ -z "${GEMINI_API_KEY:-}" ]; then
    warn "No AI provider key found in .env"
    warn "The app will start but AI features need at least one of:"
    warn "  ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY"
  fi
}

# ── Stop all services ────────────────────────────────────────────
cmd_stop() {
  info "Stopping FOS services..."
  if command -v docker &>/dev/null; then
    docker compose down 2>/dev/null || true
  fi
  pkill -f "uvicorn main:app" 2>/dev/null || true
  pkill -f "next dev" 2>/dev/null || true
  success "Stopped."
}

# ── Show logs ────────────────────────────────────────────────────
cmd_logs() {
  if command -v docker &>/dev/null && docker compose ps -q 2>/dev/null | grep -q .; then
    docker compose logs -f
  else
    echo "Backend log:"; tail -50 /tmp/fos_backend.log 2>/dev/null || echo "(not running)"
    echo "Frontend log:"; tail -30 /tmp/fos_frontend.log 2>/dev/null || echo "(not running)"
  fi
}

# ── Run DevOps tests ─────────────────────────────────────────────
cmd_test() {
  info "Running FOS DevOps test suite..."
  chmod +x scripts/devops_test.sh
  bash scripts/devops_test.sh
}

# ── Dev mode (no Docker) ─────────────────────────────────────────
cmd_dev() {
  info "Starting FOS in development mode (no Docker)..."
  setup_env

  # Detect Python
  PYTHON=""
  for py in python3.11 python3.12 python3 python; do
    if command -v "$py" &>/dev/null; then
      VER=$("$py" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
      MAJOR=$(echo "$VER" | cut -d. -f1)
      MINOR=$(echo "$VER" | cut -d. -f2)
      if [ "$MAJOR" -ge 3 ] && [ "$MINOR" -ge 10 ]; then
        PYTHON="$py"; break
      fi
    fi
  done
  [ -z "$PYTHON" ] && error "Python 3.10+ required. Install from https://python.org/"
  info "Using $PYTHON ($($PYTHON --version))"

  # Detect Node
  command -v node &>/dev/null || error "Node.js 18+ required. Install from https://nodejs.org/"
  NODE_VER=$(node --version | grep -oE '[0-9]+' | head -1)
  [ "$NODE_VER" -lt 18 ] && error "Node.js 18+ required (found $(node --version))"
  info "Using Node.js $(node --version)"

  # Backend setup
  info "Setting up Python backend..."
  cd backend
  if [ ! -d ".venv" ]; then
    $PYTHON -m venv .venv
    info "Created virtual environment"
  fi
  source .venv/bin/activate
  pip install -q --upgrade pip
  pip install -q -r requirements.txt
  mkdir -p data uploads

  info "Starting backend on port 8000..."
  nohup uvicorn main:app --host 0.0.0.0 --port 8000 --reload > /tmp/fos_backend.log 2>&1 &
  BACKEND_PID=$!
  cd ..

  # Wait for backend
  info "Waiting for backend to start..."
  for i in {1..20}; do
    if curl -sf http://localhost:8000/api/providers >/dev/null 2>&1; then
      success "Backend ready"
      break
    fi
    sleep 1
  done

  # Frontend setup
  info "Setting up frontend..."
  cd frontend
  if [ ! -d "node_modules" ]; then
    npm install --silent
    info "Installed frontend dependencies"
  fi

  info "Starting frontend on port 3000..."
  nohup npm run dev > /tmp/fos_frontend.log 2>&1 &
  FRONTEND_PID=$!
  cd ..

  # Wait for frontend
  info "Waiting for frontend to compile..."
  for i in {1..30}; do
    if curl -sf http://localhost:3000 >/dev/null 2>&1; then
      success "Frontend ready"
      break
    fi
    sleep 2
  done

  echo ""
  echo "═══════════════════════════════════════════════"
  success "FOS Platform is running!"
  echo "═══════════════════════════════════════════════"
  echo "  🌐 Web App   → http://localhost:3000"
  echo "  ⚡ Backend   → http://localhost:8000"
  echo "  📖 API Docs  → http://localhost:8000/docs"
  echo "  📋 Logs      → ./start.sh logs"
  echo "  🧪 Tests     → ./start.sh test"
  echo "═══════════════════════════════════════════════"
  echo "Press Ctrl+C to stop all services"
  echo ""

  trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT INT TERM
  wait
}

# ── Docker mode (default) ────────────────────────────────────────
cmd_docker() {
  if ! command -v docker &>/dev/null; then
    warn "Docker not found. Falling back to dev mode..."
    cmd_dev
    return
  fi

  setup_env

  info "Building and starting FOS with Docker Compose..."
  info "This may take 3-5 minutes on first run (building images)..."

  docker compose up --build -d

  # Wait for health
  info "Waiting for services to become healthy..."
  for i in {1..30}; do
    if curl -sf http://localhost:8000/api/providers >/dev/null 2>&1; then
      break
    fi
    sleep 3
  done

  echo ""
  echo "═══════════════════════════════════════════════"
  success "FOS Platform is running!"
  echo "═══════════════════════════════════════════════"
  echo "  🌐 Web App   → http://localhost:3000"
  echo "  ⚡ Backend   → http://localhost:8000"
  echo "  📖 API Docs  → http://localhost:8000/docs"
  echo "  📋 Logs      → docker compose logs -f"
  echo "  🛑 Stop      → docker compose down"
  echo "═══════════════════════════════════════════════"
}

# ── Main entrypoint ──────────────────────────────────────────────
CMD="${1:-docker}"
case "$CMD" in
  dev)    cmd_dev ;;
  stop)   cmd_stop ;;
  logs)   cmd_logs ;;
  test)   cmd_test ;;
  docker) cmd_docker ;;
  *)
    echo "Usage: ./start.sh [dev|stop|logs|test]"
    echo "  (no args)  Start with Docker"
    echo "  dev        Start without Docker"
    echo "  stop       Stop all services"
    echo "  logs       Show live logs"
    echo "  test       Run DevOps test suite"
    exit 1
    ;;
esac
