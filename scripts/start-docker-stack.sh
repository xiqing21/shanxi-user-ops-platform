#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Fill DEEPSEEK_API_KEY for LLM-backed planning."
fi

docker compose --env-file .env -f deploy/compose/docker-compose.yml up --build
