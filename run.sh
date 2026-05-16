#!/usr/bin/env bash
# run.sh — Analyze a SystemVerilog codebase and launch the block diagram UI.
#
# Usage:
#   ./run.sh --top <top_module> [--src <source_dir>] [--exts ".sv .v"]
#
# Examples:
#   ./run.sh --top top --src backend/tests/fixtures/src
#   ./run.sh --top my_chip --src ~/projects/asic/rtl

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
PUBLIC_DIR="$FRONTEND_DIR/public"

# ── Defaults ────────────────────────────────────────────────────────────────
TOP=""
SRC="$BACKEND_DIR/tests/fixtures/src"
EXTS=".sv .v .svh"

# ── Parse arguments ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --top)  TOP="$2";  shift 2 ;;
    --src)  SRC="$2";  shift 2 ;;
    --exts) EXTS="$2"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: ./run.sh --top <module> [--src <dir>] [--exts '.sv .v']" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$TOP" ]]; then
  echo "Error: --top is required." >&2
  echo "Usage: ./run.sh --top <module> [--src <dir>]" >&2
  exit 1
fi

# ── Check dependencies ───────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
  echo "Error: python3 not found in PATH." >&2
  exit 1
fi
PYTHON=$(command -v python3 || command -v python)

if ! command -v node &>/dev/null; then
  echo "Error: node not found in PATH." >&2
  exit 1
fi

# ── Step 1: Run the backend ──────────────────────────────────────────────────
mkdir -p "$PUBLIC_DIR"
OUT_JSON="$PUBLIC_DIR/hierarchy.json"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SV Module Visualizer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Top module : $TOP"
echo "  Source dir : $SRC"
echo "  Output     : $OUT_JSON"
echo ""

(
  cd "$BACKEND_DIR"
  # shellcheck disable=SC2086
  "$PYTHON" sv_analyzer.py --top "$TOP" --src "$SRC" --out "$OUT_JSON" --exts $EXTS
)

echo ""
echo "  JSON written to: $OUT_JSON"
echo ""

# ── Step 2: Install npm deps if needed ───────────────────────────────────────
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "  Installing frontend dependencies (first run only)…"
  (cd "$FRONTEND_DIR" && npm install --silent)
  echo ""
fi

# ── Step 3: Launch the dev server ────────────────────────────────────────────
echo "  Launching UI at http://localhost:5173"
echo "  Press Ctrl+C to stop."
echo ""

(cd "$FRONTEND_DIR" && npm run dev)
