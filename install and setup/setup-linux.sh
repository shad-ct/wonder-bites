#!/usr/bin/env bash
# Wonder Bites full environment installer - LINUX (Debian/Ubuntu family)
#
# Installs: build prerequisites, Node 24, OpenClaw, Ollama (+ GPU tuning), models,
# the Wonder Bites MCP server, agents, gateway service, and (optionally enabled) cron jobs.
#
# RUN WITH:   bash setup-linux.sh        (do NOT source it)
# Needs:      wonder-bites-jobs.json in the same folder.
#
# Optional environment variables:
#   MODELS="qwen3:4b qwen3:0.6b gemma4:e2b"   models to pull
#   PRIMARY=ollama/qwen3:4b                   model for agents
#   CTX=16384                                 context cap written into OpenClaw config
#   ENABLE_JOBS=0|1                           1 = create scheduled jobs ENABLED (default 0 = created disabled)
#   JOB_MODEL=""                              model override for scheduled jobs (default: agent's model)
#   INSTALL_NVIDIA=0|1                        1 = run 'ubuntu-drivers install' if an NVIDIA GPU has no driver
#   CLONE_REPO=0|1                            1 = git clone the wonder-bites repo if missing
#   WONDER_BITES_MCP_TOKEN=...                token (otherwise you are asked, hidden)
#
# Safe to re-run: every step checks before it changes anything.

if (return 0 2>/dev/null); then
  echo "Don't source this file. Run: bash setup-linux.sh"; return 1
fi
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JOBS_FILE="$HERE/wonder-bites-jobs.json"
MODELS="${MODELS:-qwen3:4b qwen3:0.6b gemma4:e2b}"
PRIMARY="${PRIMARY:-ollama/qwen3:4b}"
CTX="${CTX:-16384}"
ENABLE_JOBS="${ENABLE_JOBS:-0}"
JOB_MODEL="${JOB_MODEL:-}"
INSTALL_NVIDIA="${INSTALL_NVIDIA:-0}"
CLONE_REPO="${CLONE_REPO:-0}"
ENV_FILE="$HOME/.config/openclaw/wonder-bites.env"
OC_CFG="$HOME/.openclaw/openclaw.json"
API="https://wonder-bites-api.onrender.com/readyz"
MCP_URL="https://wonder-bites-api.onrender.com/mcp"
NEED_REBOOT=0
SUMMARY=()

step() { echo; echo "=== $* ==="; }
say()  { echo "  $*"; }
warn() { echo "  WARN: $*"; SUMMARY+=("WARN: $*"); }
note() { SUMMARY+=("$*"); }
die()  { echo; echo "STOPPED: $*"; print_summary; exit 1; }
print_summary() {
  echo; echo "################ SUMMARY ################"
  for l in "${SUMMARY[@]}"; do echo " - $l"; done
  echo "#########################################"
}
wait_http() {  # url seconds
  local i; for ((i=0;i<$2;i++)); do curl -fsS --max-time 3 "$1" >/dev/null 2>&1 && return 0; sleep 1; done; return 1
}
wait_gateway() {
  local i; for ((i=0;i<40;i++)); do openclaw cron status >/dev/null 2>&1 && return 0; sleep 3; done; return 1
}

[[ -f "$JOBS_FILE" ]] || die "wonder-bites-jobs.json not found next to this script ($JOBS_FILE)"

# ------------------------------------------------------------------ 1. packages
step "1. System packages"
command -v apt-get >/dev/null || die "apt-get not found. This script supports Debian/Ubuntu. Install curl git jq zstd and Node >= 22.14 yourself, then re-run."
sudo -v || die "sudo is required"
sudo apt-get update -y >/dev/null
sudo apt-get install -y curl ca-certificates git jq zstd pciutils >/dev/null || die "apt install failed"
note "Base packages installed (curl git jq zstd pciutils)"

# ------------------------------------------------------------------ 2. node
step "2. Node.js (need >= 22.14, installing 24 if missing/old)"
node_ok=0
if command -v node >/dev/null && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit((a>22||(a===22&&b>=14))?0:1)'; then node_ok=1; fi
if (( ! node_ok )); then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - >/dev/null 2>&1 || die "NodeSource setup failed"
  sudo apt-get install -y nodejs >/dev/null || die "nodejs install failed"
