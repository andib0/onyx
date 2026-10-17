<#
.SYNOPSIS
  Builds a local-API release APK of the Onyx app for the x86_64 emulator.

.DESCRIPTION
  Copies mobile/ to a SHORT path (default C:\Users\<you>\onyx-build-<Name>), runs
  `expo prebuild` and `gradlew assembleRelease` for x86_64 with EXPO_PUBLIC_API_URL baked
  in. mobile/app.config.ts turns on android:usesCleartextTraffic only because that URL is
  http://10.0.2.2 - production builds are unaffected.

  Why the copy: Windows' 260-character MAX_PATH. CMake/ninja (react-native-reanimated,
  worklets, screens) generate object paths like
    <project>\node_modules\react-native-reanimated\android\.cxx\RelWithDebInfo\<hash>\x86_64\...
  which already run ~200 chars; from a worktree such as
    C:\Users\andi\Desktop\Personal\daily\.claude\worktrees\agent-...\mobile
  they exceed 260 and the native build fails ("Filename longer than 260 characters" /
  ninja "No such file or directory"). Building from C:\Users\<you>\onyx-build-* keeps
  the prefix short. Enabling LongPathsEnabled in the registry is NOT enough: ninja/cmake
  in the NDK are not long-path aware.

.EXAMPLE
  pwsh scripts/android/build-release.ps1                       # API http://10.0.2.2:3201/api
  pwsh scripts/android/build-release.ps1 -Name main -ApiUrl http://10.0.2.2:3001/api -Clean
#>
param(
  [string]$Name = "mach",
  [string]$ApiUrl = "http://10.0.2.2:3201/api",
  [string]$Arch = "x86_64",
  [string]$Dest = "",
  [switch]$Clean,
  [switch]$Install
)
$ErrorActionPreference = "Stop"

if ($ApiUrl -match "onrender\.com") { throw "Refusing to build an e2e APK against the production API ($ApiUrl)" }

$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$src = Join-Path $repo "mobile"
if (-not $Dest) { $Dest = Join-Path $env:USERPROFILE "onyx-build-$Name" }
if ($Dest.Length -gt 40) { Write-Warning "Build path '$Dest' is long ($($Dest.Length) chars); native builds may hit MAX_PATH." }

$jdk = Get-ChildItem "$env:LOCALAPPDATA\Programs\Java" -Directory -Filter "jdk-17*" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $env:JAVA_HOME -and $jdk) { $env:JAVA_HOME = $jdk.FullName }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
$env:EXPO_PUBLIC_API_URL = $ApiUrl
$env:NODE_ENV = "production"
$env:CI = "1"
Write-Host "JAVA_HOME=$env:JAVA_HOME  ANDROID_HOME=$env:ANDROID_HOME"
Write-Host "Building $src -> $Dest  (API $ApiUrl, arch $Arch)"

$t0 = Get-Date
# Mirror sources (not node_modules / generated native dirs). robocopy exit codes < 8 = success.
robocopy $src $Dest /MIR /NFL /NDL /NJH /NJS /NP `
  /XD node_modules android ios .expo .perf-export dist web-build | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }

Push-Location $Dest
try {
  if (-not (Test-Path node_modules) -or $Clean) {
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE) { throw "npm ci failed" }
  }
  $prebuildArgs = @("expo", "prebuild", "--platform", "android", "--no-install")
  if ($Clean -or -not (Test-Path android)) { $prebuildArgs += "--clean" }
  npx @prebuildArgs
  if ($LASTEXITCODE) { throw "expo prebuild failed" }

  $manifest = Get-Content android\app\src\main\AndroidManifest.xml -Raw
  if ($manifest -notmatch 'usesCleartextTraffic="true"') {
    Write-Warning "AndroidManifest has no usesCleartextTraffic=true - an http:// API will fail in release."
  }

  Push-Location android
  .\gradlew.bat assembleRelease "-PreactNativeArchitectures=$Arch" --console=plain
  $code = $LASTEXITCODE
  Pop-Location
  if ($code) { throw "gradle assembleRelease failed ($code)" }

  $apk = Join-Path $Dest "android\app\build\outputs\apk\release\app-release.apk"
  $mins = [math]::Round(((Get-Date) - $t0).TotalMinutes, 1)
  Write-Host "APK: $apk  ($mins min)"
  if ($Install) {
    adb install -r $apk
    if ($LASTEXITCODE) { throw "adb install failed" }
  }
}
finally {
  Pop-Location
}
