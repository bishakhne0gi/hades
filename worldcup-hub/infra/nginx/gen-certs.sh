#!/usr/bin/env bash
# Author: Bishakh
# Generate a self-signed cert for local TLS termination (dev only).
set -euo pipefail
DIR="$(dirname "$0")/certs"
mkdir -p "$DIR"
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$DIR/dev.key" -out "$DIR/dev.crt" \
  -subj "/C=IN/ST=Dev/L=Dev/O=WorldCupHub/CN=localhost"
echo "Wrote $DIR/dev.crt and $DIR/dev.key"
