<#
  Wonder Bites full environment installer - WINDOWS 10/11 (native PowerShell)

  Installs: Node LTS, Git, Ollama (+ GPU tuning), models, OpenClaw, the Wonder Bites MCP server,
  agents, the gateway, and (optionally enabled) scheduled jobs.

  RUN WITH (normal PowerShell, not sourced):
      powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1

  Needs wonder-bites-jobs.json in the same folder.

  Options:
      -Models "qwen3:4b qwen3:0.6b gemma4:e2b"   models to pull
      -Primary "ollama/qwen3:4b"                  model for agents
      -Ctx 16384                                  context cap written into OpenClaw config
      -JobModel "provider/model"                  model override for scheduled jobs
      -EnableJobs                                 create jobs ENABLED (default: created disabled)
      -CloneRepo                                  git clone the wonder-bites repo

  Notes:
    * Safe to re-run: steps check before changing anything.
    * WSL2 (Ubuntu) is OpenClaw's officially recommended Windows path. If this native script
      gives you trouble, run setup-linux.sh inside WSL Ubuntu instead.
    * The gateway service uses a Scheduled Task; creating it may need an Administrator shell.
#>
param(
  [string]$Models = "qwen3:4b qwen3:0.6b gemma4:e2b",
  [string]$Primary = "ollama/qwen3:4b",
  [int]$Ctx = 16384,
  [string]$JobModel = "",
  [switch]$EnableJobs,
  [switch]$CloneRepo
)

$ErrorActionPreference = "Continue"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$JobsFile = Join-Path $Here "wonder-bites-jobs.json"
$OcDir = Join-Path $HOME ".openclaw"
$OcCfg = Join-Path $OcDir "openclaw.json"
$Api = "https://wonder-bites-api.onrender.com/readyz"
$McpUrl = "https://wonder-bites-api.onrender.com/mcp"
$Summary = New-Object System.Collections.Generic.List[string]

