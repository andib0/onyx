#!/usr/bin/env bash
# Cold-start / TTI measurement for Onyx on an Android release build.
# Prereqs: a release build installed on a device/emulator, logged in, adb on PATH,
#          python3. The app logs "ONYX_PERF <mark> <ms>" (utils/perfMarks.ts).
# Usage: ./measure-tti.sh [runs=10] [package=com.onyx.daily]
# Output: per-run TotalTime (am start -W) and every JS mark as ms since the
#         process started (logcat "Start proc" line -> mark line, same clock),
#         p50/p90 summary -> tti-results.csv
set -euo pipefail
RUNS="${1:-10}"
PKG="${2:-com.onyx.daily}"
ACTIVITY="$PKG/.MainActivity"
OUT="tti-results.csv"
LOGDIR="$(mktemp -d)"

for i in $(seq 1 "$RUNS"); do
  adb shell am force-stop "$PKG"
  # Drop page cache for a true cold start (needs root/emulator; ignored otherwise)
  adb shell "echo 3 > /proc/sys/vm/drop_caches" 2>/dev/null || true
  sleep 2
  adb logcat -c
  AM=$(adb shell am start -W -S -n "$ACTIVITY" | tr -d '\r')
  echo "$AM" | awk -F': ' '/TotalTime/ {print $2}' > "$LOGDIR/am-$i.txt"
  # Give the app up to 15 s to emit the interactive mark
  for _ in $(seq 1 30); do
    if adb logcat -d -s ReactNativeJS:V | grep -q "ONYX_PERF focus_interactive"; then break; fi
    sleep 0.5
  done
  adb logcat -d -v time | tr -d '\r' > "$LOGDIR/log-$i.txt"
done

python3 - "$LOGDIR" "$RUNS" "$PKG" "$OUT" <<'PY'
import re, sys, statistics as st
from datetime import datetime
logdir, runs, pkg, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
MARKS = ["js_start", "fonts_loaded", "cache_restored", "auth_ready",
         "focus_first_render", "focus_interactive"]
ts = lambda line: datetime.strptime("2000-" + line[:18], "%Y-%m-%d %H:%M:%S.%f")
rows = []
for i in range(1, runs + 1):
    lines = open(f"{logdir}/log-{i}.txt", encoding="utf8", errors="replace").read().splitlines()
    start = next((ts(l) for l in lines if "Start proc" in l and pkg in l), None)
    row = {"run": i, "am_total_ms": open(f"{logdir}/am-{i}.txt").read().strip()}
    for m in MARKS:
        hit = next((l for l in lines if f"ONYX_PERF {m} " in l), None)
        row[m + "_ms"] = round((ts(hit) - start).total_seconds() * 1000) if (hit and start) else ""
    rows.append(row)
cols = list(rows[0].keys())
with open(out, "w") as f:
    f.write(",".join(cols) + "\n")
    for r in rows:
        f.write(",".join(str(r[c]) for c in cols) + "\n")
        print(",".join(str(r[c]) for c in cols))
for c in cols[1:]:
    vals = sorted(float(r[c]) for r in rows if str(r[c]) != "")
    if not vals:
        print(f"{c:24s} (no data)"); continue
    p90 = vals[min(len(vals) - 1, int(round(0.9 * (len(vals) - 1))))]
    print(f"{c:24s} p50={st.median(vals):8.0f} ms  p90={p90:8.0f} ms  n={len(vals)}")
PY
echo "Marks are ms since the process started (logcat 'Start proc'); budget: focus_interactive p50 < 1000 ms on a mid-range device"
