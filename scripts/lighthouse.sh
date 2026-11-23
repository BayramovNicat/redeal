#!/usr/bin/env bash

# Automatically run Lighthouse for tourmkr (or any URL) using isolated headless Brave
set -euo pipefail

URL="${1:-http://localhost:3000}"
RAW_OUTPUT="${2:-$HOME/Downloads/tourmkr-lighthouse}"
PRESET="${3:-${LH_PRESET:-desktop}}"
TIMEOUT="${LH_TIMEOUT:-60000}"
BRAVE_BIN="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"

if [ ! -f "$BRAVE_BIN" ]; then
  echo "Error: Brave Browser not found at $BRAVE_BIN" >&2
  exit 1
fi

OUTPUT_BASE="${RAW_OUTPUT%.report.html}"
OUTPUT_BASE="${OUTPUT_BASE%.report.json}"
OUTPUT_BASE="${OUTPUT_BASE%.html}"
OUTPUT_BASE="${OUTPUT_BASE%.json}"

# Fast TCP pre-check without hitting HTTP/SSR (avoids warming Redis/SSR caches before audit)
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
PORT="${LH_PORT:-}"
if [ -z "$PORT" ]; then
  if command -v bun >/dev/null 2>&1; then
    PORT=$(bun -e 'const s = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch() { return new Response(); } }); console.log(s.port); s.stop(true);')
  else
    PORT=9223
  fi
fi

USER_DATA_DIR=$(mktemp -d "${TMPDIR:-/tmp}/brave-lh.XXXXXX")
mkdir -p "$(dirname "$OUTPUT_BASE")"

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

echo "🚀 Starting isolated headless Brave on port $PORT (preset=$PRESET)..."
"$BRAVE_BIN" \
  --headless=new \
  --user-data-dir="$USER_DATA_DIR" \
  --remote-debugging-port="$PORT" \
  --window-size="1440,900" \
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

LH_ARGS=(
  "$URL"
  --port="$PORT"
  --output=html
  --output=json
  --output-path="$OUTPUT_BASE"
  --max-wait-for-load="$TIMEOUT"
  --quiet
)

if [ "$PRESET" = "desktop" ]; then
  LH_ARGS+=(--preset=desktop)
fi

echo "🔍 Running Lighthouse ($PRESET) for $URL..."
if command -v bunx >/dev/null 2>&1; then
  bunx lighthouse "${LH_ARGS[@]}"
else
  npx --yes lighthouse "${LH_ARGS[@]}"
fi

JSON_REPORT="${OUTPUT_BASE}.report.json"
HTML_REPORT="${OUTPUT_BASE}.report.html"

echo "✅ Saved reports:"
echo "   - $HTML_REPORT"
echo "   - $JSON_REPORT"

if [ -f "$JSON_REPORT" ] && command -v bun >/dev/null 2>&1; then
  bun -e '
    import fs from "node:fs";
    const r = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    console.log("\n=== LIGHTHOUSE SCORES ===");
    for (const [id, c] of Object.entries(r.categories || {})) {
      const score = c.score == null ? "n/a" : Math.round(c.score * 100);
      console.log(`- ${c.title}: ${score}`);
    }
    const metrics = [
      "server-response-time",
      "first-contentful-paint",
      "largest-contentful-paint",
      "total-blocking-time",
      "cumulative-layout-shift",
      "speed-index",
      "interactive",
    ];
    console.log("\n=== KEY METRICS ===");
    for (const m of metrics) {
      const a = r.audits?.[m];
      if (!a) continue;
      console.log(`- ${a.title}: ${a.displayValue ?? a.numericValue ?? "n/a"} (score=${a.score ?? "n/a"})`);
    }
  ' "$JSON_REPORT"
fi
