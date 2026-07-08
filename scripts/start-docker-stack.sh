#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FULL_MODE=false
FOLLOW_LOGS=false
BUILD_FLAG="--build"
LOG_SERVICE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --full)
      FULL_MODE=true
      shift
      ;;
    --logs)
      FOLLOW_LOGS=true
      shift
      if [[ $# -gt 0 && "$1" != --* ]]; then
        LOG_SERVICE="$1"
        shift
      fi
      ;;
    --no-build)
      BUILD_FLAG=""
      shift
      ;;
    -h|--help)
      cat <<'HELP'
Usage:
  scripts/start-docker-stack.sh [--full] [--logs [service]] [--no-build]

Examples:
  pnpm stack:up             # core stack, detached
  pnpm stack:up:full        # Flink + Fluss + Paimon + StarRocks + PostgreSQL
  pnpm stack:logs milvus    # follow Milvus logs only
HELP
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Fill DEEPSEEK_API_KEY for LLM-backed planning."
fi

compose=(docker compose --env-file .env -f deploy/compose/docker-compose.yml)
if [ "$FULL_MODE" = "true" ]; then
  compose+=(--profile lakehouse)
fi

if [ "$FOLLOW_LOGS" = "true" ]; then
  if [ -n "$LOG_SERVICE" ]; then
    "${compose[@]}" logs -f --tail=160 "$LOG_SERVICE"
  else
    "${compose[@]}" logs -f --tail=160
  fi
  exit 0
fi

"${compose[@]}" up -d ${BUILD_FLAG}

echo ""
echo "Docker stack is running in detached mode."
if [ "$FULL_MODE" = "true" ]; then
  echo "Mode: lakehouse full stack"
  echo "Flink UI:      http://localhost:8083"
  echo "StarRocks FE:  http://localhost:8030"
  echo "PostgreSQL:    localhost:5432"
  echo "Fluss:         coordinator localhost:9123, tablet localhost:9124"
else
  echo "Mode: core stack"
fi
echo "Web:           http://localhost:${WEB_PORT:-5051}"
echo "API:           http://localhost:4000/health"
echo "AI:            http://localhost:8000/health"
echo "Milvus gRPC:   localhost:19530"
echo "MinIO console: http://localhost:19001"
echo ""
echo "Useful commands:"
echo "  pnpm stack:ps"
echo "  pnpm stack:logs milvus"
echo "  pnpm stack:down"
