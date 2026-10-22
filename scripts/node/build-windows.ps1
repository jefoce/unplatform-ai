#!/usr/bin/env pwsh
# Builds pinned small-ICU Node for Windows x64. Source is SHA-256 checked.
param([string]$Out = '', [switch]$PrepareOnly)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$VersionFile = Get-Content (Join-Path $ScriptDir 'versions.env')

function Read-Version([string]$Name) {
  $line = $VersionFile | Where-Object { $_ -match "^\s*$Name\s*=" } | Select-Object -First 1
  if (-not $line) { throw "Missing $Name in scripts/node/versions.env" }
  return (($line -split '=', 2)[1]).Trim()
}

function Get-Sha256([string]$Path) {
  return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
}

function Invoke-Verify([string]$Path) {
  $bash = Get-Command bash -ErrorAction SilentlyContinue
  if (-not $bash) {
    Write-Host '[node] bash not found, skipping verify.sh'
    return
  }
  & $bash.Source (Join-Path $ScriptDir 'verify.sh') ($Path -replace '\\', '/')
  if ($LASTEXITCODE -ne 0) { throw "verify.sh failed for $Path" }
}

function Copy-License {
  $licenseDir = Join-Path $RepoRoot 'licenses'
  New-Item -ItemType Directory -Force -Path $licenseDir | Out-Null
  $license = Join-Path $SrcDir 'LICENSE'
  if (-not (Test-Path $license)) {
    & tar -xf $Archive -C $Work "node-v$NodeVersion/LICENSE"
    if ($LASTEXITCODE -ne 0) { throw 'Could not extract Node LICENSE' }
  }
  Copy-Item $license (Join-Path $licenseDir 'LICENSE.node') -Force
}

$NodeVersion = Read-Version 'NODE_VERSION'
$NodeSha256 = (Read-Version 'NODE_SHA256').ToLowerInvariant()
$Triple = 'x86_64-pc-windows-msvc'

# Node's source tree is deep, so the build dir must stay short. MSBuild
# FileTracker fails past 260 characters. D:\nb keeps the whole tree under it.
if ($IsWindows) {
  $Work = if ($env:NODE_BUILD_WORK) { $env:NODE_BUILD_WORK } elseif (Test-Path 'D:\') { 'D:\nb' } else { 'C:\nb' }
} else {
  $Work = if ($env:NODE_BUILD_WORK) { $env:NODE_BUILD_WORK } else { '/tmp/nb' }
}
$Work = [IO.Path]::GetFullPath($Work)
if ($Work.Length -gt 10) {
  throw "NODE_BUILD_WORK '$Work' is too long. MSBuild FileTracker rejects paths over 260 characters and Node's tree is deep. Use a short path such as D:\nb."
}

$CacheRoot = Join-Path $HOME '.cache/unplatform-ai-build/node'
$OutDir = if ($Out) { [IO.Path]::GetFullPath($Out) } else { Join-Path $CacheRoot "${NodeVersion}-small-icu/$Triple" }
$Archive = Join-Path $CacheRoot "node-v$NodeVersion.tar.xz"
$Dest = Join-Path $OutDir "unplatform-ai-server-$Triple.exe"
$SrcDir = Join-Path $Work "node-v$NodeVersion"

New-Item -ItemType Directory -Force -Path $CacheRoot, $Work, $OutDir | Out-Null

if ($IsWindows -and $env:PROCESSOR_ARCHITECTURE -ne 'AMD64') {
  throw "Windows x64 host required, got $env:PROCESSOR_ARCHITECTURE"
}

if (-not (Test-Path $Archive) -or (Get-Sha256 $Archive) -ne $NodeSha256) {
  $url = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion.tar.xz"
  Remove-Item $Archive, "$Archive.part" -Force -ErrorAction SilentlyContinue
  Write-Host "[node] download $url"
  Invoke-WebRequest -Uri $url -OutFile "$Archive.part" -UseBasicParsing
  $actual = Get-Sha256 "$Archive.part"
  if ($actual -ne $NodeSha256) {
    Remove-Item "$Archive.part" -Force
    throw "sha256 mismatch for $url`: expected $NodeSha256, got $actual"
  }
  Move-Item "$Archive.part" $Archive -Force
} else {
  Write-Host "[node] cached $Archive"
}

if ($PrepareOnly) {
  if (-not (Test-Path $SrcDir)) {
    Write-Host "[node] extract $Archive"
    & tar -xf $Archive -C $Work
    if ($LASTEXITCODE -ne 0) { throw "Could not extract $Archive" }
  }
  Write-Host "[node] work $Work ($($Work.Length))"
  exit 0
}

if (-not $IsWindows) {
  throw 'Full Node build requires Windows. Use -PrepareOnly on other hosts.'
}

if (Test-Path $Dest) {
  Invoke-Verify $Dest
  Copy-License
  Write-Host "[node] cached binary $Dest"
  exit 0
}

if (-not (Test-Path (Join-Path $SrcDir 'vcbuild.bat'))) {
  Remove-Item $SrcDir -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "[node] extract $Archive"
  & tar -xf $Archive -C $Work
  if ($LASTEXITCODE -ne 0) { throw "Could not extract $Archive" }
}

Write-Host "[node] build $NodeVersion ($Triple)"
Push-Location $SrcDir
try {
  $help = (& cmd /c 'vcbuild.bat help' 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) { throw "vcbuild.bat help failed: $help" }
  foreach ($token in @('small-icu', 'nonpm', 'nocorepack')) {
    if ($help -notmatch [regex]::Escape($token)) {
      throw "vcbuild.bat does not support $token"
    }
  }
  # Node 24.22.1 vcbuild.bat has no inspector-disable switch, so this build
  # keeps the inspector that Next 16 needs.
  & cmd /c 'vcbuild.bat release x64 small-icu nonpm nocorepack'
  if ($LASTEXITCODE -ne 0) { throw 'Node build failed' }
} finally {
  Pop-Location
}

$binary = Join-Path $SrcDir 'out/Release/node.exe'
if (-not (Test-Path $binary)) { throw 'Node build produced no binary' }
Copy-Item $binary $Dest -Force
Invoke-Verify $Dest
Copy-License

Write-Host "[node] binary $Dest"
Write-Host ("[node] size {0:N1} MB" -f ((Get-Item $Dest).Length / 1MB))