fi
note "Node $(node -v)"

# ------------------------------------------------------------------ 3. openclaw
step "3. OpenClaw CLI (user-level npm prefix, no sudo)"
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
grep -qs '.npm-global/bin' "$HOME/.profile" || echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> "$HOME/.profile"
npm install -g openclaw@latest >/dev/null 2>&1 || die "npm install -g openclaw@latest failed"
command -v openclaw >/dev/null || die "openclaw not on PATH after install"
note "OpenClaw $(openclaw --version 2>/dev/null | head -1)"

# ------------------------------------------------------------------ 4. gpu
step "4. NVIDIA GPU check"
if lspci 2>/dev/null | grep -qi nvidia; then
  if command -v nvidia-smi >/dev/null && nvidia-smi >/dev/null 2>&1; then
    note "GPU: $(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader | head -1)"
  elif [[ "$INSTALL_NVIDIA" == "1" ]] && command -v ubuntu-drivers >/dev/null; then
    sudo ubuntu-drivers install && NEED_REBOOT=1 && note "NVIDIA driver installed -> REBOOT required, then re-run this script"
  else
    warn "NVIDIA GPU found but no working driver (models will run CPU-only). Re-run with INSTALL_NVIDIA=1 or run: sudo ubuntu-drivers install"
  fi
else
  say "no NVIDIA GPU detected (CPU-only is fine, just slower)"
fi

# ------------------------------------------------------------------ 5. ollama
step "5. Ollama"
if ! command -v ollama >/dev/null; then
  curl -fsSL https://ollama.com/install.sh | sh || die "Ollama install failed"
fi
sudo mkdir -p /etc/systemd/system/ollama.service.d
printf '[Service]\nEnvironment="OLLAMA_FLASH_ATTENTION=1"\nEnvironment="OLLAMA_KV_CACHE_TYPE=q8_0"\n' \
  | sudo tee /etc/systemd/system/ollama.service.d/wonder-bites.conf >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable ollama >/dev/null 2>&1
sudo systemctl restart ollama
wait_http http://127.0.0.1:11434/api/version 30 || die "Ollama did not start"
note "Ollama $(ollama --version 2>/dev/null | tail -1) (flash attention on, KV cache q8_0)"

# ------------------------------------------------------------------ 6. models
step "6. Pull models: $MODELS"
for m in $MODELS; do
  if ollama list | awk 'NR>1{print $1}' | grep -qx "$m"; then say "have $m"
  else ollama pull "$m" && note "pulled $m" || warn "could not pull $m"; fi
done

# ------------------------------------------------------------------ 7. token
step "7. Wonder Bites MCP token (stored in $ENV_FILE, mode 600)"
mkdir -p "$(dirname "$ENV_FILE")"
if [[ -s "$ENV_FILE" ]]; then
  say "env file already exists, keeping it"
else
  tok="${WONDER_BITES_MCP_TOKEN:-}"
  if [[ -z "$tok" ]]; then read -rsp "  Paste the Wonder Bites MCP token (hidden, Enter to skip): " tok; echo; fi
  if [[ -n "$tok" ]]; then
    ( umask 077; printf 'WONDER_BITES_MCP_TOKEN=%s\n' "$tok" > "$ENV_FILE" ); chmod 600 "$ENV_FILE"
    note "token saved (use a freshly rotated token, not one that was ever pasted in chat/logs)"
  else
    warn "no token saved: MCP publishing will not work until $ENV_FILE exists"
  fi
  unset tok
fi

# ------------------------------------------------------------------ 8. onboarding
step "8. OpenClaw onboarding (non-interactive, local + Ollama)"
if [[ -f "$OC_CFG" ]]; then
  say "config already exists, skipping onboarding"
else
  openclaw onboard --non-interactive --mode local --auth-choice ollama \
    --custom-model-id "${PRIMARY#ollama/}" --accept-risk --skip-health \
    --gateway-port 18789 --gateway-bind loopback \
    || die "onboarding failed. Run 'openclaw onboard' interactively once (choose Ollama, Local only), then re-run this script."
  note "OpenClaw onboarded with ${PRIMARY}"
fi

