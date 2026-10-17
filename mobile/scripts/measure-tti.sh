#!/usr/bin/env bash
# Cold-start / TTI measurement for Onyx on an Android release build.
# Prereqs: a release (or `--variant release`) build installed on a device/emulator,
#          adb on PATH, and the JS marks from perf-marks.ts wired in (they log "ONYX_PERF ...").
# Usage: ./measure-tti.sh [runs=10] [package=com.onyx.daily]
# Output: per-run TotalTime (am start -W), JS marks, and p50/p90 summary -> tti-results.csv
set -euo pipefail
RUNS="${1:-10}"
PKG="${2:-com.onyx.daily}"
ACTIVITY="$PKG/.MainActivity"
OUT="tti-results.csv"
echo "run,am_total_ms,js_bundle_start_ms,fonts_ms,auth_ms,focus_first_render_ms,focus_interactive_ms" > "$OUT"

for i in $(seq 1 "$RUNS"); do
  adb shell am force-stop "$PKG"
  # Drop page cache for a true cold start (needs root/emulator; ignored otherwise)
  adb shell "echo 3 > /proc/sys/vm/drop_caches" 2>/dev/null || true
  sleep 2
  adb logcat -c
  AM=$(adb shell am start -W -S -n "$ACTIVITY" | tr -d '\r')
  TOTAL=$(echo "$AM" | awk -F': ' '/TotalTime/ {print $2}')
  # Give the app up to 15 s to emit the interactive mark
  for _ in $(seq 1 30); do
    if adb logcat -d -s ReactNativeJS:V | grep -q "ONYX_PERF focus_interactive"; then break; fi
    sleep 0.5
  done
  LOG=$(adb logcat -d -s ReactNativeJS:V | tr -d '\r')
  mark() { echo "$LOG" | grep -o "ONYX_PERF $1 [0-9.]*" | tail -1 | awk '{print $3}'; }
  echo "$i,$TOTAL,$(mark js_start),$(mark fonts_loaded),$(mark auth_ready),$(mark focus_first_render),$(mark focus_interactive)" | tee -a "$OUT"
done

# p50 / p90 per column (sorted numeric)
python3 - "$OUT" <<'PY'
import csv, sys, statistics as st
rows = list(csv.DictReader(open(sys.argv[1])))
for col in rows[0].keys():
    if col == "run": continue
    vals = sorted(float(r[col]) for r in rows if r[col])
    if not vals: print(f"{col:24s} (no data)"); continue
    p90 = vals[min(len(vals)-1, int(round(0.9*(len(vals)-1))))]
    print(f"{col:24s} p50={st.median(vals):8.0f} ms  p90={p90:8.0f} ms  n={len(vals)}")
PY
echo "Budget: focus_interactive p50 < 1000 ms (mid-range device, release, warm network or cache-first)"
