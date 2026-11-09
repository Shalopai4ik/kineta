# Сборка debug-APK Kineta.
# Gradle и AAPT2 нестабильно работают с не-ASCII путями (у нас «Антоха»), поэтому проект
# зеркалируется в C:\kineta-build и собирается там; готовый APK копируется в mobile\dist.
param(
  [string]$Sdk = $(if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { 'C:\Android\Sdk' }),
  [string]$Jdk = $(if ($env:JAVA_HOME) { $env:JAVA_HOME } else { 'C:\Program Files\Android\Android Studio\jbr' }),
  [string]$Work = 'C:\kineta-build',
  [ValidateSet('debug', 'release')][string]$Type = 'debug'
)
$ErrorActionPreference = 'Stop'
$mobile = Split-Path -Parent $PSScriptRoot

Write-Host '1/4 Копирую веб-часть и синхронизирую Capacitor'
Push-Location $mobile
node scripts/copy-www.mjs
npx cap sync android
Pop-Location

Write-Host "2/4 Зеркалирую проект в $Work"
New-Item -ItemType Directory -Force $Work | Out-Null
robocopy $mobile "$Work\mobile" /MIR /NFL /NDL /NJH /NJS /NP /XD build .gradle dist | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy завершился с кодом $LASTEXITCODE" }
"sdk.dir=$($Sdk -replace '\\', '/')" | Set-Content -Encoding ascii "$Work\mobile\android\local.properties"

Write-Host "3/4 Gradle assemble$Type"
$env:JAVA_HOME = $Jdk; $env:ANDROID_HOME = $Sdk; $env:GRADLE_USER_HOME = "$Work\.gradle"
Push-Location "$Work\mobile\android"
$task = if ($Type -eq 'release') { 'assembleRelease' } else { 'assembleDebug' }
& .\gradlew.bat $task --no-daemon --console=plain
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "Gradle завершился с кодом $code" }

Write-Host '4/4 Копирую APK'
$ver = (Get-Content "$mobile\package.json" -Raw | ConvertFrom-Json).version
$apk = Get-ChildItem "$Work\mobile\android\app\build\outputs\apk\$Type" -Filter *.apk | Select-Object -First 1
New-Item -ItemType Directory -Force "$mobile\dist" | Out-Null
$out = "$mobile\dist\kineta-$ver-$Type.apk"
Copy-Item $apk.FullName $out -Force
'{0}  ({1:N1} МБ)' -f $out, ((Get-Item $out).Length / 1MB)