# ------------------------------------------------------------------ 9. gateway service
step "9. Gateway service (systemd user service)"
openclaw gateway install >/dev/null 2>&1 || warn "'openclaw gateway install' reported a problem (see: openclaw gateway status)"
OVR="$HOME/.config/systemd/user/openclaw-gateway.service.d"
mkdir -p "$OVR"
printf '[Service]\nEnvironmentFile=-%%h/.config/openclaw/wonder-bites.env\n' > "$OVR/override.conf"
systemctl --user daemon-reload
sudo loginctl enable-linger "$USER" 2>/dev/null && say "linger enabled (gateway keeps running after logout)"
systemctl --user restart openclaw-gateway.service 2>/dev/null || warn "could not restart openclaw-gateway.service"
wait_gateway || die "gateway did not come up (journalctl --user -u openclaw-gateway.service -n 50)"
note "Gateway running"

# ------------------------------------------------------------------ 10. config patches
step "10. OpenClaw config: MCP server + context cap"
BK="$OC_CFG.bak-setup-$(date +%s)"; cp "$OC_CFG" "$BK"; say "backup: $BK"

MCP_PATCH="$(mktemp)"
jq -n --arg url "$MCP_URL" '{mcp:{servers:{"wonder-bites":{
  url:$url, transport:"streamable-http",
  headers:{Authorization:"Bearer ${WONDER_BITES_MCP_TOKEN}"},
  connectionTimeoutMs:30000, requestTimeoutMs:60000}}}}' > "$MCP_PATCH"
if openclaw config patch --file "$MCP_PATCH" --dry-run >/dev/null 2>&1 && openclaw config patch --file "$MCP_PATCH" >/dev/null 2>&1; then
  note "MCP server 'wonder-bites' saved"
else
  warn "MCP config patch failed; fallback: openclaw mcp set wonder-bites '<json>' (see docs.openclaw.ai/cli/mcp)"
fi
openclaw mcp configure wonder-bites --approval auto >/dev/null 2>&1 || true
rm -f "$MCP_PATCH"

MID="${PRIMARY#ollama/}"
if jq -e '.models.providers.ollama' "$OC_CFG" >/dev/null 2>&1; then
  CTX_PATCH="$(mktemp)"
  jq --arg id "$MID" --argjson ctx "$CTX" '
    (.models.providers.ollama.models // []) as $m
    | ([$m[] | select(.id == $id)] | length) as $has
    | {models:{providers:{ollama:{models:(
        if $has > 0
        then ($m | map(if .id == $id then .contextTokens = $ctx else . end))
        else ($m + [ (([$m[] | select(.id | test("qwen3"))][0]) // {
                        input:["text"], reasoning:true,
                        cost:{input:0,output:0,cacheRead:0,cacheWrite:0},
                        contextWindow:40960, maxTokens:8192,
                        compat:{supportsTools:true,supportsUsageInStreaming:true,supportsJsonSchemaResponseFormat:true}})
                     | .id=$id | .name=$id | .contextTokens=$ctx ])
        end)}}}}' "$OC_CFG" > "$CTX_PATCH" 2>/dev/null
  if [[ -s "$CTX_PATCH" ]] && openclaw config patch --file "$CTX_PATCH" --dry-run >/dev/null 2>&1 && openclaw config patch --file "$CTX_PATCH" >/dev/null 2>&1; then
    note "Context for $MID capped at $CTX tokens"
  else
    warn "context cap patch failed (config untouched; backup $BK)"
  fi
  rm -f "$CTX_PATCH"
else
  warn "no models.providers.ollama in config; skipped context cap"
fi
openclaw config validate >/dev/null 2>&1 && say "config valid" || warn "'openclaw config validate' reported a problem (backup: $BK)"

# ------------------------------------------------------------------ 11. agents
step "11. Agents: coordinator researcher writer reviewer"
for a in coordinator researcher writer reviewer; do
  if openclaw agents add "$a" --workspace "$HOME/.openclaw/workspace/$a" --model "$PRIMARY" --non-interactive --json >/dev/null 2>&1; then
    say "created $a"
  else
    say "$a: not created (probably exists already)"
  fi
done
note "Agents ensured. Sub-agent delegation (coordinator -> researcher/writer/reviewer) is NOT copied: set it in openclaw.json or the Control UI if you want it"

