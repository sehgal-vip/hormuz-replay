#!/bin/zsh
# Fetch and trim adsb.lol daily archives (YYYY.MM.DD) to the Middle East.
# Resumable: each archive part is downloaded to data/raw with curl -C - and
# retried until its size matches GitHub's, so a dropped connection costs
# seconds, not the whole day. The extractor then verifies the byte count too.
#   ./scripts/fetch_flights.sh 2026.02.28 2026.03.01
cd "$(dirname "$0")/.."
mkdir -p data/flights data/raw logs
for d in "$@"; do
  out="data/flights/${d//./-}.jsonl.gz"
  [ -f "$out.done" ] && { echo "skip $d"; continue; }
  rel="v$d-planes-readsb-prod-0"
  sizes=$(curl -s "https://api.github.com/repos/adsblol/globe_history_2026/releases/tags/$rel" \
    | python3 -c "import sys,json;print(' '.join(f\"{a['name']}={a['size']}\" for a in json.load(sys.stdin)['assets']))")
  [ -z "$sizes" ] && { echo "FAILED $d (no release info)"; continue; }
  echo "start $d $(date -u +%H:%M:%S)"
  total=0; ok=1
  for item in ${=sizes}; do
    name=${item%%=*}; want=${item##*=}; total=$((total+want)); f="data/raw/$name"
    tries=0
    while [ "$(stat -f %z "$f" 2>/dev/null || echo 0)" -lt "$want" ] && [ $tries -lt 200 ]; do
      curl -sL -C - --connect-timeout 30 --speed-limit 20000 --speed-time 60 -o "$f" \
        "https://github.com/adsblol/globe_history_2026/releases/download/$rel/$name"
      tries=$((tries+1))
    done
    [ "$(stat -f %z "$f" 2>/dev/null || echo 0)" -eq "$want" ] || ok=0
  done
  if [ $ok -eq 1 ] && cat data/raw/$rel.tar.* | uv run -q scripts/extract_flights.py "${d//./-}" "$out.part" "$total" 2>>logs/flights.log; then
    mv "$out.part" "$out" && touch "$out.done" && rm -f data/raw/$rel.tar.*
    echo "ok $d $(du -h "$out" | cut -f1) $(date -u +%H:%M:%S)"
  else
    echo "FAILED $d (see logs/flights.log)"
  fi
done
echo "ALL DONE $(date -u +%H:%M:%S)"
