#!/usr/bin/env bash

# Automatically capture HAR for tourmkr (or any URL) using headless Brave & chrome-har-capturer
set -euo pipefail

URL="${1:-http://localhost:3000}"
OUTPUT="${2:-$HOME/Downloads/tourmkr.har}"
GRACE="${3:-4000}"
WIDTH="${HAR_WIDTH:-1440}"
HEIGHT="${HAR_HEIGHT:-900}"
TIMEOUT="${HAR_TIMEOUT:-30000}"
CAPTURE_CONTENT="${HAR_CONTENT:-1}"
BRAVE_BIN="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"

if [ ! -f "$BRAVE_BIN" ]; then
  echo "Error: Brave Browser not found at $BRAVE_BIN" >&2
  exit 1
fi

# Fast TCP pre-check without hitting HTTP/SSR (avoids warming Redis/SSR caches before capture)
if command -v bun >/dev/null 2>&1; then
  if ! bun -e '
    import net from "node:net";
    const u = new URL(process.argv[1]);
    const port = Number(u.port) || (u.protocol === "https:" ? 443 : 80);
    const sock = net.connect({ host: u.hostname, port });
    sock.setTimeout(2000);
    sock.on("connect", () => { sock.destroy(); process.exit(0); });
    sock.on("timeout", () => { sock.destroy(); process.exit(1); });
    sock.on("error", () => process.exit(1));
  ' "$URL"; then
    echo "Error: Target server is not listening for $URL" >&2
    echo "Hint: Start the tourmkr server first (e.g. bun run serve:tourmkr)." >&2
    exit 1
  fi
fi

# Pick a free DevTools port so we don't collide with existing debuggers
PORT="${HAR_PORT:-}"
if [ -z "$PORT" ]; then
  if command -v bun >/dev/null 2>&1; then
    PORT=$(bun -e 'const s = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch() { return new Response(); } }); console.log(s.port); s.stop(true);')
  else
    PORT=9222
  fi
fi

# Isolated profile prevents hijacking an open Brave window and ensures a cold cache (no stale NGSW/cookies)
USER_DATA_DIR=$(mktemp -d "${TMPDIR:-/tmp}/brave-har.XXXXXX")
mkdir -p "$(dirname "$OUTPUT")"

BRAVE_PID=""
cleanup() {
  if [ -n "$BRAVE_PID" ]; then
    echo "🧹 Stopping Brave (PID $BRAVE_PID)..."
    kill "$BRAVE_PID" 2>/dev/null || true
    wait "$BRAVE_PID" 2>/dev/null || true
  fi
  rm -rf "$USER_DATA_DIR"
}
trap cleanup EXIT

echo "🚀 Starting isolated headless Brave on port $PORT (${WIDTH}x${HEIGHT})..."
"$BRAVE_BIN" \
  --headless=new \
  --user-data-dir="$USER_DATA_DIR" \
  --remote-debugging-port="$PORT" \
  --window-size="${WIDTH},${HEIGHT}" \
  --no-first-run \
  --no-default-browser-check \
  --disable-extensions \
  --disable-background-networking \
  --disable-component-update \
  --disable-sync \
  --metrics-recording-only \
  --mute-audio \
  about:blank >/dev/null 2>&1 &
BRAVE_PID=$!

# Poll DevTools endpoint instead of fixed sleep
READY=0
for _ in $(seq 1 100); do
  if ! kill -0 "$BRAVE_PID" 2>/dev/null; then
    echo "Error: Brave exited unexpectedly before DevTools became ready." >&2
    exit 1
  fi
  if curl -sf "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.1
done

if [ "$READY" -ne 1 ]; then
  echo "Error: Timed out waiting for Brave DevTools on port $PORT." >&2
  exit 1
fi

CAPTURER_ARGS=(
  -t 127.0.0.1
  -p "$PORT"
  -x "$WIDTH"
  -y "$HEIGHT"
  -g "$GRACE"
  -u "$TIMEOUT"
  -o "$OUTPUT"
)

if [ "$CAPTURE_CONTENT" = "1" ]; then
  CAPTURER_ARGS+=(-c)
fi

echo "📡 Recording HAR for $URL (grace=${GRACE}ms, timeout=${TIMEOUT}ms)..."
if command -v bunx >/dev/null 2>&1; then
  bunx chrome-har-capturer "${CAPTURER_ARGS[@]}" "$URL"
else
  npx --yes chrome-har-capturer "${CAPTURER_ARGS[@]}" "$URL"
fi

SIZE=$(du -h "$OUTPUT" | cut -f1 | xargs)
echo "✅ Saved HAR file to $OUTPUT ($SIZE)"
