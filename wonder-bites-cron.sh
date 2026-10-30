#!/usr/bin/env bash
# Wonder Bites -> OpenClaw cron setup (v2)
# RUN WITH:  bash wonder-bites-cron.sh <inspect|jobs|warmups>
# DO NOT `source` it (set -e / exit would kill your terminal).
#
#   bash wonder-bites-cron.sh inspect            # read-only checks
#   bash wonder-bites-cron.sh jobs               # DRY RUN of content jobs
#   APPLY=1 bash wonder-bites-cron.sh jobs       # create content jobs
#   bash wonder-bites-cron.sh warmups            # DRY RUN of warm-ups
#   APPLY=1 bash wonder-bites-cron.sh warmups    # create warm-ups

if (return 0 2>/dev/null); then
  echo "Don't source this file. Run: bash wonder-bites-cron.sh <inspect|jobs|warmups>"
  return 1
fi
set -uo pipefail

TZ_NAME="Asia/Kolkata"
AGENT="coordinator"
# Leave MODEL empty to inherit the coordinator agent's configured model
# (the old jaahas/qwen3-abliterated:4b is NOT installed). To force one:
#   MODEL="ollama/qwen3:4b" bash wonder-bites-cron.sh jobs
MODEL="${MODEL:-}"
API="https://wonder-bites-api.onrender.com/readyz"
APPLY="${APPLY:-0}"
AGENT_TIMEOUT=1200   # seconds; research + publish on a small local model is slow

MODEL_ARGS=()
[[ -n "$MODEL" ]] && MODEL_ARGS=(--model "$MODEL")

read -r -d '' COMMON <<'EOF' || true
You are the Wonder Bites coordinator. Follow this sequence every run:
1) Use Wonder Bites MCP tools to list recent entries in this category and check whether today's/this week's entry already exists. If it does, skip safely.
2) Research with real sources. Open each source; never invent facts, quotes, URLs, DOIs, APIs or papers.
3) Draft in the exact format below. Use short paragraphs and headings. Math in LaTeX.
4) Review: facts, sources, dates, completeness, no duplicate of recent entries.
5) Publish ONCE via Wonder Bites MCP with category, tags and source references. Never put tokens or logs in content.
6) Retrieve the created entry and confirm title/category/content. If publish fails or times out, check the platform before retrying (max 2 retries).
If anything cannot be verified, do NOT publish; report the skip reason instead.
Timezone: Asia/Kolkata.

WORKFLOW:
EOF