# ------------------------------------------------------------------ 12. restart + probe
step "12. Restart gateway, wait for API, probe MCP"
systemctl --user restart openclaw-gateway.service 2>/dev/null
wait_gateway || warn "gateway slow to restart"
say "waiting for API (Render may be asleep, up to 90s)..."
if curl -fsS --max-time 90 "$API" >/dev/null 2>&1; then
  say "API ready"
else
  warn "API not ready yet"
fi
if [[ -s "$ENV_FILE" ]]; then
  PROBE=$( ( set -a; source "$ENV_FILE"; set +a; openclaw mcp probe 2>&1 ) )
  echo "$PROBE" | grep -E 'wonder-bites' || true
  echo "$PROBE" | grep -q '16 tools' && note "MCP probe OK (16 tools)" || warn "MCP probe did not report 16 tools"
else
  warn "skipped MCP probe (no token)"
fi

# ------------------------------------------------------------------ 13. scheduled jobs
step "13. Scheduled jobs (from wonder-bites-jobs.json)"
[[ "$ENABLE_JOBS" == "1" ]] && DIS=() || DIS=(--disabled)
MODEL_ARGS=(); [[ -n "$JOB_MODEL" ]] && MODEL_ARGS=(--model "$JOB_MODEL")
TZN="$(jq -r '.tz' "$JOBS_FILE")"
COMMON="$(jq -r '.common' "$JOBS_FILE")"
LIST="$(openclaw cron list 2>/dev/null)"

created=0
while IFS=$'\t' read -r name key cron prompt; do
  if grep -qF "$name" <<<"$LIST"; then say "skip (exists): $name"; continue; fi
  if openclaw cron add --name "$name" --declaration-key "$key" --agent coordinator --session isolated \
       --cron "$cron" --tz "$TZN" --exact --thinking low --no-deliver --timeout-seconds 1200 \
       "${MODEL_ARGS[@]}" "${DIS[@]}" --message "$COMMON $prompt" >/dev/null 2>&1; then
    say "created: $name  [$cron]"; created=$((created+1))
  else
    warn "failed to create job: $name"
  fi
done < <(jq -r '.jobs[] | [.name,.key,.cron,.prompt] | @tsv' "$JOBS_FILE")

while IFS=$'\t' read -r name key cron; do
  if grep -qF "$name" <<<"$LIST"; then say "skip (exists): $name"; continue; fi
  if openclaw cron add --name "$name" --declaration-key "$key" --cron "$cron" --tz "$TZN" --exact \
       "${DIS[@]}" --command "curl -fsS --max-time 60 $API" >/dev/null 2>&1; then
    say "created: $name  [$cron]"; created=$((created+1))
  else
    warn "failed to create warm-up: $name"
  fi
done < <(jq -r '.warmups[] | [.name,.key,.cron] | @tsv' "$JOBS_FILE")

if [[ "$ENABLE_JOBS" == "1" ]]; then note "$created jobs created ENABLED"; else note "$created jobs created DISABLED (enable with: ENABLE_JOBS=1 bash setup-linux.sh, or 'openclaw cron enable <id>')"; fi
note "Math Practice is NOT created: it needs your exact 32-module syllabus first"

# ------------------------------------------------------------------ 14. optional repo
if [[ "$CLONE_REPO" == "1" ]]; then
  step "14. Clone repo"
  if [[ -d "$HOME/Projects/wonder-bites/.git" ]]; then say "already cloned"
  else mkdir -p "$HOME/Projects" && git clone https://github.com/shad-ct/wonder-bites "$HOME/Projects/wonder-bites" && note "repo cloned" || warn "git clone failed (private repo? run 'gh auth login' or set up an SSH key)"; fi
fi

# ------------------------------------------------------------------ done
print_summary
(( NEED_REBOOT )) && echo "REBOOT NOW (new GPU driver), then run this script again."
echo
echo "Next steps:"
echo "  1. openclaw cron list                      # confirm every job appears once"
echo "  2. Test ONE job before enabling anything:  openclaw cron run <job-id>   then check the site"
echo "  3. Local 4B models are slow at agent work; consider JOB_MODEL=<stronger model> for the real schedule"
echo "  4. Open a NEW terminal so the PATH change from ~/.profile applies"
