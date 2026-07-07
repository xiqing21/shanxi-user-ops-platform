#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/services/ai"

if [ ! -d "$ROOT_DIR/.venv-ai" ]; then
  python3 -m venv "$ROOT_DIR/.venv-ai"
fi

source "$ROOT_DIR/.venv-ai/bin/activate"
pip install -q -r requirements.txt
PYTHONPATH=. pytest -q
