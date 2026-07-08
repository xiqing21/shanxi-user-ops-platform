#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FULL_MODE=false
FOLLOW_LOGS=false
BUILD_FLAG="--build"
LOG_SERVICE=""
SUBMIT_FLINK_JOB=true

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
    --no-submit)
      SUBMIT_FLINK_JOB=false
      shift
      ;;
    -h|--help)
      cat <<'HELP'
Usage:
  scripts/start-docker-stack.sh [--full] [--logs [service]] [--no-build] [--no-submit]

Examples:
  pnpm stack:up                 # core stack, detached
  pnpm stack:up:full            # full stack + submit a real Flink streaming job
  pnpm stack:logs milvus        # follow Milvus logs only
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

wait_url() {
  local name="$1"
  local url="$2"
  local max_attempts="${3:-60}"
  local attempt=1
  printf "Waiting for %s" "$name"
  while [ "$attempt" -le "$max_attempts" ]; do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo " ok"
      return 0
    fi
    printf "."
    sleep 2
    attempt=$((attempt + 1))
  done
  echo ""
  echo "ERROR: $name is not ready: $url" >&2
  return 1
}

running_flink_jobs() {
  curl -sf http://localhost:8083/jobs/overview 2>/dev/null | node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      const payload = JSON.parse(input || "{\"jobs\":[]}");
      const count = (payload.jobs || []).filter(job => job.state === "RUNNING").length;
      process.stdout.write(String(count));
    });
  '
}

if [ "$FULL_MODE" = "true" ]; then
  wait_url "Flink JobManager" "http://localhost:8083/jobs/overview" 90
  wait_url "API" "http://localhost:4000/health" 60
  echo "Loading demo ADS data into StarRocks internal tables"
  scripts/load-starrocks-demo.sh

  if [ "$SUBMIT_FLINK_JOB" = "true" ]; then
    current_jobs="$(running_flink_jobs || echo 0)"
    if [ "${current_jobs:-0}" = "0" ]; then
      echo "Submitting real Flink streaming job: CarTopSpeedWindowingExample"
      "${compose[@]}" exec -T flink-jobmanager ./bin/flink run -d /opt/flink/examples/streaming/TopSpeedWindowing.jar
      sleep 3
    else
      echo "Flink already has ${current_jobs} running job(s); skip duplicate submit."
    fi
  fi
fi

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
echo "  ./scripts/start-full-stack.sh"
echo "  pnpm stack:ps"
echo "  pnpm stack:logs flink-jobmanager"
echo "  pnpm stack:down"

if [ "$FULL_MODE" = "true" ]; then
  echo ""
  echo "Flink jobs:"
  curl -sf http://localhost:8083/jobs/overview || true
  echo ""
fi
