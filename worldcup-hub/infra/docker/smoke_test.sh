#!/usr/bin/env bash
# Author: Bishakh
set -euo pipefail

echo "Waiting for core-api..."
for i in {1..30}; do
  if curl -sf http://localhost:8000/health > /dev/null; then break; fi
  sleep 2
done

curl -sf http://localhost:8000/health | grep -q '"status":"ok"'
curl -sf http://localhost:9000/health | grep -q '"status":"ok"'

# Create a team and read it back
curl -sf -X POST http://localhost:8000/teams \
  -H 'Content-Type: application/json' \
  -d '{"name":"Argentina","code":"ARG","group":"A"}' | grep -q '"code":"ARG"'

curl -sf http://localhost:8000/teams | grep -q 'Argentina'

# Simulator returns a kickoff event
curl -sf "http://localhost:9000/matches/1/events?seed=42" | grep -q '"kickoff"'

echo "SMOKE TEST PASSED"
