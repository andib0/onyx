<#
.SYNOPSIS
  Cold-start measurement on the Android emulator: p50/p90 over N runs, JSON out.

.DESCRIPTION
  Prereqs: emulator booted (adb devices shows it), release APK from build-release.ps1
  installed, local API reachable on the host at :3201 (emulator sees it as 10.0.2.2:3201;
  e.g. `node e2e/scripts/start-api.mjs` with E2E_DATABASE_URL set), Maestro in
  %USERPROFILE%\.maestro\bin.

  1. Registers the e2e fixture user on the local API (409 = exists) and signs in once with
     e2e/maestro/login.yaml.
  2. Per run:
       a. `am force-stop` + `am start -W` -> TotalTime (ms to first frame; logged in).
       b. e2e/maestro/coldstart-focus.yaml (stopApp + launch + wait for "Day score");
          flow duration from Maestro's JUnit report -> upper bound for "cold start to Focus"
          (includes Maestro's launchApp step, ~1.3 s on the reference machine).
  3. Writes { runs, amStartTotalMs{p50,p90}, focusVisibleMs{p50,p90} } to -Out.

.EXAMPLE
  powershell -File scripts/android/coldstart.ps1 -Runs 10
#>
param(
  [int]$Runs = 10,
  [string]$Package = "com.onyx.daily",
  [string]$Activity = ".MainActivity",
  [string]$Api = "http://localhost:3201/api",
  [string]$Out = ""
)
$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
if (-not $Out) { $Out = Join-Path $repo "e2e\results\coldstart.json" }
if ($Api -notmatch '^http://(localhost|127\.0\.0\.1)') { throw "Refusing non-local API $Api" }

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$adb = Join-Path $sdk "platform-tools\adb.exe"
$maestro = Join-Path $env:USERPROFILE ".maestro\bin\maestro.bat"
$jdk = Get-ChildItem "$env:LOCALAPPDATA\Programs\Java" -Directory -Filter "jdk-17*" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $env:JAVA_HOME -and $jdk) { $env:JAVA_HOME = $jdk.FullName }
$flows = Join-Path $repo "e2e\maestro"

$devices = & $adb devices | Select-String "\tdevice$"
if (-not $devices) { throw "No emulator/device attached (adb devices)." }
if (-not (& $adb shell pm list packages $Package)) { throw "$Package not installed - run build-release.ps1 -Install" }

try { Invoke-RestMethod "$Api/health" -TimeoutSec 5 | Out-Null }
catch { throw "Local API not reachable at $Api/health - start it first (see .DESCRIPTION)." }

$user = Get-Content (Join-Path $repo "e2e\fixtures\test-user.json") -Raw | ConvertFrom-Json
$body = @{ email = $user.email; password = $user.password; username = $user.name; weight = 80; age = 30 } | ConvertTo-Json
try { Invoke-RestMethod "$Api/auth/register" -Method Post -Body $body -ContentType "application/json" | Out-Null }
catch { if ($_.Exception.Response.StatusCode.value__ -ne 409) { throw } }

Write-Host "Signing in once via Maestro (login.yaml)..."
& $maestro test (Join-Path $flows "login.yaml") | Out-Host
if ($LASTEXITCODE) { throw "Maestro login flow failed" }

$am = @(); $focus = @()
for ($i = 1; $i -le $Runs; $i++) {
  & $adb shell am force-stop $Package | Out-Null
  Start-Sleep -Milliseconds 800
  $res = & $adb shell am start -W -n "$Package/$Activity"
  $total = ($res | Select-String "TotalTime:\s+(\d+)").Matches.Groups[1].Value
  if ($total) { $am += [int]$total }

  & $adb shell am force-stop $Package | Out-Null
  # Flow duration from Maestro's JUnit report (excludes the CLI's ~10 s JVM/device
  # connect overhead that a stopwatch around the command would include).
  $junit = Join-Path $env:TEMP "onyx-coldstart-$i.xml"
  & $maestro test --format junit --output $junit (Join-Path $flows "coldstart-focus.yaml") | Out-Null
  $ok = ($LASTEXITCODE -eq 0)
  $ms = $null
  if ($ok -and (Test-Path $junit)) {
    $tc = ([xml](Get-Content $junit -Raw)).SelectSingleNode("//testcase")
    if ($tc -and $tc.time) { $ms = [int]([double]$tc.time * 1000) }
  }
  if ($ms) { $focus += $ms }
  Write-Host ("run {0}/{1}: am TotalTime={2} ms, Maestro flow launch->'Day score'={3}" -f $i, $Runs, $total, $(if ($ms) { "$ms ms" } else { "FAILED" }))
}

function Pct([int[]]$xs, [double]$p) {
  if (-not $xs.Count) { return $null }
  $s = $xs | Sort-Object
  $idx = [math]::Ceiling($p * $s.Count) - 1
  return $s[[math]::Max(0, $idx)]
}
$result = [ordered]@{
  measuredAt = (Get-Date).ToString("o")
  device = (& $adb shell getprop ro.product.model).Trim()
  runs = $Runs
  amStartTotalMs = [ordered]@{ p50 = (Pct $am 0.5); p90 = (Pct $am 0.9); samples = $am }
  focusVisibleMs = [ordered]@{ p50 = (Pct $focus 0.5); p90 = (Pct $focus 0.9); samples = $focus; note = "Maestro JUnit flow time incl. its launchApp step (upper bound)" }
}
New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
$result | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 $Out
Write-Host "Wrote $Out"
$result | ConvertTo-Json -Depth 5
