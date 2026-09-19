#!/usr/bin/env bash
# Поднимает собранный образ вместе с чистой базой и проверяет, что контейнер
# действительно работает: применил миграции, отдаёт API, статику и клиентские
# маршруты. Этот скрипт — граница между «собралось» и «можно публиковать».
set -euo pipefail

IMAGE="${1:?usage: smoke-test.sh <image>}"
NETWORK=travel-smoke
DB=travel-smoke-db
APP=travel-smoke-app
BASE_URL=http://127.0.0.1:3000/travel

cleanup() {
  docker rm -f "$APP" "$DB" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "::error::$*"
  echo "--- app logs ---"
  docker logs "$APP" 2>&1 | tail -50 || true
  exit 1
}

docker network create "$NETWORK" >/dev/null

docker run -d --name "$DB" --network "$NETWORK" \
  -e POSTGRES_DB=travel -e POSTGRES_USER=travel -e POSTGRES_PASSWORD=travel \
  --health-cmd 'pg_isready -U travel -d travel' --health-interval 2s --health-retries 15 \
  postgres:17-alpine >/dev/null

echo "Waiting for PostgreSQL…"
for _ in $(seq 1 30); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$DB")" = healthy ] && break
  sleep 2
done
[ "$(docker inspect -f '{{.State.Health.Status}}' "$DB")" = healthy ] || { docker logs "$DB" | tail -30; exit 1; }

docker run -d --name "$APP" --network "$NETWORK" -p 3000:3000 \
  -e DATABASE_URL=postgres://travel:travel@"$DB":5432/travel \
  -e PUBLIC_ORIGIN=http://127.0.0.1:3000 \
  "$IMAGE" >/dev/null

echo "Waiting for the application…"
for _ in $(seq 1 30); do
  curl -fsS "$BASE_URL/api/health" >/dev/null 2>&1 && break
  # Контейнер, упавший на миграции, не поднимется сам — дальше ждать бессмысленно.
  [ "$(docker inspect -f '{{.State.Running}}' "$APP")" = true ] || fail "container exited during startup"
  sleep 2
done

echo "→ health endpoint"
curl -fsS "$BASE_URL/api/health" | grep -q '"ok":true' || fail "health endpoint did not report ok"

echo "→ migrations applied"
migrations_logged=false
for _ in $(seq 1 10); do
  app_logs=$(docker logs "$APP" 2>&1)
  if grep -qE 'Applied 001_initial\.sql|Schema is up to date' <<<"$app_logs"; then
    migrations_logged=true
    break
  fi
  sleep 1
done
[ "$migrations_logged" = true ] || fail "no evidence that migrations ran"

echo "→ index page under the base path"
curl -fsS "$BASE_URL/" | grep -q 'id="root"' || fail "index.html is not served at $BASE_URL/"

echo "→ hashed assets carry the base path"
asset=$(curl -fsS "$BASE_URL/" | grep -o '/travel/assets/[^"]*\.js' | head -1)
[ -n "$asset" ] || fail "index.html references no asset under /travel/"
curl -fsS "http://127.0.0.1:3000$asset" >/dev/null || fail "asset $asset is not served"

echo "→ public asset copied into the bundle"
curl -fsS "$BASE_URL/assets/icons/planet.svg" >/dev/null || fail "public assets are not served"

echo "→ client-side route falls back to index.html"
curl -fsS "$BASE_URL/join/smoke-test-token" | grep -q 'id="root"' \
  || fail "SPA fallback does not work for nested routes"

echo "→ bare base path redirects to the trailing slash"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL")
[ "$code" = 301 ] || fail "expected 301 at $BASE_URL, got $code"

echo "→ unknown API route answers JSON, not the SPA"
curl -s "$BASE_URL/api/nope" | grep -q '"error"' || fail "unknown API route did not return a JSON error"

echo "→ protected endpoint rejects anonymous access"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/trips")
[ "$code" = 401 ] || fail "expected 401 at $BASE_URL/api/trips, got $code"

echo "Smoke test passed."
