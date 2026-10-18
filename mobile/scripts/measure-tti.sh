#!/usr/bin/env bash
# Cold-start / TTI measurement for Onyx on an Android release build.
# Prereqs: a release build installed on a device/emulator, logged in, adb on PATH,
#          python3. The app logs "ONYX_PERF <mark> <ms>" (utils/perfMarks.ts; the
#          first, bundle_start, from utils/perfBoot.ts before expo-router loads).
# Usage: ./measure-tti.sh [runs=10] [package=com.onyx.daily] [label]
# Output: per-run am TotalTime, ActivityManager "Displayed" and every JS mark as ms since the process started (logcat "Start proc" line ->
#         mark line, same clock); p50/p90 per mark and p50 per segment ->
#         tti-results[-label].csv. Host free RAM is printed before/after (Windows).
# Docs: docs/log/cold-start.md
set -euo pipefail
RUNS="${1:-10}"
PKG="${2:-com.onyx.daily}"
LABEL="${3:-}"
ACTIVITY="$PKG/.MainActivity"
OUT="tti-results${LABEL:+-$LABEL}.csv"
LOGDIR="$(mktemp -d)"

free_ram() {
  powershell.exe -NoProfile -Command \
    "[int]((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1024)" 2>/dev/null \
    | tr -d '\r' || echo "?"
}
echo "host free RAM before: $(free_ram) MB"

for i in $(seq 1 "$RUNS"); do
  adb shell am force-stop "$PKG"
  # Drop page cache for a true cold start (root shell on emulators; ignored otherwise)
  adb shell "su 0 sh -c 'echo 3 > /proc/sys/vm/drop_caches'" >/dev/null 2>&1 \
    || adb shell "echo 3 > /proc/sys/vm/drop_caches" >/dev/null 2>&1 || true
  sleep 2
  adb logcat -c
  AM=$(adb shell am start -W -S -n "$ACTIVITY" | tr -d '\r')
  echo "$AM" | awk -F': ' '/TotalTime/ {print $2}' > "$LOGDIR/am-$i.txt"
  # Give the app up to 15 s to emit the interactive mark
  for _ in $(seq 1 30); do
    if adb logcat -d -s ReactNativeJS:V | grep -q "ONYX_PERF focus_interactive"; then break; fi
    sleep 0.5
  done
  sleep 0.5
  adb logcat -d -v time | tr -d '\r' > "$LOGDIR/log-$i.txt"
done
echo "host free RAM after: $(free_ram) MB"

python3 - "$LOGDIR" "$RUNS" "$PKG" "$OUT" <<'PY'
import re, sys, statistics as st
from datetime import datetime
logdir, runs, pkg, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
MARKS = ["bundle_start", "js_start", "root_render", "fonts_loaded", "cache_restored",
         "auth_ready", "splash_hide", "tabs_render", "today_module",
         "focus_first_render", "focus_interactive", "focus_complete"]
ts = lambda line: datetime.strptime("2000-" + line[:18], "%Y-%m-%d %H:%M:%S.%f")
rows = []
for i in range(1, runs + 1):
    lines = open(f"{logdir}/log-{i}.txt", encoding="utf8", errors="replace").read().splitlines()
    start = next((ts(l) for l in lines if "Start proc" in l and pkg in l), None)
    row = {"run": i, "am_total": open(f"{logdir}/am-{i}.txt").read().strip()}
    disp = next((l for l in lines if "Displayed " + pkg in l), None)
    row["displayed"] = ""
    if disp and start:
        row["displayed"] = round((ts(disp) - start).total_seconds() * 1000)
    for m in MARKS:
        hit = next((l for l in lines if f"ONYX_PERF {m} " in l), None)
        row[m] = round((ts(hit) - start).total_seconds() * 1000) if (hit and start) else ""
    rows.append(row)
cols = list(rows[0].keys())
with open(out, "w") as f:
    f.write(",".join(cols) + "\n")
    for r in rows:
        f.write(",".join(str(r[c]) for c in cols) + "\n")
        print(",".join(str(r[c]) for c in cols))
def pct(vals):
    vals = sorted(vals)
    return st.median(vals), vals[min(len(vals) - 1, int(round(0.9 * (len(vals) - 1))))]
print("\nmark (ms since process start)            p50      p90   n")
for c in cols[1:]:
    vals = [float(r[c]) for r in rows if str(r[c]) != ""]
    if not vals:
        print(f"{c:40s} (no data)"); continue
    p50, p90 = pct(vals)
    print(f"{c:40s} {p50:7.0f}  {p90:7.0f}  {len(vals)}")
# Segments: per run, the gap between consecutive timeline points, then p50.
chain = ["process_start"] + MARKS
print("\nsegment (p50 of per-run deltas)                         p50      p90")
prev = "process_start"
for c in chain[1:]:
    d = []
    for r in rows:
        a = 0 if prev == "process_start" else r.get(prev, "")
        b = r.get(c, "")
        if str(a) != "" and str(b) != "":
            d.append(float(b) - float(a))
    if d:
        p50, p90 = pct(d)
        print(f"{prev:>38s} -> {c:<20s} {p50:6.0f}  {p90:6.0f}")
        prev = c
PY
echo "Marks are ms since the process started (logcat 'Start proc'); budget: focus_interactive p50 < 1000 ms on a mid-range device"