function Step($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Say($t)  { Write-Host "  $t" }
function Warn($t) { Write-Host "  WARN: $t" -ForegroundColor Yellow; $Summary.Add("WARN: $t") }
function Note($t) { $Summary.Add($t) }
function Show-Summary {
  Write-Host ""; Write-Host "################ SUMMARY ################"
  foreach ($l in $Summary) { Write-Host " - $l" }
  Write-Host "#########################################"
}
function Die($t) { Write-Host ""; Write-Host "STOPPED: $t" -ForegroundColor Red; Show-Summary; exit 1 }
function Has($c) { return [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Refresh-Path {
  $m = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $u = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$m;$u;$env:APPDATA\npm"
}
function Wait-Http($url, $seconds) {
  for ($i = 0; $i -lt $seconds; $i++) {
    try { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 | Out-Null; return $true } catch { Start-Sleep -Seconds 1 }
  }
  return $false
}
function Wait-Gateway {
  for ($i = 0; $i -lt 40; $i++) {
    & openclaw cron status *> $null
    if ($LASTEXITCODE -eq 0) { return $true }
    Start-Sleep -Seconds 3
  }
  return $false
}
function Write-Json($obj, $path) {
  $json = $obj | ConvertTo-Json -Depth 20
  [IO.File]::WriteAllText($path, $json, (New-Object Text.UTF8Encoding($false)))
}
function Winget-Install($id, $cmd) {
  if (Has $cmd) { Say "have $cmd"; return }
  winget install -e --id $id --silent --accept-package-agreements --accept-source-agreements | Out-Null
  Refresh-Path
}

if (-not (Test-Path $JobsFile)) { Die "wonder-bites-jobs.json not found next to this script ($JobsFile)" }

# ---------------------------------------------------------------- 1. prerequisites
Step "1. winget, Node LTS, Git"
if (-not (Has "winget")) { Die "winget not found. Install 'App Installer' from the Microsoft Store, then re-run." }
Winget-Install "OpenJS.NodeJS.LTS" "node"
Winget-Install "Git.Git" "git"
Refresh-Path
if (-not (Has "node")) { Die "node not on PATH. Close this window, open a new PowerShell, and re-run." }
$nv = [version](& node -p "process.versions.node")
if ($nv -lt [version]"22.14") {
  winget upgrade -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements | Out-Null
  Refresh-Path
  $nv = [version](& node -p "process.versions.node")
  if ($nv -lt [version]"22.14") { Die "Node $nv is too old (need 22.14+). Install Node 24 LTS manually." }
}
Note "Node $nv"

# ---------------------------------------------------------------- 2. openclaw
Step "2. OpenClaw CLI"
& npm install -g openclaw@latest *> $null
Refresh-Path
if (-not (Has "openclaw")) { Die "openclaw not on PATH after npm install. Open a NEW PowerShell and re-run." }
Note ("OpenClaw " + ((& openclaw --version 2>$null) | Select-Object -First 1))

# ---------------------------------------------------------------- 3. gpu
Step "3. GPU check"
$gpus = (Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name) -join ", "
Say "video: $gpus"
if ($gpus -match "NVIDIA") {
  if (Has "nvidia-smi") { Note "NVIDIA driver present" }
  else { Warn "NVIDIA GPU found but nvidia-smi is missing. Install the NVIDIA driver (GeForce Experience or nvidia.com) or models will run CPU-only." }
}

# ---------------------------------------------------------------- 4. ollama
Step "4. Ollama"
Winget-Install "Ollama.Ollama" "ollama"
Refresh-Path
[Environment]::SetEnvironmentVariable("OLLAMA_FLASH_ATTENTION", "1", "User")
[Environment]::SetEnvironmentVariable("OLLAMA_KV_CACHE_TYPE", "q8_0", "User")
$env:OLLAMA_FLASH_ATTENTION = "1"; $env:OLLAMA_KV_CACHE_TYPE = "q8_0"
Get-Process | Where-Object { $_.ProcessName -like "ollama*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
$app = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama app.exe"
if (Test-Path $app) { Start-Process $app } else { Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden }
if (-not (Wait-Http "http://127.0.0.1:11434/api/version" 40)) { Die "Ollama did not start" }
Note "Ollama running (flash attention on, KV cache q8_0)"

# ---------------------------------------------------------------- 5. models
Step "5. Pull models: $Models"
$have = (& ollama list) -join "`n"
foreach ($m in ($Models -split "\s+" | Where-Object { $_ })) {
  if ($have -match "(?m)^$([regex]::Escape($m))\s") { Say "have $m"; continue }
  & ollama pull $m
  if ($LASTEXITCODE -eq 0) { Note "pulled $m" } else { Warn "could not pull $m" }
}

# ---------------------------------------------------------------- 6. token
Step "6. Wonder Bites MCP token (stored as a USER environment variable)"
$existing = [Environment]::GetEnvironmentVariable("WONDER_BITES_MCP_TOKEN", "User")
if ($existing) { Say "token already set, keeping it"; $env:WONDER_BITES_MCP_TOKEN = $existing }
else {
  $tok = $env:WONDER_BITES_MCP_TOKEN
  if (-not $tok) {
    $sec = Read-Host "  Paste the Wonder Bites MCP token (hidden, Enter to skip)" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    $tok = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  if ($tok) {
    [Environment]::SetEnvironmentVariable("WONDER_BITES_MCP_TOKEN", $tok, "User")
    $env:WONDER_BITES_MCP_TOKEN = $tok
    Note "token saved (use a freshly rotated token, never one pasted in chat or logs)"
  } else { Warn "no token saved: MCP publishing will not work until WONDER_BITES_MCP_TOKEN is set" }
  $tok = $null
}

# ---------------------------------------------------------------- 7. onboarding
Step "7. OpenClaw onboarding (non-interactive, local + Ollama)"
$mid = $Primary -replace "^ollama/", ""
if (Test-Path $OcCfg) { Say "config already exists, skipping onboarding" }
else {
  & openclaw onboard --non-interactive --mode local --auth-choice ollama --custom-model-id $mid --accept-risk --skip-health --gateway-port 18789 --gateway-bind loopback
  if ($LASTEXITCODE -ne 0) { Die "onboarding failed. Run 'openclaw onboard' once interactively (Ollama, Local only), then re-run this script." }
  Note "OpenClaw onboarded with $Primary"
}

# ---------------------------------------------------------------- 8. config patches
Step "8. OpenClaw config: MCP server + context cap"
$bk = "$OcCfg.bak-setup-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item $OcCfg $bk; Say "backup: $bk"

$mcpPatch = Join-Path $env:TEMP "wb-mcp-patch.json"
$mcp = @{ mcp = @{ servers = @{ "wonder-bites" = @{
  url = $McpUrl; transport = "streamable-http"
  headers = @{ Authorization = 'Bearer ${WONDER_BITES_MCP_TOKEN}' }
  connectionTimeoutMs = 30000; requestTimeoutMs = 60000 } } } }
Write-Json $mcp $mcpPatch
& openclaw config patch --file $mcpPatch --dry-run *> $null
if ($LASTEXITCODE -eq 0) {
  & openclaw config patch --file $mcpPatch *> $null
  if ($LASTEXITCODE -eq 0) { Note "MCP server 'wonder-bites' saved" } else { Warn "MCP config patch failed" }
} else { Warn "MCP config dry-run failed; fallback: openclaw mcp set (docs.openclaw.ai/cli/mcp)" }
& openclaw mcp configure wonder-bites --approval auto *> $null
Remove-Item $mcpPatch -ErrorAction SilentlyContinue

$cfg = Get-Content $OcCfg -Raw | ConvertFrom-Json
if ($cfg.models -and $cfg.models.providers -and $cfg.models.providers.ollama) {
  $list = @($cfg.models.providers.ollama.models | Where-Object { $_ })
  $hit = $list | Where-Object { $_.id -eq $mid }
  if ($hit) { foreach ($e in $list) { if ($e.id -eq $mid) { $e | Add-Member -NotePropertyName contextTokens -NotePropertyValue $Ctx -Force } } }
  else {
    $tpl = $list | Where-Object { $_.id -like "*qwen3*" } | Select-Object -First 1
    if ($tpl) { $new = $tpl | ConvertTo-Json -Depth 20 | ConvertFrom-Json }
    else {
      $new = [pscustomobject]@{
        input = @("text"); reasoning = $true
        cost = @{ input = 0; output = 0; cacheRead = 0; cacheWrite = 0 }
        contextWindow = 40960; maxTokens = 8192
        compat = @{ supportsTools = $true; supportsUsageInStreaming = $true; supportsJsonSchemaResponseFormat = $true } }
    }
    $new | Add-Member -NotePropertyName id -NotePropertyValue $mid -Force
    $new | Add-Member -NotePropertyName name -NotePropertyValue $mid -Force
    $new | Add-Member -NotePropertyName contextTokens -NotePropertyValue $Ctx -Force
    $list += $new
  }
  $ctxPatch = Join-Path $env:TEMP "wb-ctx-patch.json"
  Write-Json @{ models = @{ providers = @{ ollama = @{ models = [object[]]$list } } } } $ctxPatch
  & openclaw config patch --file $ctxPatch --dry-run *> $null
  if ($LASTEXITCODE -eq 0) {
    & openclaw config patch --file $ctxPatch *> $null
    if ($LASTEXITCODE -eq 0) { Note "Context for $mid capped at $Ctx tokens" } else { Warn "context patch failed (backup: $bk)" }
  } else { Warn "context patch dry-run failed (config untouched; backup: $bk)" }
  Remove-Item $ctxPatch -ErrorAction SilentlyContinue
} else { Warn "no models.providers.ollama in config; skipped context cap" }
& openclaw config validate *> $null
if ($LASTEXITCODE -eq 0) { Say "config valid" } else { Warn "'openclaw config validate' reported a problem (backup: $bk)" }

# ---------------------------------------------------------------- 9. agents
Step "9. Agents: coordinator researcher writer reviewer"
foreach ($a in @("coordinator", "researcher", "writer", "reviewer")) {
  $ws = Join-Path $OcDir "workspace\$a"
  & openclaw agents add $a --workspace $ws --model $Primary --non-interactive --json *> $null
  if ($LASTEXITCODE -eq 0) { Say "created $a" } else { Say "$a: not created (probably exists already)" }
}
Note "Agents ensured. Sub-agent delegation (coordinator -> researcher/writer/reviewer) is NOT copied; set it in openclaw.json or the Control UI if wanted"

# ---------------------------------------------------------------- 10. gateway
Step "10. Gateway (Scheduled Task) + MCP probe"
& openclaw gateway install *> $null
if ($LASTEXITCODE -ne 0) { Warn "'openclaw gateway install' failed (try an Administrator PowerShell, or run 'openclaw gateway' in a window)" }
& openclaw gateway restart *> $null
if (-not (Wait-Gateway)) { Warn "gateway not answering. Check: openclaw gateway status" } else { Note "Gateway running" }
Say "waiting for API (Render may be asleep, up to 90s)..."
try { Invoke-WebRequest -Uri $Api -UseBasicParsing -TimeoutSec 90 | Out-Null; Say "API ready" } catch { Warn "API not ready yet" }
$probe = (& openclaw mcp probe 2>&1 | Out-String)
if ($probe -match "16 tools") { Note "MCP probe OK (16 tools)" } else { Warn "MCP probe did not report 16 tools. If it says 401, sign out/in (or restart) so the gateway sees the user env var." }

# ---------------------------------------------------------------- 11. jobs
Step "11. Scheduled jobs (from wonder-bites-jobs.json)"
$jobs = Get-Content $JobsFile -Raw | ConvertFrom-Json
$existingList = (& openclaw cron list 2>&1 | Out-String)
$created = 0
foreach ($j in $jobs.jobs) {
  if ($existingList -match [regex]::Escape($j.name)) { Say "skip (exists): $($j.name)"; continue }
  $a = @("cron","add","--name",$j.name,"--declaration-key",$j.key,"--agent","coordinator","--session","isolated",
         "--cron",$j.cron,"--tz",$jobs.tz,"--exact","--thinking","low","--no-deliver","--timeout-seconds","1200",
         "--message",($jobs.common + " " + $j.prompt))
  if ($JobModel) { $a += @("--model", $JobModel) }
  if (-not $EnableJobs) { $a += "--disabled" }
  & openclaw @a *> $null
  if ($LASTEXITCODE -eq 0) { Say "created: $($j.name)  [$($j.cron)]"; $created++ } else { Warn "failed to create job: $($j.name)" }
}

# Warm-ups: Windows has no 'sh' for OpenClaw command jobs, so use Task Scheduler (times converted from IST to this PC's time zone)
$ist = [TimeZoneInfo]::FindSystemTimeZoneById("India Standard Time")
foreach ($w in $jobs.warmups) {
  $p = $w.cron -split " "
  $istTime = [datetime]::SpecifyKind([datetime]::Today.AddHours([int]$p[1]).AddMinutes([int]$p[0]), [DateTimeKind]::Unspecified)
  $loc = [TimeZoneInfo]::ConvertTimeFromUtc([TimeZoneInfo]::ConvertTimeToUtc($istTime, $ist), [TimeZoneInfo]::Local)
  $at = [datetime]::Today.AddHours($loc.Hour).AddMinutes($loc.Minute)
  $tn = "WonderBites-" + ($w.name -replace " ", "-")
  $action = New-ScheduledTaskAction -Execute "curl.exe" -Argument "-fsS --max-time 60 $Api"
  $trigger = New-ScheduledTaskTrigger -Daily -At $at
  Register-ScheduledTask -TaskName $tn -Action $action -Trigger $trigger -Force *> $null
  if (-not $EnableJobs) { Disable-ScheduledTask -TaskName $tn *> $null }
  Say "warm-up task: $tn at $($at.ToString('HH:mm')) local"
}
if ($EnableJobs) { Note "$created cron jobs created ENABLED" } else { Note "$created cron jobs created DISABLED (use -EnableJobs, or 'openclaw cron enable <id>')" }
Note "Math Practice is NOT created: it needs your exact 32-module syllabus first"

# ---------------------------------------------------------------- 12. optional repo
if ($CloneRepo) {
  Step "12. Clone repo"
  $dest = Join-Path $HOME "Projects\wonder-bites"
  if (Test-Path (Join-Path $dest ".git")) { Say "already cloned" }
  else {
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    git clone https://github.com/shad-ct/wonder-bites $dest
    if ($LASTEXITCODE -eq 0) { Note "repo cloned" } else { Warn "git clone failed (private repo? sign in with 'gh auth login' or a credential manager)" }
  }
}

Show-Summary
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. openclaw cron list                       (each job should appear once)"
Write-Host "  2. Test ONE job first:  openclaw cron run <job-id>  then check the site"
Write-Host "  3. Local 4B models are slow at agent work; consider -JobModel with a stronger model"
Write-Host "  4. Open a NEW PowerShell window so PATH and env vars are fully refreshed"