add_job () {  # name | key | cron | prompt
  local name="$1" key="$2" cron="$3" prompt="$4"
  if openclaw cron list 2>/dev/null | grep -qF "$name"; then
    echo "SKIP (name already in cron list): $name"
    echo "     -> if that is the old UI-created job, disable/remove it first, then re-run."
    return
  fi
  local cmd=(openclaw cron add
    --name "$name" --declaration-key "$key"
    --agent "$AGENT" --session isolated
    --cron "$cron" --tz "$TZ_NAME" --exact
    "${MODEL_ARGS[@]}"
    --thinking low --no-deliver
    --timeout-seconds "$AGENT_TIMEOUT"
    --message "${COMMON}
${prompt}")
  if [[ "$APPLY" == "1" ]]; then
    if "${cmd[@]}"; then echo "CREATED: $name"; else echo "FAILED:  $name"; fi
  else
    echo "DRY-RUN: $name  [$cron $TZ_NAME]"
  fi
}

jobs () {
add_job "Facts & Quotes" wb-facts-quotes "0 7 * * *" \
"Facts & Quotes. Publish ONE entry: exactly 5 verified facts from varied fields (each: Fact, Why it matters, Source with URL) and exactly 5 quotes whose exact wording and attribution are verified against a primary/traceable source (each: quote, author, Context, Source). Then 3-5 open reflection questions and a one-minute takeaway. If a quote's attribution is unverifiable, replace it."

add_job "Concept of the Day" wb-concept "0 8 * * *" \
"Concept of the Day. Rotate domain among Mathematics, Physics, Computer Science, Biology (check recent entries, keep balance). Sections: Domain/Difficulty/Prerequisites; 1 idea in one sentence; 2 intuitive explanation; 3 how it works; 4 worked example or analogy; 5 where it is used (2-3); 6 common misconception; 7 check-your-understanding question with answer; 8 sources."

add_job "Mind Signal" wb-mind-signal "30 8 * * *" \
"Mind Signal. Rotate Philosophy / Psychology / Thought Experiment. Sections: Category + core question; 1 the idea; 2 the scenario; 3 think-before-reading pause; 4 analysis with objections; 5 real-world connection; 6 2-4 reflection questions; 7 balanced takeaway; 8 sources. No diagnoses, no single-study universal claims, no paraphrase presented as direct quote."

add_job "Daily Random Project Ideas" wb-project-ideas "0 9 * * *" \
"Daily Project Ideas. Publish exactly FIVE feasible, distinct ideas across varied categories (web/mobile, AI/ML, dev tools, automation, embedded/IoT, data, education, accessibility). Each: Problem, Proposed solution, Target users, Core features, Suggested stack/components, Difficulty, Scope, MVP, Stretch feature, Why worth building, References (real docs/repos/datasheets only). End with 'Pick of the day' and why. Check existing tools and that every API/component actually exists."

add_job "Weekly Coding Challenge" wb-coding-challenge "30 9 * * 1" \
"Weekly Coding Challenge (Monday). Read previous challenges and any learner feedback; if none, use beginner-to-intermediate. Adapt difficulty by feedback only. Rotate topic family. Format: Difficulty/Topic/Estimated time/Prerequisites; Problem; Input format; Output format; Constraints; at least 2 examples you have manually traced; 3 progressive hints; What this tests; Feedback request (solved?, difficulty, hints, time, confusion). Put the solution in a clearly labelled separate section (algorithm, correctness, time/space, reference code, edge cases)."

add_job "Sunday Project Roundup" wb-project-roundup "30 9 * * 0" \
"Weekly Project Ideas Roundup (Sunday). Use ONLY the week's already-published daily ideas; do not invent new ones. Sections: five strongest ideas (name, date, problem, main challenge, difficulty, why chosen); category distribution; best beginner project; most technically challenging; recommended project of the week (MVP scope, 3 milestones, dependencies, risks, success criterion); reflection question."

add_job "Science Signal" wb-science-signal "0 10 * * *" \
"Science Signal. Find a genuinely recent development (prefer last 7 days, widen to 30; label older items as background). Inspect the primary source (paper, mission/observatory release) plus one independent source for big claims. Label research status (peer-reviewed / preprint / mission update / press release). Sections: What happened; How it works; Why it matters; What is genuinely new; What remains uncertain; A concept to understand; Sources (primary first); Think about it. Record publication date vs event date."

echo
echo "NOT CREATED: Math Practice (11:00 daily). Blocked until the exact 32-module syllabus file is located and progress tracking exists."
}

warmups () {
  local t mm hh name cron
  for t in "58 6" "58 7" "28 8" "58 8" "58 9" "58 10"; do
    mm="${t% *}"; hh="${t#* }"
    name="Warmup ${hh}:${mm}"
    cron="${mm} ${hh} * * *"
    if openclaw cron list 2>/dev/null | grep -qF "$name"; then echo "SKIP: $name"; continue; fi
    if [[ "$APPLY" == "1" ]]; then
      # --max-time 60: Render cold starts exceed 20s, so wait long enough to actually wake it
      if openclaw cron add --name "$name" --declaration-key "wb-warm-${hh}-${mm}" \
          --cron "$cron" --tz "$TZ_NAME" --exact --timeout-seconds 90 \
          --command "curl -fsS --max-time 60 $API"; then echo "CREATED: $name"; else echo "FAILED:  $name"; fi
    else
      echo "DRY-RUN: $name [$cron $TZ_NAME]"
    fi
  done
}

case "${1:-}" in
  inspect)
    echo "== cron status ==";  openclaw cron status || true
    echo; echo "== existing jobs =="; openclaw cron list || true
    echo; echo "== cron subcommands (look for rm/edit/disable) =="; openclaw cron --help || true
    echo; echo "== API (waits up to 90s for Render to wake) =="; curl -fsS --max-time 90 "$API" || echo "API not ready"; echo
    echo; echo "== MCP =="; openclaw mcp probe || true
    echo; echo "== installed models =="; ollama list || true
    ;;
  jobs) jobs ;;
  warmups) warmups ;;
  *) echo "usage: bash $0 {inspect|jobs|warmups}"; exit 1 ;;
esac
