#!/bin/bash
# Usage: bash deploy/set-domain.sh yourname
# Replaces YOURNAME with your DuckDNS name in all config files.
set -e
[ -z "$1" ] && { echo "Usage: bash deploy/set-domain.sh yourname"; exit 1; }
cd "$(dirname "$0")/.."
grep -rl "YOURNAME" --exclude=set-domain.sh --exclude-dir=node_modules . | xargs sed -i "s/YOURNAME/$1/g"
[ -f .env ] || cp .env.example .env
echo "Done. Domains:"
echo "  https://$1.duckdns.org"
echo "  https://$1-backend.duckdns.org"
echo "  https://$1-api.duckdns.org"
